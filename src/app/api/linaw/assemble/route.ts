// src/app/api/linaw/assemble/route.ts
// Sprint 7 (S7-C10) — N006 Code Assembler endpoint. Thin auth + tolerant
// body + outcome-mapping layer over assembleCode (agents 5+6 — D5/D7):
// 409 PENDING_RELATIONSHIPS while any detection awaits a human decision,
// 409 NOTHING_TO_ASSEMBLE when the eligible set is empty, 200 + toc +
// final_code_export gate otherwise.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { assembleCode } from "@/lib/linaw/agents";
import type { LinawAssembleRequest } from "@/types/linaw";

export const POST = withUserAuth(async (request, { user }) => {
  let body: Partial<LinawAssembleRequest>;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "edition must be a non-empty string", code: "VALIDATION" },
        { status: 400 }
      );
    }
    body = parsed as Partial<LinawAssembleRequest>;
  } catch {
    return NextResponse.json(
      { error: "edition must be a non-empty string", code: "VALIDATION" },
      { status: 400 }
    );
  }

  if (typeof body.edition !== "string" || body.edition.trim() === "") {
    return NextResponse.json(
      { error: "edition must be a non-empty string", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const outcome = await assembleCode({ edition: body.edition.trim(), userId: user.user.id });

  if (!outcome.ok) {
    if (outcome.kind === "pending_relationships") {
      return NextResponse.json(
        { error: outcome.error, code: "PENDING_RELATIONSHIPS", pending: outcome.pending ?? 0 },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: outcome.error, code: "NOTHING_TO_ASSEMBLE" }, { status: 409 });
  }

  return NextResponse.json(outcome.response, { status: 200 });
});
