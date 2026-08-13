// src/lib/linaw/ingest.ts
// Sprint 5 (S5-C6) — LINAW ingestion + verification logic (server-only).
// Independent implementation of the proven server-logic pattern: every DB
// handle, OCR function, and LLM function is injectable for hermetic tests.
// Writes ONLY to linaw_ordinances + agent_decisions (module='linaw'); no
// schema changes (frozen Sprint-1 DDL).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { LinawOrdinance } from "@/generated/prisma/client";
import { chatCompletion } from "@/lib/ai/llm";
import { extractText, OcrError } from "@/lib/linaw/ocr";
import {
  LINAW_METADATA_SYSTEM_PROMPT,
  buildLinawMetadataUserPrompt,
  parseLinawMetadataResponse,
} from "@/lib/linaw/prompts";
import type {
  LinawManualCreateRequest,
  LinawOrdinance as LinawOrdinanceType,
  LinawVerificationRequest,
  LinawVerificationResponse,
} from "@/types/linaw";

/** Storage root for LINAW scans (mirrors the sibling module's layout — decision D6). */
export const LINAW_UPLOAD_DIR = path.join("data", "uploads", "linaw");

/**
 * Deterministic scan path convention (decision D6): the table has no path
 * column, so detail/scan routes reconstruct this from id + source_filename.
 */
export function linawScanRelPath(recordId: string, sourceFilename: string): string {
  const sanitized = sourceFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return "data/uploads/linaw/" + recordId + "__" + sanitized;
}

/**
 * Audit helper (decision D7): module='linaw', agent_id=0, agent_name='Ingestion'
 * for pre-pipeline human/module actions. Used by the import + upload routes.
 */
export async function recordIngestionDecision(params: {
  pipelineId: string;
  action: string;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
}): Promise<void> {
  await prisma.agentDecision.create({
    data: {
      id: crypto.randomUUID(),
      module: "linaw",
      pipelineId: params.pipelineId,
      agentId: 0,
      agentName: "Ingestion",
      action: params.action,
      inputSnapshot: params.inputSnapshot ? JSON.parse(JSON.stringify(params.inputSnapshot)) : undefined,
      outputSnapshot: params.outputSnapshot ? JSON.parse(JSON.stringify(params.outputSnapshot)) : undefined,
    },
  });
}

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export interface DigitizeParams {
  buffer: Buffer;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  filename: string;
  uploadedById: string;
  ocr?: typeof extractText;
  llm?: (system: string, user: string) => Promise<string>;
}

export interface DigitizeResult {
  status: "accepted" | "duplicate" | "duplicate_metadata" | "ocr_failed";
  id?: string;
  hash: string;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  confidence?: { ordinanceNumber: number; seriesYear: number; title: number };
  error?: string;
}

/**
 * Inline digitize chain (decision D11): hash → duplicate check → persist
 * processing row → OCR → metadata parse → UPDATE to pending_review.
 * OCR failure after the wrapper's own retry lands the row in pending_review
 * with placeholders so a human can finish it in verification.
 */
export async function digitizeScanFile(params: DigitizeParams): Promise<DigitizeResult> {
  const ocr = params.ocr ?? extractText;
  const llm =
    params.llm ??
    (async (system: string, user: string) =>
      (await chatCompletion(system, user)).content);

  // 1. Hash computed BEFORE anything else (duplicate detection precedes OCR).
  const hash = sha256Hex(params.buffer);

  // 2. Hash duplicate check.
  const hashHit = await prisma.linawOrdinance.findFirst({
    where: { fileHash: hash },
    select: { id: true },
  });
  if (hashHit) {
    return { status: "duplicate", hash };
  }

  // 3. Store the file under the deterministic path convention.
  const recordId = crypto.randomUUID();
  fs.mkdirSync(LINAW_UPLOAD_DIR, { recursive: true });
  const relPath = linawScanRelPath(recordId, params.filename);
  fs.writeFileSync(path.resolve(process.cwd(), relPath), params.buffer);

  // 4. Insert the processing row with placeholder metadata.
  const placeholderOrdinance = -crypto.randomInt(1, 2_000_000_000);
  try {
    await prisma.linawOrdinance.create({
      data: {
        id: recordId,
        ordinanceNumber: placeholderOrdinance,
        seriesYear: 0,
        title: "Processing — " + params.filename,
        content: "",
        sourceType: "scan",
        sourceFilename: params.filename,
        fileHash: hash,
        libraryStatus: "processing",
        uploadedById: params.uploadedById,
      },
    });
  } catch {
    // Astronomically unlikely placeholder UNIQUE collision — retry once.
    await prisma.linawOrdinance.create({
      data: {
        id: recordId,
        ordinanceNumber: -crypto.randomInt(1, 2_000_000_000),
        seriesYear: 0,
        title: "Processing — " + params.filename,
        content: "",
        sourceType: "scan",
        sourceFilename: params.filename,
        fileHash: hash,
        libraryStatus: "processing",
        uploadedById: params.uploadedById,
      },
    });
  }

  // 5. OCR (wrapper already retried once internally).
  let ocrText: string;
  try {
    const ocrResult = await ocr({
      fileBuffer: params.buffer,
      mimeType: params.mimeType,
      filename: params.filename,
    });
    ocrText = ocrResult.text;
  } catch (err) {
    if (err instanceof OcrError) {
      await prisma.linawOrdinance.update({
        where: { id: recordId },
        data: { libraryStatus: "pending_review" },
      });
      return { status: "ocr_failed", id: recordId, hash, error: err.message };
    }
    throw err;
  }

  // 6. Metadata parse via LINAW's own prompt (never throws).
  let raw = "";
  try {
    raw = await llm(LINAW_METADATA_SYSTEM_PROMPT, buildLinawMetadataUserPrompt(ocrText));
  } catch {
    raw = "";
  }
  const parsed = parseLinawMetadataResponse(raw);

  // 7. Real metadata → duplicate check, then finalize the row.
  if (parsed.ordinanceNumber > 0 && parsed.seriesYear > 0 && parsed.title !== "") {
    const metadataHit = await prisma.linawOrdinance.findFirst({
      where: {
        ordinanceNumber: parsed.ordinanceNumber,
        seriesYear: parsed.seriesYear,
      },
      select: { id: true },
    });
    if (metadataHit) {
      await prisma.linawOrdinance.delete({ where: { id: recordId } });
      fs.rmSync(path.resolve(process.cwd(), relPath), { force: true });
      return { status: "duplicate_metadata", hash };
    }

    await prisma.linawOrdinance.update({
      where: { id: recordId },
      data: {
        ordinanceNumber: parsed.ordinanceNumber,
        seriesYear: parsed.seriesYear,
        title: parsed.title,
        content: ocrText,
        libraryStatus: "pending_review",
      },
    });
    return {
      status: "accepted",
      id: recordId,
      hash,
      ordinanceNumber: parsed.ordinanceNumber,
      seriesYear: parsed.seriesYear,
      title: parsed.title,
      confidence: parsed.confidence,
    };
  }

  // 8. Parse produced zeros → keep placeholders for the human reviewer.
  await prisma.linawOrdinance.update({
    where: { id: recordId },
    data: {
      content: ocrText,
      libraryStatus: "pending_review",
    },
  });
  return { status: "accepted", id: recordId, hash };
}

// ── Manual entry ──

function validateTags(tags: unknown): string[] | null {
  if (tags === undefined) return [];
  if (!Array.isArray(tags)) return null;
  if (tags.length > 20) return null;
  const out: string[] = [];
  for (const entry of tags) {
    if (typeof entry !== "string") return null;
    const trimmed = entry.trim();
    if (trimmed === "" || trimmed.length > 60) return null;
    out.push(trimmed);
  }
  return out;
}

export async function createManualRecord(params: {
  userId: string;
  fields: LinawManualCreateRequest;
}): Promise<{ ok: true; record: LinawOrdinanceType } | { ok: false; kind: "invalid" | "conflict"; error: string }> {
  const fields = params.fields ?? ({} as LinawManualCreateRequest);

  if (!Number.isInteger(fields.ordinanceNumber) || fields.ordinanceNumber <= 0) {
    return { ok: false, kind: "invalid", error: "ordinanceNumber must be a positive integer" };
  }
  if (!Number.isInteger(fields.seriesYear) || fields.seriesYear <= 0) {
    return { ok: false, kind: "invalid", error: "seriesYear must be a positive integer" };
  }
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  if (title === "") {
    return { ok: false, kind: "invalid", error: "title must be a non-empty string" };
  }
  const content = typeof fields.content === "string" ? fields.content.trim() : "";
  if (content === "") {
    return { ok: false, kind: "invalid", error: "content must be a non-empty string" };
  }
  const subjectTags = validateTags(fields.subjectTags);
  if (subjectTags === null) {
    return { ok: false, kind: "invalid", error: "subjectTags must be at most 20 strings of at most 60 chars" };
  }

  const collision = await prisma.linawOrdinance.findFirst({
    where: {
      ordinanceNumber: fields.ordinanceNumber,
      seriesYear: fields.seriesYear,
    },
    select: { id: true },
  });
  if (collision) {
    return {
      ok: false,
      kind: "conflict",
      error: "An ordinance with this number and series year already exists",
    };
  }

  const id = crypto.randomUUID();
  const created = await prisma.linawOrdinance.create({
    data: {
      id,
      ordinanceNumber: fields.ordinanceNumber,
      seriesYear: fields.seriesYear,
      title,
      content,
      subjectTags,
      sourceType: "manual",
      libraryStatus: "pending_review",
      uploadedById: params.userId,
    },
  });

  return { ok: true, record: prismaToOrdinance(created) };
}

/** Convert a Prisma LinawOrdinance to the API LinawOrdinance type. */
export function prismaToOrdinance(row: LinawOrdinance): LinawOrdinanceType {
  const tags = Array.isArray(row.subjectTags)
    ? (row.subjectTags as unknown[]).filter((t): t is string => typeof t === 'string')
    : [];
  return {
    id: row.id,
    ordinanceNumber: row.ordinanceNumber,
    seriesYear: row.seriesYear,
    title: row.title,
    content: row.content,
    summary: row.summary ?? undefined,
    subjectTags: tags,
    status: row.status as LinawOrdinanceType["status"],
    sourceType: row.sourceType as LinawOrdinanceType["sourceType"],
    sourceFilename: row.sourceFilename ?? undefined,
    fileHash: row.fileHash ?? undefined,
    libraryStatus: row.libraryStatus as LinawOrdinanceType["libraryStatus"],
    uploadedById: row.uploadedById,
    verifiedById: row.verifiedById ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Verification decisions ──

export async function applyLibraryDecision(params: {
  recordId: string;
  userId: string;
  body: LinawVerificationRequest;
}): Promise<
  | { ok: true; response: LinawVerificationResponse }
  | { ok: false; kind: "not_found" | "conflict" | "invalid"; error: string }
> {
  const body = params.body;

  const row = await prisma.linawOrdinance.findUnique({
    where: { id: params.recordId },
  });
  if (!row) {
    return { ok: false, kind: "not_found", error: "Record not found" };
  }
  if (body.expectedUpdatedAt && row.updatedAt.toISOString() !== body.expectedUpdatedAt) {
    return { ok: false, kind: "conflict", error: "Record changed or already finalized — reload and retry" };
  }
  if (row.libraryStatus !== "pending_review") {
    return { ok: false, kind: "conflict", error: "Record already finalized" };
  }

  const audit = async (action: string, outputSnapshot: Record<string, unknown>, reason?: string) => {
    await prisma.agentDecision.create({
      data: {
        id: crypto.randomUUID(),
        module: "linaw",
        pipelineId: "verification-" + params.recordId,
        agentId: 0,
        agentName: "Library Verification",
        action,
        outputSnapshot: JSON.parse(JSON.stringify(outputSnapshot)),
        userId: params.userId,
        reason: reason ?? null,
      },
    });
  };

  if (body.action === "approve") {
    // Check current status to handle race conditions
    const current = await prisma.linawOrdinance.findUnique({
      where: { id: params.recordId },
      select: { libraryStatus: true },
    });
    if (!current || current.libraryStatus !== "pending_review") {
      return { ok: false, kind: "conflict", error: "Record already finalized" };
    }
    await prisma.linawOrdinance.update({
      where: { id: params.recordId },
      data: {
        libraryStatus: "ready",
        verifiedById: params.userId,
      },
    });
    await audit("confirm", { decision: "approve" });
    return {
      ok: true,
      response: { recordId: params.recordId, action: "approve", libraryStatus: "ready" },
    };
  }

  if (body.action === "reject") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason === "") {
      return { ok: false, kind: "invalid", error: "A reason is required to reject a record" };
    }
    const current = await prisma.linawOrdinance.findUnique({
      where: { id: params.recordId },
      select: { libraryStatus: true },
    });
    if (!current || current.libraryStatus !== "pending_review") {
      return { ok: false, kind: "conflict", error: "Record already finalized" };
    }
    await prisma.linawOrdinance.update({
      where: { id: params.recordId },
      data: { libraryStatus: "rejected" },
    });
    // The reason persists ONLY in agent_decisions (decision D9 — no table column).
    await audit("reject", { decision: "reject" }, reason);
    return {
      ok: true,
      response: { recordId: params.recordId, action: "reject", libraryStatus: "rejected", reason },
    };
  }

  if (body.action === "edit") {
    const fields = body.fields ?? {};
    let ordinanceNumber = row.ordinanceNumber;
    let seriesYear = row.seriesYear;
    let title = row.title;
    let content = row.content;
    let subjectTags = Array.isArray(row.subjectTags)
      ? (row.subjectTags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    const changed: Record<string, unknown> = {};

    if (fields.ordinanceNumber !== undefined) {
      if (!Number.isInteger(fields.ordinanceNumber) || fields.ordinanceNumber <= 0) {
        return { ok: false, kind: "invalid", error: "ordinanceNumber must be a positive integer" };
      }
      ordinanceNumber = fields.ordinanceNumber;
      changed.ordinanceNumber = ordinanceNumber;
    }
    if (fields.seriesYear !== undefined) {
      if (!Number.isInteger(fields.seriesYear) || fields.seriesYear <= 0) {
        return { ok: false, kind: "invalid", error: "seriesYear must be a positive integer" };
      }
      seriesYear = fields.seriesYear;
      changed.seriesYear = seriesYear;
    }
    if (fields.title !== undefined) {
      const trimmed = typeof fields.title === "string" ? fields.title.trim() : "";
      if (trimmed === "") {
        return { ok: false, kind: "invalid", error: "title must be a non-empty string" };
      }
      title = trimmed;
      changed.title = title;
    }
    if (fields.content !== undefined) {
      const trimmed = typeof fields.content === "string" ? fields.content.trim() : "";
      if (trimmed === "") {
        return { ok: false, kind: "invalid", error: "content must be a non-empty string" };
      }
      content = trimmed;
      changed.content = content;
    }
    if (fields.subjectTags !== undefined) {
      const validated = validateTags(fields.subjectTags);
      if (validated === null) {
        return { ok: false, kind: "invalid", error: "subjectTags must be at most 20 strings of at most 60 chars" };
      }
      subjectTags = validated;
      changed.subjectTags = subjectTags;
    }

    const collision = await prisma.linawOrdinance.findFirst({
      where: {
        ordinanceNumber,
        seriesYear,
        id: { not: params.recordId },
      },
      select: { id: true },
    });
    if (collision) {
      return {
        ok: false,
        kind: "conflict",
        error: "An ordinance with this number and series year already exists",
      };
    }

    const current = await prisma.linawOrdinance.findUnique({
      where: { id: params.recordId },
      select: { libraryStatus: true },
    });
    if (!current || current.libraryStatus !== "pending_review") {
      return { ok: false, kind: "conflict", error: "Record already finalized" };
    }

    await prisma.linawOrdinance.update({
      where: { id: params.recordId },
      data: {
        ordinanceNumber,
        seriesYear,
        title,
        content,
        subjectTags,
      },
    });
    await audit("confirm", { decision: "edit", changed });
    return {
      ok: true,
      response: { recordId: params.recordId, action: "edit", libraryStatus: "pending_review" },
    };
  }

  return { ok: false, kind: "invalid", error: "Unknown verification action" };
}
