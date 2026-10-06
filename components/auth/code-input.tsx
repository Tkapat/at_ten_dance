"use client";

import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { tween, spring } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { CODE_LENGTH, CODE_CHARACTERS } from "@/lib/auth-flow";

/**
 * Six characters typed one at a time, from one real input.
 *
 * The tiles are what a person reads; the input is what they type into. A visible
 * six-tile grid of separate fields is unusable on a phone — six tab stops, six
 * focus rings, and no paste — so there is a single input sitting invisibly behind
 * the tiles. It keeps the caret, the keyboard, autofill and paste behaving the way
 * the platform does, and the tiles are pure presentation.
 *
 * Everything about the tiles is derived from `value`, so there is no second copy of
 * the code to fall out of step.
 */

export interface CodeInputHandle {
  focus: () => void;
  clear: () => void;
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
  label = "Institute code",
  describedBy,
  className,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired once, when the sixth character arrives. Never again for the same value. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
  describedBy?: string;
  className?: string;
  ref?: React.Ref<CodeInputHandle>;
}) {
  const { reduced } = useMotionPref();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const firedFor = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      onChange("");
      firedFor.current = null;
      inputRef.current?.focus();
    },
  }));

  // Fires at six characters and then not again until the value changes, so a
  // parent that re-renders — or a keystroke that lands on the same value — cannot
  // submit twice.
  useEffect(() => {
    if (value.length !== CODE_LENGTH) {
      if (value.length < CODE_LENGTH) firedFor.current = null;
      return;
    }
    if (firedFor.current === value) return;
    firedFor.current = value;
    onComplete?.(value);
  }, [value, onComplete]);

  const setValue = useCallback(
    (next: string) => {
      onChange(next.slice(0, CODE_LENGTH));
    },
    [onChange],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace on an empty field steps back rather than doing nothing, which is
    // what every other one-time-code field on a phone does.
    if (e.key === "Backspace" && value.length === 0) {
      e.preventDefault();
      setValue(value.slice(0, -1));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setValue(pasteCode(pasted, value));
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        role="group"
        aria-labelledby={`${inputId}-label`}
        aria-describedby={describedBy}
        className="relative"
      >
        <span id={`${inputId}-label`} className="sr-only">
          {label}
        </span>

        {/* The input is the control; the tiles below are drawn from its value. */}
        <input
          ref={inputRef}
          id={inputId}
          value={value}
          onChange={(e) => setValue(filterCode(e.target.value))}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          // The platform's own hints, kept on the real input where they are useful.
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={CODE_LENGTH}
          aria-invalid={invalid || undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent opacity-0 outline-none"
        />

        {/* Sized against a 375 px screen rather than chosen by eye: six tiles at
            40 px plus five 4 px gaps is 260 px, which leaves room inside the card's
            24 px padding and the page's 16 px on a phone. At 44 px the same row
            came to 374 px — one pixel of slack on the narrowest phone there is. */}
        <div className="pointer-events-none flex justify-center gap-1 sm:gap-2" aria-hidden>
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const ch = value[i] ?? "";
            const active = focused && i === value.length;
            const bad = invalid;
            return (
              <m.span
                key={i}
                animate={
                  bad
                    ? { y: [0, -3, 3, -2, 2, 0], borderColor: "hsl(var(--danger))" }
                    : active
                      ? { scale: 1.04 }
                      : { scale: 1 }
                }
                transition={
                  bad
                    ? { duration: reduced ? tween.instant.duration : 0.4 }
                    : active
                      ? spring.snappy
                      : tween.tick
                }
                className={cn(
                  "grid size-10 place-items-center rounded-xl border text-lg font-semibold tabular-nums sm:size-12",
                  "border-2 bg-card transition-colors",
                  ch
                    ? "border-primary text-foreground"
                    : active
                      ? "border-primary text-muted-foreground"
                      : bad
                        ? "border-destructive/40 text-muted-foreground"
                        : "border-input text-muted-foreground",
                )}
              >
                {ch}
                {active && !ch && (
                  <span className="absolute h-5 w-px animate-pulse bg-primary" />
                )}
              </m.span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Keeps only the characters a code may contain, uppercased. */
function filterCode(value: string): string {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, CODE_LENGTH);
}

/**
 * A pasted code, joined onto whatever is already there.
 *
 * Pasting the whole code into an empty field gives six characters. Pasting one
 * character into a half-filled field fills the next slot rather than replacing
 * what is there, because that is what the field feels like: six slots, in order.
 */
export function pasteCode(pasted: string, existing: string): string {
  const cleaned = filterCode(pasted);
  if (cleaned.length >= CODE_LENGTH) return cleaned;
  if (!existing) return cleaned;
  return filterCode(existing + cleaned).slice(0, CODE_LENGTH);
}

/** Used by the shell to validate as a person types, without owning the value. */
export function looksLikeCode(value: string): boolean {
  return CODE_CHARACTERS.test(value.toUpperCase());
}