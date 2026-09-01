// src/app/api/likha/stats/route.ts
// Sprint 3 (S3-C6) — L006 archive stats (DESIGN.md §2.1 header counts).
//   GET /api/likha/stats → LikhaStatsResponse
// archived = ALL archived_ordinances rows (processing folded into archived
// only); published/pendingReview/flagged per archive_status; byYear/byStatus
// over published rows; bySubject parsed from published subject_tags JSON;
// bm25Indexed = size of LIKHA's own BM25 namespace (decision D13).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { likhaSearch, ensureLikhaIndexFresh } from "@/lib/likha/search";
import type { LikhaStatsResponse } from "@/types/likha";

export const GET = withUserAuth(async () => {
  // Guardrail (2026-08-13): heal a stale index before reporting its size.
  await ensureLikhaIndexFresh();

  const [total, published, pendingReview, flagged] = await Promise.all([
    prisma.archivedOrdinance.count(),
    prisma.archivedOrdinance.count({ where: { archiveStatus: "published" } }),
    prisma.archivedOrdinance.count({ where: { archiveStatus: "pending_review" } }),
    prisma.archivedOrdinance.count({ where: { archiveStatus: "flagged" } }),
  ]);

  const byYear: Record<string, number> = {};
  const yearRows = await prisma.archivedOrdinance.groupBy({
    by: ["seriesYear"],
    where: { archiveStatus: "published" },
    _count: { seriesYear: true },
  });
  for (const row of yearRows) {
    byYear[String(row.seriesYear)] = Number(row._count.seriesYear);
  }

  const byStatus: Record<string, number> = {};
  const statusRows = await prisma.archivedOrdinance.groupBy({
    by: ["status"],
    where: { archiveStatus: "published" },
    _count: { status: true },
  });
  for (const row of statusRows) {
    byStatus[row.status] = Number(row._count.status);
  }

  const bySubject: Record<string, number> = {};
  const allPublished = await prisma.archivedOrdinance.findMany({
    where: { archiveStatus: "published" },
    select: { subjectTags: true },
  });
  for (const row of allPublished) {
    const tags = row.subjectTags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === "string" && tag !== "") {
          bySubject[tag] = (bySubject[tag] ?? 0) + 1;
        }
      }
    }
  }

  const response: LikhaStatsResponse = {
    archived: total,
    published,
    pendingReview,
    flagged,
    byYear,
    byStatus,
    bySubject,
    bm25Indexed: likhaSearch.stats().totalDocs,
  };
  return NextResponse.json(response);
});
