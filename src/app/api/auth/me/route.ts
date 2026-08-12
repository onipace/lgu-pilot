import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      display_name: session.user.display_name,
      lgu_id: session.user.lgu_id,
      province_id: session.user.province_id,
    },
    expires_at: session.expires_at,
  });
}
