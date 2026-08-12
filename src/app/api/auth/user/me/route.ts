import { NextRequest, NextResponse } from "next/server";
import { getUserSessionFromRequest, setUserSessionCookie } from "@/lib/user-auth";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/auth/user/me
 * Return current user profile from session cookie and refresh the
 * sliding 1-hour cookie expiration.
 * Also accepts admin sessions — admins can access user-facing tool pages.
 */
export async function GET(request: NextRequest) {
  // Try user session first
  const session = await getUserSessionFromRequest(request);

  if (session) {
    const response = NextResponse.json({
      user: session.user,
      expires_at: session.expires_at,
    });
    setUserSessionCookie(response.headers, session.id);
    return response;
  }

  // Fall back to admin session (admins can access tool pages)
  const adminSession = await getSessionFromRequest(request);
  if (adminSession) {
    const adminUser = adminSession.user;
    // Adapt admin profile to match UserProfile shape expected by tool pages
    const adaptedUser = {
      id: adminUser.id,
      email: adminUser.username,
      full_name: adminUser.display_name || adminUser.username,
      lgu_name: "",
      lgu_type: null,
      lgu_class: null,
      province: "",
      mobile_phone: null,
      status: "approved" as const,
      rejection_reason: null,
      approved_at: new Date().toISOString(),
      login_count: 0,
      created_at: new Date().toISOString(),
      role: adminUser.role,
      display_name: adminUser.display_name,
    };

    const response = NextResponse.json({
      user: adaptedUser,
      expires_at: adminSession.expires_at,
      is_admin: true,
    });

    // Refresh admin session cookie
    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: "esangguni_session",
      value: adminSession.id,
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: "/",
    });

    return response;
  }

  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401 }
  );
}
