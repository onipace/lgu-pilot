import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const sessionParam = searchParams.get("session") || "";
  const moduleParam = searchParams.get("module") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  try {
    // Build where clause for participant sessions
    const where: Prisma.ParticipantSessionWhereInput = {};
    if (sessionParam) where.workshopSessionId = sessionParam;
    if (moduleParam) where.module = moduleParam;

    // Total count
    const total = await prisma.participantSession.count({ where });

    // Fetch participant sessions with their interaction logs
    const allSessions = await prisma.participantSession.findMany({
      where,
      orderBy: { lastActiveAt: "desc" },
      include: {
        logs: {
          select: { id: true, role: true, interactionType: true },
        },
      },
    });

    // Paginate in JS after computing enriched data
    const enriched = allSessions.map((ps) => ({
      id: ps.id,
      workshop_session_id: ps.workshopSessionId,
      participant_name:
        ps.participantName || ps.ipAddress || "Anonymous",
      module: ps.module,
      started_at: ps.startedAt.toISOString(),
      last_active_at: ps.lastActiveAt.toISOString(),
      message_count: ps.logs.filter((l) => l.role === "user").length,
      draft_count: ps.logs.filter(
        (l) => l.interactionType === "obra_draft"
      ).length,
    }));

    // Apply pagination
    const sessions = enriched.slice(offset, offset + pageSize);

    return NextResponse.json({
      sessions,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("[admin/sessions]", err);
    return NextResponse.json(
      { error: "Sessions query failed" },
      { status: 500 }
    );
  }
});
