// src/app/api/linaw/upload/route.ts
// Sprint 5 (S5-C7) — N014 scan upload with module-owned OCR.
// Accepts up to 10 PDF/JPG/PNG files (each up to 20 MB), computes SHA-256
// BEFORE OCR for duplicate detection, and digitizes each file inline and
// sequentially (decision D11): processing row → OCR → metadata parse →
// pending_review. Thin wrapper over ingest.digitizeScanFile.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { logModuleEvent } from "@/lib/logger";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { digitizeScanFile, recordIngestionDecision } from "@/lib/linaw/ingest";
import type { LinawUploadFileResult, LinawUploadResponse } from "@/types/linaw";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const POST = withUserAuth(async (request, { user }) => {
  const userId = user.user.id;
  const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((v): v is File => v instanceof File);

    // ── All-or-nothing validation BEFORE any write ──
    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided", code: "NO_FILES" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_FILES} files per batch`,
          code: "TOO_MANY_FILES",
          files: files.map((f) => ({ originalFilename: f.name, error: "Too many files in batch" })),
        },
        { status: 400 }
      );
    }
    const oversize = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversize.length > 0) {
      return NextResponse.json(
        {
          error: "One or more files exceed the 20 MB limit",
          code: "FILE_TOO_LARGE",
          files: oversize.map((f) => ({ originalFilename: f.name, error: "File exceeds 20 MB limit" })),
        },
        { status: 400 }
      );
    }
    const badType = files.filter((f) => !ALLOWED_MIME_TYPES.includes(f.type));
    if (badType.length > 0) {
      return NextResponse.json(
        {
          error: "Unsupported file type — PDF, JPEG or PNG only",
          code: "UNSUPPORTED_TYPE",
          files: badType.map((f) => ({ originalFilename: f.name, error: `Unsupported MIME type: ${f.type}` })),
        },
        { status: 400 }
      );
    }

    const batchId = crypto.randomUUID();
    await recordIngestionDecision({ pipelineId: batchId, action: "start", inputSnapshot: { fileCount: files.length } });

    // ── Sequential inline digitize (decision D11) ──
    let accepted = 0;
    let duplicates = 0;
    let failed = 0;
    const results: LinawUploadFileResult[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await digitizeScanFile({
        buffer,
        mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png",
        filename: file.name,
        uploadedById: userId,
      });

      const item: LinawUploadFileResult = {
        id: result.id,
        hash: result.hash,
        status: result.status,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      if (result.ordinanceNumber !== undefined) item.ordinanceNumber = result.ordinanceNumber;
      if (result.seriesYear !== undefined) item.seriesYear = result.seriesYear;
      if (result.title !== undefined) item.title = result.title;
      if (result.confidence !== undefined) item.confidence = result.confidence;
      if (result.error !== undefined) item.error = result.error;

      if (result.status === "accepted") accepted += 1;
      else if (result.status === "duplicate" || result.status === "duplicate_metadata") duplicates += 1;
      else if (result.status === "ocr_failed") failed += 1;

      results.push(item);
    }

    await recordIngestionDecision({
      pipelineId: batchId,
      action: "complete",
      outputSnapshot: { accepted, duplicates, failed },
    });

    logModuleEvent({
      module: "linaw",
      interactionType: "linaw_upload",
      content: JSON.stringify({ batchId, accepted, duplicates, failed }),
      ipAddress,
      participantName: user.user.full_name,
      participantSessionId: "linaw-" + userId,
    });

    const responseBody: LinawUploadResponse = { batchId, accepted, duplicates, failed, files: results };
    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    try {
      logModuleEvent({
        module: "linaw",
        interactionType: "linaw_upload_error",
        content: err instanceof Error ? err.message : String(err),
        ipAddress,
        participantName: user.user.full_name,
        participantSessionId: "linaw-" + userId,
      });
    } catch {
      // Logging must never mask the original failure.
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
});
