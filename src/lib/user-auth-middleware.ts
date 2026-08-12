import { NextRequest, NextResponse } from "next/server";
import {
  getUserSessionFromRequest,
  UserSession,
  USER_SESSION_COOKIE_NAME,
} from "./user-auth";
import { getSessionFromRequest } from "./auth";

// ═══════════════════════════════════════════════════════════
// USER AUTH MIDDLEWARE — Protects public API routes
// Requires an approved user session (esangguni_user_session cookie)
// Also accepts admin sessions (esangguni_session) for admin access
// ═══════════════════════════════════════════════════════════

type UserRouteHandler = (
  request: NextRequest,
  context: { params: Promise<any>; user: UserSession }
) => Promise<Response> | Response;

/**
 * Wraps a Next.js API route handler to require an approved user session.
 * Returns 401 if no valid session is found.
 * Also accepts admin sessions — admins can access all user-facing APIs.
 *
 * Usage:
 *   export const POST = withUserAuth(async (request, { user }) => {
 *     // user.user contains the authenticated UserProfile
 *   });
 */
export function withUserAuth(handler: UserRouteHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      // Try user session first
      let session = await getUserSessionFromRequest(request);

      // Fall back to admin session (admins can access user-facing APIs)
      if (!session) {
        const adminSession = await getSessionFromRequest(request);
        if (adminSession) {
          // Adapt admin session to UserSession shape
          const adminUser = adminSession.user;
          session = {
            id: adminSession.id,
            user: {
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
            },
            expires_at: adminSession.expires_at,
          } as UserSession;
        }
      }

      if (!session) {
        return NextResponse.json(
          { error: "Authentication required", code: "NO_SESSION" },
          { status: 401 }
        );
      }

      return await handler(request, { ...context, user: session });
    } catch (err) {
      console.error("[user-auth-middleware] Unexpected error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Server-side function to check user session from cookies.
 * For use in Server Components and middleware.ts
 */
export function checkUserSession(request: NextRequest): UserSession | null {
  const cookieName = USER_SESSION_COOKIE_NAME;
  const sessionId = request.cookies.get(cookieName)?.value;
  if (!sessionId) return null;

  // Import validateUserSession dynamically to avoid circular deps
  const { validateUserSession } = require("./user-auth");
  return validateUserSession(sessionId);
}
