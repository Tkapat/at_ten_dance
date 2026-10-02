/**
 * Build-time environment. Inlined into both bundles by Next, so reading these
 * on the server (route handlers, proxy) and in the browser gives the same
 * answer within a build.
 */

/** Mock is the default: `NEXT_PUBLIC_USE_MOCK=false` connects the real service. */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export const WS_BASE = API_BASE.replace(/^http/, "ws");
