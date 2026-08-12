// src/app/api/likha/classify/route.ts
// Sprint 4 (S4-C6) — L007 standalone classification over existing records
// (PRD §12.6). Body { ordinanceIds: string[] } (required, non-empty) →
// LikhaClassifyResponse with classified / skipped / results (decision D22
// eligibility: pending_review + published rows are classifiable; everything
// else lands in `skipped`). withUserAuth; acting user = user.user.id.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { classifyLikhaRecords } from "@/lib/likha/agents";
import type { LikhaClassifyRequest, LikhaClassifyResponse } from "@/types/likha";

export const POST = withUserAuth(
  async (
    request: NextRequest,
    { user }: { user: { user: { id: string } } }
  ) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "ordinanceIds must be a non-empty array", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const ordinanceIds = (body as Partial<LikhaClassifyRequest> | null)?.ordinanceIds;
    if (
      !Array.isArray(ordinanceIds) ||
      ordinanceIds.length === 0 ||
      ordinanceIds.some((v) => typeof v !== "string")
    ) {
      return NextResponse.json(
        { error: "ordinanceIds must be a non-empty array", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    try {
      const response: LikhaClassifyResponse = await classifyLikhaRecords({
        recordIds: ordinanceIds as string[],
        userId: user.user.id,
      });
      return NextResponse.json(response);
    } catch {
      return NextResponse.json(
        { error: "Classification failed" },
        { status: 500 }
      );
    }
  }
);
