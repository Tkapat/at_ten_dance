"use client";

import { m } from "framer-motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { dur, ease } from "@/lib/motion";

/**
 * Animated attendance ring. Fills from zero on mount so the eye is drawn to
 * the value; colour follows the value so status is never shape-only. Under the
 * reduced-motion preference the ring lands on its value immediately.
 */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  label = true,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: boolean;
  className?: string;
}) {
  const mpref = useMotionPref();
  const reduced = mpref.reduced;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 75 ? "hsl(var(--success))" : pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--danger))";

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(pct)} percent`}
    >
      <div className="relative grid place-items-center">
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <m.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduced ? c * (1 - pct / 100) : c }}
            animate={{ strokeDashoffset: c * (1 - pct / 100) }}
            transition={{ duration: mpref.t(dur.count), ease: ease.out }}
          />
        </svg>
        {label && (
          <span className="absolute text-[11px] font-medium tabular-nums">
            {Math.round(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}
