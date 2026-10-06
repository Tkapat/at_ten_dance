"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring, tween } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

/**
 * How much of a password this is, as four segments.
 *
 * The service's own rule is deliberately thin — eight characters, no padding at
 * the ends — because a stricter one locks people out of a school account they are
 * assigned rather than chosen. So this bar is guidance, not a gate: it never
 * refuses, and the copy says what would make it stronger rather than scolding.
 *
 * It is deliberately not a zxcvbn-style score. The honest version of "strong" here
 * is length plus variety, which is what this counts.
 */

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

export type Strength = 0 | 1 | 2 | 3 | 4;

export function scorePassword(password: string): Strength {
  if (!password) return 0;
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  // Length is the single biggest factor, so it carries two of the four steps.
  let score: number = password.length >= 16 ? 2 : password.length >= 12 ? 1 : 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  return Math.min(4, score) as Strength;
}

/** The one concrete improvement worth making, or null when there is none. */
export function nextStep(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `At least ${MIN_PASSWORD_LENGTH} characters — ${MIN_PASSWORD_LENGTH - password.length} to go.`;
  }
  const missing: string[] = [];
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) missing.push("mix of upper and lower case");
  if (!/\d/.test(password)) missing.push("a number");
  if (!/[^\w\s]/.test(password)) missing.push("a symbol");
  if (password.length < 12) missing.push("a few more characters");
  if (password.length > 64) return "That password is very long — consider something shorter.";
  if (!missing.length) return null;
  return `Try adding ${missing.slice(0, 2).join(" and ")}.`;
}

const SEGMENT_TONES = [
  "bg-border",
  "bg-danger",
  "bg-warning",
  "bg-primary",
  "bg-success",
] as const;

export function StrengthBar({
  password,
  className,
  showHint = true,
}: {
  password: string;
  className?: string;
  /** Off where the form is dense and the words would crowd the field. */
  showHint?: boolean;
}) {
  const mpref = useMotionPref();
  const score = scorePassword(password);
  const hint = nextStep(password);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <m.span
            key={step}
            className={cn("h-1 flex-1 rounded-full", SEGMENT_TONES[score])}
            initial={false}
            animate={{ opacity: score >= step ? 1 : 0.25 }}
            transition={
              score >= step ? (mpref.reduced ? tween.instant : spring.pop) : tween.tick
            }
          />
        ))}
      </div>
      {/* Announced, not just coloured: the bar alone says nothing to a screen
          reader, and colour alone says nothing to a colourblind person. */}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {password ? (
          <>
            <span className="font-medium text-foreground">{LABELS[score]}</span>
            {showHint && hint ? <span className="ml-1">{hint}</span> : null}
          </>
        ) : (
          `At least ${MIN_PASSWORD_LENGTH} characters.`
        )}
      </p>
    </div>
  );
}

