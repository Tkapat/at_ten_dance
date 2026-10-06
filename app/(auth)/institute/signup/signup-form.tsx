"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { AuthFrame, AuthCard, AuthFooter, AuthLink } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/countdown";
import { StrengthBar } from "@/components/auth/strength-bar";
import { StepTransition } from "@/components/motion/StepTransition";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

/**
 * Creating an institute, in two questions.
 *
 * There is no Excel here, deliberately. The first version of this product required
 * a structure file and a roster before anything worked, which put the upload
 * screens in front of the first thing anybody should have seen. So the account
 * comes first and the imports come after, from a setup checklist the owner lands
 * on with a code already in hand.
 *
 * Validation runs on blur rather than on every keystroke. Nobody wants to be told
 * their email address is invalid while they are still typing the domain, and the
 * alternative — no message until submit — means finding out about a typo after
 * filling in everything else.
 */

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const instituteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(120, "That name is too long."),
  city: z.string().trim().max(80, "That is too long."),
  state: z.string().trim().max(80, "That is too long."),
});

const adminSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .refine((v) => v === v.trim(), "Remove the leading or trailing spaces."),
  // A boolean that must be true: the box is a promise about storing face
  // templates, and agreeing to that is not something to infer from a form that was
  // submitted.
  acceptTerms: z.boolean().refine((v) => v === true, "You have to accept the terms to continue."),
});

type Step = "institute" | "admin";

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("institute");
  const [direction, setDirection] = useState<1 | -1>(1);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  /** Only the fields that have been left at least once are shown an error. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  const instituteResult = instituteSchema.safeParse({ name, city, state });
  const adminResult = adminSchema.safeParse({ email, password, acceptTerms });

  const instituteErrors = instituteResult.success
    ? {}
    : Object.fromEntries(
        instituteResult.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
  const adminErrors = adminResult.success
    ? {}
    : Object.fromEntries(
        adminResult.error.issues.map((i) => [String(i.path[0]), i.message]),
      );

  function blur(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function next() {
    // Every field in this step is validated on the way out, whether or not it has
    // been blurred: pressing Continue is a statement that the step is finished.
    setTouched({ name: true, city: true, state: true });
    if (!instituteResult.success) return;
    setDirection(1);
    setStep("admin");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true, acceptTerms: true });
    if (!adminResult.success || pending) return;
    setPending(true);
    setError(null);
    setEmailTaken(false);
    try {
      await api().signupInstitute({
        institute: { name: name.trim(), city: city.trim() || null, state: state.trim() || null },
        admin: { email: email.trim().toLowerCase(), password },
        acceptTerms: true,
      });
      // The cookie is already set, so the code screen can read the session and
      // survive a refresh. It is where the code is revealed, and it is the only
      // place the code is ever shown.
      router.replace("/institute/signup/code");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The service says this address already has an account. Saying so is the
        // useful answer here: this is somebody signing themselves up as an owner,
        // not probing for whether a stranger's account exists.
        setEmailTaken(true);
        setError("That email already has an account. Sign in instead.");
      } else {
        setError(
          err instanceof Error && err.message ? err.message : "Could not create the account.",
        );
      }
      setPending(false);
    }
  }

  return (
    <AuthFrame
      width="wide"
      onBack={step === "admin" ? () => { setDirection(-1); setStep("institute"); } : undefined}
      footer={
        <AuthFooter>
          <p>
            Already have an account? <AuthLink href="/login?tab=institute">Sign in</AuthLink>
          </p>
        </AuthFooter>
      }
    >
      <AuthCard title="Create your institute" subtitle="Two minutes, and you can start importing students.">
        <StepTransition stepKey={step} direction={direction} focusHeading minHeight={330}>
          {step === "institute" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              className="space-y-4"
              noValidate
            >
              <Field
                label="Institute name"
                htmlFor="inst-name"
                error={touched.name ? instituteErrors.name : undefined}
              >
                <Input
                  id="inst-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => blur("name")}
                  placeholder="Sunrise Institute of Technology"
                  autoFocus
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  htmlFor="inst-city"
                  error={touched.city ? instituteErrors.city : undefined}
                >
                  <Input
                    id="inst-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={() => blur("city")}
                    placeholder="Pune"
                  />
                </Field>
                <Field
                  label="State"
                  htmlFor="inst-state"
                  error={touched.state ? instituteErrors.state : undefined}
                >
                  <Select
                    id="inst-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    onBlur={() => blur("state")}
                  >
                    <option value="">Choose…</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Button type="submit" size="lg" className="mt-2 w-full">
                Continue
              </Button>
            </form>
          )}

          {step === "admin" && (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field
                label="Your email"
                htmlFor="admin-email"
                hint="This is how you sign in. It is not shared with students."
                error={touched.email ? adminErrors.email : undefined}
              >
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTaken(false);
                  }}
                  onBlur={() => blur("email")}
                  placeholder="you@institute.edu"
                  autoFocus
                  aria-invalid={emailTaken || undefined}
                />
              </Field>

              <Field
                label="Password"
                htmlFor="admin-password"
                error={touched.password ? adminErrors.password : undefined}
              >
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTouched((prev) => ({ ...prev, password: true }));
                  }}
                  onBlur={() => blur("password")}
                />
              </Field>
              <StrengthBar password={password} />

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  onBlur={() => blur("acceptTerms")}
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                />
                <span>
                  I agree to store a numeric template of each student&rsquo;s face so it can be
                  recognised, and to never store a photograph.
                </span>
              </label>
              {touched.acceptTerms && adminErrors.acceptTerms && (
                <p role="alert" className="-mt-2 text-xs text-danger">
                  {adminErrors.acceptTerms}
                </p>
              )}

              <div className="mt-1">
                <FormError message={error} />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={pending}
                disabled={
                  emailTaken ||
                  password.length < MIN_PASSWORD_LENGTH ||
                  !acceptTerms
                }
              >
                Create institute
              </Button>
            </form>
          )}
        </StepTransition>
      </AuthCard>
    </AuthFrame>
  );
}