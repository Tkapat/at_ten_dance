import { SignJWT, jwtVerify } from "jose";

/**
 * Server-side session helpers shared by the login route handlers and `proxy.ts`.
 *
 * The cookie is httpOnly: the browser cannot read it. The client fetches the
 * raw token from `GET /api/auth/token` when it needs to call the FaceTrack
 * service directly or open the recognition WebSocket (browsers cannot set
 * headers on a WS handshake, so the token must go in the URL).
 */

export const SESSION_COOKIE = "ft_token";

const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production.");
  }
  return new TextEncoder().encode(secret || "facetrack-dev-secret-change-me");
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

export type Session = { username: string; expiresAt: number };

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return { username: payload.sub, expiresAt: payload.exp * 1000 };
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
