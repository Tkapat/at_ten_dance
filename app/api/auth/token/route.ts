import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Hands the raw token to the app so it can call the FaceTrack service with a
 * bearer header and open `?token=` on the recognition WebSocket. Returns 401
 * when there is no valid session; the client then sends the user to /login.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({
    token,
    username: session.username,
    expiresAt: session.expiresAt,
  });
}
