/**
 * Per-device preference for "Reduce motion", stored like the other camera prefs.
 * The OS setting (`prefers-reduced-motion`) is the default; a user can tighten
 * or loosen it per device in Settings → Appearance. When the user has not chosen,
 * the OS value wins and changes to it live.
 */

const KEY = "facetrack.reduceMotion"; // "on" | "off" | no key: follow OS
const listeners = new Set<() => void>();
let cached: boolean | null = null;
let storageOk = true;

function osTrue(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function read(): boolean {
  if (cached !== null) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw === "on" ? true : raw === "off" ? false : osTrue();
  } catch {
    storageOk = false;
    cached = osTrue();
  }
  return cached;
}

/** True when motion should be minimised: user asked for it, or the OS did and they haven't overridden. */
export function reducedMotionPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return read();
}

/** Whether the user has explicitly chosen (vs following the OS). */
export function reducedMotionOverride(): boolean | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "on" ? true : raw === "off" ? false : null;
  } catch {
    return null;
  }
}

export function setReducedMotionOverride(value: boolean | null): void {
  cached = value === null ? osTrue() : value;
  if (storageOk) {
    try {
      if (value === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, value ? "on" : "off");
    } catch {
      storageOk = false;
    }
  }
  for (const listener of listeners) listener();
  try {
    document.dispatchEvent(new Event("facetrackMotionPref"));
  } catch {
    /* not in a browser context */
  }
}

export function subscribeReducedMotion(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reducedMotionSnapshot(): boolean {
  return read();
}
