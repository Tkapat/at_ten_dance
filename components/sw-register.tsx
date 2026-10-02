"use client";

import { useEffect } from "react";

/**
 * Registers the offline cache for production builds only — in dev the service
 * worker would fight the dev server's asset invalidation.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  return null;
}
