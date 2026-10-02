"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronRight, Search, SlidersHorizontal, UserSearch, X } from "lucide-react";
import { api, type StudentFilter } from "@/lib/api";
import type { Status, StudentRow } from "@/lib/types";
import {
  DEGREE_LIST,
  SECTIONS,
  STATUS_ORDER,
  ordinal,
  type Degree,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, statusLabel } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const PAGE = 6;
const CHUNK = 12;

const STATUS_FILTER = STATUS_ORDER.filter((s) =>
  ["present", "late", "excused", "absent"].includes(s),
);

export function StudentList() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [degree, setDegree] = useState<Degree | "">("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const onSearch = (value: string) => {
    setSearch(value);
    setLimit(PAGE);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filter: StudentFilter = useMemo(
    () => ({
      search: debounced || undefined,
      degree: degree || undefined,
      section: section || undefined,
      year: year ? Number(year) : undefined,
      status: status || undefined,
    }),
    [debounced, degree, section, year, status],
  );

  const hasFilters = Boolean(debounced || degree || section || year || status);

  const query = useQuery({
    queryKey: ["students", filter],
    queryFn: () => api().listStudents(filter),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });

  // Rows that change status since the previous poll get one highlight pass.
  const previous = useRef<Map<string, Status>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rows = query.data;
    if (!rows) return;
    const changed: string[] = [];
    for (const row of rows) {
      const was = previous.current.get(row.id);
      if (was !== undefined && was !== row.todayStatus) changed.push(row.id);
      previous.current.set(row.id, row.todayStatus);
    }
    if (changed.length === 0) return;

    // The highlight is a CSS animation, so it is applied straight to the row
    // nodes: no React render per poll, and the class is removed on cleanup.
    const nodes = changed
      .map((id) => listRef.current?.querySelector<HTMLElement>(`[data-student="${id}"]`))
      .filter((n): n is HTMLElement => n !== null && n !== undefined);

    for (const node of nodes) {
      node.classList.remove("row-flash");
      void node.offsetWidth;
      node.classList.add("row-flash");
    }
    const t = setTimeout(() => {
      for (const node of nodes) node.classList.remove("row-flash");
    }, 1400);
    return () => clearTimeout(t);
  }, [query.data]);

  const rows = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );
  const visible = rows.slice(0, limit);

  function clearFilters() {
    setSearch("");
    setDebounced("");
    setLimit(PAGE);
    setDegree("");
    setSection("");
    setYear("");
    setStatus("");
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-wrap gap-3">
          <div>
            <CardTitle>Students</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {query.isPending && !query.data
                ? "Loading…"
                : rows.length
                  ? `Showing ${visible.length} of ${rows.length}`
                  : "Nothing to show"}
            </p>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" /> Clear filters
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search name or enrollment number"
                aria-label="Search students"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:w-[440px]">
              <Select
                value={degree}
                onChange={(e) => {
                  setDegree(e.target.value as Degree | "");
                  setLimit(PAGE);
                }}
                aria-label="Filter by degree"
                className="h-11"
              >
                <option value="">All degrees</option>
                {DEGREE_LIST.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              <Select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setLimit(PAGE);
                }}
                aria-label="Filter by section"
                className="h-11"
              >
                <option value="">All sections</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setLimit(PAGE);
                }}
                aria-label="Filter by year"
                className="h-11"
              >
                <option value="">All years</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    {ordinal(y)}
                  </option>
                ))}
              </Select>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setLimit(PAGE);
                }}
                aria-label="Filter by today's status"
                className="h-11"
              >
                <option value="">Any status</option>
                {STATUS_FILTER.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {query.isPending && !query.data ? (
            <ListSkeleton rows={PAGE} />
          ) : query.isError ? (
            <ErrorState
              message={query.error.message || "The student list could not be loaded."}
              onRetry={() => query.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={hasFilters ? <UserSearch className="size-5" /> : <SlidersHorizontal className="size-5" />}
              title={hasFilters ? "No students match" : "No students yet"}
              message={
                hasFilters
                  ? "Try a different name, or clear the filters to see everyone."
                  : "Register a student to start building the face gallery."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => router.push("/register")}>
                    Register student
                  </Button>
                )
              }
            />
          ) : (
            <div ref={listRef} className="-mx-1 divide-y divide-border overflow-hidden rounded-xl">
              {visible.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  )}
                  data-student={row.id}
                >
                  <Avatar name={row.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.enrollmentNo}
                      <span className="hidden sm:inline">
                        {" · "}
                        {row.degree}
                        {row.department ? ` · ${row.department}` : ""} · Sec {row.section} ·{" "}
                        {ordinal(row.year)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusDot status={row.todayStatus} className="text-xs" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {row.monthPct}% this month
                    </span>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground/70"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}

          {rows.length > limit && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + CHUNK)}>
                Show more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <QuickView
        student={selected}
        onClose={() => setSelected(null)}
        onOpen={(id) => {
          setSelected(null);
          router.push(`/students/${id}`);
        }}
        onReenroll={(id) => {
          setSelected(null);
          router.push(`/register?student=${id}`);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------- quick view */

function QuickView({
  student,
  onClose,
  onOpen,
  onReenroll,
}: {
  student: StudentRow | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onReenroll: (id: string) => void;
}) {
  return (
    <Modal
      open={Boolean(student)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Quick view"
      size="md"
      footer={
        student && (
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onReenroll(student.id)}>
              Re-enroll face
            </Button>
            <Button className="flex-1" onClick={() => onOpen(student.id)}>
              Open profile
            </Button>
          </div>
        )
      }
    >
      {student && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={student.name} size={56} />
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold tracking-[-0.01em]">
                {student.name}
              </p>
              <p className="text-sm text-muted-foreground">{student.enrollmentNo}</p>
              <div className="mt-1.5">
                <StatusDot status={student.todayStatus} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-muted/60 p-4 text-sm">
            <KV label="Degree" value={student.degree} />
            <KV label="Department" value={student.department ?? "—"} />
            <KV label="Section" value={`Section ${student.section}`} />
            <KV label="Year" value={ordinal(student.year)} />
          </div>

          <div className="flex items-center gap-5">
            <ProgressRing value={student.monthPct} size={80} stroke={6} />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <KV
                label="Present"
                value={`${student.presentDays} of ${student.workingDays} working days`}
              />
              <KV label="This month" value={`${student.monthPct}%`} />
              <KV label="Today" value={statusLabel(student.todayStatus)} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
