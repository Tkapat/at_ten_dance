"use client";

import { AnimatePresence, m } from "framer-motion";
import { dur, ease } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";

/** The only permitted height animation: a height+opacity crossfade in place. */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const mpref = useMotionPref();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="collapse"
          style={{ overflow: "hidden" }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: mpref.t(dur.slow), ease: ease.out },
            opacity: { duration: mpref.t(dur.base) },
          }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
