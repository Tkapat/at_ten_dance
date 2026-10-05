"use client";

import { LayoutGroup, m } from "framer-motion";
import { dur, ease, stagger } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * First-load list entrance: each child fades up with a small, capped stagger.
 * Later additions get their own entrance; existing children are not re-animated.
 */
export function StaggerList({
  children,
  layout = true,
  className,
}: {
  children: React.ReactNode;
  layout?: boolean;
  className?: string;
}) {
  return (
    <LayoutGroup>
      <m.div layout={layout} className={className}>
        {children}
      </m.div>
    </LayoutGroup>
  );
}

/**
 * Per-item entrance; use inside a StaggerList keyed list. `as` lets the item
 * keep list semantics — `<StaggerItem as="li">` inside an `<ol>`/`<ul>`.
 */
export function StaggerItem({
  index,
  children,
  layout = true,
  className,
  as = "div",
}: {
  index: number;
  children: React.ReactNode;
  layout?: boolean;
  className?: string;
  as?: "div" | "li";
}) {
  const mpref = useMotionPref();
  const Comp = (as === "li" ? m.li : m.div) as typeof m.div;
  return (
    <Comp
      layout={layout}
      initial={{ opacity: 0, y: mpref.y(8) }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: mpref.y(8) }}
      transition={{
        duration: mpref.t(dur.base),
        ease: ease.out,
        delay: mpref.reduced ? 0 : Math.min(index, stagger.max) * stagger.list,
      }}
      className={className}
    >
      {children}
    </Comp>
  );
}
