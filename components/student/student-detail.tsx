"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, ScanFace, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DayRecord } from "@/lib/types";
import { ordinal } from "@/lib/constants";
import { formatMonth, formatShortDate, formatTime, formatWeekday, monthKey } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatusDot, statusLabel } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { CardSkeleton, ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { AttendanceHeatmap } from "./attendance-heatmap";
import { EditStudentModal } from "./edit-student-modal";

export function StudentDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detail = useQuery({
    queryKey: ["student", id],
    queryFn: () => api().getStudent(id),
  });

  const days = useQuery({
    queryKey: ["student-days", id, month],
    queryFn: () => api().studentDays(id, month),
    placeholderData: keepPreviousData,
  });

  const year = useQuery({
    queryKey: ["student-year", id],
    queryFn: () => api().studentYear(id),
  });

  if (detail.isPending) {
    return (
      <div className="space-y-5">
        <BackButton />
        <CardSkeleton className="h-[140px]" />
        <div className="grid gap-3 sm:grid-cols-3">
          <CardSkeleton className="h-[110px]" />
          <CardSkeleton className="h-[110px]" />
          <CardSkeleton className="h-[110px]" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <CardSkeleton className="h-[380px]" />
          <CardSkeleton className="h-[380px]" />
        </div>
      </div>
    );
  }

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <div className="space-y-5">
        <BackButton />
        <EmptyState
          title={notFound ? "Student not found" : "Could not load this student"}
          message={
            notFound
              ? "This record may have been deleted."
              : detail.error.message || "Something went wrong while loading this profile."
          }
          action={
            notFound ? (
              <Button size="sm" onClick={() => router.push("/")}>
                Back to dashboard
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
                Retry
              </Button>
            )
          }
        />
      </div>
    );
  }

  const s = detail.data;
  const student = s.student;

  async function onDelete() {
    setDeleting(true);
    try {
      await api().deleteStudent(id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["students"] }),
        qc.invalidateQueries({ queryKey: ["summary"] }),
      ]);
      toast.success("Student deleted.");
      router.replace("/");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The student could not be deleted.",
      );
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton />

      {/* -------------------------------------------------------- identity */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar name={student.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.015em]">
                {student.name}
              </h1>
              <StatusDot status={s.todayStatus} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{student.enrollmentNo}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Tag>{student.degree}</Tag>
              {student.department && <Tag>{student.department}</Tag>}
              <Tag>Section {student.section}</Tag>
              <Tag>{ordinal(student.year)}</Tag>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/register?student=${student.id}`)}
            >
              <ScanFace className="size-3.5" /> Re-enroll
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label="Delete student"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="This month"
          pct={s.monthPct}
          caption={`${s.presentDays} of ${s.workingDays} working days`}
        />
        <MetricCard
          label="This year"
          pct={s.yearPct}
          caption={`${s.yearPresentDays} of ${s.yearWorkingDays} working days`}
        />
        <Card className="p-5">
          <CardContent className="space-y-2 p-0">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-[28px] font-semibold leading-none tracking-[-0.02em]">
              {statusLabel(s.todayStatus)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMonth(monthKey())} · {student.enrollmentNo}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------- calendar + day list */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance calendar</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {days.isError ? (
              <ErrorState
                message={days.error.message || "The calendar could not be loaded."}
                onRetry={() => days.refetch()}
              />
            ) : (
              <AttendanceHeatmap month={month} days={days.data ?? []} onChange={setMonth} />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Daily record</CardTitle>
            <span className="text-xs text-muted-foreground">{formatMonth(month)}</span>
          </CardHeader>
          <CardContent className="pt-4">
            {days.isPending && !days.data ? (
              <ListSkeleton rows={6} />
            ) : days.isError ? (
              <ErrorState
                message={days.error.message || "The daily record could not be loaded."}
                onRetry={() => days.refetch()}
              />
            ) : !days.data || days.data.length === 0 ? (
              <EmptyState
                title="No records this month"
                message="Nothing has been recorded for this month yet."
                className="border-0 py-8"
              />
            ) : (
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {[...days.data]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((d) => (
                    <DayRow key={d.date} day={d} />
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------------- year bar */}
      <Card>
        <CardHeader>
          <CardTitle>Month by month</CardTitle>
          <span className="text-xs text-muted-foreground">
            {year.isError ? "—" : `${s.yearPresentDays} of ${s.yearWorkingDays} days`}
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          {year.isPending && !year.data ? (
            <div className="flex h-32 items-end gap-1.5">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="shimmer flex-1 rounded-t-md" style={{ height: "60%" }} />
              ))}
            </div>
          ) : year.isError ? (
            <ErrorState
              message={year.error.message || "The yearly breakdown could not be loaded."}
              onRetry={() => year.refetch()}
              className="border-0 py-8"
            />
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {(year.data ?? []).map((p) => {
                const thisMonth = p.month === monthKey();
                return (
                  <div
                    key={p.month}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {p.pct}%
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${
                        p.pct >= 75
                          ? "bg-success/80"
                          : p.pct >= 50
                            ? "bg-warning/80"
                            : p.pct > 0
                              ? "bg-danger/70"
                              : "bg-muted"
                      } ${thisMonth ? "ring-1 ring-ring" : ""} min-h-[4px]`}
                      style={{ height: `${Math.max(4, p.pct)}%` }}
                      title={`${formatMonth(p.month)}: ${p.pct}%`}
                    />
                    <span
                      className={`text-[10px] ${thisMonth ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {formatMonth(p.month).slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <EditStudentModal student={editing ? student : null} onOpenChange={setEditing} />

      <Modal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this student?"
        description="Their face embeddings and attendance history are removed. This cannot be undone."
        size="sm"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={onDelete}>
              Delete student
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{student.name}</span> ·{" "}
          {student.enrollmentNo}
        </p>
      </Modal>
    </div>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="-ml-2">
        <ArrowLeft className="size-4" /> All students
      </Button>
    </div>
  );
}

function MetricCard({ label, pct, caption }: { label: string; pct: number; caption: string }) {
  return (
    <Card className="p-5">
      <CardContent className="flex items-center gap-4 p-0">
        <ProgressRing value={pct} size={62} stroke={5} label={false} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-[28px] font-semibold leading-none tracking-[-0.02em]">
            <AnimatedNumber value={pct} decimals={1} suffix="%" />
          </p>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DayRow({ day }: { day: DayRecord }) {
  const seen = Boolean(day.firstSeenAt);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="w-[92px] shrink-0">
        <p className="text-sm tabular-nums">{formatShortDate(day.date)}</p>
        <p className="text-[11px] text-muted-foreground">{formatWeekday(day.date)}</p>
      </div>
      <StatusDot status={day.status} className="text-xs" />
      <span className="ml-auto shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {seen ? formatTime(day.firstSeenAt) : "—"}
        {day.confidence !== undefined && seen ? ` · ${Math.round(day.confidence * 100)}%` : ""}
      </span>
    </li>
  );
}
