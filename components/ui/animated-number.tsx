"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** cubic-bezier(0.22, 1, 0.36, 1) sampled by Newton-Raphson — no library cost. */
function easeOut(p: number): number {
  const [x1, y1, x2, y2] = EASE;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let t = p;
  for (let i = 0; i < 5; i++) {
    const x = ((ax * t + bx) * t + cx) * t - p;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  t = Math.min(1, Math.max(0, t));
  return ((ay * t + by) * t + cy) * t;
}

/**
 * Counts up the first time it scrolls into view, then tracks its value with a
 * short tween. The frames are written straight to the DOM so a 60 fps tween
 * never re-renders React; only the settled value lands in state (and in the
 * server-rendered markup). Reduced motion paints the number immediately.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 0.6,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const nodeRef = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(0);

  const fmt = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          io.disconnect();
          setVisible(true);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !visible) return;

    // Reduced motion skips the tween entirely — the final value is rendered
    // straight from `value` below, so only the tween origin needs syncing here.
    if (reduced) {
      fromRef.current = value;
      return;
    }

    const start = performance.now();
    const startValue = fromRef.current;
    const ms = duration * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const v = startValue + (value - startValue) * easeOut(p);
      node.textContent = fmt(v);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setSettled(value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value, decimals, prefix, suffix, duration, reduced]);

  return (
    <span ref={nodeRef} className={`tabular-nums ${className ?? ""}`}>
      {fmt(visible && reduced ? value : settled)}
    </span>
  );
}
