// src/app/api/likha/upload/route.ts
// Sprint 2 (S2-C4) — L001 batch upload of scanned ordinance PDFs/images.
// Multipart ≤10 files, PDF/JPG/PNG, ≤20 MB each. SHA-256 hashed BEFORE any
// OCR; duplicate hashes surface the existing archive record without writing.
// Rows persist with placeholder metadata (decision D6) — real values arrive
// from the L003 pipeline. Auth via withUserAuth; uploader id = user.user.id.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logModuleEvent } from "@/lib/logger";
import { withUserAuth } from "@/lib/user-auth-middleware";
import type { LikhaUploadFileResult, LikhaUploadResponse } from "@/types/likha";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const UPLOAD_DIR = path.join("data", "uploads", "likha");

interface BatchValidationError {
  error: string;
  code: string;
  files: { originalFilename: string; error: string }[];
}

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

/** All-or-nothing batch validation — runs BEFORE anything is written. */
function validateBatch(files: File[]): BatchValidationError | null {
  if (files.length === 0) {
    return { error: "No files provided", code: "NO_FILES", files: [] };
  }
  if (files.length > MAX_FILES) {
    return {
      error: `Maximum ${MAX_FILES} files per batch`,
      code: "TOO_MANY_FILES",
      files: files.map((f) => ({
        originalFilename: f.name,
        error: `Batch exceeds ${MAX_FILES} files`,
      })),
    };
  }
  const oversize = files.filter((f) => f.size > MAX_FILE_BYTES);
  if (oversize.length > 0) {
    return {
      error: "File exceeds 20 MB limit",
      code: "FILE_TOO_LARGE",
      files: oversize.map((f) => ({
        originalFilename: f.name,
        error: "File exceeds 20 MB limit",
      })),
    };
  }
  const badType = files.filter((f) => !ALLOWED_MIME_TYPES.includes(f.type));
  if (badType.length > 0) {
    return {
      error: "Unsupported file type — PDF, JPG or PNG only",
      code: "UNSUPPORTED_TYPE",
      files: badType.map((f) => ({
        originalFilename: f.name,
        error: `Unsupported file type: ${f.type || "unknown"}`,
      })),
    };
  }
  return null;
}

/**
 * Insert the archive row with D6 placeholder metadata (negative random
 * ordinance_number, series_year 0). On the astronomically unlikely
 * UNIQUE(ordinance_number, series_year) collision, retry once with a
 * fresh random number.
 */
async function insertPlaceholderRow(
  recordId: string,
  originalName: string,
  relPath: string,
  fileHash: string,
  uploadedById: string
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await prisma.archivedOrdinance.create({
        data: {
          id: recordId,
          ordinanceNumber: -crypto.randomInt(1, 2_000_000_000),
          seriesYear: 0,
          title: "Processing — " + originalName,
          content: "",
          sourceType: "scan",
          originalFilename: originalName,
          scanFilePath: relPath,
          fileHash,
          archiveStatus: "processing",
          uploadedById,
        },
      });
      return;
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt === 0) {
        continue; // retry once with a fresh random placeholder number
      }
      throw err;
    }
  }
}

async function recordAgentDecision(params: {
  pipelineId: string;
  action: string;
  inputSnapshot?: string;
  outputSnapshot?: string;
}): Promise<void> {
  await prisma.agentDecision.create({
    data: {
      id: crypto.randomUUID(),
      module: "likha",
      pipelineId: params.pipelineId,
      agentId: 1,
      agentName: "Ingestor",
      action: params.action,
      inputSnapshot: params.inputSnapshot ?? undefined,
      outputSnapshot: params.outputSnapshot ?? undefined,
    },
  });
}

export const POST = withUserAuth(async (request: NextRequest, { user }) => {
  try {
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter((f): f is File => typeof File !== "undefined" && f instanceof File);

    const validationError = validateBatch(files);
    if (validationError) {
      return NextResponse.json(validationError, { status: 400 });
    }

    const batchId = crypto.randomUUID();
    const ipAddress =
      request.headers.get("x-forwarded-for") || "127.0.0.1";

    // Agent 1 (Ingestor) audit — start row before the loop.
    await recordAgentDecision({
      pipelineId: batchId,
      action: "start",
      inputSnapshot: JSON.stringify({ fileCount: files.length }),
    });

    const results: LikhaUploadFileResult[] = [];
    const fileHashes: string[] = [];
    let accepted = 0;
    let duplicates = 0;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Hash computed BEFORE any OCR / persistence — always.
      const fileHash = crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");

      const existing = await prisma.archivedOrdinance.findFirst({
        where: { fileHash },
        select: { id: true },
      });

      if (existing) {
        duplicates += 1;
        results.push({
          originalFilename: file.name,
          status: "duplicate",
          sizeBytes: file.size,
          fileHash,
          existingRecordId: existing.id,
        });
        continue;
      }

      const recordId = crypto.randomUUID();
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const relPath =
        "data/uploads/likha/" + recordId + "__" + sanitized;

      fs.mkdirSync(path.join(process.cwd(), UPLOAD_DIR), { recursive: true });
      fs.writeFileSync(path.join(process.cwd(), relPath), buffer);

      await insertPlaceholderRow(recordId, file.name, relPath, fileHash, user.user.id);

      accepted += 1;
      fileHashes.push(fileHash);
      results.push({
        originalFilename: file.name,
        status: "accepted",
        recordId,
        fileHash,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    }

    // Agent 1 (Ingestor) audit — complete row after the loop.
    await recordAgentDecision({
      pipelineId: batchId,
      action: "complete",
      outputSnapshot: JSON.stringify({ accepted, duplicates, fileHashes }),
    });

    logModuleEvent({
      module: "likha",
      interactionType: "likha_upload",
      content: JSON.stringify({ batchId, accepted, duplicates }),
      ipAddress,
      participantName: user.user.full_name,
      participantSessionId: "likha-" + user.user.id,
    });

    const response: LikhaUploadResponse = {
      batchId,
      accepted,
      duplicates,
      rejected: 0,
      files: results,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[likha/upload] Unexpected error:", err);
    try {
      logModuleEvent({
        module: "likha",
        interactionType: "likha_upload_error",
        content: err instanceof Error ? err.message : String(err),
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
        participantName: user.user.full_name,
        participantSessionId: "likha-" + user.user.id,
      });
    } catch {
      // Logging must never mask the original failure.
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
});
