// src/app/api/linaw/relationships/route.ts
// Sprint 6 (S6-C10) — N003 relationships list endpoint (GET). Sprint 7
// (S7-C4) surfaces the additive `rejected` column on each item; the decision
// endpoint lives at ./[id]/route.ts (PUT — N005). Lists persisted
// ordinance_relationships with joined source/target metadata. The 'conflict'
// storage marker (decision D1) is ALWAYS excluded — it never leaks into the
// relationships API.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { LINAW_CONFLICT_RELATIONSHIP_TYPE } from "@/lib/linaw/agents";
import type {
  LinawRelationshipRecord,
  LinawRelationshipsListResponse,
  LinawRelationshipType,
} from "@/types/linaw";

const VALID_TYPES: LinawRelationshipType[] = [
  "amends",
  "repeals",
  "partial_repeal",
  "supersedes",
  "extends",
  "implements",
];

export const GET = withUserAuth(async (request) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const confirmed = url.searchParams.get("confirmed");
  const pageRaw = url.searchParams.get("page") ?? "1";
  const limitRaw = url.searchParams.get("limit") ?? "20";

  if (type !== null && !VALID_TYPES.includes(type as LinawRelationshipType)) {
    return NextResponse.json(
      { error: "type must be one of: " + VALID_TYPES.join(", "), code: "VALIDATION" },
      { status: 400 }
    );
  }
  if (confirmed !== null && confirmed !== "0" && confirmed !== "1") {
    return NextResponse.json(
      { error: "confirmed must be 0 or 1", code: "VALIDATION" },
      { status: 400 }
    );
  }
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

  const where: Record<string, unknown> = {
    relationshipType: { not: LINAW_CONFLICT_RELATIONSHIP_TYPE },
  };
  if (type !== null) {
    where.relationshipType = type;
  }
  if (confirmed !== null) {
    where.confirmed = confirmed === "1";
  }

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

  const items: LinawRelationshipRecord[] = rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    type: row.relationshipType as LinawRelationshipType,
    ...(row.sectionRef !== null ? { sectionRef: row.sectionRef } : {}),
    confidence: row.confidence,
    confirmed: (row.confirmed ? 1 : 0) as 0 | 1,
    rejected: (row.rejected ? 1 : 0) as 0 | 1,
    createdAt: row.createdAt.toISOString(),
    source: {
      id: row.source.id,
      ordinanceNumber: row.source.ordinanceNumber,
      seriesYear: row.source.seriesYear,
      title: row.source.title,
    },
    target: {
      id: row.target.id,
      ordinanceNumber: row.target.ordinanceNumber,
      seriesYear: row.target.seriesYear,
      title: row.target.title,
    },
  }));

  const response: LinawRelationshipsListResponse = { items, total, page, limit };
  return NextResponse.json(response, { status: 200 });
});
