// src/app/api/linaw/summarize/route.ts
// Sprint 7 (S7-C8) — N007 on-demand plain-language summary generation. Thin
// auth + tolerant-body layer over summarizeReadyOrdinances (decision D4/D12):
// the engine never throws on LLM trouble (per-record failed[] entries), so a
// 500 here is only the structured fallback for unexpected DB errors.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { summarizeReadyOrdinances } from "@/lib/linaw/agents";
import type { LinawSummarizeRequest } from "@/types/linaw";

export const POST = withUserAuth(async (request, { user }) => {
  let body: LinawSummarizeRequest;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
    body = parsed as LinawSummarizeRequest;
  } catch {
    // Empty body → whole ready library without summaries.
    body = {};
  }

  if (body.ordinanceIds !== undefined) {
    if (
      !Array.isArray(body.ordinanceIds) ||
      !body.ordinanceIds.every((id) => typeof id === "string")
    ) {
      return NextResponse.json(
        { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
  }

  try {
    const response = await summarizeReadyOrdinances({
      ordinanceIds: body.ordinanceIds,
      userId: user.user.id,
    });
    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Summarization failed" }, { status: 500 });
  }
});
