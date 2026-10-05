import { jwtVerify, SignJWT } from "jose";

/**
 * Server-side session helpers, shared by the route handlers and `proxy.ts`.
 *
 * The cookie is httpOnly: the browser cannot read it. Two things need it —
 * `proxy.ts`, which reads the role to decide which half of the app exists, and
 * the data proxy, which forwards it as the bearer token. Both read the same
 * cookie, and neither asks the network anything.
 *
 * What is in the cookie is whatever the service minted: institute staff and
 * students sign in against the service, and the token it returns already
 * carries `role`, `name` and `inst`. Mock mode mints an equivalent token
 * locally, because there is no service to ask.
 *
 * The client fetches the raw token from `GET /api/auth/token` when it has to
 * call the service directly or open the recognition WebSocket, which cannot
 * carry an Authorization header.
 */

export const SESSION_COOKIE = "ft_token";

const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Roles the app knows about. `claim` is a short-lived door key, never a session. */
export type SessionRole = "owner" | "admin" | "staff" | "student";

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production.");
  }
  return new TextEncoder().encode(secret || "facetrack-dev-secret-change-me");
}

/** What a verified cookie says about who is calling. */
export interface SessionClaims {
  /** The service's user id: an institute user row, or a student row. */
  sub: string;
  role: SessionRole;
  name: string;
  /** The institute everything on screen belongs to. */
  inst: string;
  expiresAt: number;
  /** Kept because the shell still calls the subject that. */
  username: string;
}

export async function createSessionToken(
  subject: string,
  claims: { role?: SessionRole; name?: string; inst?: string } = {},
): Promise<string> {
  return new SignJWT({
    role: claims.role ?? "owner",
    name: claims.name ?? subject,
    inst: claims.inst ?? "",
  })
    .setSubject(subject)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verify a session cookie, from either source.
 *
 * Returns null for a missing, malformed, expired or unsigned-cookie value. The
 * role is only trusted when it is one this app knows: a token minted elsewhere
 * with a role claim of `claim` is not a session.
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    const role = typeof payload.role === "string" ? payload.role : "owner";
    if (role !== "owner" && role !== "admin" && role !== "staff" && role !== "student") {
      return null;
    }
    return {
      sub: payload.sub,
      username: payload.sub,
      role,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      inst: typeof payload.inst === "string" ? payload.inst : "",
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}