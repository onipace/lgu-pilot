// src/app/api/linaw/detect-relationships/route.ts
// Sprint 6 (S6-C10) — N003/N004 detection endpoint (PRD §12.6: one run
// returns relationships + conflicts). Thin auth + validation + engine wrapper
// over agents 3 (scanCrossReferences) + 4 (detectConflicts) sharing ONE
// pipelineId. Both engines degrade internally (D7/D9/D12), so a 500 here is
// rare and always structured.

export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { scanCrossReferences, detectConflicts } from "@/lib/linaw/agents";
import type { LinawDetectResponse } from "@/types/linaw";

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
    if (!Array.isArray(ordinanceIds) || ordinanceIds.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "ordinanceIds must be an array of strings", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
  }

  const userId = user.user.id;
  const pipelineId = "detect-" + crypto.randomUUID();
  const scope = Array.isArray(ordinanceIds) ? ordinanceIds : undefined;

  try {
    const scan = await scanCrossReferences({ ordinanceIds: scope, userId, pipelineId });
    const conflicts = await detectConflicts({ ordinanceIds: scope, userId, pipelineId });

    const response: LinawDetectResponse = {
      pipelineId,
      scanned: scan.scanned,
      relationshipsDetected: scan.detected,
      relationshipsPersisted: scan.persisted,
      skippedExisting: scan.skippedExisting,
      orphans: scan.orphans,
      conflictsDetected: conflicts.detected,
      conflictsPersisted: conflicts.persisted,
      conflicts: conflicts.conflicts,
      hitlRequired: scan.detected > 0 || conflicts.detected > 0,
      exceptions: [...conflicts.exceptions],
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[linaw/detect-relationships] detection failed:", err);
    return NextResponse.json(
      { error: "Relationship detection failed" },
      { status: 500 }
    );
  }
});
