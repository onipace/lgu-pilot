// src/app/api/linaw/classify/[id]/route.ts
// Sprint 6 (S6-C7) — N002 human classification override (decision D6).
// PUT /api/linaw/classify/:id — :id is the ORDINANCE id. Thin auth + type
// validation + outcome-mapping wrapper over applyClassificationOverride.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { applyClassificationOverride } from "@/lib/linaw/agents";
import type { LinawClassifyOverrideRequest } from "@/types/linaw";

export const PUT = withUserAuth(async (request, { params, user }) => {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  // Route-level TYPE checks (decision D6 semantics live in the engine).
  const { titleNumber, chapterNumber, articleNumber, reason } = body as Partial<
    LinawClassifyOverrideRequest
  >;
  if (typeof titleNumber !== "number" || typeof chapterNumber !== "number") {
    return NextResponse.json(
      { error: "titleNumber and chapterNumber must be numbers", code: "INVALID_BODY" },
      { status: 400 }
    );
  }
  if (articleNumber !== undefined && typeof articleNumber !== "number") {
    return NextResponse.json(
      { error: "articleNumber must be a number", code: "INVALID_BODY" },
      { status: 400 }
    );
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json(
      { error: "reason must be a non-empty string", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const outcome = await applyClassificationOverride({
    ordinanceId: id,
    userId: user.user.id,
    body: { titleNumber, chapterNumber, articleNumber, reason } as LinawClassifyOverrideRequest,
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
