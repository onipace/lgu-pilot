import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  createUserSession,
  setUserSessionCookie,
  UserAuthError,
} from "@/lib/user-auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/user/login
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const user = await authenticateUser(email, password);
    const sessionId = await createUserSession(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        lgu_name: user.lgu_name,
        province: user.province,
      },
    });

    setUserSessionCookie(response.headers, sessionId);
    return response;
  } catch (err) {
    if (err instanceof UserAuthError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[user-login] Unexpected error:", err);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
