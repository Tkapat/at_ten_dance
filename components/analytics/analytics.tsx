"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { api, type Segment } from "@/lib/api";
import { dur, ease, spring, tween } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { addMonthsKey, formatMonth, monthKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/controls";
import { Tag } from "@/components/ui/input";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StaggerItem } from "@/components/motion/StaggerList";
import { m } from "framer-motion";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "department", label: "Department" },
  { value: "degree", label: "Degree" },
  { value: "section", label: "Section" },
  { value: "year", label: "Year" },
];

const PRIMARY = "hsl(var(--primary))";
const DANGER = "hsl(var(--danger))";

function tone(pct: number) {
  return pct >= 75 ? "success" : pct >= 50 ? "warning" : "danger";
}

export function Analytics() {
  const mpref = useMotionPref();
  const [segment, setSegment] = useState<Segment>("department");
  const [month, setMonth] = useState(monthKey());

  const query = useQuery({
    queryKey: ["groups", segment, month],
    queryFn: () => api().analytics(segment, month),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const groups = useMemo(() => {
    const rows = [...(query.data ?? [])];
    rows.sort((a, b) => b.pct - a.pct);
    return rows;
  }, [query.data]);

  const lowestId = groups.length > 1 ? groups[groups.length - 1]?.label : undefined;
  const highest = groups[0];
  const counted = groups.reduce((n, g) => n + g.students, 0);
  const weighted = counted
    ? Math.round(
        (groups.reduce((n, g) => n + g.pct * g.students, 0) / counted) * 10,
      ) / 10
    : 0;

  const current = monthKey();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          options={SEGMENTS}
          value={segment}
          onChange={setSegment}
          ariaLabel="Group attendance by"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => setMonth(addMonthsKey(month, -1))}
            disabled={month <= "2024-01"}
            className="h-9 w-9 px-0"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-medium">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            onClick={() => setMonth(addMonthsKey(month, 1))}
            disabled={month >= current}
            className="h-9 w-9 px-0"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {query.isError && !query.data ? (
        <ErrorState
          message={query.error.message || "Attendance analytics could not be loaded."}
          onRetry={() => query.refetch()}
        />
      ) : query.isPending && !query.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading analytics…</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          message={`No attendance has been recorded for ${formatMonth(month)}. Pick an earlier month or start scanning.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Overall" value={<AnimatedNumber value={weighted} decimals={1} suffix="%" />} />
            <Tile label="Groups" value={<AnimatedNumber value={groups.length} />} />
            <Tile
              label="Highest"
              value={highest ? `${highest.label} · ${highest.pct}%` : "—"}
              icon={<TrendingUp className="size-3.5" />}
              small
            />
            <Tile
              label="Lowest"
              value={
                lowestId ? `${groups[groups.length - 1]?.label} · ${groups[groups.length - 1]?.pct}%` : "—"
              }
              icon={<TrendingDown className="size-3.5" />}
              tone={lowestId ? "text-danger" : undefined}
              small
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Attendance by {segment} · {formatMonth(month)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="w-full overflow-x-auto pb-1">
                <div
                  style={{ minWidth: Math.max(320, groups.length * 54), height: 280 }}
                  role="img"
                  aria-label={`Bar chart of attendance by ${segment}. Full figures are listed below.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groups} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        interval={0}
                        height={44}
                        angle={groups.length > 8 ? -35 : 0}
                        textAnchor={groups.length > 8 ? "end" : "middle"}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.7)" }}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 13,
                          color: "hsl(var(--foreground))",
                          boxShadow: "var(--shadow-sheet)",
                        }}
                        formatter={(value) => [`${value}%`, "Attendance"]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar
                        dataKey="pct"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                        isAnimationActive={!mpref.reduced}
                        animationDuration={dur.slow * 1000}
                        animationEasing={`cubic-bezier(${ease.out[0]},${ease.out[1]},${ease.out[2]},${ease.out[3]})`}
                      >
                        {groups.map((g) => (
                          <Cell
                            key={g.label}
                            fill={g.label === lowestId ? DANGER : PRIMARY}
                            fillOpacity={g.label === lowestId ? 1 : 0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranked</CardTitle>
              <span className="text-xs text-muted-foreground">{counted} students</span>
            </CardHeader>
            <CardContent className="pt-4">
              <ol className="space-y-4">
                {groups.map((g, i) => (
                  <StaggerItem as="li" key={g.label} index={i} layout={false} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                      <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-medium">{g.label}</span>
                      {g.label === lowestId && (
                        <m.span
                          className="inline-flex"
                          initial={{ opacity: 0, scale: mpref.reduced ? 1 : 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={mpref.reduced ? tween.instant : spring.pop}
                        >
                          <Tag tone="danger">Lowest</Tag>
                        </m.span>
                      )}
                      {i === 0 && groups.length > 1 && <Tag tone="success">Highest</Tag>}
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {g.presentDays}/{g.workingDays} days · {g.pct}%
                      </span>
                    </div>
                    <ProgressBar value={g.pct} tone={tone(g.pct)} />
                  </StaggerItem>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
  small,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: string;
  small?: boolean;
}) {
  return (
    <Card className="px-5 py-4">
      <CardContent className="space-y-1 p-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon && <span className="text-muted-foreground/80">{icon}</span>}
          {label}
        </div>
        <p
          className={cn(
            "truncate font-semibold tabular-nums tracking-[-0.02em] text-foreground",
            small ? "text-[17px] leading-snug" : "text-[28px] leading-none",
            tone,
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
