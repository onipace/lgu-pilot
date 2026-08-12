// src/app/api/linaw/library/[id]/scan/route.ts
// Sprint 5 (S5-C8) — authenticated scan stream (decision D6): scans are NEVER
// served from public/; bytes stream only through this auth-gated route with
// the reconstructed deterministic path.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { linawScanRelPath } from "@/lib/linaw/ingest";

function scanMimeTypeFor(filename: string): string | null {
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
    select: { id: true, sourceFilename: true },
  });
  if (!row || !row.sourceFilename) {
    return NextResponse.json({ error: "Scan not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const relPath = linawScanRelPath(row.id, row.sourceFilename);
  const absPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    return NextResponse.json({ error: "Scan not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const bytes = fs.readFileSync(absPath);
  const mimeType = scanMimeTypeFor(row.sourceFilename) ?? "application/octet-stream";
  const sanitized = row.sourceFilename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${sanitized}"`,
      "Cache-Control": "private, max-age=0",
      "Content-Length": String(bytes.length),
    },
  });
});
