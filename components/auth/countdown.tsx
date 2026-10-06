"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { tween } from "@/lib/motion";

/**
 * A countdown that is still true when it is not being looked at.
 *
 * Used wherever the service says "wait N seconds": a rate-limited sign-in, and a
 * locked student account. Both need a number a person can watch down rather than a
 * sentence, because the only thing they can usefully do is wait — and a timer that
 * stops at zero while the tab is in the background, then lets them try again and
 * fail, is worse than no timer at all.
 *
 * So the deadline is an absolute timestamp and every tick recomputes from it: a
 * tick that finds the tab has been asleep simply catches up. The countdown never
 * goes below zero and never shows a negative second.
 *
 * Starting a *different* countdown means a different `key`, not a changed prop.
 * Resetting from inside an effect would be a synchronous `setState` during render
 * — the thing that causes cascading renders — and a key gives a clean mount for
 * the new deadline instead.
 */
export function Countdown({
  seconds,
  onDone,
  className,
  format = "clock",
}: {
  /** How long to wait, in seconds. Re-key this component to restart the countdown. */
  seconds: number;
  onDone?: () => void;
  className?: string;
  /** `clock` is `2:05`; `both` also reads it out for a screen reader. */
  format?: "clock" | "both";
}) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil(seconds)));
  const done = useRef(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const deadline = Date.now() + seconds * 1000;
    done.current = false;

    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !done.current) {
        done.current = true;
        window.clearInterval(timer);
        onDone?.();
      }
    }, 250);
    return () => window.clearInterval(timer);
    // `onDone` is deliberately not a dependency: a caller passing an inline arrow
    // would otherwise tear down and restart the interval on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  if (remaining <= 0) return null;
  return <span className={cn("tabular-nums", className)}>{formatClock(remaining, format)}</span>;
}

export function formatClock(totalSeconds: number, format: "clock" | "both" = "clock"): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const clock = `${mins}:${String(secs).padStart(2, "0")}`;
  if (format === "clock") return clock;
  const words: string[] = [];
  if (mins) words.push(`${mins} minute${mins === 1 ? "" : "s"}`);
  if (secs || !mins) words.push(`${secs} second${secs === 1 ? "" : "s"}`);
  return `${clock} (${words.join(" ")})`;
}

/**
 * The inline error line under a form, with the live region.
 *
 * Every entry screen needs one, and the announcement behaviour has to be right:
 * the region is always in the DOM and empty when there is no error, so *adding* a
 * message is what a screen reader announces. Rendering the region only when there
 * is an error announces nothing, because there was nothing to observe.
 */
export function FormError({ message, className }: { message: string | null; className?: string }) {
  return (
    <div aria-live="polite" className={cn("min-h-[20px]", className)}>
      {message && (
        <m.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tween.tick}
          className="text-sm text-danger"
        >
          {message}
        </m.p>
      )}
    </div>
  );
}

/** Secondary actions in a step, stacked on a phone and in a row above it. */
export function StepActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}