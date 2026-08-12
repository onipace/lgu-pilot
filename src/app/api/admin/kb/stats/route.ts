import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { getLightRAGStats } from "@/lib/ai/lightrag";

// GET /api/admin/kb/stats — Return KB statistics
export const GET = withAuth(async () => {
  // Total documents by type
  const byType = await prisma.kbDocument.groupBy({
    by: ["docType"],
    _count: { _all: true },
  });

  // Total documents by status
  const byStatus = await prisma.kbDocument.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  // Total document count
  const totalDocuments = await prisma.kbDocument.count();

  // Document count per LGU
  const byLgu = await prisma.kbDocument.groupBy({
    by: ["lguId"],
    _count: { _all: true },
    orderBy: { _count: { lguId: "desc" } },
  });

  // Last index run info
  const lastRun = await prisma.kbIndexRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  // LightRAG stats
  const lightragStats = await getLightRAGStats();

  // Build summary maps
  const typeMap: Record<string, number> = {};
  for (const row of byType) {
    typeMap[row.docType] = row._count._all;
  }

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) {
    statusMap[row.status] = row._count._all;
  }

  return NextResponse.json({
    total_documents: totalDocuments,
    by_type: typeMap,
    by_status: statusMap,
    by_lgu: byLgu.map((r) => ({ lgu_id: r.lguId, count: r._count._all })),
    last_index_run: lastRun || null,
    lightrag: lightragStats,
  });
});
