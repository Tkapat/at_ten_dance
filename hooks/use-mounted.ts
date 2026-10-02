"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True after hydration, false on the server and during the first paint.
 *
 * `useSyncExternalStore` gives React the server snapshot during hydration, so
 * the markup still matches; the client snapshot then triggers exactly one
 * re-render — which is what a `useEffect(() => setMounted(true))` wanted to do,
 * without the extra render pass on the server.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
