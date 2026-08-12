import { NextRequest, NextResponse } from "next/server";
import { registerUser, UserAuthError } from "@/lib/user-auth";
import { sendRegistrationConfirmation, isEmailConfigured } from "@/lib/email";

export const runtime = "nodejs";

/**
 * POST /api/auth/register
 * Register a new user account (status: pending)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, lgu_name, lgu_type, lgu_class, province, mobile_phone } = body;

    const result = await registerUser({
      email,
      password,
      full_name,
      lgu_name,
      lgu_type,
      lgu_class,
      province,
      mobile_phone,
    });

    // Send confirmation email (non-blocking)
    if (isEmailConfigured()) {
      sendRegistrationConfirmation(result.email, full_name).catch((err) =>
        console.error("[register] Email send failed:", err)
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration submitted. Your account is pending admin approval.",
        user_id: result.id,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UserAuthError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[register] Unexpected error:", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
