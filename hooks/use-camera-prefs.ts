"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_CAMERA_PREFS,
  cameraPrefsSnapshot,
  subscribeCameraPrefs,
  type CameraPrefs,
} from "@/lib/prefs";

/**
 * Hydration-safe view of the camera preferences: the server and the first
 * client render both see the defaults, then React swaps in the stored values.
 */
const SERVER_DEFAULT: CameraPrefs = { ...DEFAULT_CAMERA_PREFS };

export function useCameraPrefs(): CameraPrefs {
  return useSyncExternalStore(
    subscribeCameraPrefs,
    cameraPrefsSnapshot,
    () => SERVER_DEFAULT,
  );
}
