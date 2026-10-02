"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Camera, CircleStop, Play, Radio, WifiOff } from "lucide-react";
import { api, USE_MOCK } from "@/lib/api";
import { LIVE_HINT_TEXT } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFaceStream, type StreamStatus } from "@/hooks/use-face-stream";
import { useCameraPrefs } from "@/hooks/use-camera-prefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const STATUS_COPY: Record<StreamStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "Camera off", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  starting: { label: "Starting…", dot: "bg-warning", text: "text-warning" },
  connecting: { label: "Connecting", dot: "bg-warning animate-[pulse-soft_1.4s_ease-in-out_infinite]", text: "text-warning" },
  open: { label: "Live", dot: "bg-success", text: "text-success" },
  error: { label: "Offline", dot: "bg-danger", text: "text-danger" },
};

export function Scan() {
  const stream = useFaceStream();
  const { attachVideo, attachCanvas, refreshColors, setMirror, start, stop } = stream;
  const { resolvedTheme } = useTheme();
  const prefs = useCameraPrefs();

  useEffect(() => {
    refreshColors();
  }, [refreshColors, resolvedTheme]);

  useEffect(() => {
    setMirror(prefs.mirror);
  }, [setMirror, prefs.mirror]);

  const active = stream.status === "open" || stream.status === "connecting";
  const copy = STATUS_COPY[stream.status];

  const marked = useQuery({
    queryKey: ["marked-today"],
    queryFn: () => api().recentlyMarked(),
    refetchInterval: active ? 5_000 : 15_000,
  });

  const latestEvent = stream.events[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      {/* --------------------------------------------------------- viewport */}
      <div className="space-y-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black sm:aspect-[4/3]">
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              prefs.mirror && "-scale-x-100",
              active ? "opacity-100" : "opacity-0",
            )}
          />
          <canvas
            ref={attachCanvas}
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

          {active && (
            <>
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm">
                <span className={cn("size-1.5 rounded-full", copy.dot)} aria-hidden />
                <span className={cn("text-xs font-medium", copy.text)}>{copy.label}</span>
                {USE_MOCK && (
                  <span className="text-[11px] text-white/70">· demo feed</span>
                )}
              </div>

              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-[11px] tabular-nums text-white/85 backdrop-blur-sm">
                {stream.stats.ms !== null ? `${Math.round(stream.stats.ms)} ms` : "—"}
                {" · "}
                {stream.stats.fps} fps
                {" · "}
                {stream.stats.faces} faces
              </div>

              {stream.hints.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 p-4"
                  aria-live="polite"
                >
                  {stream.hints.map((hint) => (
                    <span
                      key={hint}
                      className="rounded-full bg-warning/90 px-3 py-1.5 text-xs font-medium text-black"
                    >
                      {LIVE_HINT_TEXT[hint] ?? hint}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              {stream.status === "starting" ? (
                <span className="size-8 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              ) : (
                <Camera className="size-9 text-white/70" />
              )}
              <p className="max-w-xs text-sm text-white/85">
                {stream.error ??
                  (stream.status === "starting"
                    ? "Starting the camera…"
                    : "Point the camera at the room. Recognized students are marked automatically.")}
              </p>
              <Button onClick={() => void start()} disabled={stream.status === "starting"}>
                <Play className="size-4" />
                {stream.error ? "Try again" : "Start scanning"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {stream.status === "open"
              ? "Frames are sent one at a time and drawn on canvas — recognition never re-renders the page."
              : "Attendance is written the moment a face is confirmed."}
          </p>
          {active && (
            <Button variant="outline" size="sm" onClick={stop}>
              <CircleStop className="size-4" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- marked today */}
      <Card className="flex h-fit flex-col">
        <CardHeader>
          <CardTitle>Marked today</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="size-3.5" /> {marked.data?.length ?? 0} students
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          {marked.isPending ? (
            <ListSkeleton rows={5} />
          ) : marked.isError ? (
            <ErrorState
              message={marked.error.message || "Today's marks could not be loaded."}
              onRetry={() => marked.refetch()}
            />
          ) : !marked.data || marked.data.length === 0 ? (
            <EmptyState
              title="Nobody marked yet"
              message="Start the camera — the first confirmed face will appear here."
              icon={<WifiOff className="size-5" />}
              className="border-0 py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {marked.data.map((row) => {
                const fresh = latestEvent?.studentId === row.studentId;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-center gap-3 py-2.5",
                      fresh && "row-flash rounded-lg px-2",
                    )}
                  >
                    <Avatar name={row.name ?? row.enrollmentNo ?? "?"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.name ?? "Student"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.enrollmentNo ?? row.studentId}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatTime(row.firstSeenAt)}
                      </p>
                      <div className="mt-0.5 flex justify-end gap-1">
                        <Tag tone={row.status === "late" ? "warning" : "success"}>
                          {row.status}
                        </Tag>
                        {row.confidence !== null && row.confidence !== undefined && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {Math.round(row.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
