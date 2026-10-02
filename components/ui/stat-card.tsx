import type { ReactNode } from "react";
import { Card, CardContent } from "./card";
import { AnimatedNumber } from "./animated-number";
import { cn } from "@/lib/utils";

/**
 * A headline number. The height is fixed so a value change never shifts the
 * layout underneath it.
 */
export function StatCard({
  label,
  value,
  decimals = 0,
  suffix,
  icon,
  caption,
  className,
  valueClassName,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon?: ReactNode;
  caption?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={cn("px-5 py-4", className)}>
      <CardContent className="space-y-1 p-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon && <span className="text-muted-foreground/80">{icon}</span>}
          {label}
        </div>
        <div
          className={cn(
            "text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground",
            valueClassName,
          )}
        >
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        </div>
        {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
      </CardContent>
    </Card>
  );
}
