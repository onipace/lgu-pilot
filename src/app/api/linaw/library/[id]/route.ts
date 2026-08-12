// src/app/api/linaw/library/[id]/route.ts
// Sprint 5 (S5-C8) — LINAW library record detail + verification decision.
// GET  → LinawLibraryDetailResponse (scan availability via the deterministic
//        reconstructed path — decision D6).
// PUT  → approve / reject / edit (only pending_review rows are mutable).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { logModuleEvent } from "@/lib/logger";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { applyLibraryDecision, linawScanRelPath, prismaToOrdinance } from "@/lib/linaw/ingest";
import type { LinawLibraryDetailResponse, LinawVerificationRequest } from "@/types/linaw";

function scanMimeTypeFor(filename: string): LinawLibraryDetailResponse["scanMimeType"] {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null;
}

export const GET = withUserAuth(async (_request, { params }) => {
  const { id } = await params;

  const row = await prisma.linawOrdinance.findUnique({
    where: { id: String(id) },
  });
  if (!row) {
    return NextResponse.json({ error: "Record not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const record = prismaToOrdinance(row);
  let scanAvailable = false;
  if (record.sourceFilename) {
    const stored = path.resolve(process.cwd(), linawScanRelPath(record.id, record.sourceFilename));
    scanAvailable = fs.existsSync(stored);
  }

  const body: LinawLibraryDetailResponse = {
    record,
    scanAvailable,
    scanUrl: scanAvailable ? "/api/linaw/library/" + record.id + "/scan" : null,
    scanMimeType: scanAvailable && record.sourceFilename ? scanMimeTypeFor(record.sourceFilename) : null,
  };
  return NextResponse.json(body, { status: 200 });
});

export const PUT = withUserAuth(async (request, { params, user }) => {
  const { id } = await params;
  const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";

  let body: LinawVerificationRequest;
  try {
    body = (await request.json()) as LinawVerificationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }
  if (!body || !["approve", "reject", "edit"].includes(body.action)) {
    return NextResponse.json(
      { error: "action must be one of: approve, reject, edit", code: "VALIDATION" },
      { status: 400 }
    );
  }

  const result = await applyLibraryDecision({ recordId: String(id), userId: user.user.id, body });
  if (!result.ok) {
    if (result.kind === "not_found") {
      return NextResponse.json({ error: result.error, code: "NOT_FOUND" }, { status: 404 });
    }
    if (result.kind === "conflict") {
      return NextResponse.json({ error: result.error, code: "CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ error: result.error, code: "VALIDATION" }, { status: 400 });
  }

  logModuleEvent({
    module: "linaw",
    interactionType: "linaw_library_verify",
    content: JSON.stringify({
      recordId: result.response.recordId,
      action: result.response.action,
      libraryStatus: result.response.libraryStatus,
    }),
    ipAddress,
    participantName: user.user.full_name,
    participantSessionId: "linaw-" + user.user.id,
  });

  return NextResponse.json(result.response, { status: 200 });
});
