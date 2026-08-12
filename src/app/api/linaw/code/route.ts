// src/app/api/linaw/code/route.ts
// Sprint 7 (S7-C10) — N006 code volume list (newest first, cap 100).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import type { LinawCodeVolumeListResponse, LinawCodeVolumeSummary } from "@/types/linaw";

export const GET = withUserAuth(async () => {
  const rows = await prisma.codeVolume.findMany({
    select: {
      id: true,
      title: true,
      edition: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  const items: LinawCodeVolumeSummary[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    edition: row.edition,
    status: row.status as 'draft' | 'under_review' | 'published',
    createdAt: row.createdAt.toISOString(),
  }));

  const response: LinawCodeVolumeListResponse = { items, total: items.length };
  return NextResponse.json(response, { status: 200 });
});
