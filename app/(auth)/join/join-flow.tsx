"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import {
  GENERIC_DETAILS_MISMATCH,
  INSTITUTE_NOT_READY,
  INVALID_CODE_MESSAGE,
  isCompleteCode,
  normaliseCode,
  rememberInstitute,
} from "@/lib/auth-flow";
import type { ClaimDetail, PublicInstitute } from "@/lib/types";
import { AuthFrame, AuthCard, AuthFooter, AuthLink } from "@/components/auth/auth-shell";
import { CodeInput } from "@/components/auth/code-input";
import { FormError } from "@/components/auth/countdown";
import { StrengthBar } from "@/components/auth/strength-bar";
import { CheckDraw } from "@/components/motion/CheckDraw";
import { Shake } from "@/components/motion/Shake";
import { StepTransition } from "@/components/motion/StepTransition";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Field, Input } from "@/components/ui/input";

/**
 * Joining as a student: claiming the account your institute already made.
 *
 * An institute imports its roster, and a student turns a row of that roster into
 * an account. Five questions, asked one at a time:
 *
 *   1. the institute code
 *   2. your login ID
 *   3. the verification value, when the institute asks for one
 *   4. "is this you?" — and only *here* are any details shown
 *   5. a password, and agreeing to what a face template is
 *
 * Two rules in here are about privacy rather than convenience.
 *
 * **Details appear on the confirm screen and nowhere earlier.** Steps 1–3 say
 * nothing about the record at all, because until the verification value is
 * answered, nothing about it has been proven. Printing the name on step 2 would
 * confirm the ID exists to anyone standing at the same desk.
 *
 * **The claim token stays in memory.** It is a bearer credential for a half-made
 * account, and a page reload loses it deliberately. `localStorage` would let a
 * stale token be replayed days later; the service expires it in ten minutes
 * anyway, and the flow restarts at step 2 rather than pretending otherwise.
 */

type Step = "code" | "loginId" | "verify" | "confirm" | "password" | "done";

const STEP_ORDER: Step[] = ["code", "loginId", "verify", "confirm", "password", "done"];

export function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const codeFromUrl = normaliseCode(params.get("code") ?? "");

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(codeFromUrl);
  const [institute, setInstitute] = useState<PublicInstitute | null>(null);
  const [loginId, setLoginId] = useState("");
  const [verifyValue, setVerifyValue] = useState("");
  const [details, setDetails] = useState<ClaimDetail[]>([]);
  /**
   * The single-use claim token. In memory only, and never written anywhere: it is
   * a bearer credential for an account that does not exist yet, so a reload losing
   * it is the correct behaviour rather than an inconvenience. Expiry is detected
   * by the service refusing it, not by a timer here — a local clock is not
   * something to decide on whether a credential is still good.
   */
  const [claimToken, setClaimToken] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);


  function goTo(next: Step) {
    setDirection(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  /** Clear whatever failed, then move. */
  function advance(next: Step) {
    setError(null);
    setInvalid(false);
    goTo(next);
  }

  // ------------------------------------------------------------------ code
  async function lookUpCode(value: string) {
    setPending(true);
    setError(null);
    setInvalid(false);
    try {
      const found = await api().publicInstitute(value);
      if (!found.ready) {
        setInstitute(found);
        setError(INSTITUTE_NOT_READY);
        setInvalid(true);
        return;
      }
      setInstitute(found);
      rememberInstitute(value, found.name);
      // No verification column means no question 3 — an institute that does not
      // ask for one should not be made to show an empty field and call it a step.
      advance(found.verifyLabel ? "loginId" : "loginId");
    } catch {
      setInstitute(null);
      setError(INVALID_CODE_MESSAGE);
      setInvalid(true);
    } finally {
      setPending(false);
    }
  }

  // ------------------------------------------------------- verify + confirm
  async function verify() {
    setPending(true);
    setError(null);
    setInvalid(false);
    try {
      const result = await api().claimVerify({
        code,
        loginId: loginId.trim(),
        // Only sent when the institute asks for one. Sending an empty string when
        // there is nothing to verify would be a different request from sending
        // nothing, so it is omitted rather than blanked.
        ...(institute?.verifyLabel ? { verifyValue: verifyValue.trim() } : {}),
      });
      setClaimToken(result.claimToken);
      setDetails(result.details ?? []);
      advance("confirm");
    } catch (err) {
      setInvalid(true);
      // The service's own sentence, verbatim, for the same reason as sign-in: it
      // refuses unknown id, wrong institute and wrong verification value with one
      // answer, and the client must not reintroduce a difference between them.
      setError(
        err instanceof ApiError && err.status === 429 && err.retryAfterSeconds
          ? "Too many attempts. Wait a moment and try again."
          : err instanceof Error && err.message
            ? err.message
            : GENERIC_DETAILS_MISMATCH,
      );
    } finally {
      setPending(false);
    }
  }

  // -------------------------------------------------------- password + done
  async function complete() {
    setPending(true);
    setError(null);
    try {
      await api().claimComplete({
        claimToken,
        password,
        acceptConsent: consent,
      });
      advance("done");
      // Long enough for the check to read as a moment rather than a flash.
      window.setTimeout(() => router.replace("/me"), 1400);
    } catch (err) {
      setInvalid(true);
      if (err instanceof ApiError && err.status === 401) {
        // The claim token expired while the person was typing a password. Go back
        // to the question that earns a token rather than leaving them to retry a
        // button that can only fail.
        setClaimToken("");
        setPassword("");
        setConsent(false);
        setError("That claim expired before it was finished. Let's check your ID again.");
        goTo("loginId");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("That account has already been claimed. Sign in instead.");
      } else {
        setError(err instanceof Error && err.message ? err.message : "That did not work.");
      }
    } finally {
      setPending(false);
    }
  }

  // ------------------------------------------------------------ back handling
  function back() {
    setError(null);
    setInvalid(false);
    switch (step) {
      case "code":
        router.replace("/welcome");
        break;
      case "loginId":
        setInstitute(null);
        goTo("code");
        break;
      case "verify":
        goTo("loginId");
        break;
      case "confirm":
        goTo(institute?.verifyLabel ? "verify" : "loginId");
        break;
      case "password":
        goTo("confirm");
        break;
      default:
        break;
    }
  }

  // A code in the URL is used without being typed.
  const autoCode = useRef(false);
  useEffect(() => {
    if (!isCompleteCode(codeFromUrl) || autoCode.current) return;
    autoCode.current = true;
    void lookUpCode(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  const verifyLabel = institute?.verifyLabel ?? null;

  const title: Record<Step, string> = {
    code: "Join your institute",
    loginId: "Your ID",
    verify: verifyLabel ?? "Verify",
    confirm: "Is this you?",
    password: "Create a password",
    done: "You\u2019re in",
  };

  if (institute && !institute.ready && step === "code") {
    return (
      <AuthFrame>
        <AuthCard title="Not quite yet" subtitle={institute.name}>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="This institute isn't accepting students yet"
            message="They have to finish setting up before anyone can join. Try again shortly."
            action={
              <Button variant="outline" onClick={() => router.replace("/welcome")}>
                Back
              </Button>
            }
          />
        </AuthCard>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      onBack={step === "done" ? undefined : back}
      footer={
        <AuthFooter>
          <p>
            Already claimed? <AuthLink href="/login?tab=student">Sign in</AuthLink>
          </p>
        </AuthFooter>
      }
    >
      <AuthCard title={title[step]} subtitle={institute?.name || undefined}>
        <StepTransition stepKey={step} direction={direction} focusHeading minHeight={330}>
          {/* ------------------------------------------------------ 1. code */}
          {step === "code" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isCompleteCode(code)) void lookUpCode(code);
              }}
            >
              <p className="text-center text-sm text-muted-foreground">
                Enter the six-character code from your institute.
              </p>
              <CodeInput
                className="mt-5"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) {
                    setError(null);
                    setInvalid(false);
                  }
                }}
                invalid={invalid}
                disabled={pending}
                onComplete={(value) => void lookUpCode(value)}
              />
              <div className="mt-6">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={pending}
                  disabled={!isCompleteCode(code)}
                >
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* -------------------------------------------------- 2. login ID */}
          {step === "loginId" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!loginId.trim()) return;
                if (verifyLabel) advance("verify");
                else void verify();
              }}
            >
              <Field
                label={institute?.loginLabel ?? "Login ID"}
                htmlFor="join-login-id"
                hint="The ID your institute has on your record."
              >
                <Input
                  id="join-login-id"
                  value={loginId}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </Field>
              <div className="mt-5">
                <Button type="submit" size="lg" className="w-full" disabled={!loginId.trim()}>
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------- 3. verify */}
          {step === "verify" && verifyLabel && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <Field
                label={verifyLabel}
                htmlFor="join-verify"
                hint="Your institute holds this. It's checked here and never shown again."
              >
                <Input
                  id="join-verify"
                  value={verifyValue}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  onChange={(e) => setVerifyValue(e.target.value)}
                />
              </Field>
              <div className="mt-4">
                <FormError message={error} />
              </div>
              <div className="mt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={pending}
                  disabled={!verifyValue.trim()}
                >
                  Check
                </Button>
              </div>
            </form>
          )}

          {/* --------------------------------------------------- 4. confirm */}
          {step === "confirm" && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                Check these are your details. Nothing is created yet.
              </p>
              <dl className="divide-y divide-border rounded-xl border border-border">
                {details.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Your institute did not add any details to show.
                  </p>
                )}
                {details.map((row) => (
                  <div key={row.label} className="flex items-baseline gap-3 px-4 py-2.5">
                    <dt className="w-32 shrink-0 text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <FormError message={error} />
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => advance(verifyLabel ? "verify" : "loginId")}
                  disabled={pending}
                >
                  Not me
                </Button>
                <Button className="flex-1" size="lg" onClick={() => advance("password")}>
                  That&rsquo;s me
                </Button>
              </div>
            </div>
          )}

          {/* --------------------------------------------------- 5. password */}
          {step === "password" && (
            <Shake trigger={invalid}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void complete();
                }}
              >
                <Field label="Password" htmlFor="join-password">
                  <Input
                    id="join-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setInvalid(false);
                    }}
                  />
                </Field>
                <StrengthBar password={password} className="mt-2" />

                <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      setInvalid(false);
                    }}
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <span>
                    I understand FaceTrack stores a numeric template of my face so it can
                    recognise me, and never a photograph.
                  </span>
                </label>

                <div className="mt-3">
                  <FormError message={error} />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="mt-2 w-full"
                  loading={pending}
                  disabled={password.length < MIN_PASSWORD_LENGTH || !consent}
                >
                  Create my account
                </Button>
              </form>
            </Shake>
          )}

          {/* ------------------------------------------------------ 6. done */}
          {step === "done" && (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckDraw />
              <p className="mt-4 text-[15px] font-medium">Your account is ready</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Taking you to your attendance&hellip;
              </p>
            </div>
          )}
        </StepTransition>
      </AuthCard>
    </AuthFrame>
  );
}