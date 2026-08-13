-- Migration: add LLM citation capture tables (from PILLAR sync 2026-08-13)
-- Mirrors the verified PILLAR SQLite schema, adapted to PostgreSQL/Prisma.

CREATE TABLE IF NOT EXISTS "llm_citations" (
    "id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "section_number" TEXT,
    "raw_citation" TEXT NOT NULL,
    "title" TEXT,
    "source_query" TEXT,
    "module" TEXT NOT NULL,
    "relevance_rating" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "session_id" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "distinct_query_count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    CONSTRAINT "llm_citations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_citations_status_idx" ON "llm_citations"("status");
CREATE INDEX IF NOT EXISTS "llm_citations_doc_type_idx" ON "llm_citations"("doc_type");
CREATE INDEX IF NOT EXISTS "llm_citations_relevance_rating_idx" ON "llm_citations"("relevance_rating");

CREATE TABLE IF NOT EXISTS "llm_citation_occurrences" (
    "id" TEXT NOT NULL,
    "citation_id" TEXT NOT NULL,
    "source_query" TEXT NOT NULL,
    "response_text" TEXT,
    "module" TEXT NOT NULL,
    "relevance_rating" TEXT NOT NULL DEFAULT 'medium',
    "session_id" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_citation_occurrences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "llm_citation_occurrences_citation_id_fkey"
        FOREIGN KEY ("citation_id") REFERENCES "llm_citations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "llm_citation_occurrences_citation_id_idx" ON "llm_citation_occurrences"("citation_id");
