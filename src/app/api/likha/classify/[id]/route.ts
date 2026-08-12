// src/app/api/likha/classify/[id]/route.ts
// Sprint 4 (S4-C6) — L007 admin override persistence path (decision D25;
// additive route, same precedent as Sprint-3's D15 scan route).
// PUT /api/likha/classify/[id] with { categories: string[] } REPLACES the
// record's classifications with assigned_by=<acting user id>, confidence NULL.
// Outcomes: 404 not_found · 400 invalid (route-level body shape → INVALID_BODY,
// engine-level category validation → VALIDATION) · 409 conflict (processing).

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { applyClassificationOverride } from "@/lib/likha/agents";
import type { LikhaClassificationOverrideRequest } from "@/types/likha";

export const PUT = withUserAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ id: string }>; user: { user: { id: string } } }
  ) => {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "categories must be a non-empty array", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const categories = (body as Partial<LikhaClassificationOverrideRequest> | null)
      ?.categories;
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.some((c) => typeof c !== "string")
    ) {
      return NextResponse.json(
        { error: "categories must be a non-empty array", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const outcome = await applyClassificationOverride({
      recordId: id,
      userId: user.user.id,
      categories: categories as string[],
    });

    if (!outcome.ok) {
      if (outcome.kind === "not_found") {
        return NextResponse.json(
          { error: outcome.error, code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      if (outcome.kind === "invalid") {
        return NextResponse.json(
          { error: outcome.error, code: "VALIDATION" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: outcome.error, code: "CONFLICT" },
        { status: 409 }
      );
    }

    return NextResponse.json(outcome.response);
  }
);
