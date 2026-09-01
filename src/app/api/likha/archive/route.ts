// src/app/api/likha/archive/route.ts
// Sprint 3 (S3-C6) — L006 archive list/search.
//   GET /api/likha/archive?q=&yearFrom=&yearTo=&status=&subject=&archiveStatus=&page=&limit=
// Contract params per PRD-LIKHA §12.6 + ONE additive optional param
// (decision D18): archiveStatus (default 'published') so the verification
// queue can list pending_review records.
// With q: BM25 search over LIKHA's own namespace (self-healing rebuild when
// the index is empty/missing). Without q: Prisma listing. Snippets are escaped
// server-side (escape-then-mark rule); <mark> wrapping only for q-searches.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { likhaSearch, ensureLikhaIndexFresh } from "@/lib/likha/search";
import { logModuleEvent } from "@/lib/logger";
import type {
  LikhaArchiveListItem,
  LikhaArchiveSearchResponse,
} from "@/types/likha";
import { Prisma } from "@/generated/prisma/client";

const LEGAL_STATUSES = [
  "active",
  "amended",
  "repealed",
  "superseded",
  "expired",
] as const;

const ARCHIVE_STATUSES = [
  "processing",
  "pending_review",
  "published",
  "flagged",
] as const;

type LegalStatus = (typeof LEGAL_STATUSES)[number];
type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];

/** Server-side HTML escape — applied to ALL snippet text (escape-then-mark). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** subjectTags is a native Json field in Prisma — already a JS array. */
function safeSubjectTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

function parseOptionalInt(value: string | null): number | undefined | null {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null; // signals invalid
  return parsed;
}

export const GET = withUserAuth(async (request: NextRequest, { user }) => {
  const startedAt = Date.now();
  const searchParams = request.nextUrl.searchParams;

  const q = searchParams.get("q")?.trim() ?? "";

  const yearFrom = parseOptionalInt(searchParams.get("yearFrom"));
  const yearTo = parseOptionalInt(searchParams.get("yearTo"));
  if (yearFrom === null || yearTo === null) {
    return NextResponse.json(
      { error: "yearFrom/yearTo must be integers", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const statusParam = searchParams.get("status");
  if (statusParam !== null && !(LEGAL_STATUSES as readonly string[]).includes(statusParam)) {
    return NextResponse.json(
      { error: "Invalid status filter", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const status = statusParam as LegalStatus | null;

  const archiveStatusParam = searchParams.get("archiveStatus") ?? "published";
  if (!(ARCHIVE_STATUSES as readonly string[]).includes(archiveStatusParam)) {
    return NextResponse.json(
      { error: "Invalid archiveStatus filter", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const archiveStatus = archiveStatusParam as ArchiveStatus;

  const subject = searchParams.get("subject");

  const pageRaw = parseOptionalInt(searchParams.get("page"));
  const limitRaw = parseOptionalInt(searchParams.get("limit"));
  if (pageRaw === null || limitRaw === null) {
    return NextResponse.json(
      { error: "page/limit must be integers", code: "VALIDATION" },
      { status: 400 }
    );
  }
  const page = Math.max(1, pageRaw ?? 1);
  const limit = Math.min(100, Math.max(1, limitRaw ?? 20));

  // ── q present: BM25 over LIKHA's own namespace (self-healing) ──
  if (q !== "") {
    const filters = {
      yearFrom,
      yearTo,
      status: status ?? undefined,
      subject: subject ?? undefined,
      page,
      limit,
    };

    const beforeDocs = likhaSearch.stats().totalDocs;
    await ensureLikhaIndexFresh();
    const afterDocs = likhaSearch.stats().totalDocs;
    if (afterDocs !== beforeDocs) {
      // Index was stale (empty OR count mismatch) → it has been rebuilt; audit it.
      logModuleEvent({
        module: "likha",
        interactionType: "likha_index_rebuild",
        content: JSON.stringify({ trigger: "archive-search", q, beforeDocs, afterDocs }),
        ipAddress: "127.0.0.1",
        participantSessionId: "likha-" + user.user.id,
      });
    }
    const result = likhaSearch.search(q, filters);

    const items: LikhaArchiveListItem[] = result.items.map((hit) => ({
      ...hit,
      archiveStatus,
    }));

    const response: LikhaArchiveSearchResponse = {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      tookMs: Date.now() - startedAt,
    };
    return NextResponse.json(response);
  }

  // ── No q: Prisma listing over archived_ordinances ──
  const where: Prisma.ArchivedOrdinanceWhereInput = {
    archiveStatus,
  };

  if (yearFrom !== undefined || yearTo !== undefined) {
    where.seriesYear = {
      gte: yearFrom ?? -8000,
      lte: yearTo ?? 9999,
    };
  }
  if (status !== null) {
    where.status = status;
  }

  // subject_tags is a JSONB array in PostgreSQL. Use raw SQL for the
  // containment filter (@>) since Prisma doesn't natively support JSONB ops.
  let rows: Array<{
    id: string;
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    content: string;
    status: string;
    subjectTags: unknown;
    sectionCount: number | null;
    archiveStatus: string;
    createdAt: Date;
  }>;
  let totalCount: number;

  if (subject !== null && subject !== "") {
    const rawRows = await prisma.$queryRaw<
      Array<{
        id: string;
        ordinance_number: number;
        series_year: number;
        title: string;
        content: string;
        status: string;
        subject_tags: unknown;
        section_count: number | null;
        archive_status: string;
        created_at: Date;
        total_count: bigint;
      }>
    >(
      Prisma.sql`
        SELECT ao.id, ao.ordinance_number, ao.series_year, ao.title,
               ao.content, ao.status, ao.subject_tags, ao.section_count,
               ao.archive_status, ao.created_at,
               COUNT(*) OVER() as total_count
        FROM archived_ordinances ao
        WHERE ao.archive_status = ${archiveStatus}
          ${yearFrom !== undefined || yearTo !== undefined
            ? Prisma.sql`AND ao.series_year BETWEEN ${yearFrom ?? -8000} AND ${yearTo ?? 9999}`
            : Prisma.sql``}
          ${status !== null
            ? Prisma.sql`AND ao.status = ${status}`
            : Prisma.sql``}
          AND ao.subject_tags @> ${JSON.stringify([subject])}::jsonb
        ORDER BY ao.series_year DESC, ao.ordinance_number DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `
    );

    // Normalize snake_case raw SQL result to camelCase
    rows = rawRows.map((r) => ({
      id: r.id,
      ordinanceNumber: r.ordinance_number,
      seriesYear: r.series_year,
      title: r.title,
      content: r.content,
      status: r.status,
      subjectTags: r.subject_tags,
      sectionCount: r.section_count,
      archiveStatus: r.archive_status,
      createdAt: r.created_at,
    }));
    totalCount = rawRows.length > 0 ? Number(rawRows[0].total_count) : 0;
  } else {
    const [prismaRows, count] = await Promise.all([
      prisma.archivedOrdinance.findMany({
        where,
        orderBy: [
          { seriesYear: "desc" },
          { ordinanceNumber: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.archivedOrdinance.count({ where }),
    ]);

    rows = prismaRows.map((r) => ({
      id: r.id,
      ordinanceNumber: r.ordinanceNumber,
      seriesYear: r.seriesYear,
      title: r.title,
      content: r.content,
      status: r.status,
      subjectTags: r.subjectTags,
      sectionCount: r.sectionCount,
      archiveStatus: r.archiveStatus,
      createdAt: r.createdAt,
    }));
    totalCount = count;
  }

  const items: LikhaArchiveListItem[] = rows.map((row) => ({
    id: row.id,
    ordinanceNumber: row.ordinanceNumber,
    seriesYear: row.seriesYear,
    title: row.title,
    status: row.status as LegalStatus,
    archiveStatus: row.archiveStatus as ArchiveStatus,
    subjectTags: safeSubjectTags(row.subjectTags),
    sectionCount: row.sectionCount,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    // No q → no <mark>; escaped leading excerpt only (escape-then-mark rule).
    snippet: escapeHtml((row.content ?? "").slice(0, 200)),
  }));

  const response: LikhaArchiveSearchResponse = {
    items,
    total: totalCount,
    page,
    limit,
    tookMs: Date.now() - startedAt,
  };
  return NextResponse.json(response);
});
