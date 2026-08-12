import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { ingestDocumentToLightRAG } from "@/lib/ai/rag";

// POST /api/admin/kb/reindex — Trigger a re-index for an LGU
export const POST = withAuth(async (request, session) => {
  const body = await request.json();
  const { lgu_id } = body;

  if (!lgu_id) {
    return NextResponse.json(
      { error: "lgu_id is required" },
      { status: 400 }
    );
  }

  // Create a kb_index_runs record
  const run = await prisma.kbIndexRun.create({
    data: {
      lguId: lgu_id,
      status: "running",
      triggeredBy: session.user.id,
    },
  });
  const runId = run.id;

  try {
    // Get the last successful index run to determine what needs re-indexing
    const lastRun = await prisma.kbIndexRun.findFirst({
      where: { lguId: lgu_id, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });

    const lastIndexedAt = lastRun?.completedAt || new Date(0);

    // Get documents that need indexing:
    // - status = 'pending' (never indexed)
    // - updated_at > last index run completed_at (modified since last index)
    const documents = await prisma.kbDocument.findMany({
      where: {
        lguId: lgu_id,
        OR: [
          { status: "pending" },
          { updatedAt: { gt: lastIndexedAt } },
        ],
        content: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });

    let indexedCount = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        const success = await ingestDocumentToLightRAG(doc.id, doc.content!, {
          doc_type: doc.docType,
          title: doc.title,
          lgu_id: doc.lguId,
          section_number: doc.sectionNumber || undefined,
          ordinance_number: doc.ordinanceNumber || undefined,
        });

        if (success) {
          await prisma.kbDocument.update({
            where: { id: doc.id },
            data: { status: "indexed", indexedAt: new Date() },
          });
          indexedCount++;
        } else {
          await prisma.kbDocument.update({
            where: { id: doc.id },
            data: { status: "error", errorMessage: "LightRAG ingestion returned false" },
          });
          errors.push(`Failed to index: ${doc.title} (${doc.id})`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await prisma.kbDocument.update({
          where: { id: doc.id },
          data: { status: "error", errorMessage: errorMsg },
        });
        errors.push(`Error indexing ${doc.title}: ${errorMsg}`);
      }
    }

    // Update the index run record
    const finalStatus = errors.length > 0 && indexedCount === 0 ? "error" : "completed";
    const errorMessage = errors.length > 0 ? errors.join("; ") : null;

    const updatedRun = await prisma.kbIndexRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        documentsIndexed: indexedCount,
        errorMessage,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updatedRun,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    // Mark the run as errored
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await prisma.kbIndexRun.update({
      where: { id: runId },
      data: { status: "error", errorMessage: errorMsg, completedAt: new Date() },
    });

    return NextResponse.json(
      { error: "Re-indexing failed", details: errorMsg },
      { status: 500 }
    );
  }
});
