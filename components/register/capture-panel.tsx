"use client";

import { Camera, Check, CheckCircle2, RefreshCw } from "lucide-react";
import {
  POSE_PLAN,
  useRegisterCapture,
  type CaptureState,
} from "@/hooks/use-register-capture";
import {
  FRAMES_PER_POSE,
  ISSUE_PRIORITY,
  ISSUE_TEXT,
  LIVE_HINT_TEXT,
  MIN_GOOD_FRAMES,
  MIN_POSES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCameraPrefs } from "@/hooks/use-camera-prefs";

/** One live guidance string: a quality gate first, then the check's message. */
function guidance(state: CaptureState): string | null {
  const gate = ISSUE_PRIORITY.find((code) => state.issues.includes(code));
  if (gate) return ISSUE_TEXT[gate];
  if (state.message) return LIVE_HINT_TEXT[state.message] ?? state.message;
  return null;
}

export function CapturePanel({
  capture,
  onContinue,
}: {
  capture: ReturnType<typeof useRegisterCapture>;
  onContinue: () => void;
}) {
  // Destructured so the ref-callback binding never taints the rest of the
  // hook's return value while rendering.
  const { state: s, attachVideo, start, stop, skipPose } = capture;
  const prefs = useCameraPrefs();
  const tip = guidance(s);
  const covered = POSE_PLAN.filter((p) => (s.counts[p] ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[440px] overflow-hidden rounded-3xl bg-black sm:aspect-[4/3]">
        <video
          ref={attachVideo}
          autoPlay
          playsInline
          muted
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            prefs.mirror && "-scale-x-100",
            s.phase === "active" ? "opacity-100" : "opacity-0",
          )}
        />

        {s.phase === "active" && (
          <>
            {/* Oval guide: the area outside it is dimmed so framing is obvious. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 42% 44% at 50% 46%, transparent 62%, rgba(0,0,0,0.55) 63%)",
              }}
              aria-hidden
            />

            {s.faceBox && (
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-primary/90"
                style={{
                  left: `${Math.max(0, s.faceBox[0]) * 100}%`,
                  top: `${Math.max(0, s.faceBox[1]) * 100}%`,
                  width: `${Math.min(1, s.faceBox[2]) * 100}%`,
                  height: `${Math.min(1, s.faceBox[3]) * 100}%`,
                }}
                aria-hidden
              />
            )}

            {/* Pose prompt */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
              <span className="rounded-full bg-black/55 px-3.5 py-1.5 text-center text-[13px] font-medium text-white backdrop-blur-sm">
                {s.counts[s.currentPose] !== undefined && s.counts[s.currentPose]! > 0
                  ? `${s.counts[s.currentPose]} of ${FRAMES_PER_POSE} captured`
                  : "Hold still"}
              </span>
            </div>

            {/* Guidance chip */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3"
              aria-live="polite"
            >
              <span
                className={cn(
                  "max-w-[92%] rounded-full px-3.5 py-1.5 text-center text-[13px] font-medium backdrop-blur-sm",
                  tip ? "bg-warning/90 text-black" : "bg-success/90 text-black",
                )}
              >
                {tip ?? "Looking good — hold it"}
              </span>
            </div>
          </>
        )}

        {(s.phase === "idle" ||
          s.phase === "starting" ||
          s.phase === "paused" ||
          s.phase === "denied" ||
          s.phase === "unsupported" ||
          s.phase === "failed") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
            {s.phase === "starting" ? (
              <Spinner className="size-6 text-white" />
            ) : (
              <Camera className="size-8 text-white/70" />
            )}
            <p className="text-sm text-white/85">
              {s.phase === "starting"
                ? "Starting the camera…"
                : s.error ?? "The camera is off. Turn it on to capture frames."}
            </p>
            {s.phase !== "starting" && (
              <Button onClick={() => void start()}>
                {s.phase === "denied" || s.phase === "failed" ? (
                  <>
                    <RefreshCw className="size-4" /> Try again
                  </>
                ) : (
                  (s.phase === "paused" ? "Resume camera" : "Enable camera")
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ pose plan */}
      <ul className="grid grid-cols-4 gap-2">
        {POSE_PLAN.map((pose) => {
          const got = s.counts[pose] ?? 0;
          const done = got >= FRAMES_PER_POSE;
          const active = pose === s.currentPose && s.phase === "active";
          return (
            <li
              key={pose}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                done
                  ? "border-success/40 bg-success/10"
                  : active
                    ? "border-primary/50 bg-primary/8"
                    : "border-border",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : got}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {pose === s.currentPose && s.phase === "active" ? (
                  <span className="font-medium text-foreground">{pose}</span>
                ) : (
                  pose
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {s.shots.length} frames · {covered} of {MIN_POSES}+ poses · needs{" "}
          {MIN_GOOD_FRAMES} frames
        </span>
        {s.phase === "active" && (
          <Button variant="ghost" size="sm" onClick={skipPose}>
            Skip this angle
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="lg"
          disabled={!s.ready}
          onClick={onContinue}
        >
          {s.planComplete ? "All angles captured — review" : "Review capture"}
        </Button>
        {s.phase === "active" && (
          <Button variant="outline" size="lg" onClick={stop}>
            Pause
          </Button>
        )}
      </div>

      {!s.ready && s.shots.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Capture a few more angles before continuing — at least {MIN_GOOD_FRAMES} good frames
          across {MIN_POSES} poses.
        </p>
      )}

      {s.phase === "active" && s.ready && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-success">
          <CheckCircle2 className="size-3.5" aria-hidden /> Enough frames captured — you can
          continue.
        </p>
      )}
    </div>
  );
}
