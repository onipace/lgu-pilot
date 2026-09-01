// src/lib/likha/agents.ts
// Sprint 2 (S2-C7) — SERVER-only LIKHA pipeline runner for agents 1–3.
// Agent 1 (Ingestor) already runs inside the upload route; this runner
// executes agent 2 (OCR Extractor) + agent 3 (Metadata Parser) per file and
// persists parsed metadata + per-field confidence to archived_ordinances.
// Sprint 3 (S3-C3) extended the runner with agent 4 (Subject Classifier —
// then a pass-through seam) + agent 5 (Legal Validator, deterministic HITL
// gate), and added applyVerificationDecision() for the human approve / edit /
// reject flow behind PUT /api/likha/archive/[id]. Agent 6 (Archiver) landed
// in S3-C5. Sprint 4 (S4-C6) makes agent 4 REAL (decision D24): suggestions
// persisted to classifications with assigned_by='ai', the
// low_confidence_classification gate owned by agent 4, plus
// classifyLikhaRecords() (standalone classify engine behind
// POST /api/likha/classify) and applyClassificationOverride() (admin
// override persistence behind PUT /api/likha/classify/[id], decision D25).
// Publish stays gated on human approval — never automatic.
// No UI delays here — delays are the CLIENT's simulation (decision D9).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { logModuleEvent } from '@/lib/logger';
import { chatCompletion } from '@/lib/ai/llm';
import { extractText, type LikhaOcrMimeType } from '@/lib/likha/ocr';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  METADATA_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  buildMetadataUserPrompt,
  parseClassificationResponse,
  parseMetadataResponse,
  countSectionsByRegex,
} from '@/lib/likha/prompts';
import {
  LIKHA_CLASSIFICATION_LABELS,
  LIKHA_SUBJECTS,
  type LikhaClassifyResponse,
  type LikhaClassifyResultItem,
  type LikhaClassificationOverrideResponse,
  type LikhaClassificationResult,
  type LikhaClassificationSuggestion,
  type LikhaPipelineFileInput,
  type LikhaPipelineFileResult,
  type LikhaPipelineResponse,
  type LikhaValidationResult,
  type LikhaVerificationRequest,
  type LikhaVerificationResponse,
  type MetadataConfidence,
  type ParsedMetadata,
} from '@/types/likha';

export interface RunLikhaPipelineOptions {
  pipelineId: string;
  /** Optional originating upload batch id (echoed in the response). */
  batchId?: string;
  userId: string;
  files: LikhaPipelineFileInput[];
  /** DI seams for tests — defaults are the real implementations. */
  ocr?: (opts: {
    fileBuffer: Buffer;
    mimeType: LikhaOcrMimeType;
    filename?: string;
  }) => Promise<{ text: string; model: string; attempts: number }>;
  extractMetadata?: (rawText: string) => Promise<ParsedMetadata>;
  /** Agent 4 seam — Sprint 4 default is the REAL LLM classifier (decision
   *  D24); tests inject a stub (decision D32 — no real model calls asserted). */
  classify?: (input: {
    rawText: string;
    title: string;
  }) => Promise<Array<{ label: string; confidence: number }>>;
  /** Agent 5 seam — default is the real deterministic validator. */
  validate?: typeof validateLikhaExtraction;
}

interface RecordDecisionParams {
  agentId: number;
  agentName: string;
  action: 'start' | 'complete' | 'hitl' | 'confirm' | 'error';
  inputSnapshot?: string;
  outputSnapshot?: string;
  confidence?: number;
  reason?: string;
}

const AGENT_NAMES: Record<number, string> = {
  2: 'Extractor',
  3: 'Parser',
  4: 'Classifier',
  5: 'Validator',
  6: 'Archiver',
};

/** Agent 5 (Legal Validator): raises low_confidence_metadata per PRD-LIKHA §12.4 row 1. */
export function validateLikhaExtraction(input: {
  content: string;
  ordinanceNumber: number;
  extractionConfidence: MetadataConfidence | null;
}): LikhaValidationResult {
  const exceptions: string[] = [];
  const confidence = input.extractionConfidence;

  const unreadable =
    input.content.trim() === '' ||
    confidence === null ||
    (confidence.ordinanceNumber === 0 &&
      confidence.seriesYear === 0 &&
      confidence.title === 0 &&
      confidence.sectionCount === 0) ||
    input.ordinanceNumber <= 0;

  if (unreadable) {
    exceptions.push('Scan unreadable or metadata missing — manual entry required');
  }

  if (confidence) {
    const critical: Array<{ field: 'ordinanceNumber' | 'seriesYear' | 'title'; value: number }> = [
      { field: 'ordinanceNumber', value: confidence.ordinanceNumber },
      { field: 'seriesYear', value: confidence.seriesYear },
      { field: 'title', value: confidence.title },
    ];
    for (const { field, value } of critical) {
      if (value < 0.7) {
        exceptions.push(`${field} confidence ${value} < 0.7 — confirm against the scan`);
      }
    }
  }

  const hitlRequired = exceptions.length > 0;
  return hitlRequired
    ? { hitlRequired, exceptions, gate: 'low_confidence_metadata' }
    : { hitlRequired, exceptions };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

// ── Sprint 4 (S4-C6): agent 4 becomes REAL (decision D24) ─────────────────

/** The real agent-4 seam: LLM classification at temperature 0 through the
 *  Sprint-2 metadata precedent (never-throws parser on the response). */
async function realClassify(input: {
  rawText: string;
  title: string;
}): Promise<Array<{ label: string; confidence: number }>> {
  return parseClassificationResponse(
    (
      await chatCompletion(
        CLASSIFICATION_SYSTEM_PROMPT,
        buildClassificationUserPrompt(input.rawText, input.title),
        { temperature: 0, maxTokens: 1024 }
      )
    ).content
  );
}

/** One agent_decisions audit row (module='likha'), bound to a pipeline id. */
async function insertAgentDecision(
  pipelineId: string,
  userId: string,
  params: RecordDecisionParams
): Promise<void> {
  await prisma.agentDecision.create({
    data: {
      id: crypto.randomUUID(),
      module: 'likha',
      pipelineId,
      agentId: params.agentId,
      agentName: params.agentName,
      action: params.action,
      inputSnapshot: params.inputSnapshot ?? undefined,
      outputSnapshot: params.outputSnapshot ?? undefined,
      confidence: params.confidence ?? null,
      userId,
      reason: params.reason ?? null,
    },
  });
}

/**
 * Persists agent-4 suggestions with AI provenance (decision D24). REPLACE
 * semantics are scoped to assigned_by='ai' rows ONLY — admin override rows
 * (assigned_by=<user id>, decision D25) survive later AI re-classifications.
 */
async function persistAiClassifications(
  recordId: string,
  subjects: LikhaClassificationSuggestion[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.classification.deleteMany({
      where: { ordinanceId: recordId, assignedBy: 'ai' },
    });
    for (const s of subjects) {
      await tx.classification.create({
        data: {
          id: crypto.randomUUID(),
          ordinanceId: recordId,
          category: s.label,
          confidence: s.confidence,
          assignedBy: 'ai',
        },
      });
    }
  });
}

/** Gate rule (PRD §12.4 row 2 / WORKFLOW exception rule): suggestions empty
 *  OR max confidence < 0.6 → low_confidence_classification. */
function classificationGate(subjects: LikhaClassificationSuggestion[]): boolean {
  if (subjects.length === 0) return true;
  return Math.max(...subjects.map((s) => s.confidence)) < 0.6;
}

/** Max suggestion confidence (audit `confidence` column); undefined when empty. */
function maxSuggestionConfidence(
  subjects: LikhaClassificationSuggestion[]
): number | undefined {
  if (subjects.length === 0) return undefined;
  return Math.max(...subjects.map((s) => s.confidence));
}

export async function runLikhaPipeline(
  opts: RunLikhaPipelineOptions
): Promise<LikhaPipelineResponse> {
  const ocr = opts.ocr ?? extractText;
  const extractMetadata =
    opts.extractMetadata ??
    (async (rawText: string) =>
      parseMetadataResponse(
        (
          await chatCompletion(METADATA_SYSTEM_PROMPT, buildMetadataUserPrompt(rawText), {
            temperature: 0,
            maxTokens: 1024,
          })
        ).content
      ));
  // Agent 4 default — the REAL LLM classifier (decision D24). The Sprint-3
  // pass-through is gone; tests inject the `classify` seam (decision D32).
  const classify = opts.classify ?? realClassify;
  const validate = opts.validate ?? validateLikhaExtraction;

  /** One agent_decisions audit row, bound to this run's pipeline id. */
  const recordDecision = (params: RecordDecisionParams): Promise<void> => {
    return insertAgentDecision(opts.pipelineId, opts.userId, params);
  };

  const results: LikhaPipelineFileResult[] = [];
  let processed = 0;
  let failed = 0;

  for (const file of opts.files) {
    const row = await prisma.archivedOrdinance.findUnique({
      where: { id: file.recordId },
      select: { id: true },
    });
    if (!row) continue; // skip missing rows

    let currentAgent = 2;
    let rawTextLength: number | undefined;

    try {
      const scanPath = path.isAbsolute(file.scanFilePath)
        ? file.scanFilePath
        : path.join(process.cwd(), file.scanFilePath);
      const fileBuffer = fs.readFileSync(scanPath);

      // ── Agent 2: OCR Extractor ─────────────────────────────────────────
      await recordDecision({
        agentId: 2,
        agentName: AGENT_NAMES[2],
        action: 'start',
        inputSnapshot: JSON.stringify({
          recordId: file.recordId,
          fileHash: file.fileHash,
          mimeType: file.mimeType,
        }),
      });

      const ocrResult = await ocr({
        fileBuffer,
        mimeType: file.mimeType,
        filename: file.originalFilename,
      });
      rawTextLength = ocrResult.text.length;

      await recordDecision({
        agentId: 2,
        agentName: AGENT_NAMES[2],
        action: 'complete',
        outputSnapshot: JSON.stringify({
          rawTextLength: ocrResult.text.length,
          model: ocrResult.model,
          attempts: ocrResult.attempts,
        }),
      });

      // ── Agent 3: Metadata Parser ───────────────────────────────────────
      currentAgent = 3;
      await recordDecision({
        agentId: 3,
        agentName: AGENT_NAMES[3],
        action: 'start',
        inputSnapshot: JSON.stringify({
          recordId: file.recordId,
          rawTextLength: ocrResult.text.length,
        }),
      });

      const parsed = await extractMetadata(ocrResult.text);

      // UAT-005 fix: regex fallback for sectionCount when LLM returns 0
      if (parsed.sectionCount === 0) {
        const regexCount = countSectionsByRegex(ocrResult.text);
        if (regexCount > 0) {
          parsed.sectionCount = regexCount;
          parsed.confidence.sectionCount = 0.6; // lower confidence for regex-derived count
        }
      }

      try {
        await prisma.archivedOrdinance.update({
          where: { id: file.recordId },
          data: {
            ordinanceNumber: parsed.ordinanceNumber,
            seriesYear: parsed.seriesYear,
            title: parsed.title,
            content: ocrResult.text,
            extractionConfidence: JSON.parse(JSON.stringify(parsed.confidence)),
            archiveStatus: 'pending_review',
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          await prisma.archivedOrdinance.update({
            where: { id: file.recordId },
            data: { archiveStatus: 'flagged' },
          });
          await recordDecision({
            agentId: 3,
            agentName: AGENT_NAMES[3],
            action: 'error',
            reason: 'duplicate (ordinance_number, series_year)',
          });
          failed += 1;
          results.push({
            recordId: file.recordId,
            originalFilename: file.originalFilename,
            ok: false,
            failedAgent: 3,
            error: 'duplicate (ordinance_number, series_year)',
            archiveStatus: 'flagged',
          });
          continue; // next file — never crash the batch
        }
        throw err;
      }

      const avgConfidence =
        (parsed.confidence.ordinanceNumber +
          parsed.confidence.seriesYear +
          parsed.confidence.title +
          parsed.confidence.sectionCount) /
        4;

      await recordDecision({
        agentId: 3,
        agentName: AGENT_NAMES[3],
        action: 'complete',
        outputSnapshot: JSON.stringify(parsed),
        confidence: avgConfidence,
      });

      // ── Agent 4: Subject Classifier — REAL (decision D24) ────────────────
      currentAgent = 4;
      const classifyMode = opts.classify ? 's4-stub' : 's4-llm';
      await recordDecision({
        agentId: 4,
        agentName: AGENT_NAMES[4],
        action: 'start',
        inputSnapshot: JSON.stringify({ recordId: file.recordId, mode: classifyMode }),
      });

      const subjects = await classify({ rawText: ocrResult.text, title: parsed.title });

      await persistAiClassifications(file.recordId, subjects);

      const classificationHitl = classificationGate(subjects);

      await recordDecision({
        agentId: 4,
        agentName: AGENT_NAMES[4],
        action: 'complete',
        outputSnapshot: JSON.stringify({ mode: classifyMode, subjects }),
        confidence: maxSuggestionConfidence(subjects),
      });

      if (classificationHitl) {
        await recordDecision({
          agentId: 4,
          agentName: AGENT_NAMES[4],
          action: 'hitl',
          outputSnapshot: JSON.stringify({ subjects }),
          reason:
            'low_confidence_classification: ' +
            (subjects.length === 0 ? 'no suggestions' : 'max confidence < 0.6'),
        });
      }

      const classification: LikhaClassificationResult = {
        subjects,
        hitlRequired: classificationHitl,
        gate: classificationHitl ? 'low_confidence_classification' : undefined,
      };

      // ── Agent 5: Legal Validator (deterministic HITL gate) ───────────────
      currentAgent = 5;
      await recordDecision({
        agentId: 5,
        agentName: AGENT_NAMES[5],
        action: 'start',
        inputSnapshot: JSON.stringify({ recordId: file.recordId }),
      });

      const validation = validate({
        content: ocrResult.text,
        ordinanceNumber: parsed.ordinanceNumber,
        extractionConfidence: parsed.confidence,
      });

      await recordDecision({
        agentId: 5,
        agentName: AGENT_NAMES[5],
        action: 'complete',
        outputSnapshot: JSON.stringify(validation),
      });

      if (validation.hitlRequired) {
        await recordDecision({
          agentId: 5,
          agentName: AGENT_NAMES[5],
          action: 'hitl',
          outputSnapshot: JSON.stringify(validation),
          reason:
            (validation.gate ?? 'low_confidence_metadata') +
            ': ' +
            validation.exceptions.join('; '),
        });
      }

      processed += 1;
      results.push({
        recordId: file.recordId,
        originalFilename: file.originalFilename,
        ok: true,
        rawTextLength,
        metadata: parsed,
        archiveStatus: 'pending_review',
        validation,
        classification,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordDecision({
        agentId: currentAgent,
        agentName: AGENT_NAMES[currentAgent] ?? 'Unknown',
        action: 'error',
        reason: message,
      });
      await prisma.archivedOrdinance.update({
        where: { id: file.recordId },
        data: { archiveStatus: 'flagged' },
      });

      failed += 1;
      results.push({
        recordId: file.recordId,
        originalFilename: file.originalFilename,
        ok: false,
        failedAgent: currentAgent,
        error: message,
        archiveStatus: 'flagged',
      });
      // continue with the next file — never crash the batch
    }
  }

  logModuleEvent({
    module: 'likha',
    interactionType: 'likha_pipeline',
    content: JSON.stringify({
      pipelineId: opts.pipelineId,
      processed,
      failed,
    }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'likha-' + opts.userId,
  });

  return {
    batchId: opts.batchId ?? opts.pipelineId,
    pipelineId: opts.pipelineId,
    processed,
    failed,
    files: results,
  };
}

// ── Sprint 3 (L004): human verification decision persistence ──────────────

export type LikhaDecisionOutcome =
  | { ok: true; response: LikhaVerificationResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

/**
 * Persists a human verification decision (approve / edit / reject) for one
 * archived_ordinances record and writes the agent_decisions + interaction_logs
 * audit trail. Used by PUT /api/likha/archive/[id].
 *
 * Decision D19 seam: `approve` records the human decision and keeps the record
 * at 'pending_review' here; the Archiver publish step is wired into the same
 * approve branch by S3-C5 (never before a human approve exists).
 *
 * Gating guarantees: only rows at archive_status='pending_review' are mutable
 * (guarded UPDATE); UNIQUE(ordinance_number, series_year) collisions and stale
 * expectedUpdatedAt both surface as `conflict` (→ HTTP 409).
 */
export async function applyVerificationDecision(params: {
  recordId: string;
  userId: string;
  body: LikhaVerificationRequest;
  /** Defaults to 'verification-<recordId>'. */
  pipelineId?: string;
}): Promise<LikhaDecisionOutcome> {
  const { recordId, userId, body } = params;
  const pipelineId = params.pipelineId ?? 'verification-' + recordId;

  const notFound: LikhaDecisionOutcome = {
    ok: false,
    kind: 'not_found',
    error: 'Record not found',
  };

  const row = await prisma.archivedOrdinance.findUnique({
    where: { id: recordId },
    select: { id: true, archiveStatus: true, updatedAt: true },
  });
  if (!row) return notFound;

  // Optimistic-concurrency guard (decision D17c).
  const updatedAtStr = row.updatedAt.toISOString();
  if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== updatedAtStr) {
    return { ok: false, kind: 'conflict', error: 'Record changed — reload and retry' };
  }

  // Status guard: only pending_review records are reviewable.
  if (row.archiveStatus !== 'pending_review') {
    return { ok: false, kind: 'conflict', error: 'Record already finalized' };
  }

  // Per-action validation.
  if (!['approve', 'edit', 'reject'].includes(body.action)) {
    return { ok: false, kind: 'invalid', error: 'Unknown action' };
  }
  if (body.action === 'reject' && (!body.reason || body.reason.trim() === '')) {
    return { ok: false, kind: 'invalid', error: 'Reject requires a non-empty reason' };
  }

  const fields = body.fields;
  if (fields) {
    if (
      fields.ordinanceNumber !== undefined &&
      (!Number.isInteger(fields.ordinanceNumber) || fields.ordinanceNumber <= 0)
    ) {
      return { ok: false, kind: 'invalid', error: 'ordinanceNumber must be a positive integer' };
    }
    if (
      fields.seriesYear !== undefined &&
      (!Number.isInteger(fields.seriesYear) || fields.seriesYear <= 0)
    ) {
      return { ok: false, kind: 'invalid', error: 'seriesYear must be a positive integer' };
    }
    if (fields.title !== undefined && (typeof fields.title !== 'string' || fields.title.trim() === '')) {
      return { ok: false, kind: 'invalid', error: 'title must be a non-empty string' };
    }
    if (
      fields.sectionCount !== undefined &&
      (!Number.isInteger(fields.sectionCount) || fields.sectionCount < 0)
    ) {
      return { ok: false, kind: 'invalid', error: 'sectionCount must be an integer >= 0' };
    }
    if (fields.subjects !== undefined) {
      if (!Array.isArray(fields.subjects)) {
        return { ok: false, kind: 'invalid', error: 'subjects must be an array' };
      }
      for (const subject of fields.subjects) {
        if (!LIKHA_SUBJECTS.includes(subject)) {
          return { ok: false, kind: 'invalid', error: `Unknown subject: ${subject}` };
        }
      }
    }
  }

  /** Insert a verification decision audit row inside the transaction. */
  const insertDecisionInTx = async (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    action: 'confirm' | 'reject',
    outputSnapshot: string,
    reason: string | null
  ): Promise<void> => {
    await tx.agentDecision.create({
      data: {
        id: crypto.randomUUID(),
        module: 'likha',
        pipelineId,
        agentId: 5,
        agentName: 'Validator',
        action,
        inputSnapshot: JSON.stringify({ recordId, action: body.action }),
        outputSnapshot,
        userId,
        reason,
      },
    });
  };

  try {
    const result = await prisma.$transaction(async (tx): Promise<LikhaDecisionOutcome> => {
      if (body.action === 'approve') {
        const info = await tx.archivedOrdinance.updateMany({
          where: { id: recordId, archiveStatus: 'pending_review' },
          data: { verifiedById: userId },
        });
        if (info.count === 0) {
          return { ok: false, kind: 'conflict', error: 'Record already finalized' };
        }
        await insertDecisionInTx(tx, 'confirm', JSON.stringify({ decision: 'approve' }), null);
        return {
          ok: true,
          response: { recordId, action: 'approve', archiveStatus: 'pending_review', published: false },
        };
      }

      if (body.action === 'edit') {
        const data: Record<string, unknown> = {
          verifiedById: userId,
        };
        if (fields?.ordinanceNumber !== undefined) {
          data.ordinanceNumber = fields.ordinanceNumber;
        }
        if (fields?.seriesYear !== undefined) {
          data.seriesYear = fields.seriesYear;
        }
        if (fields?.title !== undefined) {
          data.title = fields.title.trim();
        }
        if (fields?.sectionCount !== undefined) {
          data.sectionCount = fields.sectionCount;
        }
        if (fields?.subjects !== undefined) {
          data.subjectTags = fields.subjects;
        }

        const info = await tx.archivedOrdinance.updateMany({
          where: { id: recordId, archiveStatus: 'pending_review' },
          data,
        });
        if (info.count === 0) {
          return { ok: false, kind: 'conflict', error: 'Record already finalized' };
        }
        await insertDecisionInTx(tx, 'confirm', JSON.stringify(fields ?? {}), 'edit');
        return {
          ok: true,
          response: { recordId, action: 'edit', archiveStatus: 'pending_review', published: false },
        };
      }

      // reject — terminates the branch; never publishable (decision D10).
      const reason = (body.reason ?? '').trim();
      const info = await tx.archivedOrdinance.updateMany({
        where: { id: recordId, archiveStatus: 'pending_review' },
        data: {
          archiveStatus: 'flagged',
          rejectionReason: reason,
          verifiedById: userId,
        },
      });
      if (info.count === 0) {
        return { ok: false, kind: 'conflict', error: 'Record already finalized' };
      }
      await insertDecisionInTx(tx, 'reject', JSON.stringify({ decision: 'reject', reason }), reason);
      return {
        ok: true,
        response: { recordId, action: 'reject', archiveStatus: 'flagged', published: false },
      };
    });

    logModuleEvent({
      module: 'likha',
      interactionType: 'likha_verification',
      content: JSON.stringify({ recordId, action: body.action, ok: result.ok }),
      ipAddress: '127.0.0.1',
      participantSessionId: 'likha-' + userId,
    });

    return result;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return {
        ok: false,
        kind: 'conflict',
        error: 'Conflicts with an existing ordinance number / series year',
      };
    }
    throw err;
  }
}

// ── Sprint 4 (L007): standalone classification engine + admin override ────

/**
 * Classifies EXISTING archived_ordinances records (the engine behind
 * POST /api/likha/classify — decision D22). Eligibility: rows at
 * pending_review or published (they have content); processing/flagged rows
 * and unknown ids land in `skipped` with a reason — the batch is total and
 * never crashes on one bad id (same posture as the pipeline runner).
 */
export async function classifyLikhaRecords(params: {
  recordIds: string[];
  userId: string;
  /** Defaults to 'classify-' + randomUUID(). */
  pipelineId?: string;
  /** Agent-4 seam; default is the real LLM classifier (decision D24). */
  classify?: (input: {
    rawText: string;
    title: string;
  }) => Promise<Array<{ label: string; confidence: number }>>;
}): Promise<LikhaClassifyResponse> {
  const pipelineId = params.pipelineId ?? 'classify-' + crypto.randomUUID();
  const classify = params.classify ?? realClassify;

  const skipped: Array<{ recordId: string; reason: string }> = [];
  const results: LikhaClassifyResultItem[] = [];
  let classified = 0;

  for (const recordId of params.recordIds) {
    const row = await prisma.archivedOrdinance.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        ordinanceNumber: true,
        seriesYear: true,
        title: true,
        content: true,
        archiveStatus: true,
      },
    });

    if (!row) {
      skipped.push({ recordId, reason: 'not_found' });
      continue;
    }
    if (row.archiveStatus !== 'pending_review' && row.archiveStatus !== 'published') {
      skipped.push({ recordId, reason: 'not_classifiable:' + row.archiveStatus });
      continue;
    }

    const mode = params.classify ? 's4-stub' : 's4-llm';
    await insertAgentDecision(pipelineId, params.userId, {
      agentId: 4,
      agentName: AGENT_NAMES[4],
      action: 'start',
      inputSnapshot: JSON.stringify({ recordId, mode }),
    });

    const subjects = await classify({ rawText: row.content, title: row.title });

    await persistAiClassifications(recordId, subjects);

    const hitlRequired = classificationGate(subjects);

    await insertAgentDecision(pipelineId, params.userId, {
      agentId: 4,
      agentName: AGENT_NAMES[4],
      action: 'complete',
      outputSnapshot: JSON.stringify({ mode, subjects }),
      confidence: maxSuggestionConfidence(subjects),
    });

    if (hitlRequired) {
      await insertAgentDecision(pipelineId, params.userId, {
        agentId: 4,
        agentName: AGENT_NAMES[4],
        action: 'hitl',
        outputSnapshot: JSON.stringify({ subjects }),
        reason:
          'low_confidence_classification: ' +
          (subjects.length === 0 ? 'no suggestions' : 'max confidence < 0.6'),
      });
    }

    classified += 1;
    results.push({
      recordId,
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      suggestions: subjects,
      hitlRequired,
    });
  }

  logModuleEvent({
    module: 'likha',
    interactionType: 'likha_classify',
    content: JSON.stringify({ pipelineId, classified, skipped: skipped.length }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'likha-' + params.userId,
  });

  return { classified, skipped, results };
}

export type LikhaOverrideOutcome =
  | { ok: true; response: LikhaClassificationOverrideResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

/**
 * Persists an admin classification override (decision D25 — REPLACE
 * semantics): deletes ALL of the record's classifications rows and inserts
 * one row per category with assigned_by=<acting user id>, confidence NULL
 * (human decisions carry no model confidence). Audited to agent_decisions as
 * agent 4 action='confirm', reason='override'. Later AI re-classification
 * runs never delete these rows (they replace only assigned_by='ai' rows).
 */
export async function applyClassificationOverride(params: {
  recordId: string;
  userId: string;
  categories: string[];
  /** Defaults to 'override-' + recordId. */
  pipelineId?: string;
}): Promise<LikhaOverrideOutcome> {
  const { recordId, userId, categories } = params;
  const pipelineId = params.pipelineId ?? 'override-' + recordId;

  const row = await prisma.archivedOrdinance.findUnique({
    where: { id: recordId },
    select: { id: true, archiveStatus: true },
  });
  if (!row) {
    return { ok: false, kind: 'not_found', error: 'Record not found' };
  }
  if (row.archiveStatus === 'processing') {
    return {
      ok: false,
      kind: 'conflict',
      error: 'Record is still processing — nothing to classify yet',
    };
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    return { ok: false, kind: 'invalid', error: 'categories must be a non-empty array' };
  }
  for (const category of categories) {
    if (typeof category !== 'string' || !LIKHA_CLASSIFICATION_LABELS.includes(category)) {
      return {
        ok: false,
        kind: 'invalid',
        error: 'Unknown category: ' + String(category),
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.classification.deleteMany({ where: { ordinanceId: recordId } });
    for (const category of categories) {
      await tx.classification.create({
        data: {
          id: crypto.randomUUID(),
          ordinanceId: recordId,
          category,
          confidence: null,
          assignedBy: userId,
        },
      });
    }
  });

  await insertAgentDecision(pipelineId, userId, {
    agentId: 4,
    agentName: AGENT_NAMES[4],
    action: 'confirm',
    inputSnapshot: JSON.stringify({ recordId }),
    outputSnapshot: JSON.stringify({ categories }),
    reason: 'override',
  });

  logModuleEvent({
    module: 'likha',
    interactionType: 'likha_classification_override',
    content: JSON.stringify({ recordId, categories }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'likha-' + userId,
  });

  return {
    ok: true,
    response: { recordId, categories, assignedBy: userId },
  };
}
