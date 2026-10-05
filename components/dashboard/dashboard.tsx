"use client";

import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Cpu,
  Database,
  Percent,
  ScanFace,
  UserPlus,
  UserX,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type { GroupStat, HealthStatus } from "@/lib/types";
import { monthKey, formatLongDay, formatMonth, greeting } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/controls";
import { CardSkeleton, ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StudentList } from "./student-list";
import { StaggerItem } from "@/components/motion/StaggerList";

export function Dashboard() {
  const router = useRouter();

  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: () => api().summary(),
    refetchInterval: 5_000,
  });

  const groups = useQuery({
    queryKey: ["groups", "department", monthKey()],
    queryFn: () => api().analytics("department", monthKey()),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api().health(),
    refetchInterval: 30_000,
  });

  if (summary.isPending) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <CardSkeleton className="h-[260px]" />
          <CardSkeleton className="h-[260px]" />
        </div>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (summary.isError) {
    return (
      <ErrorState
        message={summary.error.message || "The dashboard summary could not be loaded."}
        onRetry={() => summary.refetch()}
      />
    );
  }

  const s = summary.data;
  const attendanceRate = s.totalStudents
    ? Math.round((1000 * s.presentToday) / s.totalStudents) / 10
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{formatLongDay(s.date)}</p>
          <p className="mt-0.5 text-[15px] font-medium">
            {greeting()} — here&apos;s today&apos;s picture.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="md" onClick={() => router.push("/register")}>
            <UserPlus className="size-4" /> Register
          </Button>
          <Button size="md" onClick={() => router.push("/scan")}>
            <ScanFace className="size-4" /> Start scanning
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------- stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Present today"
          value={s.presentToday}
          icon={<UsersRound className="size-3.5" />}
          caption={
            s.isWorkingDay
              ? `${attendanceRate}% of enrolled`
              : "Not recorded today"
          }
        />
        <StatCard
          label="Absent today"
          value={s.absentToday}
          icon={<UserX className="size-3.5" />}
          valueClassName={s.isWorkingDay && s.absentToday > 0 ? "text-danger" : undefined}
          caption={s.isWorkingDay ? "Still to check in" : "No attendance expected"}
        />
        <StatCard
          label="This month"
          value={s.monthPct}
          decimals={1}
          suffix="%"
          icon={<Percent className="size-3.5" />}
          caption={formatMonth(monthKey())}
        />
        <StatCard
          label="Enrolled"
          value={s.totalStudents}
          icon={<CalendarDays className="size-3.5" />}
          caption="Active students"
        />
      </div>

      {/* -------------------------------------------------- today + groups */}
      <div className="grid gap-5 lg:grid-cols-2">
        <TodayCard
          working={s.isWorkingDay}
          present={s.presentToday}
          total={s.totalStudents}
          rate={attendanceRate}
        />
        <GroupCard state={groups} />
      </div>

      {/* -------------------------------------------------------- students */}
      <StudentList />

      {/* --------------------------------------------------------- health */}
      <HealthStrip state={health} />
    </div>
  );
}

/* ------------------------------------------------------------------ today */

function TodayCard({
  working,
  present,
  total,
  rate,
}: {
  working: boolean;
  present: number;
  total: number;
  rate: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s attendance</CardTitle>
        <span className="text-xs text-muted-foreground">
          {total > 0 ? `${present} of ${total}` : "—"}
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {!working ? (
          <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl bg-muted/70 px-6 py-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              Off day
            </span>
            <p className="text-sm text-muted-foreground">
              Sundays and holidays are excluded — nothing to mark today.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <ProgressRing value={rate} size={96} stroke={7} />
            <div className="min-w-0 flex-1 space-y-3">
              <Legend label="Present" value={present} tone="bg-success" />
              <Legend label="Absent" value={Math.max(0, total - present)} tone="bg-danger" />
              <div className="pt-1">
                <ProgressBar value={rate} tone={rate >= 75 ? "success" : rate >= 50 ? "warning" : "danger"} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Counts students seen by the camera so far today.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`size-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- groups */

/** The slice of a React Query result these cards actually read. */
interface QuerySlice<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
}

function GroupCard({ state }: { state: QuerySlice<GroupStat[]> }) {
  const title = `By department · ${formatMonth(monthKey())}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {state.isPending && !state.data ? (
          <div className="space-y-4">
            {[72, 58, 44, 36].map((w, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <span className="shimmer block h-3 w-20 rounded" />
                  <span className="shimmer block h-3 w-10 rounded" />
                </div>
                <span className="shimmer block h-1.5 rounded-full" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : state.isError ? (
          <ErrorState
            message={state.error?.message || "Group breakdown could not be loaded."}
            onRetry={() => state.refetch()}
            className="border-0 py-8"
          />
        ) : !state.data || state.data.length === 0 ? (
          <EmptyState
            title="No group data yet"
            message={`Attendance has not been recorded for ${formatMonth(monthKey())} yet.`}
            icon={<CalendarDays className="size-5" />}
            className="border-0 py-8"
          />
        ) : (
          <ul className="space-y-4">
            {state.data.map((g, i) => (
              <StaggerItem as="li" key={g.label} index={i} layout={false} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{g.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {g.pct}% · {g.presentDays}/{g.workingDays}
                  </span>
                </div>
                <ProgressBar
                  value={g.pct}
                  tone={g.pct >= 75 ? "success" : g.pct >= 50 ? "warning" : "danger"}
                />
              </StaggerItem>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------- health */

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function HealthStrip({ state }: { state: QuerySlice<HealthStatus> }) {
  const h = state.data;
  const offline = state.isError;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <span
          className={`inline-flex items-center gap-2 text-sm font-medium ${
            offline ? "text-danger" : "text-success"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${offline ? "bg-danger" : "bg-success"}`}
            aria-hidden
          />
          {offline ? "Service unreachable" : "Service live"}
        </span>

        {h && (
          <>
            <Metric icon={<Cpu className="size-4" />} label="Model" value={h.model} />
            <Metric
              icon={<Activity className="size-4" />}
              label="Frame"
              value={h.avgMsPerFrame ? `${Math.round(h.avgMsPerFrame)} ms` : "—"}
            />
            <Metric
              icon={<UsersRound className="size-4" />}
              label="Gallery"
              value={`${h.galleryStudents}`}
            />
            <Metric
              icon={<Database className="size-4" />}
              label="Database"
              value={h.dbReachable ? "Connected" : "Unreachable"}
            />
          </>
        )}

        {offline && (
          <Button variant="outline" size="sm" onClick={() => state.refetch()}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
