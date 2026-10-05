"use client";

import { m, useAnimationControls } from "framer-motion";
import { useEffect } from "react";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease } from "@/lib/motion";

/**
 * A short horizontal nudge for failed submissions. Pair with a border flash and
 * an inline error. Reduced motion skips the nudge and keeps the border flash.
 *
 * Usage:
 *   const [shake, setShake] = usage, error...
 *   <Shake trigger={badInput}>{children}</Shake>
 */
export function Shake({
  trigger,
  children,
  className,
}: {
  trigger: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const mpref = useMotionPref();
  const controls = useAnimationControls();
  useEffect(() => {
    if (trigger && !mpref.reduced) {
      void controls.start({
        x: [0, -8, 8, -6, 6, -3, 3, 0],
        transition: { duration: mpref.t(dur.slow), ease: ease.inOut },
      });
    } else if (trigger && mpref.reduced) {
      void controls.start({ opacity: [1, 0.4, 1], transition: { duration: mpref.t(dur.base) } });
    }
  }, [trigger, mpref, controls]);
  return <m.div className={className} animate={controls}>{children}</m.div>;
}
