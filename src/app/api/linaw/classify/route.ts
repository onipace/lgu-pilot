// src/app/api/linaw/classify/route.ts
// Sprint 6 (S6-C7) — N002 batch classification endpoint (PRD §12.6).
// POST /api/linaw/classify — { ordinanceIds? } (absent/[] = whole ready
// library). Thin auth + validation + engine wrapper. Classification is
// LLM-primary (decision D12): engine failures map to a structured 500.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { classifyGate, classifyReadyOrdinances } from "@/lib/linaw/agents";
import type { LinawClassifyResponse, LinawClassifyResultItem } from "@/types/linaw";

export const POST = withUserAuth(async (request, { user }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const ordinanceIds = (body as { ordinanceIds?: unknown } | null)?.ordinanceIds;
  if (ordinanceIds !== undefined) {
    if (
      !Array.isArray(ordinanceIds) ||
      ordinanceIds.some((id) => typeof id !== "string")
    ) {
      return NextResponse.json(
        { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
  }

  try {
    const response = await classifyReadyOrdinances({
      ordinanceIds: Array.isArray(ordinanceIds) ? ordinanceIds : undefined,
      userId: user.user.id,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[linaw/classify] classification failed:", err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
});

// GET /api/linaw/classify — persisted placements (agent-2 output already in
// codification_records). Lets the Classification tab hydrate after a reload
// without re-running the LLM classifier. Pure DB read — no LLM.
export const GET = withUserAuth(async () => {
  const rows = await prisma.codificationRecord.findMany({
    include: {
      ordinance: {
        select: { ordinanceNumber: true, seriesYear: true, libraryStatus: true },
      },
    },
    orderBy: [{ ordinance: { seriesYear: "asc" } }, { ordinance: { ordinanceNumber: "asc" } }],
  });

  const results: LinawClassifyResultItem[] = rows.map((row) => {
    let confidence: number | undefined;
    if (row.aiSuggestion) {
      try {
        const parsed = JSON.parse(row.aiSuggestion) as { confidence?: unknown };
        if (typeof parsed.confidence === "number") confidence = parsed.confidence;
      } catch {
        confidence = undefined;
      }
    }

    const hasPlacement = row.titleNumber !== null && row.chapterNumber !== null;
    const gate: 'code_placement' | 'low_confidence_classification' | undefined = hasPlacement
      ? classifyGate(confidence ?? 0)
      : "low_confidence_classification";

    return {
      recordId: row.ordinanceId,
      ordinanceNumber: row.ordinance.ordinanceNumber,
      seriesYear: row.ordinance.seriesYear,
      placement: hasPlacement
        ? {
            titleNumber: row.titleNumber as number,
            chapterNumber: row.chapterNumber as number,
            ...(row.articleNumber !== null ? { articleNumber: row.articleNumber } : {}),
            confidence: confidence ?? 0,
          }
        : null,
      hitlRequired: gate !== undefined,
      ...(gate ? { gate } : {}),
    };
  });

  const response: LinawClassifyResponse = {
    pipelineId: "persisted",
    classified: results.length,
    skipped: [],
    results,
    exceptions: [],
  };
  return NextResponse.json(response, { status: 200 });
});
