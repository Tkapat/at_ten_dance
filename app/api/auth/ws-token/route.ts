import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * The token the recognition WebSocket connects with.
 *
 * A browser cannot set an `Authorization` header on a WebSocket upgrade, so the
 * scanner is the one call that cannot be proxied: it opens a socket against the
 * service itself, with the token in the query string. This route is how the
 * browser gets that token without the cookie ever being readable to script.
 *
 * The token handed back is the one the service minted, so its lifetime is the
 * service's own — twelve hours for an institute account. Minting a shorter-lived
 * copy here would need the service's signing key and its `token_version` check,
 * which is the service's business; instead the socket is closed by the service
 * (`4401`) the moment the token stops being valid, and the Scan screen shows a
 * reconnecting state rather than a dead camera.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims || !token) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }
  // Only an institute account may open the scanner: a student socket would be a
  // way to mark attendance without a camera in front of anybody.
  if (claims.role === "student") {
    return NextResponse.json(
      { message: "You do not have access to this." },
      { status: 403 },
    );
  }
  return NextResponse.json({
    token,
    expiresAt: claims.expiresAt,
  });
}