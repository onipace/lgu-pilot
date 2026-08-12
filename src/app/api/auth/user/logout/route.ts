import { NextRequest, NextResponse } from "next/server";
import {
  getUserSessionFromRequest,
  destroyUserSession,
  clearUserSessionCookie,
} from "@/lib/user-auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/user/logout
 * Destroy user session and clear cookie
 */
export async function POST(request: NextRequest) {
  const session = await getUserSessionFromRequest(request);

  if (session) {
    await destroyUserSession(session.id);
  }

  const response = NextResponse.json({ success: true });
  clearUserSessionCookie(response.headers);
  return response;
}
