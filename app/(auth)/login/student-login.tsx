"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import {
  GENERIC_DETAILS_MISMATCH,
  INSTITUTE_NOT_READY,
  INVALID_CODE_MESSAGE,
  isCompleteCode,
  rememberInstitute,
} from "@/lib/auth-flow";
import type { PublicInstitute } from "@/lib/types";
import { CodeInput } from "@/components/auth/code-input";
import { Countdown, FormError, StepActions } from "@/components/auth/countdown";
import { Shake } from "@/components/motion/Shake";
import { StepTransition } from "@/components/motion/StepTransition";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

/**
 * Student sign-in: one question per step.
 *
 * Code, then ID, then password — never all three at once. The three belong to
 * different people: the code is on the poster, the ID is on the student's own
 * record, and the password is the only one they invented. Asking for them together
 * puts three blanks on a phone screen and invites the wrong one to be typed into
 * the wrong box, and on a mistyped code the person has no way of telling which
 * field was wrong.
 *
 * The state machine is typed and explicit rather than a set of booleans, because
 * "which question am I on" and "where do I go back to" are the same fact here and
 * one variable cannot be wrong independently of the other.
 */

type Step = "code" | "loginId" | "password";

/** Where a remembered or `?code=` code takes us. */
const START: Step = "code";

export function StudentLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const initialCode = (params.get("code") ?? "").toUpperCase();

  const [step, setStep] = useState<Step>(START);
  const [code, setCode] = useState(initialCode);
  const [institute, setInstitute] = useState<PublicInstitute | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(0);

  /**
   * Which way the next step came in.
   *
   * Set in `goTo` rather than derived during render: the step order is a fact
   * about the transition, not about the step currently on screen, and a ref read
   * during render is exactly the kind of thing that makes a component's output
   * depend on something React cannot see.
   */
  const [direction, setDirection] = useState<1 | -1>(1);
  function goTo(next: Step) {
    setDirection(stepOrder(next) >= stepOrder(step) ? 1 : -1);
    setStep(next);
  }

  /**
   * Turn a code into an institute.
   *
   * A code that is refused and a code that does not exist get the same sentence on
   * purpose: this is not a question anybody should be able to use to find out which
   * institutes exist. An institute that has not finished setup is a different case
   * — the code is real and the answer is about them, not about the person asking.
   */
  async function lookUp(value: string) {
    setPending(true);
    setError(null);
    setInvalid(false);
    try {
      const found = await api().publicInstitute(value);
      if (!found.ready) {
        setError(INSTITUTE_NOT_READY);
        setInvalid(true);
        setInstitute(null);
        return;
      }
      setInstitute(found);
      // Remembered so /welcome can offer "continue to {institute}" next time. The
      // name is only a label; the code is what identifies them.
      rememberInstitute(value, found.name);
      goTo("loginId");
    } catch {
      setInstitute(null);
      setError(INVALID_CODE_MESSAGE);
      setInvalid(true);
    } finally {
      setPending(false);
    }
  }

  // A code arriving in the URL is used without being typed, so look the institute
  // up and step straight past the question it answers.
  const lookedUp = useRef<string | null>(null);
  useEffect(() => {
    if (!isCompleteCode(initialCode) || lookedUp.current === initialCode) return;
    lookedUp.current = initialCode;
    void lookUp(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);


  async function submit() {
    if (pending || wait > 0) return;
    setPending(true);
    setError(null);
    try {
      await api().loginStudent(code, loginId.trim(), password);
      router.replace("/me");
    } catch (err) {
      setInvalid(true);
      if (err instanceof ApiError && err.status === 429 && err.retryAfterSeconds) {
        setWait(err.retryAfterSeconds);
        setError("Too many attempts. Try again when the timer is up.");
      } else {
        // Whatever the service said, shown verbatim. That matters more than it
        // looks: the service answers every student sign-in failure with one
        // sentence, and a client that invented its own wording could reintroduce
        // the difference between "no such id" and "wrong password" that the
        // service is careful to erase. The constant below is only a fallback for
        // the case where there is no message at all.
        setError(
          err instanceof Error && err.message ? err.message : GENERIC_DETAILS_MISMATCH,
        );
        setPassword("");
        goTo("password");
      }
      setPending(false);
    }
  }

  function back() {
    setError(null);
    setInvalid(false);
    if (step === "password") goTo("loginId");
    else if (step === "loginId") {
      setInstitute(null);
      setLoginId("");
      goTo("code");
    }
  }

  const blocked = wait > 0;
  const label = institute?.loginLabel ?? "Login ID";

  return (
    <>
      {step !== "code" && (
        <div className="-mt-3 mb-4">
          <button
            type="button"
            onClick={back}
            className="rounded text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            &larr; Back
          </button>
        </div>
      )}
      <StepTransition stepKey={step} direction={direction} focusHeading minHeight={300}>
        {step === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isCompleteCode(code)) void lookUp(code);
            }}
          >
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Ask your institute for the six-character code on its poster.
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
                disabled={pending || blocked}
                onComplete={(value) => void lookUp(value)}
              />
            </div>
            <div className="mt-6">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={pending}
                disabled={!isCompleteCode(code) || blocked}
              >
                Continue
              </Button>
            </div>
          </form>
        )}

        {step === "loginId" && institute && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (loginId.trim()) {
                setError(null);
                goTo("password");
              }
            }}
          >
            <Field
              label={label}
              htmlFor="student-login-id"
              hint="The ID your institute has on your record."
            >
              <Input
                id="student-login-id"
                value={loginId}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                onChange={(e) => setLoginId(e.target.value)}
              />
            </Field>
            <div className="mt-5">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!loginId.trim()}
              >
                Continue
              </Button>
            </div>
            <p className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={back}
                className="rounded font-medium text-primary underline-offset-4 hover:underline"
              >
                Not your institute? Change
              </button>
            </p>
          </form>
        )}

        {step === "password" && institute && (
          <Shake trigger={invalid}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Field label="Password" htmlFor="student-password">
                <Input
                  id="student-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setInvalid(false);
                  }}
                />
              </Field>

              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {show ? "Hide password" : "Show password"}
              </button>

              <div className="mt-3">
                <FormError message={error} />
              </div>

              {wait > 0 && (
                <p className="mb-3 text-sm text-warning" aria-live="polite">
                  Try again in <Countdown seconds={wait} onDone={() => setWait(0)} />
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={pending}
                disabled={blocked || password.length < MIN_PASSWORD_LENGTH}
              >
                Sign in
              </Button>

              <StepActions className="mt-3">
                <Button type="button" variant="ghost" onClick={back}>
                  Back
                </Button>
              </StepActions>
            </form>
          </Shake>
        )}
      </StepTransition>
    </>
  );
}

function stepOrder(step: Step): number {
  return step === "code" ? 0 : step === "loginId" ? 1 : 2;
}

