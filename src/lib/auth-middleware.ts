import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import type { AuthSession } from "@/lib/auth";

type ApiHandler = (
  request: Request,
  session: AuthSession,
  context?: any
) => Promise<Response>;

export function withAuth(
  handler: ApiHandler,
  options?: { requireSuperAdmin?: boolean }
) {
  return async (request: Request, context?: any): Promise<Response> => {
    try {
      const session = await requireAuth(
        request,
        options?.requireSuperAdmin ? "super_admin" : undefined
      );
      return await handler(request, session, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
