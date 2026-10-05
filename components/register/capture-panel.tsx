"use client";

import { Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { m } from "framer-motion";
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
import { dur, ease } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCameraPrefs } from "@/hooks/use-camera-prefs";
import { useMotionPref } from "@/hooks/useMotionPref";
import { CheckDraw } from "@/components/motion/CheckDraw";

/**
 * The oval guide's edge, matching the radial-gradient dimmer below (the dark
 * ring starts at 62% of the `ellipse 42% 44% at 50% 46%` guide). One arc is
 * drawn per planned pose, in viewBox units stretched with `preserveAspectRatio
 * = "none"`; strokes keep their width via `vector-effect`.
 */
const OVAL = { cx: 50, cy: 46, rx: 0.62 * 42, ry: 0.62 * 44 };

function ovalArc(a0: number, a1: number): string {
  const pt = (a: number): [number, number] => [
    OVAL.cx + OVAL.rx * Math.cos(a),
    OVAL.cy + OVAL.ry * Math.sin(a),
  ];
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const rx = OVAL.rx.toFixed(2);
  const ry = OVAL.ry.toFixed(2);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rx} ${ry} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const OVAL_ARCS = POSE_PLAN.map((pose, i) => {
  const step = (Math.PI * 2) / POSE_PLAN.length;
  const gap = step * 0.12;
  return {
    pose,
    d: ovalArc(-Math.PI / 2 + i * step + gap / 2, -Math.PI / 2 + (i + 1) * step - gap / 2),
  };
});

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
  const mpref = useMotionPref();
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

            {/* Pose progress ring: arcs fill as frames land, then hold green. */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {OVAL_ARCS.map(({ pose, d }) => {
                const fill = Math.min(
                  1,
                  (s.counts[pose] ?? 0) / FRAMES_PER_POSE,
                );
                const done = fill >= 1;
                return (
                  <g key={pose}>
                    <path
                      d={d}
                      fill="none"
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <m.path
                      d={d}
                      fill="none"
                      stroke={done ? "hsl(var(--success))" : "hsl(var(--primary))"}
                      strokeWidth={2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: fill }}
                      transition={{ duration: mpref.reduced ? 0 : dur.slow, ease: ease.out }}
                    />
                  </g>
                );
              })}
            </svg>

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
              {done ? (
                <span className="grid size-5 place-items-center">
                  <CheckDraw size={18} key={pose} />
                </span>
              ) : (
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {got}
                </span>
              )}
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
