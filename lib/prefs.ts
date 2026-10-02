/**
 * Device preferences that live in `localStorage` rather than on the server —
 * they describe this browser's camera, not the attendance policy.
 */

export interface CameraPrefs {
  /** Empty string means "let the browser pick" (front camera by default). */
  deviceId: string;
  /** Mirror the preview. Recognition always runs on the unmirrored frames. */
  mirror: boolean;
}

const KEY = "facetrack.camera";
export const DEFAULT_CAMERA_PREFS: CameraPrefs = { deviceId: "", mirror: true };

const listeners = new Set<() => void>();
let cached: CameraPrefs | null = null;
let storageOk = true;

function read(): CameraPrefs {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw
      ? { ...DEFAULT_CAMERA_PREFS, ...(JSON.parse(raw) as Partial<CameraPrefs>) }
      : { ...DEFAULT_CAMERA_PREFS };
  } catch {
    storageOk = false;
    cached = { ...DEFAULT_CAMERA_PREFS };
  }
  return cached;
}

export function getCameraPrefs(): CameraPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CAMERA_PREFS };
  return read();
}

export function setCameraPrefs(patch: Partial<CameraPrefs>): CameraPrefs {
  const next = { ...read(), ...patch };
  cached = next;
  if (storageOk) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      storageOk = false;
    }
  }
  for (const listener of listeners) listener();
  return next;
}

export function subscribeCameraPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `true` once `localStorage` has been read — used to avoid a hydration mismatch. */
export function cameraPrefsSnapshot(): CameraPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CAMERA_PREFS };
  return read();
}
