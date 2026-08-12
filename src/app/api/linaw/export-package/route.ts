// src/app/api/linaw/export-package/route.ts
// Sprint 7 (S7-C14) — N015 L1 interchange export endpoint (INTERCHANGE-SPEC
// v1.0.0 §7). Thin auth + tolerant body + outcome-mapping layer over
// buildLinawInterchangePackage; owns logging + attachment headers. NOT gated
// by final_code_export — the L1 package is a library snapshot (SPEC §4/D5).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { logModuleEvent } from "@/lib/logger";
import { buildLinawInterchangePackage } from "@/lib/linaw/export";
import type { LinawExportRequest } from "@/types/linaw";

export const POST = withUserAuth(async (request, { user }) => {
  let body: Partial<LinawExportRequest> = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
          { status: 400 }
        );
      }
      body = parsed as Partial<LinawExportRequest>;
    }
  } catch {
    return NextResponse.json(
      { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
      { status: 400 }
    );
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

  const outcome = await buildLinawInterchangePackage({
    userId: user.user.id,
    recordIds: body.ordinanceIds,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error, code: "CONFLICT" }, { status: 409 });
  }

  logModuleEvent({
    module: "linaw",
    interactionType: "linaw_export_package",
    content: JSON.stringify({
      recordCount: outcome.payload.records.length,
      packageHash: outcome.payload.packageHash,
    }),
    ipAddress: "127.0.0.1",
    participantSessionId: "linaw-" + user.user.id,
  });

  const filename =
    "esangguni-linaw-l1-package-" + outcome.payload.manifest.exportedAt.replace(/[:.]/g, "-") + ".json";
  return new Response(JSON.stringify(outcome.payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
