import type { FrameReply, Track, TrackState } from "./types";

/**
 * Canvas overlay for the live recognition feed.
 *
 * Boxes arrive normalised to the frame. A rAF loop, driven entirely from refs
 * and never from React state, draws corner brackets plus a name pill. Motion on
 * the box border is restricted to opacity and position: on-screen movement is a
 * time-based exponential lerp, never a width/height/box-shadow tween.
 */

/** HSL triplets straight from the CSS tokens, e.g. `"160 84% 39%"`. */
export interface OverlayColors {
  success: string;
  warning: string;
  muted: string;
  foreground: string;
  card: string;
}

const DEFAULT_COLORS: OverlayColors = {
  success: "160 84% 39%",
  warning: "38 92% 50%",
  muted: "240 4% 46%",
  foreground: "240 10% 4%",
  card: "0 0% 100%",
};

const DROP_AFTER = 4; // replies a target may miss before it is considered gone
const CROSS_FADE_MS = 200; // state colour crossfade
const LOCK_ON_MS = 150; // new-track bracket scale 1.15 → 1.0
const GHOST_MS = 200; // keep a lost track visible this long, fading
const RING_MS = 450; // recognition ring lifetime
const CHIP_IN_MS = 180; // name-chip scale/fade-in on confirmation
const PULSE_PERIOD_MS = 1100; // scanning-stat alpha pulse

interface Target {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  tw: number;
  th: number;
  state: TrackState;
  name: string | null;
  sim: number | null;
  alpha: number;
  missing: number;
  leaving: boolean;
  seen: boolean;
  bornAt: number;
  leavingAt: number | null;
  prevState: TrackState;
  stateT: number; // when the current state began
  recognizedAt: number | null;
}

let lastFrameT = performance.now();

function readReducedMotion(): boolean {
  try {
    const raw = typeof window !== "undefined" && window.localStorage.getItem("facetrack.reduceMotion");
    if (raw === "on") return true;
    if (raw === "off") return false;
  } catch {
    /* ignore */
  }
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hsl(triplet: string, alpha?: number): string {
  return alpha === undefined ? `hsl(${triplet})` : `hsl(${triplet} / ${alpha})`;
}

/** "160 84% 39%" → [r,g,b] 0..255 */
function tripletToRgb(triplet: string): [number, number, number] {
  const parts = triplet.split(/\s+/);
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Interpolate two token colours in RGB space; returns an hsl-solid string. */
function mixRgb(a: string, b: string, f: number): string {
  const A = tripletToRgb(a);
  const B = tripletToRgb(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * f);
  const g = Math.round(A[1] + (B[1] - A[1]) * f);
  const bl = Math.round(A[2] + (B[2] - A[2]) * f);
  return `rgb(${r} ${g} ${bl})`;
}

function stateColor(t: Target, colors: OverlayColors, now: number): string {
  const target =
    t.state === "recognized" ? colors.success : t.state === "scanning" ? colors.warning : colors.muted;
  const from =
    t.prevState === "recognized" ? colors.success : t.prevState === "scanning" ? colors.warning : colors.muted;
  // crossfade across the state change
  const f = Math.min(1, (now - t.stateT) / CROSS_FADE_MS);
  if (f >= 1 || t.prevState === t.state || readReducedMotion()) {
    return hsl(target);
  }
  return mixRgb(from, target, f);
}

export class FaceOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private targets = new Map<number, Target>();
  private colors: OverlayColors = DEFAULT_COLORS;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private videoW = 0;
  private videoH = 0;
  private mirror: boolean;
  private raf = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, opts: { mirror?: boolean } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mirror = opts.mirror ?? true;
  }

  setColors(colors: Partial<OverlayColors>) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
  }

  setMirror(mirror: boolean) {
    this.mirror = mirror;
  }

  /** Intrinsic video dimensions — needed to reproduce `object-fit: cover`. */
  setVideoSize(w: number, h: number) {
    this.videoW = w;
    this.videoH = h;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(this.cssW * this.dpr));
    const h = Math.max(1, Math.round(this.cssH * this.dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  push(reply: FrameReply) {
    const live = new Set<number>();
    const now = performance.now();
    for (const track of reply.tracks) {
      live.add(track.id);
      const [x, y, w, h] = track.box;
      const existing = this.targets.get(track.id);
      if (existing) {
        // state may have changed: note it so the colour crossfades
        const prev = existing.state;
        existing.tx = x;
        existing.ty = y;
        existing.tw = w;
        existing.th = h;
        existing.name = track.name;
        existing.sim = track.sim ?? null;
        existing.missing = 0;
        existing.leaving = false;
        existing.leavingAt = null;
        existing.seen = true;
        existing.alpha = Math.min(1, existing.alpha + 0.25);
        existing.state = track.state;
        if (prev !== track.state) {
          existing.prevState = prev;
          existing.stateT = now;
          if (track.state === "recognized") existing.recognizedAt = now;
        }
      } else {
        this.targets.set(track.id, this.makeTarget(track, now));
      }
    }

    for (const [id, target] of this.targets) {
      if (live.has(id)) continue;
      target.missing += 1;
      if (target.missing >= DROP_AFTER && !target.leaving) {
        target.leaving = true;
        target.leavingAt = now;
      }
    }
  }

  clear() {
    this.targets.clear();
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.running) return;
    this.running = true;
    lastFrameT = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameT) / 1000));
      lastFrameT = now;
      this.step(now, dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.targets.clear();
    this.ctx = null;
  }

  private makeTarget(track: Track, now: number): Target {
    const [x, y, w, h] = track.box;
    return {
      id: track.id,
      x,
      y,
      w,
      h,
      tx: x,
      ty: y,
      tw: w,
      th: h,
      state: track.state,
      name: track.name,
      sim: track.sim ?? null,
      alpha: 0.35,
      missing: 0,
      leaving: false,
      seen: false,
      bornAt: now,
      leavingAt: null,
      prevState: track.state,
      stateT: now,
      recognizedAt: track.state === "recognized" ? now : null,
    };
  }

  private mapRect(x: number, y: number, w: number, h: number) {
    let nx = x;
    if (this.mirror) nx = 1 - x - w;

    if (!this.videoW || !this.videoH) {
      return { x: nx * this.cssW, y: y * this.cssH, w: w * this.cssW, h: h * this.cssH };
    }
    const scale = Math.max(this.cssW / this.videoW, this.cssH / this.videoH);
    const dw = this.videoW * scale;
    const dh = this.videoH * scale;
    const ox = (this.cssW - dw) / 2;
    const oy = (this.cssH - dh) / 2;
    return { x: ox + nx * dw, y: oy + y * dh, w: w * dw, h: h * dh };
  }

  private step(now: number, dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    const reduced = readReducedMotion();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    for (const t of this.targets.values()) {
      // Position smoothing. Time-based exponential lerp so a box tracks a target
      // smoothly at any frame rate; under reduced motion the box simply snaps (that
      // is the function, not the flourish), with no lock-on scale/ring/pulse.
      if (reduced) {
        t.x = t.tx;
        t.y = t.ty;
        t.w = t.tw;
        t.h = t.th;
      } else {
        const k = 1 - Math.exp(-dt / 0.06);
        t.x += (t.tx - t.x) * k;
        t.y += (t.ty - t.y) * k;
        t.w += (t.tw - t.w) * k;
        t.h += (t.th - t.h) * k;
      }

      if (t.leaving && t.leavingAt !== null) {
        const elapsed = now - t.leavingAt;
        t.alpha = Math.max(0, 1 - elapsed / GHOST_MS);
        if (elapsed >= GHOST_MS || t.alpha <= 0) {
          this.targets.delete(t.id);
          continue;
        }
      } else if (t.alpha < 1) {
        t.alpha = Math.min(1, t.alpha + dt / 0.15);
      }

      const rect = this.mapRect(t.x, t.y, t.w, t.h);

      // "Locking on": a brand-new track's corner brackets scale 1.15 → 1.0.
      const lock = reduced ? 1 : 1 + 0.15 * (1 - Math.min(1, (now - t.bornAt) / LOCK_ON_MS));

      const stroke = stateColor(t, this.colors, now);

      // Scanning-state alpha pulse (sin, 1.1 s, 0.65–1.0). Recognition and
      // unknown states are static so they never distract.
      let workingAlpha = t.alpha;
      if (!reduced && t.state === "scanning") {
        workingAlpha *= 0.65 + 0.35 * (0.5 + 0.5 * Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2));
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, workingAlpha));
      drawBrackets(ctx, rect, stroke, lock);

      // One-time recognition ring: an expanding 1.0 → 1.35× of the box, fading.
      if (!reduced && t.state === "recognized" && t.recognizedAt !== null) {
        const tRing = Math.min(1, (now - t.recognizedAt) / RING_MS);
        if (tRing < 1) {
          ctx.globalAlpha = (1 - tRing) * 0.85;
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;
          const r = (Math.min(rect.w, rect.h) / 2) * (1 + 0.35 * tRing);
          ctx.beginPath();
          ctx.strokeStyle = hsl(this.colors.success);
          ctx.lineWidth = 2.5;
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      drawLabel(ctx, rect, t, this.colors, this.cssW, reduced, t.recognizedAt, now);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBrackets(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  color: string,
  scaleFactor = 1,
) {
  const len = Math.max(8, Math.min(18, Math.min(r.w, r.h) * 0.28)) * scaleFactor;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  const corners: [number, number, number, number][] = [
    [r.x, r.y, 1, 1],
    [r.x + r.w, r.y, -1, 1],
    [r.x, r.y + r.h, 1, -1],
    [r.x + r.w, r.y + r.h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  t: Target,
  colors: OverlayColors,
  canvasW: number,
  reduced: boolean,
  recognizedAt: number | null,
  now: number,
) {
  const text =
    t.state === "recognized"
      ? `${t.name ?? "Recognized"}${t.sim !== null ? `  ${Math.round(t.sim * 100)}%` : ""}`
      : t.state === "scanning"
        ? "Scanning…"
        : "Unknown";

  ctx.font = "600 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  const padX = 7;
  const boxH = 22;
  const width = Math.ceil(ctx.measureText(text).width) + padX * 2;

  const x = Math.max(2, Math.min(rect.x, canvasW - width - 2));
  const above = rect.y - boxH - 6;
  const y = above >= 2 ? above : rect.y + rect.h + 6;

  // On confirmation, the chip scales/fades in once from the box's top-left.
  let chipAlpha = 1;
  if (!reduced && t.state === "recognized" && recognizedAt !== null) {
    chipAlpha = Math.min(1, (now - recognizedAt) / CHIP_IN_MS);
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, chipAlpha));
  ctx.fillStyle = hsl(colors.card, 0.92);
  roundRect(ctx, x, y, width, boxH, 7);
  ctx.fill();

  ctx.fillStyle =
    t.state === "recognized"
      ? hsl(colors.success)
      : t.state === "scanning"
        ? hsl(colors.warning)
        : hsl(colors.muted);
  ctx.fillText(text, x + padX, y + boxH / 2 + 0.5);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function readOverlayColors(): OverlayColors {
  if (typeof window === "undefined") return DEFAULT_COLORS;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    success: read("--success", DEFAULT_COLORS.success),
    warning: read("--warning", DEFAULT_COLORS.warning),
    muted: read("--muted-foreground", DEFAULT_COLORS.muted),
    foreground: read("--foreground", DEFAULT_COLORS.foreground),
    card: read("--card", DEFAULT_COLORS.card),
  };
}
