import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "src/lib/data/documents");

// POST /api/admin/kb/upload — Handle file upload
export const POST = withAuth(async (request, session) => {
  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const formData = await request.formData();

  const file = formData.get("file") as File | null;
  const lguId = formData.get("lgu_id") as string;
  const docType = formData.get("doc_type") as string;
  const title = formData.get("title") as string;
  const sectionNumber = formData.get("section_number") as string | null;
  const ordinanceNumber = formData.get("ordinance_number") as string | null;
  const seriesYear = formData.get("series_year") as string | null;
  const ordinanceType = formData.get("ordinance_type") as string | null;
  const ruleNumber = formData.get("rule_number") as string | null;
  const topicsRaw = formData.get("topics") as string | null;
  const metadataRaw = formData.get("metadata") as string | null;

  if (!lguId || !docType || !title) {
    return NextResponse.json(
      { error: "lgu_id, doc_type, and title are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  let content: string | null = null;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  // Process the uploaded file
  if (file && file.size > 0) {
    fileName = file.name;
    fileSize = file.size;

    // Generate a safe filename
    const ext = path.extname(file.name) || ".txt";
    const safeFilename = `${id}${ext}`;
    filePath = `src/lib/data/documents/${safeFilename}`;

    const fullPath = path.join(UPLOAD_DIR, safeFilename);

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    // Extract text content based on file type
    if (ext === ".json") {
      try {
        const jsonContent = JSON.parse(buffer.toString("utf-8"));
        content =
          typeof jsonContent === "string"
            ? jsonContent
            : JSON.stringify(jsonContent, null, 2);
      } catch {
        content = buffer.toString("utf-8");
      }
    } else if (ext === ".txt" || ext === ".md") {
      content = buffer.toString("utf-8");
    } else if (ext === ".pdf") {
      // Store raw text placeholder — PDF extraction requires additional libraries
      content = `[PDF file: ${file.name}, ${fileSize} bytes]`;
    } else {
      content = buffer.toString("utf-8");
    }
  }

  // Parse topics
  let topicsStr: string | null = null;
  if (topicsRaw) {
    const topicsArr = topicsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    topicsStr = topicsArr.length > 0 ? JSON.stringify(topicsArr) : null;
  }

  // Parse metadata
  let metadataValue: unknown = null;
  if (metadataRaw) {
    try {
      metadataValue = JSON.parse(metadataRaw);
    } catch {
      metadataValue = { raw: metadataRaw };
    }
  }

  // Insert into database
  const doc = await prisma.kbDocument.create({
    data: {
      lguId: lguId,
      docType: docType,
      title,
      content,
      filePath,
      fileName,
      fileSize,
      metadata: metadataValue ?? undefined,
      sectionNumber: sectionNumber || null,
      ordinanceNumber: ordinanceNumber || null,
      seriesYear: seriesYear ? parseInt(seriesYear, 10) : null,
      ordinanceType: ordinanceType || null,
      ruleNumber: ruleNumber ? parseInt(ruleNumber, 10) : null,
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
