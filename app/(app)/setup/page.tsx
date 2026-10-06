"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { CodeChip } from "@/components/ui/code-chip";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { SetupStatus } from "@/lib/types";

/**
 * Where a new institute lands.
 *
 * This is the interim version: the checklist and the code, read from
 * `GET /setup/status`, so an owner who has just signed up can see what there is to
 * do and confirm the code worked. The wizard built on top of it — the progress
 * bar, the ordering, and the four import screens — is the next phase; this is the
 * floor rather than the destination.
 */

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  detail: string;
  /** Shown when an item is not needed before attendance works. */
  optional?: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const status = useQuery<SetupStatus>({
    queryKey: ["setup-status"],
    queryFn: () => api().setupStatus(),
  });

  if (status.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-7">
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-7">
        <ErrorState onRetry={() => void status.refetch()} />
      </div>
    );
  }

  const body = status.data.status;
  const institute = status.data.institute;

  const items: ChecklistItem[] = [
    {
      key: "structure",
      label: "Academic structure",
      done: body.structure.done,
      detail: body.structure.done
        ? `${body.structure.count} programmes`
        : "Import the programmes you teach",
    },
    {
      key: "schema",
      label: "Student columns",
      done: body.studentSchema.done,
      detail: body.studentSchema.done
        ? `${body.studentSchema.count} columns`
        : "Choose what is on a student record",
    },
    {
      key: "students",
      label: "Student list",
      done: body.students.done,
      detail: `${body.students.enrolled} of ${body.students.total} enrolled · ${body.students.joined} joined`,
    },
    {
      key: "calendar",
      label: "Calendar and holidays",
      done: body.calendar.done,
      optional: true,
      detail: body.holidays.done
        ? `${body.holidays.count} holidays`
        : "Optional, but attendance percentages are better with it",
    },
  ];

  const done = items.filter((i) => i.done).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-7 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Set up your institute</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {done === items.length
              ? "Everything is in place."
              : `${done} of ${items.length} done. Students can join once the list is in.`}
          </p>
        </div>
        {institute?.code && <CodeChip code={institute.code} />}
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <span
                className={
                  item.done
                    ? "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                    : "mt-0.5 size-6 shrink-0 rounded-full border-2 border-border"
                }
                aria-hidden
              >
                {item.done && (
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
              </div>
              {item.optional && !item.done && (
                <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Optional
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push("/")}>
          <Building2 className="size-4" /> Go to the console
        </Button>
      </div>

      {body.ready && body.students.total === 0 && (
        <EmptyState
          title="No students yet"
          message="Import your student list and their codes will start working straight away."
        />
      )}
    </div>
  );
}