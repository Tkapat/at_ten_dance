"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, USE_MOCK } from "@/lib/api";
import type { FrameReply, RecognitionEvent, StudentRow } from "@/lib/types";
import { FaceOverlay, readOverlayColors } from "@/lib/overlay";
import { scannerToken } from "@/lib/token";
import { getCameraPrefs } from "@/lib/prefs";

export type StreamStatus = "idle" | "starting" | "connecting" | "open" | "error";

export interface StreamStats {
  ms: number | null;
  faces: number;
  fps: number;
}

const FRAME_MS = 110; // ~9 checks/s when the server keeps up
const JPEG_QUALITY = 0.7;
const CAPTURE_WIDTH = 640;
const MAX_BACKOFF_MS = 15_000;

export interface FaceStream {
  attachVideo: (el: HTMLVideoElement | null) => void;
  attachCanvas: (el: HTMLCanvasElement | null) => void;
  refreshColors: () => void;
  setMirror: (mirror: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
  status: StreamStatus;
  error: string | null;
  hints: string[];
  stats: StreamStats;
  events: RecognitionEvent[];
}

function parseReply(data: unknown): FrameReply | null {
  try {
    const text =
      typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
    return JSON.parse(text) as FrameReply;
  } catch {
    return null;
  }
}

type MockTrack = FrameReply["tracks"][number];

/** Deterministic demo feed so the Scan screen is reviewable with no backend. */
function mockReply(seq: number, students: StudentRow[]): FrameReply {
  const t = seq / 6;
  const present = students.length === 0 ? 0 : seq % 44 < 14 ? 0 : seq % 3 === 0 ? 2 : 1;
  const tracks: MockTrack[] = students.slice(0, present).map((s, i) => {
    const cx = 0.5 + Math.sin(t + i * 2.1) * 0.16;
    const cy = 0.45 + Math.cos(t * 0.8 + i) * 0.08;
    const w = 0.2;
    const h = 0.3;
    const recognized = seq % 7 !== 3;
    return {
      id: i + 1,
      box: [cx - w / 2, cy - h / 2, w, h] as [number, number, number, number],
      state: recognized ? "recognized" : "scanning",
      studentId: recognized ? s.id : null,
      name: recognized ? s.name : null,
      enrollmentNo: recognized ? s.enrollmentNo : undefined,
      sim: recognized ? 0.74 + ((seq + i) % 12) / 100 : undefined,
    };
  });

  const events =
    seq % 20 === 0
      ? tracks
          .filter((tr) => tr.state === "recognized" && tr.studentId)
          .map((tr) => ({
            type: "recognized" as const,
            studentId: tr.studentId as string,
            name: tr.name,
            sim: tr.sim ?? 0.8,
            trackId: tr.id,
          }))
      : [];

  return {
    seq,
    ms: 140 + Math.round(Math.sin(t) * 30),
    faces: tracks.length,
    hints: tracks.length === 0 || seq % 23 === 5 ? ["Move closer"] : [],
    tracks,
    events,
  };
}

export function useFaceStream(): FaceStream {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<FaceOverlay | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef(0);
  const reconnectTimerRef = useRef(0);
  const inflightRef = useRef(false);
  const seqRef = useRef(0);
  const backoffRef = useRef(0);
  const shouldRunRef = useRef(false);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const studentsRef = useRef<StudentRow[]>([]);
  const statsWindowRef = useRef({ count: 0, at: 0, ms: 0, faces: 0 });

  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [stats, setStats] = useState<StreamStats>({ ms: null, faces: 0, fps: 0 });
  const [events, setEvents] = useState<RecognitionEvent[]>([]);

  const handleReply = useCallback((reply: FrameReply) => {
    seqRef.current = reply.seq;
    overlayRef.current?.push(reply);

    setHints((prev) => {
      const next = reply.hints;
      if (prev.length === next.length && prev.every((h, i) => h === next[i])) return prev;
      return next;
    });

    const win = statsWindowRef.current;
    const now = Date.now();
    if (win.at === 0) win.at = now;
    win.count += 1;
    win.ms = reply.ms;
    win.faces = reply.faces;
    if (now - win.at >= 1000) {
      setStats({
        ms: win.ms,
        faces: win.faces,
        fps: Math.round((win.count * 1000) / (now - win.at)),
      });
      win.count = 0;
      win.at = now;
    }

    if (reply.events && reply.events.length > 0) {
      const incoming = reply.events;
      setEvents((prev) => [...incoming, ...prev].slice(0, 40));
    }
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoElRef.current;
    if (!video || !video.videoWidth) return null;
    if (!captureRef.current) captureRef.current = document.createElement("canvas");
    const canvas = captureRef.current;
    const w = CAPTURE_WIDTH;
    const h = Math.max(1, Math.round((video.videoHeight * w) / video.videoWidth));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    overlayRef.current?.setVideoSize(video.videoWidth, video.videoHeight);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  }, []);

  const startFrames = useCallback(() => {
    window.clearInterval(frameTimerRef.current);
    frameTimerRef.current = window.setInterval(() => {
      if (!shouldRunRef.current || inflightRef.current) return;
      if (USE_MOCK) {
        seqRef.current += 1;
        handleReply(mockReply(seqRef.current, studentsRef.current));
        return;
      }
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      inflightRef.current = true;
      void captureFrame().then((blob) => {
        if (!blob || ws.readyState !== WebSocket.OPEN) {
          inflightRef.current = false;
          return;
        }
        ws.send(blob);
      });
    }, FRAME_MS);
  }, [captureFrame, handleReply]);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!shouldRunRef.current || USE_MOCK) return;
    void (async () => {
      const token = await scannerToken();
      if (!shouldRunRef.current) return;
      if (!token) {
        setStatus("error");
        setError("Your session expired. Sign in again to start scanning.");
        return;
      }
      setStatus("connecting");
      let ws: WebSocket;
      try {
        ws = new WebSocket(api().streamUrl(token));
      } catch {
        setStatus("error");
        setError("The recognition service could not be reached.");
        return;
      }
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 0;
        inflightRef.current = false;
        setStatus("open");
        setError(null);
      };
      ws.onmessage = (ev) => {
        inflightRef.current = false;
        const reply = parseReply(ev.data);
        if (reply) handleReply(reply);
      };
      ws.onclose = (ev) => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!shouldRunRef.current) return;
        if (ev.code === 1000 || ev.code === 1001) {
          shouldRunRef.current = false;
          setStatus("idle");
          return;
        }
        backoffRef.current = Math.min(
          MAX_BACKOFF_MS,
          backoffRef.current === 0 ? 500 : backoffRef.current * 2,
        );
        setStatus("connecting");
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(
          () => connectRef.current(),
          backoffRef.current,
        );
      };
    })();
  }, [handleReply]);

  // The close handler needs to schedule the next attempt, so it reads the
  // latest `connect` through a ref kept in sync by an effect.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    if (canvasElRef.current && canvasElRef.current !== el) {
      overlayRef.current?.destroy();
      overlayRef.current = null;
    }
    canvasElRef.current = el;
    if (!el) return;
    const overlay = new FaceOverlay(el, { mirror: true });
    overlay.setColors(readOverlayColors());
    overlay.resize();
    overlayRef.current = overlay;
    const observer = new ResizeObserver(() => overlay.resize());
    observer.observe(el);
    if (shouldRunRef.current) overlay.start();
  }, []);

  const refreshColors = useCallback(() => {
    overlayRef.current?.setColors(readOverlayColors());
  }, []);

  const setMirror = useCallback((mirror: boolean) => {
    overlayRef.current?.setMirror(mirror);
  }, []);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    window.clearInterval(frameTimerRef.current);
    window.clearTimeout(reconnectTimerRef.current);
    inflightRef.current = false;
    if (wsRef.current) {
      wsRef.current.close(1000, "stop");
      wsRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    const video = videoElRef.current;
    if (video) video.srcObject = null;
    overlayRef.current?.stop();
    overlayRef.current?.clear();
    setStatus("idle");
    setHints([]);
    setStats({ ms: null, faces: 0, fps: 0 });
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("This browser cannot open a camera here. Try HTTPS or a different browser.");
      return;
    }
    setStatus("starting");
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

      shouldRunRef.current = true;
      seqRef.current = 0;
      backoffRef.current = 0;
      statsWindowRef.current = { count: 0, at: 0, ms: 0, faces: 0 };
      overlayRef.current?.setColors(readOverlayColors());
      overlayRef.current?.resize();
      overlayRef.current?.start();

      if (USE_MOCK) {
        studentsRef.current = await api().listStudents().catch(() => [] as StudentRow[]);
        setStatus("open");
      } else {
        connect();
      }
      startFrames();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setStatus("error");
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Camera access was blocked. Allow it in your browser settings, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No usable camera was found on this device.");
      } else {
        setError(
          err instanceof Error && err.message ? err.message : "The camera could not start.",
        );
      }
    }
  }, [connect, startFrames]);

  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      window.clearInterval(frameTimerRef.current);
      window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "unmount");
        wsRef.current = null;
      }
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
      overlayRef.current?.destroy();
      overlayRef.current = null;
    };
  }, []);

  return {
    attachVideo,
    attachCanvas,
    refreshColors,
    setMirror,
    start,
    stop,
    status,
    error,
    hints,
    stats,
    events,
  };
}
