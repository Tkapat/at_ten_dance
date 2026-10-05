import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * An optimistic session gate, and nothing more.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (Node runtime only). The
 * session is read straight from the httpOnly cookie and never touches the
 * network, per the framework's guidance that this layer is a redirect helper and
 * not a security boundary: every API call is authorised again by the service,
 * which is the only thing that decides whether a request is allowed.
 *
 * What this does buy is the right page. A student who types an admin URL lands on
 * their own home instead of a screen that would 403 three times over, and an
 * institute account that follows a student link is sent back to the console. The
 * reverse is also what makes the two halves of the app feel like two apps: there
 * is no nav item a student cannot see, because the nav is built from the same
 * claim this reads.
 */

const PUBLIC = ["/welcome", "/login", "/join", "/institute/signup", "/api", "/dev"];

function isPublic(pathname: string): boolean {
  return PUBLIC.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in, so the login form is the wrong page. This runs before the
  // public-path check below, which is where `/login` lives — checked after it,
  // the redirect would never fire and a signed-in person would sit on a form that
  // signs them in again.
  if (pathname === "/login" && claims) {
    return NextResponse.redirect(new URL(claims.role === "student" ? "/me" : "/", request.url));
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (!claims) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isStudent = claims.role === "student";
  // `/me` is the student's world, `/` is the institute's. A claim token can never
  // reach here, so there is no third case to consider.
  if (isStudent && !pathname.startsWith("/me")) {
    return NextResponse.redirect(new URL("/me", request.url));
  }
  if (!isStudent && pathname.startsWith("/me")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Signing in while already signed in goes to the right home, not to a login
  // form that will immediately bounce back.
  if (pathname === "/login") {
    return NextResponse.redirect(new URL(isStudent ? "/me" : "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the API routes and files with an extension.
  // `/api` is in PUBLIC above, so a request there is never redirected.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};