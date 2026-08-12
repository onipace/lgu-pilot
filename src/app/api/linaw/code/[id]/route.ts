// src/app/api/linaw/code/[id]/route.ts
// Sprint 7 (S7-C10) — N006 code volume detail: the persisted structure JSON
// parsed back into the toc (corrupt structure degrades to an empty toc).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import type { CodeTocNode, LinawCodeVolumeDetail } from "@/types/linaw";

export const GET = withUserAuth(async (_request, { params }) => {
  const { id } = await params;

  const row = await prisma.codeVolume.findUnique({
    where: { id: String(id) },
  });

  if (!row) {
    return NextResponse.json({ error: "Code volume not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let toc: CodeTocNode[] = [];
  try {
    const parsed = JSON.parse(row.structure) as unknown;
    if (Array.isArray(parsed)) toc = parsed as CodeTocNode[];
  } catch {
    toc = [];
  }

  const detail: LinawCodeVolumeDetail = {
    id: row.id,
    title: row.title,
    edition: row.edition,
    status: row.status as 'draft' | 'under_review' | 'published',
    toc,
    generatedById: row.generatedById,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
  return NextResponse.json(detail, { status: 200 });
});
