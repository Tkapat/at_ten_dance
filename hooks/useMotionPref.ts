"use client";

import { useMemo, useSyncExternalStore } from "react";
import { dur } from "@/lib/motion";

const PREF_KEY = "facetrack.reduceMotion";
const OS_QUERY = "(prefers-reduced-motion: reduce)";

function readUserChoice(): boolean | null {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw === "on" ? true : raw === "off" ? false : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  // `storage` fires for other tabs; the custom event drives this tab (the
  // Settings → Appearance segmented control dispatches it on change).
  window.addEventListener("storage", onChange);
  document.addEventListener("facetrackMotionPref", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    document.removeEventListener("facetrackMotionPref", onChange);
  };
}

function subscribeOs(onChange: () => void): () => void {
  const mq = window.matchMedia(OS_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * The motion preference for this device, as one small object so screens stay
 * clean:
 *
 *   const m = useMotionPref();
 *   <m.div
 *     initial={{ opacity: 0, y: m.y(8) }}
 *     animate={{ opacity: 1, y: 0 }}
 *     transition={{ duration: m.t(dur.base), ease: ease.out }}
 *   />
 *
 * When motion is reduced, `t()` yields `dur.instant` (a 100 ms fade rather
 * than a tween) and `x()`/`y()` yield `0`, collapsing movement into a simple
 * opacity change; springs are snapped to their end state by `MotionConfig`.
 * `reduced` is for the branches that need a different path entirely (looping
 * pulses, count-ups). The returned object is memoised on `reduced`, so it can
 * sit safely in a dependency list.
 *
 * The setting lives in Settings → Appearance: the user's choice overrides the
 * OS once made; with no explicit choice the OS value is followed live.
 */
export function useMotionPref(): {
  reduced: boolean;
  t: (d: number) => number;
  y: (n: number) => number;
  x: (n: number) => number;
} {
  // Read straight from the media query (rather than framer's snapshot-on-mount
  // hook), so flipping the OS setting mid-session is honoured live.
  const os = useSyncExternalStore(subscribeOs, () => window.matchMedia(OS_QUERY).matches, () => false);
  // `null` on the server and during the first paint, which is exactly the
  // "follow the OS" case — a hydration-safe boundary.
  const userChoice = useSyncExternalStore(subscribe, readUserChoice, () => null);

  const reduced = userChoice === null ? !!os : userChoice;

  return useMemo(
    () => ({
      reduced,
      t: (d: number) => (reduced ? dur.instant : d),
      y: (n: number) => (reduced ? 0 : n),
      x: (n: number) => (reduced ? 0 : n),
    }),
    [reduced],
  );
}
