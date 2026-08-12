import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import {
  getUserById,
  approveUser,
  rejectUser,
  deactivateUser,
  UserAuthError,
} from "@/lib/user-auth";
import {
  sendApprovalNotification,
  sendRejectionNotification,
  isEmailConfigured,
} from "@/lib/email";

/**
 * GET /api/admin/users/[id]
 * Get single user details
 */
export const GET = withAuth(async (request, _session, context) => {
  const { id } = context.params;
  const user = await getUserById(id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
});

/**
 * POST /api/admin/users/[id]
 * Approve, reject, or deactivate a user.
 * Body: { action: "approve" | "reject" | "deactivate", reason?: string }
 */
export const POST = withAuth(async (request, session, context) => {
  const { id } = context.params;
  const body = await request.json();
  const { action, reason } = body;

  try {
    switch (action) {
      case "approve": {
        const approved = await approveUser(id, session.user.id);
        if (isEmailConfigured()) {
          sendApprovalNotification(approved.email, approved.full_name).catch(
            (err) => console.error("[admin] Approval email failed:", err)
          );
        }
        return NextResponse.json({
          success: true,
          message: `User ${approved.full_name} approved`,
          user: approved,
        });
      }

      case "reject": {
        const rejected = await rejectUser(id, session.user.id, reason);
        if (isEmailConfigured()) {
          sendRejectionNotification(
            rejected.email,
            rejected.full_name,
            reason
          ).catch((err) =>
            console.error("[admin] Rejection email failed:", err)
          );
        }
        return NextResponse.json({
          success: true,
          message: `User ${rejected.full_name} rejected`,
          user: rejected,
        });
      }

      case "deactivate": {
        await deactivateUser(id);
        return NextResponse.json({
          success: true,
          message: "User deactivated",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: approve, reject, or deactivate" },
          { status: 400 }
        );
    }
  } catch (err) {
    if (err instanceof UserAuthError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[admin/users] Unexpected error:", err);
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
});
