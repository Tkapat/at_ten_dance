"use client";

import { m } from "framer-motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease, spring } from "@/lib/motion";

/** Success marker: a ring that draws, then a check. Springs in on `pop`. */
export function CheckDraw({ size = 52 }: { size?: number }) {
  const mpref = useMotionPref();
  return (
    <m.svg
      viewBox="0 0 52 52"
      width={size}
      height={size}
      initial={mpref.reduced ? false : { scale: 0.8 }}
      animate={mpref.reduced ? undefined : { scale: 1 }}
      transition={spring.pop}
      aria-hidden
    >
      <m.circle
        cx="26" cy="26" r="24" fill="none" stroke="hsl(var(--success))" strokeWidth="3"
        initial={mpref.reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: mpref.t(dur.slow), ease: ease.out }}
      />
      <m.path
        d="M15 27 l8 8 l14 -16" fill="none" stroke="hsl(var(--success))" strokeWidth="3.5" strokeLinecap="round"
        initial={mpref.reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: mpref.t(dur.slow), duration: mpref.t(dur.base), ease: ease.out }}
      />
    </m.svg>
  );
}
