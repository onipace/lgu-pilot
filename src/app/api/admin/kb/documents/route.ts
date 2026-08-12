import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import crypto from "crypto";

// GET /api/admin/kb/documents — List documents with filtering
export const GET = withAuth(async (request, _session) => {
  const url = new URL(request.url);

  const lguId = url.searchParams.get("lgu_id");
  const docType = url.searchParams.get("doc_type");
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10))
  );
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const where: Prisma.KbDocumentWhereInput = {};
  if (lguId) where.lguId = lguId;
  if (docType) where.docType = docType;
  if (status) where.status = status;

  // Get total count
  const total = await prisma.kbDocument.count({ where });

  // Get paginated documents
  const documents = await prisma.kbDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });

  // Parse JSON string fields (metadata is native Json from Prisma, topics is still a string)
  const parsed = documents.map((doc) => ({
    ...doc,
    topics: doc.topics ? safeParseJson(doc.topics) : null,
  }));

  return NextResponse.json({
    documents: parsed,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// POST /api/admin/kb/documents — Create a new document record
export const POST = withAuth(async (request, session) => {
  const body = await request.json();

  const {
    lgu_id,
    doc_type,
    title,
    content,
    metadata,
    section_number,
    ordinance_number,
    series_year,
    ordinance_type,
    rule_number,
    topics,
  } = body;

  if (!lgu_id || !doc_type || !title) {
    return NextResponse.json(
      { error: "lgu_id, doc_type, and title are required" },
      { status: 400 }
    );
  }

  const topicsStr = topics
    ? Array.isArray(topics)
      ? JSON.stringify(topics)
      : topics
    : null;

  const doc = await prisma.kbDocument.create({
    data: {
      lguId: lgu_id,
      docType: doc_type,
      title,
      content: content || null,
      metadata: metadata ?? null,
      sectionNumber: section_number || null,
      ordinanceNumber: ordinance_number || null,
      seriesYear: series_year || null,
      ordinanceType: ordinance_type || null,
      ruleNumber: rule_number || null,
      topics: topicsStr,
      status: "pending",
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(
    {
      ...doc,
      topics: doc.topics ? safeParseJson(doc.topics) : null,
    },
    { status: 201 }
  );
});

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
