// src/lib/likha/archiver.ts
// Sprint 3 (S3-C5) — Agent 6 (Archiver, 1000ms slot) for LIKHA.
// HARD GATE (constraint 3 / decision D16/D19): the Archiver runs ONLY after a
// human approve decision has been persisted — it is invoked exclusively from
// the action:'approve' branch of PUT /api/likha/archive/[id]. It refuses any
// row whose archive_status is not 'pending_review', so processing/flagged
// (rejected)/published rows can NEVER be (re-)published by this path.
// Publish persists archive_status='published' (the stored file_hash stays
// cached — never cleared) and creates/updates the record's BM25 entry in
// LIKHA's own namespace (decision D13).

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { logModuleEvent } from '@/lib/logger';
import { likhaSearch } from '@/lib/likha/search';

export type LikhaPublishOutcome =
  | { ok: true; published: true }
  | { ok: false; kind: 'not_found' | 'conflict'; error: string };

/** subjectTags is a native Json field — already a JS array. */
function safeSubjectTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string');
}

/** Agent 6 (Archiver) — runs ONLY after a human approve decision (decision D16/D19). */
export async function publishApprovedRecord(params: {
  recordId: string;
  userId: string;
  /** Defaults to 'publish-<recordId>'. */
  pipelineId?: string;
}): Promise<LikhaPublishOutcome> {
  const { recordId, userId } = params;
  const pipelineId = params.pipelineId ?? 'publish-' + recordId;

  const row = await prisma.archivedOrdinance.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      ordinanceNumber: true,
      seriesYear: true,
      title: true,
      content: true,
      status: true,
      subjectTags: true,
      sectionCount: true,
      archiveStatus: true,
      verifiedById: true,
      createdAt: true,
    },
  });

  if (!row) {
    return { ok: false, kind: 'not_found', error: 'Record not found' };
  }

  // ── THE GATE: nothing publishes without a human approval decision ──
  // Only rows a human reviewed and approved sit at 'pending_review' with a
  // persisted confirm decision; rejected rows are 'flagged' and never reach
  // this branch. Any other status is refused outright.
  if (row.archiveStatus !== 'pending_review') {
    return {
      ok: false,
      kind: 'conflict',
      error: 'Archiver refused: record not approved for publish',
    };
  }

  const recordDecision = async (
    action: 'start' | 'complete' | 'error',
    outputSnapshot?: string,
    inputSnapshot?: string
  ): Promise<void> => {
    await prisma.agentDecision.create({
      data: {
        id: crypto.randomUUID(),
        module: 'likha',
        pipelineId,
        agentId: 6,
        agentName: 'Archiver',
        action,
        inputSnapshot: inputSnapshot ?? JSON.stringify({ recordId }),
        outputSnapshot: outputSnapshot ?? undefined,
        userId,
      },
    });
  };

  await recordDecision('start', undefined, JSON.stringify({ recordId, approvedBy: userId }));

  // Guarded UPDATE — the status guard is enforced in the where clause, so a
  // concurrent finalize between the read and the write still cannot publish.
  // verifiedById uses the existing value if already set (COALESCE equivalent).
  const result = await prisma.archivedOrdinance.updateMany({
    where: { id: recordId, archiveStatus: 'pending_review' },
    data: {
      archiveStatus: 'published',
      verifiedById: row.verifiedById ?? userId,
    },
  });

  if (result.count === 0) {
    return {
      ok: false,
      kind: 'conflict',
      error: 'Archiver refused: record not approved for publish',
    };
  }

  // BM25 entry create/update in LIKHA's own namespace. An index hiccup must
  // NOT lose the publish — the row stays published and rebuildIndex() heals
  // the namespace (documented recovery path, decision D13).
  let bm25Indexed = true;
  try {
    likhaSearch.indexRecord({
      id: row.id,
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      title: row.title,
      content: row.content,
      status: row.status,
      subjectTags: safeSubjectTags(row.subjectTags),
      sectionCount: row.sectionCount,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    bm25Indexed = false;
    await recordDecision(
      'error',
      JSON.stringify({
        archiveStatus: 'published',
        bm25Indexed: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }

  await recordDecision(
    'complete',
    JSON.stringify({ archiveStatus: 'published', bm25Indexed })
  );

  logModuleEvent({
    module: 'likha',
    interactionType: 'likha_publish',
    content: JSON.stringify({ recordId, ordinanceNumber: row.ordinanceNumber, seriesYear: row.seriesYear, bm25Indexed }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'likha-' + userId,
  });

  return { ok: true, published: true };
}
