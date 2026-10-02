"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Pose, RegisterIssue } from "@/lib/constants";
import { FRAMES_PER_POSE, MIN_GOOD_FRAMES, MIN_POSES, POSES } from "@/lib/constants";
import { getCameraPrefs } from "@/lib/prefs";

/** The four angles the guided flow walks through — 4 × 3 frames = 12 total. */
export const POSE_PLAN: Pose[] = POSES.slice(0, 4);

export type CapturePhase =
  | "idle"
  | "starting"
  | "active"
  | "paused"
  | "denied"
  | "unsupported"
  | "failed";

export interface Shot {
  url: string;
  pose: Pose;
  blob: Blob;
}

export interface CaptureState {
  phase: CapturePhase;
  error: string | null;
  issues: RegisterIssue[];
  message: string | null;
  detectedPose: Pose | null;
  faceBox: [number, number, number, number] | null;
  currentPose: Pose;
  counts: Partial<Record<Pose, number>>;
  shots: Shot[];
  ready: boolean;
  planComplete: boolean;
}

const CHECK_INTERVAL_MS = 420;
const MAX_WIDTH = 960;

function poseIndex(pose: Pose): number {
  const i = POSE_PLAN.indexOf(pose);
  return i < 0 ? 0 : i;
}

function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(1, MAX_WIDTH / Math.max(1, vw));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(vw * scale));
  canvas.height = Math.max(1, Math.round(vh * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return Promise.reject(new Error("Canvas unavailable."));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not read the frame."))),
      "image/jpeg",
      0.9,
    );
  });
}

/**
 * Guided face capture.
 *
 * The loop is deliberately a `setInterval` of API checks rather than a
 * per-frame render loop: only a settled check flips React state, and the video
 * itself stays a plain element — nothing here re-renders at camera rate.
 */
export function useRegisterCapture() {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlight = useRef(false);
  const countsRef = useRef<Partial<Record<Pose, number>>>({});
  const poseRef = useRef<Pose>(POSE_PLAN[0]);
  const closed = useRef(false);

  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<RegisterIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [detectedPose, setDetectedPose] = useState<Pose | null>(null);
  const [faceBox, setFaceBox] = useState<[number, number, number, number] | null>(null);
  const [currentPose, setCurrentPose] = useState<Pose>(POSE_PLAN[0]);
  const [counts, setCounts] = useState<Partial<Record<Pose, number>>>({});
  const [shots, setShots] = useState<Shot[]>([]);

  const covered = POSE_PLAN.filter((p) => (counts[p] ?? 0) > 0).length;
  const ready = shots.length >= MIN_GOOD_FRAMES && covered >= MIN_POSES;
  const planComplete = POSE_PLAN.every((p) => (counts[p] ?? 0) >= FRAMES_PER_POSE);

  /** Ref callback: the element itself stays inside the hook, never in render. */
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    const video = videoElRef.current;
    if (video) video.srcObject = null;
    setPhase((p) => (p === "idle" || p === "denied" || p === "failed" ? p : "paused"));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      setError("This browser cannot open a camera here. Try HTTPS or a different browser.");
      return;
    }
    setPhase("starting");
    try {
      const prefs = getCameraPrefs();
      const videoConstraint = prefs.deviceId
        ? { deviceId: { exact: prefs.deviceId } }
        : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });
      streamRef.current = stream;
      const video = videoElRef.current;
      if (!video) throw new Error("Camera view missing.");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setPhase("active");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPhase("denied");
        setError("Camera access was blocked. Allow it in your browser settings, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setPhase("failed");
        setError("No usable camera was found on this device.");
      } else {
        setPhase("failed");
        setError(err instanceof Error && err.message ? err.message : "The camera could not start.");
      }
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    countsRef.current = {};
    poseRef.current = POSE_PLAN[0];
    inFlight.current = false;
    setCounts({});
    setCurrentPose(POSE_PLAN[0]);
    setShots((prev) => {
      for (const s of prev) URL.revokeObjectURL(s.url);
      return [];
    });
    setIssues([]);
    setMessage(null);
    setDetectedPose(null);
    setFaceBox(null);
    setError(null);
    setPhase("idle");
  }, [stop]);

  const skipPose = useCallback(() => {
    const idx = poseIndex(poseRef.current);
    const next = POSE_PLAN[idx + 1];
    if (next) {
      poseRef.current = next;
      setCurrentPose(next);
      setMessage(null);
    }
  }, []);

  // Release the stream when the screen goes away.
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, []);

  const advance = useCallback(() => {
    const idx = poseIndex(poseRef.current);
    const next = POSE_PLAN[idx + 1];
    if (next) {
      poseRef.current = next;
      setCurrentPose(next);
      setMessage(null);
    }
  }, []);

  const accept = useCallback(
    (blob: Blob, pose: Pose) => {
      // A finished pose is finished: the last angle would otherwise keep
      // collecting frames forever while the plan waits for the review screen.
      if ((countsRef.current[pose] ?? 0) >= FRAMES_PER_POSE) return;
      const url = URL.createObjectURL(blob);
      setShots((prev) => [...prev, { url, pose, blob }]);
      countsRef.current = { ...countsRef.current, [pose]: (countsRef.current[pose] ?? 0) + 1 };
      setCounts({ ...countsRef.current });
      if ((countsRef.current[pose] ?? 0) >= FRAMES_PER_POSE) advance();
    },
    [advance],
  );

  // The check loop. Everything it reads lives in refs, so the interval never
  // goes stale and only quality changes ever reach React.
  useEffect(() => {
    if (phase !== "active") return;

    const id = window.setInterval(() => {
      if (inFlight.current || closed.current) return;
      const video = videoElRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      inFlight.current = true;

      (async () => {
        const frame = await grabFrame(video);
        const pose = poseRef.current;
        const check = await api().registerCheck(frame, null, pose);

        if (closed.current) return;
        setIssues(check.issues);
        setDetectedPose(check.pose);
        setFaceBox(check.faceBox);

        if (!check.ok || check.issues.length > 0) {
          setMessage(null);
          return;
        }

        const shown = check.pose ?? pose;
        if (shown !== pose) {
          setMessage("Match the pose on screen first.");
          return;
        }
        setMessage(null);
        accept(frame, pose);
      })().catch((err: unknown) => {
        if (closed.current) return;
        setIssues([]);
        setMessage(err instanceof Error ? err.message : "The frame check failed.");
      }).finally(() => {
        inFlight.current = false;
      });
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [phase, accept]);

  return {
    attachVideo,
    state: {
      phase,
      error,
      issues,
      message,
      detectedPose,
      faceBox,
      currentPose,
      counts,
      shots,
      ready,
      planComplete,
    } satisfies CaptureState,
    start,
    stop,
    reset,
    skipPose,
  };
}
