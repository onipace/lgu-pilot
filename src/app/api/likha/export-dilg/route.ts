// src/app/api/likha/export-dilg/route.ts
// Sprint 4 (S4-C8) — L010 DILG MC 2026-041 submission package export
// (decision D27 — single JSON attachment). Published rows only (D23):
// ordinanceIds omitted → all published; [] → valid empty package; any
// ineligible id rejects the WHOLE request with 409 CONFLICT. Successful
// exports mark the included rows dilg_submitted=1 (builder) and are logged
// with module + exporter user id. withUserAuth; acting user = user.user.id.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { buildDilgPackage } from "@/lib/likha/export";
import { logModuleEvent } from "@/lib/logger";
import type { LikhaExportRequest } from "@/types/likha";

function badBody(): NextResponse {
  return NextResponse.json(
    { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
    { status: 400 }
  );
}

export const POST = withUserAuth(
  async (
    request: NextRequest,
    { user }: { user: { user: { id: string } } }
  ) => {
    const userId = user.user.id;

    // Tolerant body parse: `{}` (or an empty body) means "all published".
    let recordIds: string[] | undefined;
    try {
      const text = await request.text();
      if (text.trim() !== "") {
        const body = JSON.parse(text) as Partial<LikhaExportRequest> | null;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          return badBody();
        }
        if (body.ordinanceIds !== undefined) {
          if (
            !Array.isArray(body.ordinanceIds) ||
            body.ordinanceIds.some((v) => typeof v !== "string")
          ) {
            return badBody();
          }
          recordIds = body.ordinanceIds as string[];
        }
      }
    } catch {
      return badBody();
    }

    const outcome = await buildDilgPackage({ userId, recordIds });

    if (!outcome.ok) {
      return NextResponse.json(
        {
          error:
            "Records not eligible for export (published only): " +
            outcome.ineligibleIds.join(", "),
          code: "CONFLICT",
        },
        { status: 409 }
      );
    }

    const payload = outcome.payload;

    logModuleEvent({
      module: "likha",
      interactionType: "likha_export_dilg",
      content: JSON.stringify({
        recordCount: payload.manifest.recordCount,
        recordIds: payload.records.map((r) => r.sourceRecordId),
      }),
      ipAddress: "127.0.0.1",
      participantSessionId: "likha-" + userId,
    });

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="likha-dilg-mc-2026-041-' +
          payload.manifest.exportedAt.slice(0, 10) +
          '.json"',
      },
    });
  }
);
