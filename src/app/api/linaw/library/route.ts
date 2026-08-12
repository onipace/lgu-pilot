// src/app/api/linaw/library/route.ts
// Sprint 5 (S5-C8) — LINAW library list + manual entry.
// GET /api/linaw/library — list/search over linaw_ordinances with SQL LIKE
// (decision D5; the BM25 namespace is Sprint 6).
// PUT /api/linaw/library — manual entry (PRD §6.5), 409 on duplicate pair.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logModuleEvent } from "@/lib/logger";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { createManualRecord, recordIngestionDecision } from "@/lib/linaw/ingest";
import type {
  LinawLibraryListItem,
  LinawLibraryListResponse,
  LinawManualCreateRequest,
} from "@/types/linaw";

const VALID_LIBRARY_STATUSES = ["processing", "pending_review", "ready", "rejected"];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t));
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((t) => String(t)) : [];
  } catch {
    return [];
  }
}

export const GET = withUserAuth(async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const libraryStatus = url.searchParams.get("libraryStatus");
  const pageRaw = url.searchParams.get("page") ?? "1";
  const limitRaw = url.searchParams.get("limit") ?? "20";

  if (libraryStatus && !VALID_LIBRARY_STATUSES.includes(libraryStatus)) {
    return NextResponse.json(
      { error: "libraryStatus must be one of: " + VALID_LIBRARY_STATUSES.join(", "), code: "VALIDATION" },
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

  const startedAt = Date.now();

  const where: Record<string, unknown> = {};
  if (libraryStatus) {
    where.libraryStatus = libraryStatus;
  }
  if (q !== "") {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }

  const total = await prisma.linawOrdinance.count({ where });

  const rows = await prisma.linawOrdinance.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { seriesYear: "desc" }],
    take: limit,
    skip: offset,
  });

  const items: LinawLibraryListItem[] = rows.map((row) => ({
    id: row.id,
    ordinanceNumber: row.ordinanceNumber,
    seriesYear: row.seriesYear,
    title: row.title,
    status: row.status as LinawLibraryListItem["status"],
    libraryStatus: row.libraryStatus as LinawLibraryListItem["libraryStatus"],
    sourceType: row.sourceType as LinawLibraryListItem["sourceType"],
    subjectTags: parseTags(row.subjectTags),
    // Escape-then-mark rule: server-side HTML-escaped snippet, no <mark> this sprint.
    snippet: escapeHtml(String(row.content).slice(0, 200)),
    updatedAt: row.updatedAt.toISOString(),
  }));

  const body: LinawLibraryListResponse = {
    items,
    total,
    page,
    limit,
    tookMs: Date.now() - startedAt,
  };
  return NextResponse.json(body, { status: 200 });
});

export const PUT = withUserAuth(async (request, { user }) => {
  const userId = user.user.id;
  const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";

  let fields: LinawManualCreateRequest;
  try {
    fields = (await request.json()) as LinawManualCreateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const result = await createManualRecord({ userId, fields });
  if (!result.ok) {
    if (result.kind === "conflict") {
      return NextResponse.json({ error: result.error, code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ error: result.error, code: "VALIDATION" }, { status: 400 });
  }

  const record = result.record;
  await recordIngestionDecision({
    pipelineId: "manual-" + record.id,
    action: "complete",
    outputSnapshot: { ordinanceNumber: record.ordinanceNumber, seriesYear: record.seriesYear },
  });
  logModuleEvent({
    module: "linaw",
    interactionType: "linaw_manual_create",
    content: JSON.stringify({
      id: record.id,
      ordinanceNumber: record.ordinanceNumber,
      seriesYear: record.seriesYear,
    }),
    ipAddress,
    participantName: user.user.full_name,
    participantSessionId: "linaw-" + userId,
  });

  return NextResponse.json({ record }, { status: 201 });
});
