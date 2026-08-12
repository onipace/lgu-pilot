// src/app/api/likha/archive/[id]/scan/route.ts
// Sprint 3 (S3-C3, decision D15) — authenticated scan streaming.
// GET /api/likha/archive/[id]/scan serves the stored scan bytes with the
// correct content type. Scans live under data/uploads/likha/ (never public/).
// Refuses any resolved path that escapes data/uploads/likha/.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { withUserAuth } from "@/lib/user-auth-middleware";

function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export const GET = withUserAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;

    const row = await prisma.archivedOrdinance.findUnique({
      where: { id },
      select: { scanFilePath: true, originalFilename: true },
    });

    if (!row || !row.scanFilePath) {
      return NextResponse.json(
        { error: "Record not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const uploadsRoot = path.resolve(process.cwd(), "data", "uploads", "likha");
    const resolved = path.resolve(
      path.isAbsolute(row.scanFilePath)
        ? row.scanFilePath
        : path.join(process.cwd(), row.scanFilePath)
    );

    // Path-traversal guard: never serve files outside data/uploads/likha/.
    if (!resolved.startsWith(uploadsRoot + path.sep)) {
      return NextResponse.json(
        { error: "Record not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        { error: "Record not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(resolved);
    const filename = row.originalFilename ?? path.basename(resolved);
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeFromFilename(filename),
        "Content-Disposition": `inline; filename="${sanitized}"`,
      },
    });
  }
);
