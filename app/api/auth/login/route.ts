import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/session";
import { API_BASE, USE_MOCK } from "@/lib/env";

/**
 * Signs the admin in.
 *
 * Mock build: verifies the demo credentials locally. Real build: forwards to
 * `POST {API_BASE}/api/auth/login` and adopts whatever token the service
 * returns, so the cookie always holds a token the backend itself accepts.
 */

const MIN_PASSWORD_LENGTH = 8;

async function forwardToService(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw Object.assign(new Error(detail?.detail || "Sign in failed."), {
      status: res.status,
    });
  }
  const body = (await res.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  if (!token) throw Object.assign(new Error("The service returned no token."), { status: 502 });
  return token;
}

export async function POST(request: NextRequest) {
  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = String(payload.username ?? "").trim();
  const password = String(payload.password ?? "");
  if (!username || !password) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password is too short." }, { status: 422 });
  }

  let token: string;
  if (USE_MOCK) {
    const { DEMO_PASSWORD, DEMO_USERNAME } = await import("@/lib/constants");
    if (username.toLowerCase() !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      return NextResponse.json(
        { error: "Incorrect username or password." },
        { status: 401 },
      );
    }
    token = await createSessionToken(DEMO_USERNAME);
  } else {
    try {
      token = await forwardToService(username, password);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 502;
      return NextResponse.json(
        { error: (err as Error).message || "Sign in failed." },
        { status },
      );
    }
  }

  const response = NextResponse.json({ username });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
