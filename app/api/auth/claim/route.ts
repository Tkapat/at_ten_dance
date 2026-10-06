import { NextResponse, type NextRequest } from "next/server";
import { serviceError } from "@/lib/server/service-error";
import { BACKEND_URL, USE_MOCK } from "@/lib/env";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import type { Session } from "@/lib/types";

/**
 * The second step of claiming an account: the student sets a password and, with
 * it, a session.
 *
 * The first step is a public call the client makes directly (`/auth/student/claim/
 * verify`), because it needs no session and must not create one. This one does,
 * so it is a route handler like every other call that ends in a cookie.
 *
 * `acceptConsent` is refused rather than defaulted: a face template is being
 * stored, and agreeing to that is not something to infer.
 */

function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  let payload: { claimToken?: unknown; password?: unknown; acceptConsent?: unknown };
  try {
    payload = await request.json();
  } catch {
    return failure("Invalid request body.", 400);
  }

  const claimToken = String(payload.claimToken ?? "");
  const password = String(payload.password ?? "");
  if (claimToken.length < 10) return failure("This claim has expired. Start again.", 401);
  if (password.length < 8) return failure("Password must be at least 8 characters.", 422);
  if (!payload.acceptConsent) {
    return failure("You have to agree to how your face data is used.", 422);
  }

  if (USE_MOCK) {
    return failure("Claims are handled by the mock adapter in mock mode.", 404);
  }

  const res = await fetch(`${BACKEND_URL}/auth/student/claim/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimToken, password, acceptConsent: true }),
    cache: "no-store",
  });
  if (!res.ok) {
    return serviceError(res, await res.json().catch(() => null), "Details don't match");
  }
  const body = (await res.json()) as { token?: string; student?: { id: string; name: string } };
  if (!body.token) return failure("The service returned no session.", 502);

  const response = NextResponse.json<Session>({
    role: "student",
    name: body.student?.name ?? "",
    // The code is not in this answer and the claim token is already spent, so
    // the portal fills it in on the next call to `/me`.
    institute: { id: "", name: "", code: "" },
  });
  response.cookies.set(SESSION_COOKIE, body.token, sessionCookieOptions());
  return response;
}