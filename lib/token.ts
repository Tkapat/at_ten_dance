/**
 * Client-side bearer token cache.
 *
 * The token itself lives in an httpOnly cookie (see `lib/session.ts`); this
 * module holds one in memory for the lifetime of the tab so the API client and
 * the recognition WebSocket can use it without ever reading the cookie.
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
export function ensureToken(): Promise<string | null> {
  if (token) return Promise.resolve(token);
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

export function clearToken() {
  token = null;
}
