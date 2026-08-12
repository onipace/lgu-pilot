// src/app/api/linaw/classify/route.ts
// Sprint 6 (S6-C7) — N002 batch classification endpoint (PRD §12.6).
// POST /api/linaw/classify — { ordinanceIds? } (absent/[] = whole ready
// library). Thin auth + validation + engine wrapper. Classification is
// LLM-primary (decision D12): engine failures map to a structured 500.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { classifyReadyOrdinances } from "@/lib/linaw/agents";

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
