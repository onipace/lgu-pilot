// src/app/api/linaw/conflicts/route.ts
// Sprint 6 (S6-C10) — N004 conflicts list endpoint (PRD §6.8 feature 4
// evidence view). Reads ordinance_relationships rows carrying the 'conflict'
// storage marker (decision D1), parses the section_ref evidence JSON back
// defensively, and joins both ordinance endpoints.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { LINAW_CONFLICT_RELATIONSHIP_TYPE } from "@/lib/linaw/agents";
import type {
  LinawConflictExcerpt,
  LinawConflictListItem,
  LinawConflictsListResponse,
} from "@/types/linaw";

function parseEvidence(sectionRef: string | null): { reason: string; excerpts: LinawConflictExcerpt[] } {
  try {
    const parsed = JSON.parse(sectionRef ?? "") as { reason?: unknown; excerpts?: unknown };
    const reason = typeof parsed.reason === "string" ? parsed.reason : "Unspecified contradiction";
    const excerpts = Array.isArray(parsed.excerpts)
      ? parsed.excerpts
          .filter((e): e is { ordinanceId: string; passage: string } => {
            return (
              typeof e === "object" &&
              e !== null &&
              typeof (e as { ordinanceId?: unknown }).ordinanceId === "string" &&
              typeof (e as { passage?: unknown }).passage === "string"
            );
          })
          .map((e) => ({ ordinanceId: e.ordinanceId, passage: e.passage }))
      : [];
    return { reason, excerpts };
  } catch {
    return { reason: "Unspecified contradiction", excerpts: [] };
  }
}

export const GET = withUserAuth(async (request) => {
  const url = new URL(request.url);
  const pageRaw = url.searchParams.get("page") ?? "1";
  const limitRaw = url.searchParams.get("limit") ?? "20";

  const page = Number(pageRaw);
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "page must be an integer >= 1", code: "VALIDATION" }, { status: 400 });
  }
  const limitParsed = Number(limitRaw);
  if (!Number.isInteger(limitParsed)) {
    return NextResponse.json({ error: "limit must be an integer", code: "VALIDATION" }, { status: 400 });
  }
  const limit = Math.min(100, Math.max(1, limitParsed));
  const offset = (page - 1) * limit;

  const where = { relationshipType: LINAW_CONFLICT_RELATIONSHIP_TYPE };

  const total = await prisma.ordinanceRelationship.count({ where });

  const rows = await prisma.ordinanceRelationship.findMany({
    where,
    include: {
      source: { select: { id: true, ordinanceNumber: true, seriesYear: true, title: true } },
      target: { select: { id: true, ordinanceNumber: true, seriesYear: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const items: LinawConflictListItem[] = rows.map((row) => {
    const evidence = parseEvidence(row.sectionRef);
    return {
      id: row.id,
      ordinanceAId: row.sourceId,
      ordinanceBId: row.targetId,
      reason: evidence.reason,
      confidence: row.confidence,
      excerpts: evidence.excerpts,
      confirmed: (row.confirmed ? 1 : 0) as 0 | 1,
      createdAt: row.createdAt.toISOString(),
      ordinanceA: {
        id: row.source.id,
        ordinanceNumber: row.source.ordinanceNumber,
        seriesYear: row.source.seriesYear,
        title: row.source.title,
      },
      ordinanceB: {
        id: row.target.id,
        ordinanceNumber: row.target.ordinanceNumber,
        seriesYear: row.target.seriesYear,
        title: row.target.title,
      },
    };
  });

  const response: LinawConflictsListResponse = { items, total, page, limit };
  return NextResponse.json(response, { status: 200 });
});
