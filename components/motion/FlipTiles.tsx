"use client";

import { m } from "framer-motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease, stagger } from "@/lib/motion";

/**
 * The code-reveal hero moment: one tile per character, each flipping in over
 * `duration`, staggered. Reduced motion fades the tiles in without rotation or
 * stagger.
 */
export function FlipTiles({ code }: { code: string }) {
  const mpref = useMotionPref();
  const chars = code.replace(/\s/g, "").split("");
  return (
    <div className="inline-flex gap-1.5" style={{ perspective: 600 }} aria-label={code}>
      {chars.map((ch, i) => (
        <m.span
          key={`${ch}${i}`}
          className="grid size-10 place-items-center rounded-lg border border-border bg-card text-lg font-semibold tabular-nums shadow-sm"
          initial={mpref.reduced ? { opacity: 0 } : { opacity: 0, rotateX: -90 }}
          animate={mpref.reduced ? { opacity: 1 } : { opacity: 1, rotateX: 0 }}
          transition={
            mpref.reduced
              ? { duration: mpref.t(dur.instant) }
              : { duration: mpref.t(dur.slow), delay: i * stagger.tiles, ease: ease.out }
          }
        >
          {ch}
        </m.span>
      ))}
    </div>
  );
}
