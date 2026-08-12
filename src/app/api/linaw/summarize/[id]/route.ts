// src/app/api/linaw/summarize/[id]/route.ts
// Sprint 7 (S7-C8) — N007 human summary edit endpoint. Thin auth + tolerant
// body + outcome-mapping layer over applySummaryEdit (ready rows only;
// non-empty summary required — the human edit is authoritative).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { applySummaryEdit } from "@/lib/linaw/agents";
import type { LinawSummaryEditRequest } from "@/types/linaw";

export const PUT = withUserAuth(async (request, { params, user }) => {
  const { id } = await params;

  let body: Partial<LinawSummaryEditRequest>;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
    }
    body = parsed as Partial<LinawSummaryEditRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const outcome = await applySummaryEdit({
    ordinanceId: String(id),
    summary: typeof body.summary === "string" ? body.summary : "",
    userId: user.user.id,
  });

  if (!outcome.ok) {
    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: outcome.error, code: "NOT_FOUND" }, { status: 404 });
    }
    if (outcome.kind === "conflict") {
      return NextResponse.json({ error: outcome.error, code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ error: outcome.error, code: "VALIDATION" }, { status: 400 });
  }

  return NextResponse.json(outcome.response, { status: 200 });
});
