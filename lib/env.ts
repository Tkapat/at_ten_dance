/**
 * Build-time environment. Inlined into both bundles by Next, so reading these
 * on the server (route handlers, proxy) and in the browser gives the same
 * answer within a build.
 */

/** Mock is the default: `NEXT_PUBLIC_USE_MOCK=false` connects the real service. */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

/**
 * Where the FaceTrack service is, for the browser.
 *
 * Only two things still use this: the recognition WebSocket, which cannot go
 * through a route handler because a browser cannot set headers on an upgrade,
 * and the two download links (an import template, an error report), which the
 * browser fetches directly so the file saves with its own name.
 *
 * Everything else goes through `BACKEND_URL` below, on the server, so the
 * browser only ever talks to one origin and CORS stops being a concern.
 */
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export const WS_BASE = API_BASE.replace(/^http/, "ws");

/**
 * Server-only. The address the proxy forwards to.
 *
 * Defaults to the public URL so an existing deployment keeps working unchanged;
 * set it when the service is reachable from the server at a different address
 * than it is from a browser, which is the normal case behind a tunnel.
 */
export const BACKEND_URL = (process.env.BACKEND_URL || API_BASE).replace(/\/$/, "");

/**
 * ngrok's free tier answers a browser request with an HTML "click to continue"
 * page unless this header is present. It is documented by them, harmless
 * anywhere else, and only sent when the tunnel is what we are talking to.
 */
export const IS_NGROK = /(^|\.)ngrok-free\.dev$|(^|\.)ngrok\.(app|io)$/.test(
  new URL(BACKEND_URL).hostname,
);

/**
 * Where the client asks for a proxied service call.
 *
 * The service mounts most of its routes at the root (`/students`, `/me`) and two
 * under `/api` (`/api/health`, `/api/config`), so the proxy cannot simply strip
 * `/api` from the request path without ambiguity. Keeping the service path
 * intact under one prefix makes the mapping one-directional and obvious:
 * `/api/proxy/students` is `/students`, and `/api/proxy/api/health` is
 * `/api/health`.
 *
 * `/api/auth/*` is reserved for this app's own handlers, which set the cookie.
 */
export const PROXY_PREFIX = "/api/proxy";

/** A service path, as the proxy sees it. */
export function proxied(path: string): string {
  return `${PROXY_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}