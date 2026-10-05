import { NextResponse, type NextRequest } from "next/server";
import { API_BASE, USE_MOCK } from "@/lib/env";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import type { Session } from "@/lib/types";

/**
 * Create an institute and its owner.
 *
 * Answers straight away rather than asking for a spreadsheet first: the code
 * reveal screen that follows is what tells the new admin what to do next, and an
 * empty dashboard with a checklist beats a wall of required uploads.
 */

function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function detailMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  let payload: {
    institute?: { name?: unknown; city?: unknown; state?: unknown };
    admin?: { email?: unknown; password?: unknown };
    acceptTerms?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return failure("Invalid request body.", 400);
  }

  const name = String(payload.institute?.name ?? "").trim();
  const email = String(payload.admin?.email ?? "").trim().toLowerCase();
  const password = String(payload.admin?.password ?? "");
  if (name.length < 2) return failure("Enter the institute's name.", 422);
  if (!email) return failure("Enter an email address.", 422);
  if (password.length < 8) return failure("Password must be at least 8 characters.", 422);
  if (!payload.acceptTerms) return failure("You have to accept the terms to continue.", 422);

  if (USE_MOCK) {
    const token = await createSessionToken(email, { role: "owner", name: email });
    const response = NextResponse.json<Session>({
      role: "owner",
      name: email,
      institute: { id: "inst-new", name, code: "NEW400" },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  }

  const res = await fetch(`${API_BASE}/auth/institute/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      institute: {
        name,
        city: payload.institute?.city ? String(payload.institute.city) : null,
        state: payload.institute?.state ? String(payload.institute.state) : null,
      },
      admin: { email, password },
      acceptTerms: true,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    return failure(
      detailMessage(await res.json().catch(() => null), "Could not create the account."),
      res.status,
    );
  }
  const body = (await res.json()) as {
    token?: string;
    institute?: { id: string; name: string; code: string };
  };
  if (!body.token || !body.institute) return failure("The service returned no institute.", 502);

  const response = NextResponse.json<Session>({
    role: "owner",
    name: email,
    institute: body.institute,
  });
  response.cookies.set(SESSION_COOKIE, body.token, sessionCookieOptions());
  return response;
}