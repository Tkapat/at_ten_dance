import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Who is signed in, read from the cookie and nowhere else.
 *
 * The shell needs this before it can decide whether to show an institute name or
 * a student's own greeting, and it must not learn that from a screen's data: the
 * header sits on every page, so it asks for the session itself. No network call,
 * because the claims are already in the cookie.
 */
export async function GET() {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({
    role: claims.role,
    name: claims.name,
    inst: claims.inst,
    expiresAt: claims.expiresAt,
    // The two file downloads and the WebSocket need the raw token, and the
    // cookie is the only place it exists. This is the one route that hands it
    // out; everything else goes through the proxy, which reads the cookie
    // server-side.
    token: store.get(SESSION_COOKIE)?.value ?? "",
  });
}