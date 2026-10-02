import type { FrameReply, Track, TrackState } from "./types";

/**
 * Canvas overlay for the live recognition feed.
 *
 * Boxes arrive normalised to the frame; this lerps them toward each new
 * position (0.35 per tick) and draws corner brackets plus a name pill at 60 fps.
 * Nothing here touches React — the hook hands it a reply and the loop runs on
 * its own rAF, so a recognition never costs a re-render.
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

const LERP = 0.35;
const DROP_AFTER = 4; // replies a target may miss before it fades out

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
}

function hsl(triplet: string, alpha?: number): string {
  return alpha === undefined ? `hsl(${triplet})` : `hsl(${triplet} / ${alpha})`;
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

  /** Re-read the CSS box and backing-store size. Cheap; call on resize. */
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

  /** Merge one server reply into the target set. Never renders by itself. */
  push(reply: FrameReply) {
    const live = new Set<number>();
    for (const track of reply.tracks) {
      live.add(track.id);
      const [x, y, w, h] = track.box;
      const existing = this.targets.get(track.id);
      if (existing) {
        existing.tx = x;
        existing.ty = y;
        existing.tw = w;
        existing.th = h;
        existing.state = track.state;
        existing.name = track.name;
        existing.sim = track.sim ?? null;
        existing.missing = 0;
        existing.leaving = false;
        existing.seen = true;
        existing.alpha = Math.min(1, existing.alpha + 0.25);
      } else {
        this.targets.set(track.id, this.makeTarget(track));
      }
    }

    for (const [id, target] of this.targets) {
      if (live.has(id)) continue;
      target.missing += 1;
      if (target.missing >= DROP_AFTER) target.leaving = true;
    }
  }

  clear() {
    this.targets.clear();
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.step();
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

  private makeTarget(track: Track): Target {
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
    };
  }

  /** Normalised box → CSS pixels, reproducing `object-fit: cover` on the video. */
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

  private step() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    for (const t of this.targets.values()) {
      t.x += (t.tx - t.x) * LERP;
      t.y += (t.ty - t.y) * LERP;
      t.w += (t.tw - t.w) * LERP;
      t.h += (t.th - t.h) * LERP;

      if (t.leaving) {
        t.alpha -= 0.08;
        if (t.alpha <= 0) {
          this.targets.delete(t.id);
          continue;
        }
      } else if (t.alpha < 1) {
        t.alpha = Math.min(1, t.alpha + 0.12);
      }

      const rect = this.mapRect(t.x, t.y, t.w, t.h);
      const color =
        t.state === "recognized"
          ? this.colors.success
          : t.state === "scanning"
            ? this.colors.warning
            : this.colors.muted;

      ctx.globalAlpha = t.alpha;
      drawBrackets(ctx, rect, color);
      drawLabel(ctx, rect, t, this.colors, this.cssW);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBrackets(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  color: string,
) {
  const len = Math.max(8, Math.min(18, Math.min(r.w, r.h) * 0.28));
  ctx.strokeStyle = hsl(color);
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
