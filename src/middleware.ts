import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════
// NEXT.JS MIDDLEWARE — Route protection for user-facing pages
// Checks for esangguni_user_session cookie existence and refreshes
// its 1-hour sliding Max-Age on every protected request.
// Full session validation happens in the auth gate component.
// ═══════════════════════════════════════════════════════════

const PROTECTED_PATHS = ["/ella", "/obra", "/yala", "/likha", "/linaw"];
const ADMIN_PATH = "/admin";
const ADMIN_LOGIN_PATH = "/admin/login";
const USER_SESSION_COOKIE = "esangguni_user_session";
const ADMIN_SESSION_COOKIE = "esangguni_session";
const USER_SESSION_MAX_AGE = 60 * 60; // 1 hour

function refreshSessionCookie(response: NextResponse, sessionId: string) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.COOKIE_DOMAIN;
  response.cookies.set({
    name: USER_SESSION_COOKIE,
    value: sessionId,
    maxAge: USER_SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    domain: cookieDomain,
    path: "/",
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path requires protection
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isAdminArea =
    pathname.startsWith(ADMIN_PATH + "/") || pathname === ADMIN_PATH;
  const isAdminLogin = pathname === ADMIN_LOGIN_PATH;

  if (!isProtected && !(isAdminArea && !isAdminLogin)) {
    return NextResponse.next();
  }

  // User-facing modules accept either user session or admin session
  // (admins can access tool pages for testing/demonstration).
  if (isProtected) {
    const userSession = request.cookies.get(USER_SESSION_COOKIE);
    const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE);
    const sessionCookie = userSession || adminSession;
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl, 302);
    }
    const response = NextResponse.next();
    // Refresh whichever cookie is present
    if (userSession?.value) {
      refreshSessionCookie(response, userSession.value);
    }
    if (adminSession?.value) {
      response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: adminSession.value,
        maxAge: 60 * 60 * 24,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: "/",
      });
    }
    return response;
  }

  // Admin area checks the admin session cookie (the admin pages also validate
  // server-side; this is defense-in-depth).
  const adminSessionCookie = request.cookies.get("esangguni_session");
  if (!adminSessionCookie?.value) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl, 302);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/ella/:path*",
    "/obra/:path*",
    "/yala/:path*",
    // SYSTEM_TEST D-1 fix: /likha and /linaw are in PROTECTED_PATHS, so they
    // must appear here too — Next.js only runs this middleware for matched
    // paths (without these entries the pages served 200 unauthenticated).
    "/likha/:path*",
    "/linaw/:path*",
    "/admin/:path*",
  ],
};
