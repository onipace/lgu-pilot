import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { listUsers, getPendingUserCount } from "@/lib/user-auth";

/**
 * GET /api/admin/users
 * List all registered users with filtering and pagination.
 * Requires admin authentication.
 */
export const GET = withAuth(async (request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const province = url.searchParams.get("province") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const result = await listUsers({ status, province, search, page, limit });
  const pendingCount = await getPendingUserCount();

  return NextResponse.json({
    ...result,
    pending_count: pendingCount,
  });
});
