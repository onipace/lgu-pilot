import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/citations
 * List LLM-sourced citations with filtering and pagination.
 * Requires admin authentication.
 * Adapted from PILLAR's better-sqlite3 implementation to Prisma/PostgreSQL.
 */
export const GET = withAuth(async (request) => {
  const url = new URL(request.url);

  const status = url.searchParams.get("status");
  const docType = url.searchParams.get("doc_type");
  const relevanceRating = url.searchParams.get("relevance_rating");
  const sort = url.searchParams.get("sort") || "last_seen";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10))
  );
  const offset = (page - 1) * limit;

  // Map sort param to Prisma orderBy
  const orderBy: Record<string, any> = {
    last_seen: { last_seen_at: "desc" },
    occurrences: { occurrence_count: "desc" },
    distinct_queries: { distinct_query_count: "desc" },
  };
  const order = orderBy[sort] || orderBy.last_seen;

  // Build WHERE clause
  const where: any = {};
  if (status) where.status = status;
  if (docType) where.doc_type = docType;
  if (relevanceRating) where.relevance_rating = relevanceRating;

  const [total, citations] = await Promise.all([
    prisma.llmCitation.count({ where }),
    prisma.llmCitation.findMany({ where, orderBy: order, skip: offset, take: limit }),
  ]);

  // Summary stats (always for full dataset, not filtered)
  const [
    totalCount,
    pending,
    reviewing,
    verified,
    added_to_kb,
    rejected,
    high_pending,
    medium_pending,
    low_pending,
  ] = await Promise.all([
    prisma.llmCitation.count(),
    prisma.llmCitation.count({ where: { status: "pending" } }),
    prisma.llmCitation.count({ where: { status: "reviewing" } }),
    prisma.llmCitation.count({ where: { status: "verified" } }),
    prisma.llmCitation.count({ where: { status: "added_to_kb" } }),
    prisma.llmCitation.count({ where: { status: "rejected" } }),
    prisma.llmCitation.count({ where: { relevance_rating: "high", status: "pending" } }),
    prisma.llmCitation.count({ where: { relevance_rating: "medium", status: "pending" } }),
    prisma.llmCitation.count({ where: { relevance_rating: "low", status: "pending" } }),
  ]);

  return NextResponse.json({
    citations,
    stats: {
      total: totalCount,
      pending,
      reviewing,
      verified,
      added_to_kb,
      rejected,
      high_pending,
      medium_pending,
      low_pending,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
