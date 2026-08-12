// src/app/api/likha/pipeline/route.ts
// Sprint 2 (S2-C7) — POST /api/likha/pipeline: runs agents 2–3 over
// archive_status='processing' rows owned by the caller and responds with the
// LikhaPipelineResponse. Auth via withUserAuth; uploader id = user.user.id.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { runLikhaPipeline } from "@/lib/likha/agents";
import type { LikhaPipelineFileInput } from "@/types/likha";

interface PipelineRequestBody {
  batchId?: string;
  fileIds?: string[];
  pipelineId?: string;
}

export const POST = withUserAuth(async (request: NextRequest, { user }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as PipelineRequestBody;

    let rows: Array<{
      id: string;
      originalFilename: string | null;
      scanFilePath: string | null;
      fileHash: string | null;
      archiveStatus: string;
    }>;

    if (Array.isArray(body.fileIds) && body.fileIds.length > 0) {
      rows = await prisma.archivedOrdinance.findMany({
        where: {
          id: { in: body.fileIds },
          uploadedById: user.user.id,
        },
        select: {
          id: true,
          originalFilename: true,
          scanFilePath: true,
          fileHash: true,
          archiveStatus: true,
        },
      });
    } else {
      rows = await prisma.archivedOrdinance.findMany({
        where: {
          archiveStatus: "processing",
          uploadedById: user.user.id,
        },
        select: {
          id: true,
          originalFilename: true,
          scanFilePath: true,
          fileHash: true,
          archiveStatus: true,
        },
      });
    }

    /** MIME is derived from the original filename extension (rows carry no MIME column). */
    function mimeFromFilename(filename: string): LikhaPipelineFileInput["mimeType"] {
      const lower = filename.toLowerCase();
      if (lower.endsWith(".pdf")) return "application/pdf";
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
      return "image/png";
    }

    const files: LikhaPipelineFileInput[] = rows
      .filter((r) => r.archiveStatus === "processing" && r.scanFilePath)
      .map((r) => ({
        recordId: r.id,
        originalFilename: r.originalFilename ?? "unknown",
        mimeType: mimeFromFilename(r.originalFilename ?? ""),
        scanFilePath: r.scanFilePath as string,
        fileHash: r.fileHash ?? "",
      }));

    const pipelineId = body.pipelineId || crypto.randomUUID();
    const result = await runLikhaPipeline({
      pipelineId,
      batchId: body.batchId,
      userId: user.user.id,
      files,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[likha/pipeline] Unexpected error:", err);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
});
