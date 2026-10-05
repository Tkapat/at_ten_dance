"use client";

import { m, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease } from "@/lib/motion";

export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const mpref = useMotionPref();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);
  const first = useRef(true);

  useEffect(() => {
    if (mpref.reduced) {
      mv.set(value);
      first.current = false;
      return;
    }
    const controls = animate(mv, value, {
      duration: first.current ? dur.count : dur.slow,
      ease: ease.out,
    });
    first.current = false;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mpref.reduced]);

  return <m.span className={`tabular-nums ${className ?? ""}`}>{text}</m.span>;
}
