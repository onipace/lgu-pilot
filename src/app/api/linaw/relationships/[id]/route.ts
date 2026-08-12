// src/app/api/linaw/relationships/[id]/route.ts
// Sprint 7 (S7-C4) — N005 relationship decision endpoint. Thin auth + tolerant
// body + outcome-mapping layer over decideRelationship (all semantics live in
// the engine). Confirm flips confirmed=1 (+ D2 target status propagation);
// reject sets the additive rejected=1 with the required reason audited.
// Decided rows refuse further actions (409 CONFLICT).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { decideRelationship } from "@/lib/linaw/agents";
import type { LinawRelationshipDecisionRequest } from "@/types/linaw";

export const PUT = withUserAuth(async (request, { params, user }) => {
  const { id } = await params;

  let body: LinawRelationshipDecisionRequest;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
    }
    body = parsed as LinawRelationshipDecisionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const outcome = await decideRelationship({
    relationshipId: String(id),
    userId: user.user.id,
    body,
  });

  if (!outcome.ok) {
    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: outcome.error, code: "NOT_FOUND" }, { status: 404 });
    }
    if (outcome.kind === "already_decided") {
      return NextResponse.json({ error: outcome.error, code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ error: outcome.error, code: "VALIDATION" }, { status: 400 });
  }

  return NextResponse.json(outcome.response, { status: 200 });
});
