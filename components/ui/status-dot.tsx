import { cn } from "@/lib/utils";
import type { Status, TrackState } from "@/lib/types";

const STATUS_STYLE: Record<Status, { dot: string; text: string; label: string }> = {
  present: { dot: "bg-success", text: "text-success", label: "Present" },
  late: { dot: "bg-warning", text: "text-warning", label: "Late" },
  excused: { dot: "bg-primary", text: "text-primary", label: "Excused" },
  absent: { dot: "bg-danger", text: "text-danger", label: "Absent" },
  holiday: { dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "Holiday" },
  sunday: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Sunday" },
};

const TRACK_STYLE: Record<TrackState, { dot: string; text: string; label: string }> = {
  recognized: { dot: "bg-success", text: "text-success", label: "Recognized" },
  scanning: { dot: "bg-warning", text: "text-warning", label: "Scanning" },
  unknown: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Unknown" },
};

/** 6 px dot plus text — colour is never the only signal. */
export function StatusDot({
  status,
  className,
  showLabel = true,
}: {
  status: Status;
  className?: string;
  showLabel?: boolean;
}) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", s.text, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} aria-hidden />
      {showLabel && <span className="text-foreground/90">{s.label}</span>}
    </span>
  );
}

export function TrackStateDot({
  state,
  className,
}: {
  state: TrackState;
  className?: string;
}) {
  const s = TRACK_STYLE[state];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", s.text, className)}>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          s.dot,
          state === "scanning" && "animate-[pulse-soft_1.4s_ease-in-out_infinite]",
        )}
        aria-hidden
      />
      <span className="text-foreground/90">{s.label}</span>
    </span>
  );
}

export function statusLabel(status: Status): string {
  return STATUS_STYLE[status].label;
}
