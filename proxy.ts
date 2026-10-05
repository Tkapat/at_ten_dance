import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Optimistic session gate. Next.js 16 renamed `middleware.ts` to `proxy.ts`
 * (Node runtime only); the session is read straight from the httpOnly cookie
 * and never touches the network, per the framework's guidance that this layer
 * is a redirect helper, not a security boundary. Every API call is authorised
 * again server-side.
 */

const PUBLIC_PATHS = new Set(["/login", "/dev/motion"]);

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (session) return NextResponse.redirect(new URL("/", request.nextUrl));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", request.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
