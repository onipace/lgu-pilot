import { NextResponse } from "next/server";
import { getSessionFromRequest, destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (session) {
    await destroySession(session.id);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("esangguni_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
