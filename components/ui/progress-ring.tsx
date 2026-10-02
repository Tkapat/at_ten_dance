"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Animated attendance ring. Fills from zero on mount so the eye is drawn to
 * the value; colour follows the value so status is never shape-only.
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
  const reduced = useReducedMotion();
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
          <motion.circle
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
            transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
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
