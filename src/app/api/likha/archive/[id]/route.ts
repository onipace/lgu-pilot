// src/app/api/likha/archive/[id]/route.ts
// Sprint 3 (S3-C3) — L004 verification endpoints.
//   GET /api/likha/archive/[id]  → LikhaRecordDetailResponse (panel detail)
//   PUT /api/likha/archive/[id]  → human approve / edit / reject decision
// Both wrapped in withUserAuth; acting user = user.user.id.
// Decision D19: approve persists the human decision FIRST, then runs the
// Archiver (agent 6) server-side inside the same branch — publish is gated
// on the human approval and never happens without it.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { applyVerificationDecision } from "@/lib/likha/agents";
import { publishApprovedRecord } from "@/lib/likha/archiver";
import type {
  ArchivedOrdinance,
  LikhaRecordDetailResponse,
  LikhaVerificationRequest,
  MetadataConfidence,
} from "@/types/likha";

/** MIME derived from the filename extension (same logic as the pipeline route). */
function mimeFromFilename(
  filename: string
): "application/pdf" | "image/jpeg" | "image/png" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

/** extractionConfidence is a native Json? field — already a JS object or null. */
function mapConfidence(raw: unknown): MetadataConfidence | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = raw as Partial<MetadataConfidence>;
  if (
    typeof parsed.ordinanceNumber === "number" &&
    typeof parsed.seriesYear === "number" &&
    typeof parsed.title === "number" &&
    typeof parsed.sectionCount === "number"
  ) {
    return {
      ordinanceNumber: parsed.ordinanceNumber,
      seriesYear: parsed.seriesYear,
      title: parsed.title,
      sectionCount: parsed.sectionCount,
    };
  }
  return undefined;
}

/** subjectTags is a native Json field — already a JS array. */
function safeSubjectTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

/** Map a Prisma ArchivedOrdinance record to the camelCase ArchivedOrdinance contract. */
function toArchivedOrdinance(row: {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary: string | null;
  subjectTags: unknown;
  status: string;
  archiveStatus: string;
  sourceType: string;
  originalFilename: string | null;
  scanFilePath: string | null;
  fileHash: string | null;
  extractionConfidence: unknown;
  uploadedById: string;
  verifiedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ArchivedOrdinance {
  return {
    id: row.id,
    ordinanceNumber: row.ordinanceNumber,
    seriesYear: row.seriesYear,
    title: row.title,
    content: row.content,
    summary: row.summary ?? undefined,
    subjectTags: safeSubjectTags(row.subjectTags),
    status: row.status as ArchivedOrdinance["status"],
    archiveStatus: row.archiveStatus as ArchivedOrdinance["archiveStatus"],
    sourceType: row.sourceType,
    originalFilename: row.originalFilename ?? undefined,
    scanFilePath: row.scanFilePath ?? undefined,
    fileHash: row.fileHash ?? undefined,
    extractionConfidence: mapConfidence(row.extractionConfidence),
    uploadedById: row.uploadedById,
    verifiedById: row.verifiedById ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const GET = withUserAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;

    const row = await prisma.archivedOrdinance.findUnique({
      where: { id },
    });
    if (!row) {
      return NextResponse.json(
        { error: "Record not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const filename = row.originalFilename ?? row.scanFilePath ?? "";
    const scanMimeType = row.scanFilePath ? mimeFromFilename(filename) : null;
    const resolved = row.scanFilePath
      ? path.isAbsolute(row.scanFilePath)
        ? row.scanFilePath
        : path.join(process.cwd(), row.scanFilePath)
      : null;
    const scanAvailable = Boolean(resolved && fs.existsSync(resolved));

    // Sprint 4 (D26): classifications with provenance, newest-first —
    // additive field on the Sprint-3 response (byte-compatible otherwise).
    const classifications = await prisma.classification.findMany({
      where: { ordinanceId: row.id },
      orderBy: { createdAt: "desc" },
    });

    const response: LikhaRecordDetailResponse = {
      record: toArchivedOrdinance(row),
      scanAvailable,
      scanUrl: scanAvailable ? `/api/likha/archive/${row.id}/scan` : null,
      scanMimeType,
      classifications: classifications.map((c) => ({
        id: c.id,
        category: c.category,
        confidence: c.confidence,
        assignedBy: c.assignedBy,
        createdAt: c.createdAt.toISOString(),
      })),
    };
    return NextResponse.json(response);
  }
);

export const PUT = withUserAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ id: string }>; user: { user: { id: string } } }
  ) => {
    const { id } = await params;

    let body: LikhaVerificationRequest;
    try {
      body = (await request.json()) as LikhaVerificationRequest;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }
    if (!body || !["approve", "edit", "reject"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid verification action", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const outcome = await applyVerificationDecision({
      recordId: id,
      userId: user.user.id,
      body,
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

    const response = outcome.response;

    // Archiver gating (constraint 3 / decisions D16+D19): agent 6 runs ONLY
    // here — inside the approve branch, after the human decision is persisted.
    if (response.action === "approve") {
      const publish = await publishApprovedRecord({ recordId: id, userId: user.user.id });
      if (!publish.ok) {
        if (publish.kind === "not_found") {
          return NextResponse.json(
            { error: publish.error, code: "NOT_FOUND" },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: publish.error, code: "CONFLICT" },
          { status: 409 }
        );
      }
      return NextResponse.json({
        ...response,
        archiveStatus: "published",
        published: true,
      });
    }

    return NextResponse.json(response);
  }
);
