import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Citation } from "@/types";

export interface CaptureContext {
  sourceQuery: string;
  responseText: string;
  module: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
}

/**
 * Capture LLM-sourced citations to the database (PostgreSQL via Prisma) for
 * future KB inclusion. Fire-and-forget — never blocks the response, never throws.
 *
 * Deduplicates by doc_type + section_number. Each sighting also inserts a row
 * into llm_citation_occurrences with the source query and full response text,
 * so reviewers can see exactly which questions triggered the citation and how
 * the LLM used it in context.
 *
 * The parent llm_citations row tracks aggregated counts:
 *   - occurrence_count: total times this citation has been seen
 *   - distinct_query_count: number of unique source queries that triggered it
 *
 * Adapted from PILLAR's better-sqlite3 implementation to Prisma/PostgreSQL.
 * Function contract is identical: captureLLMCitations(citations, context).
 */
export function captureLLMCitations(
  citations: Citation[],
  context: CaptureContext
): void {
  // Fire-and-forget — kick off the async work but never await or throw.
  void run(citations, context);
}

async function run(citations: Citation[], context: CaptureContext): Promise<void> {
  try {
    const llmCitations = citations.filter((c) => c.source === "llm");
    if (llmCitations.length === 0) return;

    const ratingOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

    for (const citation of llmCitations) {
      try {
        const docType = citation.doc_type || "ra7160";
        const sectionNumber = citation.section || "";
        const newRating = citation.relevance_rating || "medium";

        // Check if this citation already exists (same doc_type + section_number)
        const existing = await prisma.llmCitation.findFirst({
          where: { doc_type: docType, section_number: sectionNumber },
        });

        if (existing) {
          // Check if this source query is distinct from any existing occurrence
          const queryExists = await prisma.llmCitationOccurrence.findFirst({
            where: { citation_id: existing.id, source_query: context.sourceQuery },
            select: { id: true },
          });
          const isNewQuery = !queryExists;

          const shouldUpgrade =
            ratingOrder[newRating] > ratingOrder[existing.relevance_rating];

          await prisma.llmCitation.update({
            where: { id: existing.id },
            data: {
              occurrence_count: existing.occurrence_count + 1,
              distinct_query_count:
                existing.distinct_query_count + (isNewQuery ? 1 : 0),
              last_seen_at: new Date(),
              relevance_rating: shouldUpgrade
                ? newRating
                : existing.relevance_rating,
            },
          });

          // Always insert a new occurrence row for this sighting
          await prisma.llmCitationOccurrence.create({
            data: {
              id: crypto.randomUUID(),
              citation_id: existing.id,
              source_query: context.sourceQuery,
              response_text: context.responseText || null,
              module: context.module,
              relevance_rating: newRating,
              session_id: context.sessionId || null,
              user_id: context.userId || null,
              user_name: context.userName || null,
            },
          });
        } else {
          // Insert new citation
          const id = crypto.randomUUID();
          await prisma.llmCitation.create({
            data: {
              id,
              doc_type: docType,
              section_number: sectionNumber,
              raw_citation: citation.section,
              title: citation.title || null,
              source_query: context.sourceQuery,
              module: context.module,
              relevance_rating: newRating,
              status: "pending",
              session_id: context.sessionId || null,
              user_id: context.userId || null,
              user_name: context.userName || null,
              occurrence_count: 1,
              distinct_query_count: 1,
            },
          });

          // Insert occurrence row for this first sighting
          await prisma.llmCitationOccurrence.create({
            data: {
              id: crypto.randomUUID(),
              citation_id: id,
              source_query: context.sourceQuery,
              response_text: context.responseText || null,
              module: context.module,
              relevance_rating: newRating,
              session_id: context.sessionId || null,
              user_id: context.userId || null,
              user_name: context.userName || null,
            },
          });
        }
      } catch {
        // Skip individual citation errors — don't fail the whole batch
      }
    }
  } catch {
    // Fire-and-forget — never throw
  }
}
