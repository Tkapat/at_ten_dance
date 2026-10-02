"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayRecord, Status } from "@/lib/types";
import { addMonthsKey, daysInMonth, formatMonth, monthKey, parseKey, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/components/ui/status-dot";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const CELL: Record<Status, string> = {
  present: "bg-success/85",
  late: "bg-warning/85",
  excused: "bg-primary/85",
  absent: "bg-danger/20",
  sunday: "bg-muted",
  holiday: "hatch bg-muted",
};

/**
 * One month of attendance as a colour grid. Every cell carries a full text
 * label for assistive tech and a tooltip, so colour is never the only signal,
 * and a ring marks today.
 */
export function AttendanceHeatmap({
  month,
  days,
  onChange,
}: {
  month: string;
  days: DayRecord[];
  onChange: (month: string) => void;
}) {
  const today = todayKey();
  const first = parseKey(month);
  const offset = first.getDay();
  const total = daysInMonth(month);
  const current = monthKey();
  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            disabled={month <= "2024-01"}
            onClick={() => onChange(addMonthsKey(month, -1))}
            className="h-9 w-9 px-0"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-medium">
            {formatMonth(month)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            disabled={month >= current}
            onClick={() => onChange(addMonthsKey(month, 1))}
            className="h-9 w-9 px-0"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {month !== current && (
          <Button variant="ghost" size="sm" onClick={() => onChange(current)}>
            This month
          </Button>
        )}
      </div>

      <div>
        <div className="mb-1.5 grid grid-cols-7 gap-1.5" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center text-[11px] font-medium text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`blank-${i}`} className="aspect-square" aria-hidden />
          ))}

          {Array.from({ length: total }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const record = byDate.get(date);
            const future = date > today;
            const status = record?.status;
            const label = future
              ? `${date}: not yet`
              : `${date}: ${status ? statusLabel(status).toLowerCase() : "no record"}`;

            return (
              <span
                key={date}
                title={label}
                aria-label={label}
                role="img"
                className={cn(
                  "relative grid aspect-square place-items-center rounded-md transition-transform",
                  "hover:scale-110",
                  !record && !future && "bg-muted",
                  record && !future && CELL[record.status],
                  future && "bg-muted/40",
                  date === today &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-card",
                )}
              >
                <span className="text-[10px] font-medium text-foreground/80 tabular-nums">
                  {i + 1}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <LegendSwatch className="bg-success/85" label="Present" />
        <LegendSwatch className="bg-warning/85" label="Late" />
        <LegendSwatch className="bg-primary/85" label="Excused" />
        <LegendSwatch className="bg-danger/20" label="Absent" />
        <LegendSwatch className="bg-muted" label="Sunday / off" />
        <LegendSwatch className="hatch bg-muted" label="Holiday" />
      </ul>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[4px]", className)} aria-hidden />
      {label}
    </li>
  );
}
