/**
 * Client-side bearer token cache.
 *
 * Almost nothing in the app holds a token any more: REST calls go through the
 * proxy, which reads the httpOnly cookie itself, so a browser token would be one
 * more copy of a secret for a script to reach. Two things still need one:
 *
 *   * the three file downloads, which the browser fetches directly so the file
 *     keeps the name the service gave it;
 *   * the recognition WebSocket, which cannot carry an Authorization header on
 *     its upgrade and therefore takes the token in the query string.
 *
 * Both get it from `/api/auth/token`, once per page load, in memory only.
 */

let token: string | null = null;
let inflight: Promise<string | null> | null = null;

export function setToken(value: string | null) {
  token = value;
}

export function getToken(): string | null {
  return token;
}

/** Fetch the token once per page load. Concurrent callers share one request. */
export async function ensureToken(): Promise<string | null> {
  if (token) return token;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/token", { cache: "no-store" });
      if (!res.ok) {
        token = null;
        return null;
      }
      const body = (await res.json()) as { token?: string };
      token = body.token ?? null;
      return token;
    } catch {
      token = null;
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * The token for the recognition WebSocket.
 *
 * A different route from `ensureToken` on purpose: this one refuses a student
 * outright, so the scanner cannot be opened by an account that has no business
 * opening it. The service refuses one too — this is the earlier of the two.
 */
export async function scannerToken(): Promise<string | null> {
  const res = await fetch("/api/auth/ws-token", { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  return body?.token ?? null;
}

export function clearToken() {
  token = null;
}
