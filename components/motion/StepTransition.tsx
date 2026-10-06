"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { dur, ease, distance } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";

const variants = {
  enter: (d: 1 | -1) => ({ opacity: 0, x: d * distance.step }),
  center: { opacity: 1, x: 0 },
  exit: (d: 1 | -1) => ({ opacity: 0, x: d * -distance.step }),
};

const fadeOnly = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Wizard-like step transition for login/join/signup/setup/register. `stepKey`
 * should change whenever the step changes; `direction` is +1 forward, -1 back.
 *
 * With `focusHeading`, once the incoming step settles focus moves to its heading so
 * screen readers announce the new step: target `[data-step-heading]`, else the
 * first h1/h2/h3. Skipped on the very first mount — a page load should not steal
 * focus.
 *
 * The heading is looked for inside this component first, and then in the wrapping
 * card. Most of the entry screens put the question *above* the transition, in a
 * shared card, because the card is what holds the two tabs or the progress strip;
 * without the second lookup those steps would move silently and announce nothing.
 */
export function StepTransition({
  stepKey,
  direction,
  children,
  minHeight,
  focusHeading = false,
}: {
  stepKey: string | number;
  direction: 1 | -1;
  children: React.ReactNode;
  minHeight?: number | string;
  focusHeading?: boolean;
}) {
  const mpref = useMotionPref();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevKey = useRef<string | number | undefined>(undefined);

  // The very first mount may never fire `onAnimationComplete` (there is no
  // animation to complete), so remember the starting key from an effect — that
  // way the first real step change still counts as a change, not as a mount.
  useEffect(() => {
    if (prevKey.current === undefined) prevKey.current = stepKey;
  }, [stepKey]);

  function onAnimationComplete() {
    const firstMount = prevKey.current === undefined;
    const sameKey = prevKey.current === stepKey;
    prevKey.current = stepKey;
    if (!focusHeading || firstMount || sameKey) return;
    const root = containerRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>("[data-step-heading]") ??
      root.querySelector<HTMLElement>("h1, h2, h3") ??
      root.parentElement?.querySelector<HTMLElement>("[data-step-heading]");
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus();
    }
  }

  return (
    <div ref={containerRef} style={minHeight ? { minHeight } : undefined}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div
          key={stepKey}
          custom={direction}
          variants={mpref.reduced ? fadeOnly : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: mpref.t(dur.base), ease: ease.out }}
          onAnimationComplete={onAnimationComplete}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
