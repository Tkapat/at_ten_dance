import { NextResponse, type NextRequest } from "next/server";
import { serviceError } from "@/lib/server/service-error";
import { BACKEND_URL, USE_MOCK } from "@/lib/env";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import type { Session } from "@/lib/types";

/**
 * Institute sign-in.
 *
 * One of four routes that exist for exactly one reason: the session has to live
 * in an httpOnly cookie, and only a server can write one. Everything else in the
 * app is proxied to the service.
 *
 * The token in the cookie is the one the service minted, not a token of our own,
 * so the data proxy can forward it verbatim as the bearer token and the service
 * stays the only thing that decides whether a session is real.
 *
 * The institute's code is not in the service's sign-in answer, so this handler
 * reads `/setup/status` once with the fresh token. One extra call at sign-in buys
 * a session that carries the institute's name and code, which the header shows on
 * every screen afterwards.
 */

const MIN_PASSWORD_LENGTH = 8;

function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function service(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return failure("Invalid request body.", 400);
  }

  const email = String(payload.username ?? "").trim();
  const password = String(payload.password ?? "");
  if (!email || !password) return failure("Enter your email and password.", 400);
  if (password.length < MIN_PASSWORD_LENGTH) return failure("Password is too short.", 422);

  if (USE_MOCK) {
    // The mock adapter is the authority on credentials; this only mints the
    // cookie `proxy.ts` looks for.
    const token = await createSessionToken(email, { role: "owner", name: email });
    const response = NextResponse.json<Session>({
      role: "owner",
      name: email,
      institute: { id: "inst-sunrise", name: "Sunrise Institute of Technology", code: "SUNR44" },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  }

  const res = await service("/auth/institute/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    return serviceError(res, await res.json().catch(() => null), "Sign in failed.");
  }
  const body = (await res.json()) as {
    token?: string;
    user?: { id: string; role: string; name: string; institutionId: string; institutionName: string };
  };
  if (!body.token || !body.user) {
    return failure("The service returned no session.", 502);
  }

  // One call, for the code the header shows. If it fails the session is still
  // perfectly usable, so the chip is simply left without a code.
  let code = "";
  try {
    const status = await service("/setup/status", {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    if (status.ok) {
      const parsed = (await status.json()) as { institute?: { code?: string } };
      code = parsed.institute?.code ?? "";
    }
  } catch {
    code = "";
  }

  const role = body.user.role === "admin" || body.user.role === "staff" ? body.user.role : "owner";
  const response = NextResponse.json<Session>({
    role,
    name: body.user.name,
    institute: { id: body.user.institutionId, name: body.user.institutionName, code },
  });
  response.cookies.set(SESSION_COOKIE, body.token, sessionCookieOptions());
  return response;
}
