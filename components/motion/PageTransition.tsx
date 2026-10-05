"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { usePathname } from "next/navigation";
import { dur, ease, distance } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";

const depthOf = (p: string) => p.split("/").filter(Boolean).length;

/**
 * Depth-aware page transition, wired into `app/(app)/template.tsx`.
 *
 * - Sibling change in the same section (a tab switch): fade only, no movement.
 * - To a deeper route: 24 px in from the right.
 * - Back to a shallower route: 24 px in from the left.
 *
 * Reduced motion collapses every variant to a simple opacity fade.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mpref = useMotionPref();

  // Derived during render: the only way to know, without a ref read, how this
  // route compares to the previous one. setState-during-render is the sanctioned
  // "adjust state when props change" pattern and never loops.
  const current = depthOf(pathname);
  const [lastDepth, setLastDepth] = useState<number>(current);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  if (current !== lastDepth) {
    setDirection(current > lastDepth ? 1 : current < lastDepth ? -1 : 0);
    setLastDepth(current);
  }

  const variants = {
    enter: (d: 1 | -1 | 0) =>
      mpref.reduced || d === 0 ? { opacity: 0 } : { opacity: 0, x: d * distance.step },
    center: { opacity: 1, x: 0 },
    exit: (d: 1 | -1 | 0) =>
      mpref.reduced || d === 0 ? { opacity: 0 } : { opacity: 0, x: d * -distance.step * 0.5 },
  };

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <m.div
        key={pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: mpref.t(dur.base), ease: ease.out }}
        className="flex w-full flex-1 flex-col"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
