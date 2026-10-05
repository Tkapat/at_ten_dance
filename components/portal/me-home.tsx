"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ScanFace } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { daysInMonth, monthKey, toKey, todayKey } from "@/lib/format";

/**
 * The student's home.
 *
 * A shell for now, with the one thing that cannot wait: the face banner. A
 * student whose face is not enrolled has no attendance at all, so that banner is
 * the first thing on the page and stays first until it is answered. Everything
 * below it is real data, because a portal that shows three empty cards until a
 * later release teaches people that the app is broken.
 */
export function MeHome() {
  const { data: session } = useSession();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api().me(),
  });
  const summary = useQuery({
    queryKey: ["me", "summary"],
    queryFn: () => api().meSummary(),
  });

  const first = (session?.name ?? "").trim().split(/\s+/)[0] || "there";
  const today = new Date();
  const needsFace = me.data?.faceStatus === "none";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Hello, {first}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {today.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {needsFace && (
        <Card className="border-primary/30 bg-primary/[0.06]">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <ScanFace className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Register your face to mark attendance</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It takes about a minute, and it is stored as a numeric template — never a
                photograph.
              </p>
            </div>
            <Link
              href="/me/face"
              className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              Start
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isPending ? (
              <ListSkeleton rows={1} />
            ) : (
              <p className="text-lg font-medium capitalize">
                {summary.data?.todayStatus === "working" ? "Not marked yet" : summary.data?.todayStatus}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">This month</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ProgressRing value={summary.data?.monthPct ?? 0} size={44} stroke={4} label={false} />
            <p className="text-sm text-muted-foreground">
              <AnimatedNumber value={summary.data?.monthPresent ?? 0} /> of{" "}
              <AnimatedNumber value={summary.data?.monthWorking ?? 0} /> days
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">This year</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ProgressRing value={summary.data?.yearPct ?? 0} size={44} stroke={4} label={false} />
            <p className="text-sm text-muted-foreground">
              <AnimatedNumber value={summary.data?.yearPresent ?? 0} /> of{" "}
              <AnimatedNumber value={summary.data?.yearWorking ?? 0} /> days
            </p>
          </CardContent>
        </Card>
      </div>

      <NextHoliday />
    </div>
  );
}

/**
 * The next holiday, and how far off it is.
 *
 * A single line, because that is all it is for: a student deciding whether to
 * come in tomorrow morning. Past holidays are not shown here — they are on the
 * holidays page, which is where somebody looking for a specific date goes.
 */
function NextHoliday() {
  const holidays = useQuery({
    queryKey: ["me", "holidays"],
    queryFn: () => api().meHolidays(),
  });

  const upcoming = (holidays.data ?? []).filter((h) => h.date >= todayKey());
  if (holidays.isPending) return <ListSkeleton rows={1} />;
  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-5" />}
        title="No holidays yet"
        message="Your institute has not published a holiday list."
      />
    );
  }

  const next = upcoming[0];
  const days = Math.round(
    (new Date(`${next.date}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) /
      86_400_000,
  );

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{next.label}</span>
          <span className="text-muted-foreground"> · {next.date}</span>
        </p>
        <p className="shrink-0 text-sm text-muted-foreground">
          {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
        </p>
      </CardContent>
    </Card>
  );
}

/** Re-exported for the attendance page, which needs the same month arithmetic. */
export { daysInMonth, monthKey, toKey };