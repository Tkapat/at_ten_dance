import { NextResponse, type NextRequest } from "next/server";
import { serviceError } from "@/lib/server/service-error";
import { BACKEND_URL, USE_MOCK } from "@/lib/env";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/session";
import type { Session } from "@/lib/types";

/**
 * Student sign-in: institute code, then the institute's own login id, then a
 * password.
 *
 * Three fields because a student has no email and no shared username — they
 * have the code their institute gives out and the id on their own record. The
 * code is also how the institute is found, which is why it comes first and why
 * it is remembered afterwards.
 *
 * The service answers a student sign-in with a token and very little else, so the
 * institute name is read from the public code lookup and the role is read out of
 * the token the service just minted.
 */

const MIN_PASSWORD_LENGTH = 8;

function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  let payload: { code?: unknown; loginId?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return failure("Invalid request body.", 400);
  }

  const code = String(payload.code ?? "").trim().toUpperCase();
  const loginId = String(payload.loginId ?? "").trim();
  const password = String(payload.password ?? "");
  if (code.length !== 6 || !loginId || !password) {
    return failure("Enter your institute code, login ID and password.", 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) return failure("Password is too short.", 422);

  if (USE_MOCK) {
    const token = await createSessionToken(loginId, { role: "student", name: loginId });
    const response = NextResponse.json<Session>({
      role: "student",
      name: loginId,
      institute: { id: "inst-sunrise", name: "Sunrise Institute of Technology", code },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  }

  const res = await fetch(`${BACKEND_URL}/auth/student/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, loginId, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    // The service answers every failed student sign-in with one sentence, and so
    // does this route: nothing here may reveal whether the id exists.
    return serviceError(res, await res.json().catch(() => null), "Details don't match");
  }
  const body = (await res.json()) as { token?: string; student?: { id: string; name: string } };
  if (!body.token) return failure("The service returned no session.", 502);

  const claims = await verifySessionToken(body.token);
  let instituteName = "";
  try {
    const lookup = await fetch(`${BACKEND_URL}/public/institutes/${code}`, { cache: "no-store" });
    if (lookup.ok) {
      const parsed = (await lookup.json()) as { name?: string };
      instituteName = parsed.name ?? "";
    }
  } catch {
    instituteName = "";
  }

  const response = NextResponse.json<Session>({
    role: "student",
    name: body.student?.name ?? claims?.name ?? loginId,
    institute: { id: claims?.inst ?? "", name: instituteName, code },
  });
  response.cookies.set(SESSION_COOKIE, body.token, sessionCookieOptions());
  return response;
}