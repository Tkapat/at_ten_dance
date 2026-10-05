import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BACKEND_URL, IS_NGROK } from "@/lib/env";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

/**
 * The one door between the browser and the FaceTrack service.
 *
 * Every REST call the app makes ends here. This handler is deliberately thin: it
 * forwards the request with the session token from the httpOnly cookie attached
 * as a bearer token, and hands back whatever the service said. It decides
 * nothing about permissions — the service is the only thing that authorises a
 * request — and it rewrites nothing about a body, because a body that passed
 * through something other than a byte-for-byte copy is a body the browser and the
 * service no longer agree on.
 *
 * What it does decide:
 *
 *   * **401 clears the cookie.** A token the service has stopped accepting must
 *     not stay in the jar, or every later request repeats the same dead end and
 *     `proxy.ts` keeps believing there is a session.
 *   * **`Set-Cookie` is never relayed.** This app's session is set by the four
 *     `/api/auth/*` handlers and nowhere else. A cookie arriving from the
 *     service would be a second, unreadable session.
 *   * **Hop-by-hop headers are dropped in both directions**, because a proxy that
 *     forwards them is a proxy that can be desynchronised by them.
 *   * **A body over 4 MB is refused here.** The service refuses it too; refusing
 *     before the upload leaves the device is the difference between a message
 *     and a hang.
 *
 * The WebSocket does not come through here. A browser cannot put an
 * `Authorization` header on an upgrade, so the scanner connects to the service
 * directly with the token in the query string, taken from
 * `GET /api/auth/ws-token`.
 */

export const dynamic = "force-dynamic";

/** Largest request body forwarded, matching the service's own limit. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Headers that describe one connection and must not cross it. RFC 9110 §7.6.1.
 * `host` and `cookie` are here too: the first is this server's, and the second
 * is the only thing that could leak the session to the wrong place.
 */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "content-length",
]);

/** Response headers worth keeping: what it is, and what to call the file. */
const PASSTHROUGH_RESPONSE = new Set([
  "content-type",
  "content-disposition",
  "cache-control",
  "retry-after",
  "www-authenticate",
]);

type Params = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, context: Params): Promise<Response> {
  const { path = [] } = await context.params;
  // `path` is already decoded per segment by Next; joining with `/` reproduces
  // the service path exactly.
  const target = `${BACKEND_URL}/${path.map((segment) => segment).join("/")}`;

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  }
  if (IS_NGROK) headers.set("ngrok-skip-browser-warning", "1");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  let body: BodyInit | undefined;
  if (hasBody) {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { detail: { message: "That file is larger than 4 MB." } },
        { status: 413 },
      );
    }
    body = bytes;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      // Never cached: attendance changes under the reader's feet otherwise, and
      // a cached attendance list is a privacy problem as well as a wrong number.
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { detail: { message: "Cannot reach the FaceTrack service." } },
      { status: 503 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (PASSTHROUGH_RESPONSE.has(lower)) out.set(key, value);
  });

  if (upstream.status === 401) {
    // The token is no longer good for anything. Drop it here rather than waiting
    // for the client to notice, so the next navigation lands on /login instead of
    // looping through a session that cannot work.
    out.append(
      "set-cookie",
      serializeCookie(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 }),
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

/**
 * Minimal `Set-Cookie` writer.
 *
 * `Headers.append` would join two cookies with a comma, which some clients read
 * as one malformed cookie — so a cleared session would silently not clear.
 */
function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; sameSite: string; secure: boolean; path: string; maxAge: number },
): string {
  const parts = [`${name}=${value}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;