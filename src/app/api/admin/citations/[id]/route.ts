import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/citations/[id]
 * Get a single LLM citation by ID with its occurrence timeline.
 * Adapted from PILLAR's better-sqlite3 implementation to Prisma/PostgreSQL.
 */
export const GET = withAuth(async (_request, _session, context) => {
  const { id } = await context.params;

  const citation = await prisma.llmCitation.findUnique({ where: { id } });

  if (!citation) {
    return NextResponse.json(
      { error: "Citation not found" },
      { status: 404 }
    );
  }

  // Fetch occurrence timeline (most recent first, limited to 50)
  const occurrences = await prisma.llmCitationOccurrence.findMany({
    where: { citation_id: id },
    orderBy: { created_at: "desc" },
    take: 50,
    select: {
      id: true,
      source_query: true,
      response_text: true,
      module: true,
      relevance_rating: true,
      session_id: true,
      user_id: true,
      user_name: true,
      created_at: true,
    },
  });

  return NextResponse.json({ citation, occurrences });
});

/**
 * PATCH /api/admin/citations/[id]
 * Update citation status and/or notes.
 * Body: { status?: string, notes?: string }
 * Sets reviewed_by and reviewed_at when status changes.
 */
export const PATCH = withAuth(async (request, session, context) => {
  const { id } = await context.params;
  const body = await request.json();
  const { status, notes } = body;

  const existing = await prisma.llmCitation.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json(
      { error: "Citation not found" },
      { status: 404 }
    );
  }

  const data: any = {};

  if (status !== undefined) {
    const validStatuses = [
      "pending",
      "reviewing",
      "verified",
      "added_to_kb",
      "rejected",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }
    data.status = status;
    data.reviewed_by = session.user.id;
    data.reviewed_at = new Date();
  }

  if (notes !== undefined) {
    data.notes = notes;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.llmCitation.update({ where: { id }, data });

  return NextResponse.json({ citation: updated });
});
