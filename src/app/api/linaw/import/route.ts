// src/app/api/linaw/import/route.ts
// Sprint 5 (S5-C5) — N013 bulk text import into LINAW's own library.
// Accepts JSON / CSV / DOCX (dependency-free raw DOCX extraction — decision
// D1), validates per record, inserts into linaw_ordinances
// (source_type='import', library_status='pending_review') inside ONE
// transaction, and reports duplicates on (ordinance_number, series_year).
// Response shape follows PRD §12.6 verbatim + additive keys (decision D13).

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logModuleEvent } from "@/lib/logger";
import { withUserAuth } from "@/lib/user-auth-middleware";
import {
  DocxParseError,
  MAX_IMPORT_RECORDS,
  parseImportPayload,
} from "@/lib/linaw/import-parser";
import type { LinawImportResponse } from "@/types/linaw";

export const POST = withUserAuth(async (request, { user }) => {
  const userId = user.user.id;
  const ipAddress =
    request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    // ── 1. Payload intake ──
    let parsed: ReturnType<typeof parseImportPayload>;
    let format: "json" | "csv" | "docx";

    const contentType = (request.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Unsupported import format — JSON, CSV or DOCX only", code: "UNSUPPORTED_FORMAT" },
          { status: 400 }
        );
      }
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      if (ext === "json") {
        format = "json";
        parsed = parseImportPayload({ text: buffer.toString("utf8") });
      } else if (ext === "csv") {
        format = "csv";
        parsed = parseImportPayload({ text: buffer.toString("utf8") });
      } else if (ext === "docx") {
        format = "docx";
        try {
          parsed = parseImportPayload({ docxBuffer: buffer });
        } catch (err) {
          if (err instanceof DocxParseError) {
            return NextResponse.json(
              { error: err.message, code: "INVALID_DOCX" },
              { status: 400 }
            );
          }
          throw err;
        }
      } else {
        return NextResponse.json(
          { error: "Unsupported import format — JSON, CSV or DOCX only", code: "UNSUPPORTED_FORMAT" },
          { status: 400 }
        );
      }
    } else if (contentType.includes("application/json") || contentType.includes("text/csv")) {
      format = contentType.includes("application/json") ? "json" : "csv";
      const text = await request.text();
      try {
        parsed = parseImportPayload({ text });
      } catch (err) {
        return NextResponse.json(
          {
            error: err instanceof Error ? err.message : "Invalid import payload",
            code: "INVALID_PAYLOAD",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported import format — JSON, CSV or DOCX only", code: "UNSUPPORTED_FORMAT" },
        { status: 400 }
      );
    }

    // ── 2. Batch gates ──
    const inputRowCount = parsed.records.length + parsed.invalidRecords.length;
    if (inputRowCount > MAX_IMPORT_RECORDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_RECORDS} records per batch`, code: "TOO_MANY_RECORDS" },
        { status: 400 }
      );
    }
    if (parsed.records.length === 0) {
      return NextResponse.json(
        { error: "No records found", code: "NO_RECORDS" },
        { status: 400 }
      );
    }

    // ── 3. Insert loop (single transaction) ──
    const batchId = crypto.randomUUID();

    const { imported, skippedDuplicates, records } = await prisma.$transaction(async (tx) => {
      await tx.agentDecision.create({
        data: {
          id: crypto.randomUUID(),
          module: "linaw",
          pipelineId: batchId,
          agentId: 0,
          agentName: "Ingestion",
          action: "start",
          inputSnapshot: { recordCount: inputRowCount, format },
        },
      });

      let importedCount = 0;
      let skippedCount = 0;
      const insertedRecords: Array<{ id: string; library_status: "pending_review" }> = [];
      const seen = new Set<string>();

      for (const record of parsed.records) {
        const key = `${record.ordinanceNumber}|${record.seriesYear}`;
        if (seen.has(key)) {
          skippedCount += 1;
          continue;
        }
        seen.add(key);

        const existing = await tx.linawOrdinance.findFirst({
          where: {
            ordinanceNumber: record.ordinanceNumber,
            seriesYear: record.seriesYear,
          },
        });
        if (existing) {
          skippedCount += 1;
          continue;
        }

        const id = crypto.randomUUID();
        await tx.linawOrdinance.create({
          data: {
            id,
            ordinanceNumber: record.ordinanceNumber,
            seriesYear: record.seriesYear,
            title: record.title,
            content: record.content,
            subjectTags: record.subjectTags,
            sourceType: "import",
            libraryStatus: "pending_review",
            uploadedById: userId,
          },
        });
        importedCount += 1;
        insertedRecords.push({ id, library_status: "pending_review" });
      }

      await tx.agentDecision.create({
        data: {
          id: crypto.randomUUID(),
          module: "linaw",
          pipelineId: batchId,
          agentId: 0,
          agentName: "Ingestion",
          action: "complete",
          outputSnapshot: {
            imported: importedCount,
            skippedDuplicates: skippedCount,
            invalid: parsed.invalidRecords.length,
          },
        },
      });

      return { imported: importedCount, skippedDuplicates: skippedCount, records: insertedRecords };
    });

    // ── 4. Logging ──
    logModuleEvent({
      module: "linaw",
      interactionType: "linaw_import",
      content: JSON.stringify({
        batchId,
        imported,
        skippedDuplicates,
        invalid: parsed.invalidRecords.length,
      }),
      ipAddress,
      participantName: user.user.full_name,
      participantSessionId: "linaw-" + userId,
    });

    // ── 5. Response (PRD §12.6 verbatim + additive keys — decision D13) ──
    const responseBody: LinawImportResponse = {
      batchId,
      imported,
      skippedDuplicates,
      records,
      invalidRecords: parsed.invalidRecords,
    };
    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    try {
      logModuleEvent({
        module: "linaw",
        interactionType: "linaw_import_error",
        content: err instanceof Error ? err.message : String(err),
        ipAddress,
        participantName: user.user.full_name,
        participantSessionId: "linaw-" + userId,
      });
    } catch {
      // Logging must never mask the original failure.
    }
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
});
