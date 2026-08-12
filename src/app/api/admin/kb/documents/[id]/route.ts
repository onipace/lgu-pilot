import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { deleteDocumentFromLightRAG } from "@/lib/ai/rag";
import fs from "fs";
import path from "path";

// GET /api/admin/kb/documents/[id] — Get a single document
export const GET = withAuth(async (request, _session, context) => {
  const { id } = context.params;

  const doc = await prisma.kbDocument.findUnique({ where: { id } });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...doc,
    topics: doc.topics ? safeParseJson(doc.topics) : null,
  });
});

// PUT /api/admin/kb/documents/[id] — Update a document
export const PUT = withAuth(async (request, _session, context) => {
  const { id } = context.params;

  const existing = await prisma.kbDocument.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await request.json();

  const fieldMap: Record<string, string> = {
    lgu_id: "lguId",
    doc_type: "docType",
    title: "title",
    content: "content",
    metadata: "metadata",
    section_number: "sectionNumber",
    ordinance_number: "ordinanceNumber",
    series_year: "seriesYear",
    ordinance_type: "ordinanceType",
    rule_number: "ruleNumber",
    topics: "topics",
    status: "status",
    error_message: "errorMessage",
  };

  const data: Record<string, unknown> = {};

  for (const [bodyField, prismaField] of Object.entries(fieldMap)) {
    if (bodyField in body) {
      let value = body[bodyField];
      // Stringify topics array for storage
      if (bodyField === "topics" && value !== null && Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      // metadata is Json? in Prisma — pass as-is (native object)
      data[prismaField] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.kbDocument.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    ...updated,
    topics: updated.topics ? safeParseJson(updated.topics) : null,
  });
});

// DELETE /api/admin/kb/documents/[id] — Delete a document
export const DELETE = withAuth(async (request, _session, context) => {
  const { id } = context.params;

  const existing = await prisma.kbDocument.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete from LightRAG
  await deleteDocumentFromLightRAG(id);

  // Delete the file if it exists
  if (existing.filePath) {
    const filePath = path.join(process.cwd(), existing.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Delete from database
  await prisma.kbDocument.delete({ where: { id } });

  return NextResponse.json({ success: true, id });
});

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
