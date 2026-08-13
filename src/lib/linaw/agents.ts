// src/lib/linaw/agents.ts
// LINAW pipeline runner module (server-only). Implements ALL SIX codification
// agents over the READY library (boundary rule 4: every linaw_ordinances read
// filters library_status='ready'): Sprint 6 landed agents 1–4; Sprint 7 adds
// the real agent 5 (Relationship Reviewer — N005 decision workflow), agent 6
// (Code Assembler — N006), the N007 summary engines, and the full 1→6
// orchestrator (decision D7).
//
// Architecture duplicates the proven sibling-module runner pattern (per-agent
// agent_decisions audit rows, eligibility/skip posture, DI seams, never
// crash the batch) as an INDEPENDENT LINAW implementation: ZERO imports from
// any other module. Delays are the CLIENT's simulation — none live here.

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { logModuleEvent } from '@/lib/logger';
import { chatCompletion } from '@/lib/ai/llm';
import {
  LINAW_CLASSIFY_SYSTEM_PROMPT,
  LINAW_CODE_TITLES,
  LINAW_CONFLICT_SYSTEM_PROMPT,
  LINAW_CROSSREF_SYSTEM_PROMPT,
  LINAW_SUMMARY_SYSTEM_PROMPT,
  buildLinawClassifyUserPrompt,
  buildLinawConflictUserPrompt,
  buildLinawCrossRefUserPrompt,
  buildLinawSummaryUserPrompt,
  parseLinawClassifyResponse,
  parseLinawConflictResponse,
  parseLinawCrossRefResponse,
  parseLinawSummaryResponse,
  type ParsedLinawPlacement,
} from '@/lib/linaw/prompts';
import type {
  CodeSectionRef,
  CodeTocArticle,
  CodeTocChapter,
  CodeTocNode,
  LinawAssembleResponse,
  LinawClassifyOverrideRequest,
  LinawClassifyOverrideResponse,
  LinawClassifyResponse,
  LinawClassifyResultItem,
  LinawConflictExcerpt,
  LinawConflictRecord,
  LinawDetectResponse,
  LinawInventoryResponse,
  LinawOrphanWarning,
  LinawOrdinance,
  LinawRelationshipDecisionRequest,
  LinawRelationshipDecisionResponse,
  LinawRelationshipRecord,
  LinawRelationshipStatusUpdate,
  LinawRelationshipType,
  LinawSummarizeResponse,
  LinawSummarizeResultItem,
  LinawSummaryEditResponse,
} from '@/types/linaw';

// ── Shared audit writer (the single agent_decisions write path) ────────────

export const LINAW_AGENT_NAMES: Record<number, string> = {
  0: 'Summary Generation',
  1: 'Inventory Analyst',
  2: 'Code Classifier',
  3: 'Cross-Reference Scanner',
  4: 'Conflict Detector',
  5: 'Relationship Reviewer',
  6: 'Code Assembler',
};

/**
 * Storage marker for conflicts (decision D1): conflicts persist as
 * ordinance_relationships rows with this relationship_type. It is NOT a
 * member of LinawRelationshipType and must NEVER leak into the relationships
 * list; evidence rides on section_ref as JSON {reason, excerpts}. Defined
 * module-wide as the single source of truth for the marker.
 */
export const LINAW_CONFLICT_RELATIONSHIP_TYPE = 'conflict';

export interface LinawDecisionParams {
  agentId: number;
  action: 'start' | 'complete' | 'hitl' | 'confirm' | 'reject' | 'error';
  /** Additive Sprint 7: overrides LINAW_AGENT_NAMES[agentId] for pre-pipeline
   *  actions (e.g. agent 0 'Summary Edit'). */
  agentName?: string;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  confidence?: number;
  reason?: string;
}

/** One agent_decisions audit row (module='linaw'), bound to a pipeline id. */
export async function insertLinawAgentDecision(
  pipelineId: string,
  userId: string,
  params: LinawDecisionParams
): Promise<void> {
  await prisma.agentDecision.create({
    data: {
      id: crypto.randomUUID(),
      module: 'linaw',
      pipelineId,
      agentId: params.agentId,
      agentName: params.agentName ?? LINAW_AGENT_NAMES[params.agentId],
      action: params.action,
      inputSnapshot: params.inputSnapshot ? JSON.parse(JSON.stringify(params.inputSnapshot)) : undefined,
      outputSnapshot: params.outputSnapshot ? JSON.parse(JSON.stringify(params.outputSnapshot)) : undefined,
      confidence: params.confidence ?? null,
      userId,
      reason: params.reason ?? null,
    },
  });
}

// ── Agent 1: Inventory Analyst (N001) ──────────────────────────────────────

const LEGAL_STATUSES: LinawOrdinance['status'][] = [
  'active',
  'amended',
  'repealed',
  'superseded',
  'expired',
];

/**
 * Agent 1 — inventory completeness + gap analysis over the READY library.
 * Corpus range = [min(series_year), max(series_year)] computed over ready rows
 * only; yearGaps reports whole missing years ({year, missing: []}) and per-year
 * numbering holes; completenessScore = year coverage of the range (decision D4).
 *
 * SYSTEM_TEST D-2 bound: the gap window stays the ready corpus's own
 * min..max series_year range, but emission is capped — at most 500 yearGaps
 * entries and at most 500 absent numbers per year (lowest first), with
 * `truncated: true` whenever either cap trips. Completeness-score semantics
 * are unchanged by the caps.
 */
export async function analyzeInventory(params: {
  userId: string;
  /** Defaults to 'inventory-' + randomUUID(). */
  pipelineId?: string;
}): Promise<LinawInventoryResponse> {
  const pipelineId = params.pipelineId ?? 'inventory-' + crypto.randomUUID();
  const startedAt = Date.now();

  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 1,
    action: 'start',
    inputSnapshot: { readyOnly: true },
  });

  // The ONLY linaw_ordinances read in this function — ready rows only.
  const rows = await prisma.linawOrdinance.findMany({
    where: { libraryStatus: 'ready' },
    select: { ordinanceNumber: true, seriesYear: true, status: true, subjectTags: true },
  });

  const byYearMap = new Map<number, number[]>();
  const statusCounts = new Map<string, number>();
  const subjectCounts = new Map<string, number>();

  for (const row of rows) {
    const numbers = byYearMap.get(row.seriesYear) ?? [];
    numbers.push(row.ordinanceNumber);
    byYearMap.set(row.seriesYear, numbers);

    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const tags = Array.isArray(row.subjectTags) ? (row.subjectTags as string[]) : [];
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.trim().length > 0) {
        const trimmed = tag.trim();
        subjectCounts.set(trimmed, (subjectCounts.get(trimmed) ?? 0) + 1);
      }
    }
  }

  const years = [...byYearMap.keys()].sort((a, b) => a - b);
  const byYear = years.map((year) => ({ year, count: byYearMap.get(year)!.length }));
  const byStatus = LEGAL_STATUSES.filter((status) => (statusCounts.get(status) ?? 0) > 0).map(
    (status) => ({ status, count: statusCounts.get(status)! })
  );
  const bySubject = [...subjectCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([subject, count]) => ({ subject, count }));

  // Gap analysis over the inclusive corpus range (ready rows define the range).
  // ── SYSTEM_TEST D-2: bounded gap emission ────────────────────────────────
  const MAX_YEAR_GAP_ENTRIES = 500;
  const MAX_MISSING_PER_YEAR = 500;

  const yearGaps: Array<{ year: number; missing: number[] }> = [];
  let truncated = false;
  let completenessScore = 0;
  if (rows.length > 0) {
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const totalYears = maxYear - minYear + 1;
    for (let year = minYear; year <= maxYear; year += 1) {
      if (yearGaps.length >= MAX_YEAR_GAP_ENTRIES) {
        truncated = true;
        break;
      }
      const numbers = byYearMap.get(year);
      if (!numbers) {
        yearGaps.push({ year, missing: [] });
        continue;
      }
      const present = new Set(numbers);
      const maxNumber = Math.max(...numbers);
      const missing: number[] = [];
      let missingCount = 0;
      for (let n = 1; n <= maxNumber; n += 1) {
        if (!present.has(n)) {
          missingCount += 1;
          if (missing.length < MAX_MISSING_PER_YEAR) missing.push(n);
        }
      }
      if (missingCount > missing.length) truncated = true;
      if (missing.length > 0) yearGaps.push({ year, missing });
    }
    completenessScore = Math.round((1000 * years.length) / totalYears) / 10;
  }

  const totals = {
    ordinances: rows.length,
    years: years.length,
    subjects: subjectCounts.size,
  };

  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 1,
    action: 'complete',
    outputSnapshot: { totals, completenessScore, yearGapCount: yearGaps.length, truncated },
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_inventory',
    content: JSON.stringify({ pipelineId, ordinances: totals.ordinances }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + params.userId,
  });

  return {
    totals,
    byYear,
    byStatus,
    bySubject,
    yearGaps,
    truncated,
    completenessScore,
    tookMs: Date.now() - startedAt,
  };
}

// ── Agent 2: Code Classifier (N002) ────────────────────────────────────────

export interface LinawClassifyOptions {
  /** Optional: absent or [] → every ready ordinance; else restricts the batch. */
  ordinanceIds?: string[];
  userId: string;
  /** Defaults to 'classify-' + randomUUID(). */
  pipelineId?: string;
  /** Agent-2 seam; default is the real LLM classifier (decision D12:
   *  classification is LLM-primary — transport failures propagate). */
  classify?: (input: {
    content: string;
    title: string;
    subjectTags: string[];
    priors: { subjectFrequencies: Array<{ subject: string; count: number }> };
    meta: { ordinanceNumber: number; seriesYear: number };
  }) => Promise<ParsedLinawPlacement>;
}

/** Gate thresholds (decision D5 — mutually exclusive). */
function classifyGate(confidence: number): 'low_confidence_classification' | 'code_placement' | undefined {
  if (confidence < 0.6) return 'low_confidence_classification';
  if (confidence < 0.7) return 'code_placement';
  return undefined;
}

function gateThresholdReason(gate: 'low_confidence_classification' | 'code_placement'): string {
  return gate === 'low_confidence_classification'
    ? 'low_confidence_classification: confidence < 0.6'
    : 'code_placement: confidence < 0.7';
}

/** The real agent-2 seam: LLM placement at temperature 0 + never-throws parser. */
async function realClassifyPlacement(input: {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags: string[];
  priors: { subjectFrequencies: Array<{ subject: string; count: number }> };
}): Promise<ParsedLinawPlacement> {
  return parseLinawClassifyResponse(
    (
      await chatCompletion(
        LINAW_CLASSIFY_SYSTEM_PROMPT,
        buildLinawClassifyUserPrompt(
          {
            ordinanceNumber: input.ordinanceNumber,
            seriesYear: input.seriesYear,
            title: input.title,
            content: input.content,
            subjectTags: input.subjectTags,
          },
          input.priors
        ),
        { temperature: 0, maxTokens: 1024 }
      )
    ).content
  );
}

/** Upserts the AI placement (decision D6) — never touches human_override. */
async function persistAiPlacement(
  ordinanceId: string,
  placement: { titleNumber: number; chapterNumber: number; articleNumber?: number; confidence: number }
): Promise<void> {
  await prisma.codificationRecord.upsert({
    where: { ordinanceId },
    update: {
      titleNumber: placement.titleNumber,
      chapterNumber: placement.chapterNumber,
      articleNumber: placement.articleNumber ?? null,
      codStatus: 'classified',
      aiSuggestion: JSON.stringify({ ...placement, suggestedAt: new Date().toISOString() }),
    },
    create: {
      id: crypto.randomUUID(),
      ordinanceId,
      titleNumber: placement.titleNumber,
      chapterNumber: placement.chapterNumber,
      articleNumber: placement.articleNumber ?? null,
      codStatus: 'classified',
      aiSuggestion: JSON.stringify({ ...placement, suggestedAt: new Date().toISOString() }),
    },
  });
}

/** Extract tags from a Prisma Json field value. */
function extractTags(subjectTags: unknown): string[] {
  if (Array.isArray(subjectTags)) {
    return (subjectTags as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return [];
}

/**
 * Agent 2 — classifies ready ordinances into Code Titles/Chapters (the engine
 * behind POST /api/linaw/classify). Eligibility posture: total batch, never
 * crashes on one bad id (unknown → skipped not_found; non-ready → skipped
 * not_classifiable:<status>). Subject priors come from the whole ready
 * library (PRP data rule). Classification is LLM-primary (decision D12):
 * seam errors propagate and the route maps them to a structured 500.
 */
export async function classifyReadyOrdinances(
  opts: LinawClassifyOptions
): Promise<LinawClassifyResponse> {
  const pipelineId = opts.pipelineId ?? 'classify-' + crypto.randomUUID();
  const mode = opts.classify ? 'stub' : 'llm';

  // Subject priors computed ONCE from the whole ready library.
  const priorRows = await prisma.linawOrdinance.findMany({
    where: { libraryStatus: 'ready' },
    select: { subjectTags: true },
  });
  const frequencyMap = new Map<string, number>();
  for (const row of priorRows) {
    for (const tag of extractTags(row.subjectTags)) {
      frequencyMap.set(tag, (frequencyMap.get(tag) ?? 0) + 1);
    }
  }
  const subjectFrequencies = [...frequencyMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([subject, count]) => ({ subject, count }));
  const priors = { subjectFrequencies };

  // Scope: absent/[] → every ready row; else per-id lookup (never acts on non-ready).
  interface TargetRow {
    id: string;
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    content: string;
    subjectTags: string[];
  }
  const targets: TargetRow[] = [];
  const skipped: Array<{ recordId: string; reason: string }> = [];

  if (!opts.ordinanceIds || opts.ordinanceIds.length === 0) {
    const rows = await prisma.linawOrdinance.findMany({
      where: { libraryStatus: 'ready' },
      select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, subjectTags: true },
    });
    for (const row of rows) {
      targets.push({ ...row, subjectTags: extractTags(row.subjectTags) });
    }
  } else {
    for (const recordId of opts.ordinanceIds) {
      const row = await prisma.linawOrdinance.findUnique({
        where: { id: recordId },
        select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, subjectTags: true, libraryStatus: true },
      });
      if (!row) {
        skipped.push({ recordId, reason: 'not_found' });
        continue;
      }
      if (row.libraryStatus !== 'ready') {
        skipped.push({ recordId, reason: 'not_classifiable:' + row.libraryStatus });
        continue;
      }
      targets.push({ id: row.id, ordinanceNumber: row.ordinanceNumber, seriesYear: row.seriesYear, title: row.title, content: row.content, subjectTags: extractTags(row.subjectTags) });
    }
  }

  const results: LinawClassifyResultItem[] = [];
  const exceptions: string[] = [];
  let classified = 0;

  for (const row of targets) {
    await insertLinawAgentDecision(pipelineId, opts.userId, {
      agentId: 2,
      action: 'start',
      inputSnapshot: { recordId: row.id, mode },
    });

    const placement = opts.classify
      ? await opts.classify({
          content: row.content,
          title: row.title,
          subjectTags: row.subjectTags,
          priors,
          meta: { ordinanceNumber: row.ordinanceNumber, seriesYear: row.seriesYear },
        })
      : await realClassifyPlacement({
          ordinanceNumber: row.ordinanceNumber,
          seriesYear: row.seriesYear,
          title: row.title,
          content: row.content,
          subjectTags: row.subjectTags,
          priors,
        });

    const valid = placement.titleNumber > 0 && placement.chapterNumber > 0;

    if (valid) {
      await persistAiPlacement(row.id, placement);
    } else {
      exceptions.push(`record ${row.id}: unparseable classification output`);
    }

    // Gates (decision D5): unparseable → low_confidence_classification.
    const gate = valid ? classifyGate(placement.confidence) : 'low_confidence_classification';

    await insertLinawAgentDecision(pipelineId, opts.userId, {
      agentId: 2,
      action: 'complete',
      outputSnapshot: { placement: valid ? placement : null },
      confidence: valid ? placement.confidence : undefined,
    });

    if (gate) {
      await insertLinawAgentDecision(pipelineId, opts.userId, {
        agentId: 2,
        action: 'hitl',
        outputSnapshot: { placement: valid ? placement : null },
        reason: valid ? gateThresholdReason(gate) : 'low_confidence_classification: unparseable output',
      });
    }

    classified += 1;
    const item: LinawClassifyResultItem = {
      recordId: row.id,
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      placement: valid
        ? {
            titleNumber: placement.titleNumber,
            chapterNumber: placement.chapterNumber,
            ...(placement.articleNumber !== undefined
              ? { articleNumber: placement.articleNumber }
              : {}),
            confidence: placement.confidence,
          }
        : null,
      hitlRequired: gate !== undefined,
      ...(gate ? { gate } : {}),
    };
    results.push(item);
  }

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_classify',
    content: JSON.stringify({ pipelineId, classified, skipped: skipped.length, exceptions: exceptions.length }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + opts.userId,
  });

  return { pipelineId, classified, skipped, results, exceptions };
}

export type LinawOverrideOutcome =
  | { ok: true; response: LinawClassifyOverrideResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

/**
 * Persists a human classification override (decision D6): upserts the
 * codification record with the override values, human_override JSON with the
 * REQUIRED reason, cod_status='reviewed', reviewed_by_id = acting user.
 * Audited as agent 2 action='confirm', reason='override'.
 */
export async function applyClassificationOverride(params: {
  ordinanceId: string;
  userId: string;
  body: LinawClassifyOverrideRequest;
  /** Defaults to 'override-' + ordinanceId. */
  pipelineId?: string;
}): Promise<LinawOverrideOutcome> {
  const { ordinanceId, userId, body } = params;
  const pipelineId = params.pipelineId ?? 'override-' + ordinanceId;

  const row = await prisma.linawOrdinance.findUnique({
    where: { id: ordinanceId },
    select: { id: true, libraryStatus: true },
  });
  if (!row) {
    return { ok: false, kind: 'not_found', error: 'Ordinance not found' };
  }
  if (row.libraryStatus !== 'ready') {
    return { ok: false, kind: 'conflict', error: 'Ordinance is not in the ready library' };
  }

  if (
    !Number.isInteger(body.titleNumber) ||
    body.titleNumber <= 0 ||
    !Number.isInteger(body.chapterNumber) ||
    body.chapterNumber <= 0
  ) {
    return {
      ok: false,
      kind: 'invalid',
      error: 'titleNumber and chapterNumber must be positive integers',
    };
  }
  if (
    body.articleNumber !== undefined &&
    (!Number.isInteger(body.articleNumber) || body.articleNumber <= 0)
  ) {
    return { ok: false, kind: 'invalid', error: 'articleNumber must be a positive integer' };
  }
  if (typeof body.reason !== 'string' || body.reason.trim() === '') {
    return { ok: false, kind: 'invalid', error: 'reason must be a non-empty string' };
  }

  const overrideJson = JSON.stringify({
    titleNumber: body.titleNumber,
    chapterNumber: body.chapterNumber,
    ...(body.articleNumber !== undefined ? { articleNumber: body.articleNumber } : {}),
    reason: body.reason.trim(),
    overriddenAt: new Date().toISOString(),
  });

  await prisma.codificationRecord.upsert({
    where: { ordinanceId },
    update: {
      titleNumber: body.titleNumber,
      chapterNumber: body.chapterNumber,
      articleNumber: body.articleNumber ?? null,
      codStatus: 'reviewed',
      humanOverride: overrideJson,
      reviewedById: userId,
    },
    create: {
      id: crypto.randomUUID(),
      ordinanceId,
      titleNumber: body.titleNumber,
      chapterNumber: body.chapterNumber,
      articleNumber: body.articleNumber ?? null,
      codStatus: 'reviewed',
      humanOverride: overrideJson,
      reviewedById: userId,
    },
  });

  await insertLinawAgentDecision(pipelineId, userId, {
    agentId: 2,
    action: 'confirm',
    inputSnapshot: { ordinanceId },
    outputSnapshot: JSON.parse(overrideJson),
    reason: 'override',
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_classification_override',
    content: JSON.stringify({ ordinanceId, titleNumber: body.titleNumber, chapterNumber: body.chapterNumber }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + userId,
  });

  return {
    ok: true,
    response: {
      recordId: ordinanceId,
      codStatus: 'reviewed',
      titleNumber: body.titleNumber,
      chapterNumber: body.chapterNumber,
      ...(body.articleNumber !== undefined ? { articleNumber: body.articleNumber } : {}),
      reviewedBy: userId,
    },
  };
}

// ── Agent 3: Cross-Reference Scanner (N003) ────────────────────────────────

/** Baseline confidence for a fully explicit cross-reference (decision D7). */
export const LINAW_BASELINE_CROSSREF_CONFIDENCE = 0.85;

export interface RawCrossRef {
  type: LinawRelationshipType;
  ordinanceNumber: number;
  seriesYear: number;
  sectionRef?: string;
  rawQuote: string;
  index: number;
}

/** Verb family → relationship type (decision D7). */
function verbToRelationshipType(verbRaw: string, content: string, matchIndex: number): LinawRelationshipType {
  const verb = verbRaw.toLowerCase();
  if (verb.startsWith('amend')) return 'amends';
  if (verb.startsWith('repeal')) {
    const preceding = content.slice(Math.max(0, matchIndex - 60), matchIndex);
    if (/partial|in\s+part/i.test(preceding) || /in\s+part|partial/i.test(verb)) {
      return 'partial_repeal';
    }
    return 'repeals';
  }
  if (verb.startsWith('supersed')) return 'supersedes';
  if (verb.startsWith('extend')) return 'extends';
  // implement* / pursuant to
  return 'implements';
}

const LINAW_CROSSREF_REGEX =
  /(amend(?:ing|ed|s)?|repeal(?:ing|ed|s)?(?:\s+(?:in\s+part|partially))?|supersed(?:e|es|ed|ing)|extend(?:s|ed|ing)?|implement(?:s|ed|ing)?|pursuant\s+to)[^.]{0,80}?ordinance\s+(?:no\.?|number)\s*\.?\s*(\d+)(?:\s*,?\s*(?:s\.|series\s+of)\s*(\d{4}))?/gi;

/**
 * Pure regex extractor (decision D7) — one global case-insensitive pass over
 * the content. NEVER throws on any input. A missing series year is emitted as
 * seriesYear 0 (the scanner treats it as an orphan — decision D8).
 */
export function extractCrossReferences(content: string): RawCrossRef[] {
  const results: RawCrossRef[] = [];
  if (typeof content !== 'string' || content.length === 0) return results;

  try {
    LINAW_CROSSREF_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = LINAW_CROSSREF_REGEX.exec(content)) !== null) {
      const [full, verbRaw, numberRaw, yearRaw] = match;
      const ordinanceNumber = Number.parseInt(numberRaw, 10);
      if (!Number.isFinite(ordinanceNumber) || ordinanceNumber <= 0) {
        continue;
      }
      const seriesYear = yearRaw ? Number.parseInt(yearRaw, 10) : 0;

      // sectionRef: nearest preceding 'Section N' within 200 chars.
      let sectionRef: string | undefined;
      const lookback = content.slice(Math.max(0, match.index - 200), match.index);
      const sectionMatches = [...lookback.matchAll(/section\s+(\d+)/gi)];
      if (sectionMatches.length > 0) {
        sectionRef = 'Section ' + sectionMatches[sectionMatches.length - 1][1];
      }

      results.push({
        type: verbToRelationshipType(verbRaw, content, match.index),
        ordinanceNumber,
        seriesYear: Number.isFinite(seriesYear) ? seriesYear : 0,
        ...(sectionRef ? { sectionRef } : {}),
        rawQuote: full.trim().slice(0, 160),
        index,
      });
      index += 1;

      // Guard against zero-length matches.
      if (match.index === LINAW_CROSSREF_REGEX.lastIndex) LINAW_CROSSREF_REGEX.lastIndex += 1;
    }
  } catch {
    // Never throws — return whatever was collected.
  }
  return results;
}

export interface LinawScanOptions {
  /** Optional: restricts the SOURCE set; targets always resolve ready-wide. */
  ordinanceIds?: string[];
  userId: string;
  /** Defaults to 'detect-' + randomUUID(). */
  pipelineId?: string;
  /** Refinement seam; default is the BEST-EFFORT LLM (regex pass stays
   *  authoritative — any failure degrades to baseline verdicts, never 500s). */
  refine?: (
    content: string,
    candidates: Array<{ index: number; quote: string; type: string; number: number; year: number }>
  ) => Promise<Array<{ refIndex: number; type?: LinawRelationshipType; confidence?: number }> | null>;
}

export interface LinawScanResult {
  pipelineId: string;
  scanned: number;
  detected: number;
  persisted: number;
  skippedExisting: number;
  orphans: LinawOrphanWarning[];
  relationships: LinawRelationshipRecord[];
}

/** The real refinement seam: best-effort LLM at temperature 0. */
async function realRefineCrossRefs(
  content: string,
  candidates: Array<{ index: number; quote: string; type: string; number: number; year: number }>
): Promise<Array<{ refIndex: number; type?: LinawRelationshipType; confidence?: number }> | null> {
  try {
    const { content: text } = await chatCompletion(
      LINAW_CROSSREF_SYSTEM_PROMPT,
      buildLinawCrossRefUserPrompt(content, candidates),
      { temperature: 0, maxTokens: 1024 }
    );
    return parseLinawCrossRefResponse(text);
  } catch {
    return null; // best-effort — keep baseline verdicts
  }
}

/**
 * Agent 3 — scans ready ordinances for amendment/repeal/supersede/extend/
 * implement references (the engine behind the detection route). Sources are
 * the restricted-to-ready scope; targets resolve across the WHOLE ready
 * library (rule 4). Unresolved targets → orphan exception ROWS (never
 * persisted, never crash). Persistence is idempotent via
 * (source_id, target_id, relationship_type) dedupe.
 */
export async function scanCrossReferences(opts: LinawScanOptions): Promise<LinawScanResult> {
  const pipelineId = opts.pipelineId ?? 'detect-' + crypto.randomUUID();
  const refine = opts.refine ?? realRefineCrossRefs;

  // Source scope: absent/[] → every ready row; else per-id lookup, skipping
  // unknown/non-ready ids silently (they can never be sources — rule 4).
  interface SourceRow {
    id: string;
    ordinanceNumber: number;
    seriesYear: number;
    content: string;
  }
  const sources: SourceRow[] = [];
  if (!opts.ordinanceIds || opts.ordinanceIds.length === 0) {
    const rows = await prisma.linawOrdinance.findMany({
      where: { libraryStatus: 'ready' },
      select: { id: true, ordinanceNumber: true, seriesYear: true, content: true },
    });
    sources.push(...rows);
  } else {
    for (const id of opts.ordinanceIds) {
      const row = await prisma.linawOrdinance.findUnique({
        where: { id },
        select: { id: true, ordinanceNumber: true, seriesYear: true, content: true, libraryStatus: true },
      });
      if (row && row.libraryStatus === 'ready') sources.push(row);
    }
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 3,
    action: 'start',
    inputSnapshot: { sources: sources.length, readyOnly: true },
  });

  // Target resolution map built ONCE from the whole ready library.
  const targetRows = await prisma.linawOrdinance.findMany({
    where: { libraryStatus: 'ready' },
    select: { id: true, ordinanceNumber: true, seriesYear: true },
  });
  const targetMap = new Map<string, string>();
  for (const row of targetRows) {
    targetMap.set(`${row.ordinanceNumber}:${row.seriesYear}`, row.id);
  }

  const orphans: LinawOrphanWarning[] = [];
  const relationships: LinawRelationshipRecord[] = [];
  let detected = 0;
  let persisted = 0;
  let skippedExisting = 0;

  for (const source of sources) {
    const refs = extractCrossReferences(source.content);
    // Drop self-references before anything else.
    const candidates = refs.filter(
      (ref) =>
        !(ref.ordinanceNumber === source.ordinanceNumber && ref.seriesYear === source.seriesYear)
    );
    if (candidates.length === 0) continue;
    detected += candidates.length;

    // Refinement seam (best-effort; null → keep baseline verdicts).
    let refinements: Array<{ refIndex: number; type?: LinawRelationshipType; confidence?: number }> | null =
      null;
    try {
      refinements = await refine(
        source.content,
        candidates.map((c) => ({
          index: c.index,
          quote: c.rawQuote,
          type: c.type,
          number: c.ordinanceNumber,
          year: c.seriesYear,
        }))
      );
    } catch {
      refinements = null;
    }
    const refineByIndex = new Map<number, { type?: LinawRelationshipType; confidence?: number }>();
    if (Array.isArray(refinements)) {
      for (const entry of refinements) {
        if (entry && Number.isInteger(entry.refIndex)) {
          refineByIndex.set(entry.refIndex, { type: entry.type, confidence: entry.confidence });
        }
      }
    }

    for (const ref of candidates) {
      const refined = refineByIndex.get(ref.index);
      const type = refined?.type ?? ref.type;

      // Orphans: missing series year OR no ready target for number:year.
      const targetId =
        ref.seriesYear > 0 ? targetMap.get(`${ref.ordinanceNumber}:${ref.seriesYear}`) : undefined;
      if (!targetId) {
        orphans.push({
          sourceId: source.id,
          referencedNumber: ref.ordinanceNumber,
          referencedYear: ref.seriesYear,
          rawQuote: ref.rawQuote,
          warning: 'missing target',
        });
        continue;
      }

      // Idempotency: an existing (source, target, type) row skips re-insert.
      const existing = await prisma.ordinanceRelationship.findFirst({
        where: { sourceId: source.id, targetId, relationshipType: type },
        select: { id: true },
      });
      if (existing) {
        skippedExisting += 1;
        continue;
      }

      const confidence = refined?.confidence ?? LINAW_BASELINE_CROSSREF_CONFIDENCE;
      const id = crypto.randomUUID();
      const inserted = await prisma.ordinanceRelationship.create({
        data: {
          id,
          sourceId: source.id,
          targetId,
          relationshipType: type,
          sectionRef: ref.sectionRef ?? null,
          confidence,
          confirmed: false,
        },
      });
      persisted += 1;

      relationships.push({
        id: inserted.id,
        sourceId: source.id,
        targetId,
        type,
        ...(ref.sectionRef ? { sectionRef: ref.sectionRef } : {}),
        confidence,
        confirmed: (inserted.confirmed ? 1 : 0) as 0 | 1,
        createdAt: inserted.createdAt.toISOString(),
      });
    }
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 3,
    action: 'complete',
    outputSnapshot: { detected, persisted, skippedExisting, orphans: orphans.length },
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_crossref_scan',
    content: JSON.stringify({ pipelineId, detected, persisted, skippedExisting, orphans: orphans.length }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + opts.userId,
  });

  // Order by source series_year/ordinance_number then target.
  const sourceMeta = new Map(sources.map((s) => [s.id, s]));
  relationships.sort((a, b) => {
    const sa = sourceMeta.get(a.sourceId);
    const sb = sourceMeta.get(b.sourceId);
    const yearDiff = (sa?.seriesYear ?? 0) - (sb?.seriesYear ?? 0);
    if (yearDiff !== 0) return yearDiff;
    const numDiff = (sa?.ordinanceNumber ?? 0) - (sb?.ordinanceNumber ?? 0);
    if (numDiff !== 0) return numDiff;
    return a.targetId.localeCompare(b.targetId);
  });

  return {
    pipelineId,
    scanned: sources.length,
    detected,
    persisted,
    skippedExisting,
    orphans,
    relationships,
  };
}

// ── Agent 4: Conflict Detector (N004) ──────────────────────────────────────

export interface LinawConflictJudgement {
  conflict: boolean;
  reason: string;
  confidence: number;
  excerptsA: string[];
  excerptsB: string[];
}

interface ConflictScopeRow {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags: string[];
}

export interface LinawConflictOptions {
  /** Optional: restricts the scope to these ids (ready rows only); absent/[] → all ready. */
  ordinanceIds?: string[];
  userId: string;
  /** Defaults to 'detect-' + randomUUID() (routes share ONE id across agents 3+4). */
  pipelineId?: string;
  /** Conflict seam; default is the real LLM at temperature 0. ANY failure →
   *  null (decision D12: conflicts degrade to empty + exception, never throw). */
  conflictLlm?: (
    a: ConflictScopeRow,
    b: ConflictScopeRow,
    sharedSubjects: string[]
  ) => Promise<LinawConflictJudgement | null>;
}

export interface LinawConflictScanResult {
  pipelineId: string;
  candidates: number;
  detected: number;
  persisted: number;
  conflicts: LinawConflictRecord[];
  exceptions: string[];
}

/**
 * Pure evidence shaper (decision D9 caps): reason trimmed to 500 chars
 * (empty → 'Unspecified contradiction'); up to 2 excerpts per side, each
 * passage trimmed to 300 chars, blank passages dropped.
 */
export function shapeConflictEvidence(
  j: LinawConflictJudgement,
  aId: string,
  bId: string
): { reason: string; excerpts: LinawConflictExcerpt[] } {
  const reasonRaw = (j.reason ?? '').trim();
  const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : 'Unspecified contradiction';

  const shape = (passages: string[] | undefined, ordinanceId: string): LinawConflictExcerpt[] =>
    (passages ?? [])
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .slice(0, 2)
      .map((p) => ({ ordinanceId, passage: p.trim().slice(0, 300) }));

  return { reason, excerpts: [...shape(j.excerptsA, aId), ...shape(j.excerptsB, bId)] };
}

/** The real conflict seam: LLM verdict at temperature 0 + never-throws parser. */
async function realConflictLlm(
  a: ConflictScopeRow,
  b: ConflictScopeRow,
  sharedSubjects: string[]
): Promise<LinawConflictJudgement | null> {
  try {
    const { content: text } = await chatCompletion(
      LINAW_CONFLICT_SYSTEM_PROMPT,
      buildLinawConflictUserPrompt(
        { ordinanceNumber: a.ordinanceNumber, seriesYear: a.seriesYear, title: a.title, content: a.content },
        { ordinanceNumber: b.ordinanceNumber, seriesYear: b.seriesYear, title: b.title, content: b.content },
        sharedSubjects
      ),
      { temperature: 0, maxTokens: 1024 }
    );
    return parseLinawConflictResponse(text);
  } catch {
    return null;
  }
}

function parseConflictEvidence(sectionRef: string | null): { reason: string; excerpts: LinawConflictExcerpt[] } {
  try {
    const parsed = JSON.parse(sectionRef ?? '') as {
      reason?: unknown;
      excerpts?: unknown;
    };
    const reason = typeof parsed.reason === 'string' ? parsed.reason : 'Unspecified contradiction';
    const excerpts = Array.isArray(parsed.excerpts)
      ? parsed.excerpts
          .filter((e): e is { ordinanceId: string; passage: string } => {
            return (
              typeof e === 'object' &&
              e !== null &&
              typeof (e as { ordinanceId?: unknown }).ordinanceId === 'string' &&
              typeof (e as { passage?: unknown }).passage === 'string'
            );
          })
          .map((e) => ({ ordinanceId: e.ordinanceId, passage: e.passage }))
      : [];
    return { reason, excerpts };
  } catch {
    return { reason: 'Unspecified contradiction', excerpts: [] };
  }
}

/**
 * Agent 4 — flags semantic contradictions between same-subject ready
 * ordinances (the engine behind the detection route). Candidate pairs share
 * ≥1 subject tag (the deterministic prior); the LLM decides semantics and is
 * NON-FATAL: any failure degrades to zero conflicts + one exception entry
 * (decision D12). Confirmed contradictions persist per decision D1.
 */
export async function detectConflicts(opts: LinawConflictOptions): Promise<LinawConflictScanResult> {
  const pipelineId = opts.pipelineId ?? 'detect-' + crypto.randomUUID();
  const conflictLlm = opts.conflictLlm ?? realConflictLlm;

  // Scope: ordinanceIds restricted-to-ready, or all ready (same posture as agent 3).
  const scope: ConflictScopeRow[] = [];
  if (!opts.ordinanceIds || opts.ordinanceIds.length === 0) {
    const rows = await prisma.linawOrdinance.findMany({
      where: { libraryStatus: 'ready' },
      select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, subjectTags: true },
    });
    for (const row of rows) {
      scope.push({
        id: row.id,
        ordinanceNumber: row.ordinanceNumber,
        seriesYear: row.seriesYear,
        title: row.title,
        content: row.content,
        subjectTags: extractTags(row.subjectTags),
      });
    }
  } else {
    for (const id of opts.ordinanceIds) {
      const row = await prisma.linawOrdinance.findUnique({
        where: { id },
        select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, subjectTags: true, libraryStatus: true },
      });
      if (row && row.libraryStatus === 'ready') {
        scope.push({
          id: row.id,
          ordinanceNumber: row.ordinanceNumber,
          seriesYear: row.seriesYear,
          title: row.title,
          content: row.content,
          subjectTags: extractTags(row.subjectTags),
        });
      }
    }
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 4,
    action: 'start',
    inputSnapshot: { scope: scope.length, readyOnly: true },
  });

  // Candidate pairs: unordered pairs sharing ≥1 subject tag, skipping pairs
  // already represented by an existing conflict row (idempotency).
  const pairs: Array<{ a: ConflictScopeRow; b: ConflictScopeRow; shared: string[] }> = [];
  for (let i = 0; i < scope.length; i += 1) {
    for (let j = i + 1; j < scope.length; j += 1) {
      const a = scope[i];
      const b = scope[j];
      const shared = a.subjectTags.filter((tag) => b.subjectTags.includes(tag));
      if (shared.length === 0) continue;

      const existing = await prisma.ordinanceRelationship.findFirst({
        where: {
          relationshipType: LINAW_CONFLICT_RELATIONSHIP_TYPE,
          OR: [
            { sourceId: a.id, targetId: b.id },
            { sourceId: b.id, targetId: a.id },
          ],
        },
        select: { id: true },
      });
      if (existing) continue;

      pairs.push({ a, b, shared });
    }
  }

  const conflicts: LinawConflictRecord[] = [];
  const exceptions: string[] = [];
  let detected = 0;
  let persisted = 0;
  let degradationRecorded = false;

  for (const pair of pairs) {
    let verdict: LinawConflictJudgement | null;
    try {
      verdict = await conflictLlm(pair.a, pair.b, pair.shared);
    } catch {
      verdict = null;
    }

    if (verdict === null) {
      if (!degradationRecorded) {
        exceptions.push('conflict detection degraded (LLM unavailable)');
        degradationRecorded = true;
      }
      continue;
    }

    if (!verdict.conflict) continue;
    detected += 1;

    const evidence = shapeConflictEvidence(verdict, pair.a.id, pair.b.id);
    const evidenceJson = JSON.stringify(evidence);
    const id = crypto.randomUUID();
    const inserted = await prisma.ordinanceRelationship.create({
      data: {
        id,
        sourceId: pair.a.id,
        targetId: pair.b.id,
        relationshipType: LINAW_CONFLICT_RELATIONSHIP_TYPE,
        sectionRef: evidenceJson,
        confidence: verdict.confidence,
        confirmed: false,
      },
    });
    persisted += 1;

    const parsedEvidence = parseConflictEvidence(evidenceJson);
    conflicts.push({
      id: inserted.id,
      ordinanceAId: pair.a.id,
      ordinanceBId: pair.b.id,
      reason: parsedEvidence.reason,
      confidence: verdict.confidence,
      excerpts: parsedEvidence.excerpts,
      confirmed: (inserted.confirmed ? 1 : 0) as 0 | 1,
      createdAt: inserted.createdAt.toISOString(),
    });
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 4,
    action: 'complete',
    outputSnapshot: {
      candidates: pairs.length,
      detected,
      persisted,
      exceptions: exceptions.length,
    },
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_conflict_scan',
    content: JSON.stringify({ pipelineId, candidates: pairs.length, detected, persisted }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + opts.userId,
  });

  return { pipelineId, candidates: pairs.length, detected, persisted, conflicts, exceptions };
}

// ── Orchestrator (sequential 1→6 — completed in Sprint 7, decision D7) ─────

export interface RunLinawPipelineParams {
  ordinanceIds?: string[];
  userId: string;
  pipelineId?: string;
  /** Edition label for the agent-6 volume (default 'Pipeline Edition YYYY'). */
  edition?: string;
  classify?: LinawClassifyOptions['classify'];
  refine?: LinawScanOptions['refine'];
  conflictLlm?: LinawConflictOptions['conflictLlm'];
}

export interface LinawPipelineResult {
  pipelineId: string;
  inventory: LinawInventoryResponse;
  classification: LinawClassifyResponse;
  detection: LinawDetectResponse;
  /** Agent 5 — decision-queue review (Sprint 7). */
  review: LinawReviewResult;
  /** Agent 6 — omitted when the review gate blocks assembly (D5). */
  assembly?: LinawAssembleOutcome;
  hitlRequired: boolean;
}

/**
 * Sequential 1→6 orchestrator over the ready library. Agent 6 is gated by
 * agent 5 exactly like the assemble route: any pending relationship/conflict
 * row blocks the build (review surfaces the gate; assembly is omitted).
 * Errors propagate; production route callers invoke the engines individually,
 * and the /linaw page drives the same routes with client-simulated delays.
 */
export async function runLinawPipeline(params: RunLinawPipelineParams): Promise<LinawPipelineResult> {
  const pipelineId = params.pipelineId ?? 'pipeline-' + crypto.randomUUID();

  const inventory = await analyzeInventory({ userId: params.userId, pipelineId });

  const classification = await classifyReadyOrdinances({
    ordinanceIds: params.ordinanceIds,
    userId: params.userId,
    pipelineId,
    classify: params.classify,
  });

  const scan = await scanCrossReferences({
    ordinanceIds: params.ordinanceIds,
    userId: params.userId,
    pipelineId,
    refine: params.refine,
  });

  const conflictResult = await detectConflicts({
    ordinanceIds: params.ordinanceIds,
    userId: params.userId,
    pipelineId,
    conflictLlm: params.conflictLlm,
  });

  const detectionHitl = scan.detected > 0 || conflictResult.detected > 0;
  const detection: LinawDetectResponse = {
    pipelineId,
    scanned: scan.scanned,
    relationshipsDetected: scan.detected,
    relationshipsPersisted: scan.persisted,
    skippedExisting: scan.skippedExisting,
    orphans: scan.orphans,
    conflictsDetected: conflictResult.detected,
    conflictsPersisted: conflictResult.persisted,
    conflicts: conflictResult.conflicts,
    hitlRequired: detectionHitl,
    exceptions: [...conflictResult.exceptions],
  };

  // Sprint 7: agents 5–6 complete the chain (agent 6 gated by agent 5).
  const review = await reviewRelationships({ userId: params.userId, pipelineId });
  let assembly: LinawAssembleOutcome | undefined;
  if (review.pending === 0) {
    assembly = await assembleCode({
      edition: params.edition ?? 'Pipeline Edition ' + new Date().getUTCFullYear(),
      userId: params.userId,
      pipelineId,
    });
  }

  const classificationHitl = classification.results.some((item) => item.hitlRequired);
  const assemblyHitl = assembly !== undefined && assembly.ok;

  return {
    pipelineId,
    inventory,
    classification,
    detection,
    review,
    ...(assembly !== undefined ? { assembly } : {}),
    hitlRequired: detectionHitl || classificationHitl || review.hitlRequired || assemblyHitl,
  };
}

// ── Agent 5: Relationship Reviewer (N005 — Sprint 7) ───────────────────────

/** Decision D2 — the confirmed-relationship status mapping, ISOLATED for review.
 *  Only these three types flip a status; amends/extends/implements never do. */
export function ordinanceStatusAfterConfirmedRelationship(
  type: LinawRelationshipType
): 'amended' | 'repealed' | 'superseded' | undefined {
  if (type === 'repeals') return 'repealed';
  if (type === 'partial_repeal') return 'amended';
  if (type === 'supersedes') return 'superseded';
  return undefined;
}

export type LinawDecisionOutcome =
  | { ok: true; response: LinawRelationshipDecisionResponse }
  | { ok: false; kind: 'not_found' | 'invalid' | 'already_decided'; error: string };

/**
 * Applies a human decision (confirm/reject) to ONE ordinance_relationships row
 * (six-type rows AND conflict-marker rows — decision D3). Semantics:
 * - confirm: confirmed=1 + confirmed_by_id in ONE transaction with the D2
 *   status propagation on the TARGET ordinance.
 * - reject (D1): rejected=1 — confirmed stays false, confirmed_by_id stays NULL;
 *   the REQUIRED reason rides on the agent_decisions audit row.
 * Decisions are FINAL: a row with confirmed=true OR rejected=true refuses further
 * actions (route maps to 409).
 */
export async function decideRelationship(params: {
  relationshipId: string;
  userId: string;
  body: LinawRelationshipDecisionRequest;
  /** Defaults to 'review-' + relationshipId. */
  pipelineId?: string;
}): Promise<LinawDecisionOutcome> {
  const { relationshipId, userId, body } = params;
  const pipelineId = params.pipelineId ?? 'review-' + relationshipId;

  const row = await prisma.ordinanceRelationship.findUnique({
    where: { id: relationshipId },
    include: {
      target: { select: { status: true, ordinanceNumber: true, seriesYear: true } },
    },
  });
  if (!row) {
    return { ok: false, kind: 'not_found', error: 'Relationship not found' };
  }

  if (body.action !== 'confirm' && body.action !== 'reject') {
    return { ok: false, kind: 'invalid', error: 'action must be confirm or reject' };
  }
  if (body.action === 'reject' && (typeof body.reason !== 'string' || body.reason.trim() === '')) {
    return { ok: false, kind: 'invalid', error: 'reason is required when rejecting' };
  }

  const alreadyConfirmed = row.confirmed;
  const alreadyRejected = row.rejected;
  if (alreadyConfirmed || alreadyRejected) {
    return { ok: false, kind: 'already_decided', error: 'Relationship already decided' };
  }

  const relType = row.relationshipType;

  if (body.action === 'confirm') {
    let statusUpdate: LinawRelationshipStatusUpdate | undefined;

    await prisma.$transaction(async (tx) => {
      await tx.ordinanceRelationship.update({
        where: { id: relationshipId },
        data: { confirmed: true, confirmedById: userId },
      });

      // Decision D2: the confirmed relationship flips the TARGET ordinance's
      // status (the affected instrument), active/amended origins only.
      const to = ordinanceStatusAfterConfirmedRelationship(relType as LinawRelationshipType);
      const currentStatus = row.target.status;
      if (to && (currentStatus === 'active' || currentStatus === 'amended')) {
        await tx.linawOrdinance.update({
          where: { id: row.targetId },
          data: { status: to },
        });
        statusUpdate = {
          ordinanceId: row.targetId,
          ordinanceNumber: row.target.ordinanceNumber,
          seriesYear: row.target.seriesYear,
          from: currentStatus as LinawOrdinance['status'],
          to,
        };
      }
    });

    const response: LinawRelationshipDecisionResponse = {
      id: relationshipId,
      action: 'confirm',
      confirmed: 1,
      rejected: 0,
      ...(statusUpdate ? { statusUpdate } : {}),
    };

    await insertLinawAgentDecision(pipelineId, userId, {
      agentId: 5,
      action: 'confirm',
      inputSnapshot: { relationshipId, type: relType },
      outputSnapshot: response as unknown as Record<string, unknown>,
    });

    logModuleEvent({
      module: 'linaw',
      interactionType: 'linaw_relationship_decision',
      content: JSON.stringify({ relationshipId, action: 'confirm', statusChanged: !!statusUpdate }),
      ipAddress: '127.0.0.1',
      participantSessionId: 'linaw-' + userId,
    });

    return { ok: true, response };
  }

  // Reject (D1): confirmed stays false, confirmedById stays NULL; reason audited.
  await prisma.ordinanceRelationship.update({
    where: { id: relationshipId },
    data: { rejected: true },
  });

  const response: LinawRelationshipDecisionResponse = {
    id: relationshipId,
    action: 'reject',
    confirmed: 0,
    rejected: 1,
  };

  await insertLinawAgentDecision(pipelineId, userId, {
    agentId: 5,
    action: 'reject',
    inputSnapshot: { relationshipId, type: relType },
    outputSnapshot: response as unknown as Record<string, unknown>,
    reason: body.reason?.trim(),
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_relationship_decision',
    content: JSON.stringify({ relationshipId, action: 'reject', statusChanged: false }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + userId,
  });

  return { ok: true, response };
}

export interface LinawReviewResult {
  pipelineId: string;
  /** confirmed=false AND rejected=false, ALL types incl. 'conflict' (D3). */
  pending: number;
  confirmed: number;
  rejected: number;
  /** pending > 0. */
  hitlRequired: boolean;
}

/**
 * Agent 5 — reviews the decision queue: counts pending/confirmed/rejected rows
 * across ALL ordinance_relationships (the conflict marker INCLUDED — decision
 * D3). Pure DB — no LLM. Raises the detected_relationship HITL row when any
 * detection still awaits a human decision. Consumed by the assemble
 * precondition (agent 6) and presented by the Relationships tab.
 */
export async function reviewRelationships(params: {
  userId: string;
  pipelineId?: string;
}): Promise<LinawReviewResult> {
  const pipelineId = params.pipelineId ?? 'review-' + crypto.randomUUID();

  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 5,
    action: 'start',
    inputSnapshot: { scope: 'all relationship rows' },
  });

  const pending = await prisma.ordinanceRelationship.count({
    where: { confirmed: false, rejected: false },
  });
  const confirmed = await prisma.ordinanceRelationship.count({
    where: { confirmed: true },
  });
  const rejected = await prisma.ordinanceRelationship.count({
    where: { rejected: true },
  });
  const hitlRequired = pending > 0;

  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 5,
    action: 'complete',
    outputSnapshot: { pending, confirmed, rejected },
  });

  if (hitlRequired) {
    await insertLinawAgentDecision(pipelineId, params.userId, {
      agentId: 5,
      action: 'hitl',
      reason: 'detected_relationship: ' + pending + ' detections await human decision',
    });
  }

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_relationship_review',
    content: JSON.stringify({ pipelineId, pending, confirmed, rejected }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + params.userId,
  });

  return { pipelineId, pending, confirmed, rejected, hitlRequired };
}

// ── N007 plain-language summaries (Sprint 7) ───────────────────────────────

export interface LinawSummarizeOptions {
  /** Optional: absent or [] → every ready ordinance WITHOUT an existing
   *  summary; explicit ids regenerate even when a summary exists. */
  ordinanceIds?: string[];
  userId: string;
  /** Defaults to 'summarize-' + randomUUID(). */
  pipelineId?: string;
  /** DI seam; default = real chatCompletion at temperature 0. */
  summarize?: (input: {
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    content: string;
  }) => Promise<string>;
}

interface SummarizeTargetRow {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary: string | null;
}

/**
 * N007 — generates 2–3 sentence plain-language summaries for ready ordinances
 * (decision D4: on-demand, human-editable, NEVER called by assembly; D12:
 * best-effort PER RECORD — the batch never throws/500s regardless of seam
 * behavior; keyless environments yield summarized: 0 + failed list).
 * Audited as ONE agent-0 pair ('Summary Generation' — the pre-pipeline
 * convention for work outside the six pipeline agents).
 */
export async function summarizeReadyOrdinances(
  opts: LinawSummarizeOptions
): Promise<LinawSummarizeResponse> {
  const pipelineId = opts.pipelineId ?? 'summarize-' + crypto.randomUUID();
  const summarize =
    opts.summarize ??
    ((input: { ordinanceNumber: number; seriesYear: number; title: string; content: string }) =>
      chatCompletion(LINAW_SUMMARY_SYSTEM_PROMPT, buildLinawSummaryUserPrompt(input), {
        temperature: 0,
        maxTokens: 512,
      }).then((r) => r.content));

  // Scope posture identical to classifyReadyOrdinances (ready rows only —
  // boundary rule 4). Implicit batch additionally skips already-summarized
  // rows; explicit ids NEVER skip on has_summary.
  const targets: SummarizeTargetRow[] = [];
  const skipped: Array<{ recordId: string; reason: string }> = [];

  if (!opts.ordinanceIds || opts.ordinanceIds.length === 0) {
    const rows = await prisma.linawOrdinance.findMany({
      where: { libraryStatus: 'ready' },
      select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, summary: true },
    });
    for (const row of rows) {
      if (typeof row.summary === 'string' && row.summary.trim().length > 0) {
        skipped.push({ recordId: row.id, reason: 'has_summary' });
        continue;
      }
      targets.push(row);
    }
  } else {
    for (const recordId of opts.ordinanceIds) {
      const row = await prisma.linawOrdinance.findUnique({
        where: { id: recordId },
        select: { id: true, ordinanceNumber: true, seriesYear: true, title: true, content: true, summary: true, libraryStatus: true },
      });
      if (!row) {
        skipped.push({ recordId, reason: 'not_found' });
        continue;
      }
      if (row.libraryStatus !== 'ready') {
        skipped.push({ recordId, reason: 'not_summarizable:' + row.libraryStatus });
        continue;
      }
      targets.push(row);
    }
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 0,
    action: 'start',
    inputSnapshot: { scope: targets.length, explicit: !!opts.ordinanceIds?.length },
  });

  const results: LinawSummarizeResultItem[] = [];
  const failed: Array<{ recordId: string; reason: string }> = [];

  for (const row of targets) {
    let summary = '';
    try {
      const raw = await summarize({
        ordinanceNumber: row.ordinanceNumber,
        seriesYear: row.seriesYear,
        title: row.title,
        content: row.content,
      });
      summary = parseLinawSummaryResponse(raw);
    } catch (err) {
      failed.push({
        recordId: row.id,
        reason: err instanceof Error ? err.message : 'summary generation failed',
      });
      continue;
    }

    if (summary.length === 0) {
      failed.push({ recordId: row.id, reason: 'empty summary output' });
      continue;
    }

    await prisma.linawOrdinance.update({
      where: { id: row.id },
      data: { summary },
    });
    results.push({
      recordId: row.id,
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      summary,
    });
  }

  await insertLinawAgentDecision(pipelineId, opts.userId, {
    agentId: 0,
    action: 'complete',
    outputSnapshot: {
      summarized: results.length,
      skipped: skipped.length,
      failed: failed.length,
    },
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_summarize',
    content: JSON.stringify({
      pipelineId,
      summarized: results.length,
      skipped: skipped.length,
      failed: failed.length,
    }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + opts.userId,
  });

  return { pipelineId, summarized: results.length, skipped, results, failed };
}

export type LinawSummaryEditOutcome =
  | { ok: true; response: LinawSummaryEditResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

/**
 * Persists a human-edited summary (decision D4): ready rows only, non-empty
 * text required (the human edit is authoritative). Audited as agent 0 with
 * the 'Summary Edit' name, action 'confirm'.
 */
export async function applySummaryEdit(params: {
  ordinanceId: string;
  summary: string;
  userId: string;
  pipelineId?: string;
}): Promise<LinawSummaryEditOutcome> {
  const pipelineId = params.pipelineId ?? 'summary-edit-' + params.ordinanceId;

  const summary = typeof params.summary === 'string' ? params.summary.trim() : '';
  if (summary.length === 0) {
    return { ok: false, kind: 'invalid', error: 'summary must be a non-empty string' };
  }

  const row = await prisma.linawOrdinance.findUnique({
    where: { id: params.ordinanceId },
    select: { id: true, libraryStatus: true },
  });
  if (!row) {
    return { ok: false, kind: 'not_found', error: 'Ordinance not found' };
  }
  if (row.libraryStatus !== 'ready') {
    return { ok: false, kind: 'conflict', error: 'Ordinance is not in the ready library' };
  }

  await prisma.linawOrdinance.update({
    where: { id: params.ordinanceId },
    data: { summary },
  });

  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 0,
    agentName: 'Summary Edit',
    action: 'confirm',
    inputSnapshot: { ordinanceId: params.ordinanceId },
    outputSnapshot: { summary },
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_summary_edit',
    content: JSON.stringify({ ordinanceId: params.ordinanceId, editedBy: params.userId }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + params.userId,
  });

  return {
    ok: true,
    response: { recordId: params.ordinanceId, summary, editedById: params.userId },
  };
}

// ── Agent 6: Code Assembler (N006 — Sprint 7) ──────────────────────────────

/** Fixed volume title (decision D6). */
export const LINAW_CODE_VOLUME_TITLE = 'Municipal Code of Ordinances';

export type LinawAssembleOutcome =
  | { ok: true; response: LinawAssembleResponse }
  | { ok: false; kind: 'pending_relationships' | 'nothing_to_assemble'; pending?: number; error: string };

/** One eligible placement feeding the pure hierarchy builder. */
export interface LinawTocPlacement {
  ordinanceId: string;
  ordinanceNumber: number;
  seriesYear: number;
  ordinanceTitle: string;
  summary: string | null;
  titleNumber: number;
  chapterNumber: number;
  articleNumber?: number;
}

/** 'Title 3 — Taxation and Revenue' from LINAW_CODE_TITLES; 'Title N' fallback. */
function codeTitleName(titleNumber: number): string {
  const entry =
    titleNumber >= 1 && titleNumber <= LINAW_CODE_TITLES.length
      ? LINAW_CODE_TITLES[titleNumber - 1]
      : undefined;
  if (!entry) return 'Title ' + titleNumber;
  return 'Title ' + titleNumber + ' — ' + entry.replace(/^\d+\s+/, '');
}

/** Deterministic ordinance ordering inside every section list (decision D6). */
function byOrdinanceOrder(a: LinawTocPlacement, b: LinawTocPlacement): number {
  if (a.seriesYear !== b.seriesYear) return a.seriesYear - b.seriesYear;
  return a.ordinanceNumber - b.ordinanceNumber;
}

/**
 * Pure hierarchy builder (decision D6/D11): Titles ascending → Chapters
 * ascending → Articles ascending (+ chapter-level sections for placements
 * without an article). Auto-numbering is ONE counter PER CHAPTER: chapter-
 * level sections FIRST in ordinance order, then articles ascending with their
 * sections; every emitted section takes the next counter value ('Section N').
 */
export function buildCodeToc(placements: LinawTocPlacement[]): CodeTocNode[] {
  const byTitle = new Map<number, LinawTocPlacement[]>();
  for (const p of placements) {
    const list = byTitle.get(p.titleNumber) ?? [];
    list.push(p);
    byTitle.set(p.titleNumber, list);
  }

  const toc: CodeTocNode[] = [];
  for (const titleNumber of [...byTitle.keys()].sort((x, y) => x - y)) {
    const titleRows = byTitle.get(titleNumber)!;

    const byChapter = new Map<number, LinawTocPlacement[]>();
    for (const p of titleRows) {
      const list = byChapter.get(p.chapterNumber) ?? [];
      list.push(p);
      byChapter.set(p.chapterNumber, list);
    }

    const chapters: CodeTocChapter[] = [];
    for (const chapterNumber of [...byChapter.keys()].sort((x, y) => x - y)) {
      const chapterRows = byChapter.get(chapterNumber)!.slice().sort(byOrdinanceOrder);
      const chapterLevel = chapterRows.filter((p) => p.articleNumber === undefined);
      const articleRows = chapterRows.filter((p) => p.articleNumber !== undefined);

      const byArticle = new Map<number, LinawTocPlacement[]>();
      for (const p of articleRows) {
        const list = byArticle.get(p.articleNumber!) ?? [];
        list.push(p);
        byArticle.set(p.articleNumber!, list);
      }

      let counter = 0;
      const makeRef = (p: LinawTocPlacement): CodeSectionRef => {
        counter += 1;
        return {
          id: crypto.randomUUID(),
          ordinanceId: p.ordinanceId,
          label: 'Section ' + counter,
          ordinanceNumber: p.ordinanceNumber,
          seriesYear: p.seriesYear,
          title: p.ordinanceTitle,
          summary: p.summary ?? undefined,
        };
      };

      const chapter: CodeTocChapter = { name: 'Chapter ' + chapterNumber };
      if (chapterLevel.length > 0) {
        chapter.sections = chapterLevel.map(makeRef);
      }
      const articles: CodeTocArticle[] = [];
      for (const articleNumber of [...byArticle.keys()].sort((x, y) => x - y)) {
        articles.push({
          name: 'Article ' + articleNumber,
          sections: byArticle.get(articleNumber)!.map(makeRef),
        });
      }
      if (articles.length > 0) {
        chapter.articles = articles;
      }
      chapters.push(chapter);
    }

    toc.push({ title: codeTitleName(titleNumber), chapters });
  }

  return toc;
}

/**
 * Agent 6 — assembles the Code of Ordinances over the READY library.
 * Precondition (D5): agent 5 reviews the decision queue; ANY pending row
 * (confirmed=false AND rejected=false, all types incl. conflicts) refuses the build
 * with the exact count — rejected rows do NOT block. Eligible placements:
 * ready ordinances in status active/amended (D6 — repealed/superseded/expired
 * excluded + reported); missing placements → unclassified[] (non-blocking).
 * On success a NEW draft code_volumes row is written (history preserved) and
 * the final_code_export HITL gate is raised (audit row + response).
 */
export async function assembleCode(params: {
  edition: string;
  userId: string;
  pipelineId?: string; // default 'assemble-' + randomUUID()
}): Promise<LinawAssembleOutcome> {
  const pipelineId = params.pipelineId ?? 'assemble-' + crypto.randomUUID();

  // 1. Agent 5 precondition (D5) — one request serves agents 5+6.
  const review = await reviewRelationships({ userId: params.userId, pipelineId });
  if (review.pending > 0) {
    return {
      ok: false,
      kind: 'pending_relationships',
      pending: review.pending,
      error: review.pending + ' detected relationships/conflicts await human decision',
    };
  }

  // 2. Agent 6 start.
  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 6,
    action: 'start',
    inputSnapshot: { edition: params.edition },
  });

  // 3. Load placements over the READY library only (boundary rule 4).
  const codRows = await prisma.codificationRecord.findMany({
    include: {
      ordinance: {
        select: {
          ordinanceNumber: true,
          seriesYear: true,
          title: true,
          summary: true,
          status: true,
          libraryStatus: true,
        },
      },
    },
  });

  // Filter to ready ordinances only
  const rows = codRows
    .filter((c) => c.ordinance.libraryStatus === 'ready')
    .map((c) => ({
      ordinanceId: c.ordinanceId,
      titleNumber: c.titleNumber,
      chapterNumber: c.chapterNumber,
      articleNumber: c.articleNumber,
      ordinanceNumber: c.ordinance.ordinanceNumber,
      seriesYear: c.ordinance.seriesYear,
      title: c.ordinance.title,
      summary: c.ordinance.summary,
      status: c.ordinance.status,
    }));

  const unclassified: LinawAssembleResponse['unclassified'] = [];
  const excluded: LinawAssembleResponse['excluded'] = [];
  const placements: LinawTocPlacement[] = [];

  for (const row of rows) {
    if (row.titleNumber === null || row.chapterNumber === null) {
      unclassified.push({
        recordId: row.ordinanceId,
        ordinanceNumber: row.ordinanceNumber,
        seriesYear: row.seriesYear,
      });
      continue;
    }
    if (row.status === 'repealed' || row.status === 'superseded' || row.status === 'expired') {
      excluded.push({
        recordId: row.ordinanceId,
        ordinanceNumber: row.ordinanceNumber,
        seriesYear: row.seriesYear,
        status: row.status as LinawOrdinance['status'],
      });
      continue;
    }
    placements.push({
      ordinanceId: row.ordinanceId,
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      ordinanceTitle: row.title,
      summary: row.summary,
      titleNumber: row.titleNumber,
      chapterNumber: row.chapterNumber,
      ...(row.articleNumber !== null ? { articleNumber: row.articleNumber } : {}),
    });
  }

  const exceptions: string[] = [];
  if (unclassified.length > 0) {
    exceptions.push(
      unclassified.length === 1
        ? '1 ready ordinance unclassified — run classification'
        : unclassified.length + ' ready ordinances unclassified — run classification'
    );
  }
  if (excluded.length > 0) {
    exceptions.push(
      excluded.length === 1
        ? '1 ready ordinance excluded (repealed/superseded/expired)'
        : excluded.length + ' ready ordinances excluded (repealed/superseded/expired)'
    );
  }

  // 8. Zero eligible rows → refuse (no volume row; refusal still audited).
  if (placements.length === 0) {
    await insertLinawAgentDecision(pipelineId, params.userId, {
      agentId: 6,
      action: 'complete',
      outputSnapshot: {
        refused: 'nothing_to_assemble',
        unclassified: unclassified.length,
        excluded: excluded.length,
      },
    });
    logModuleEvent({
      module: 'linaw',
      interactionType: 'linaw_assemble',
      content: JSON.stringify({ pipelineId, refused: 'nothing_to_assemble' }),
      ipAddress: '127.0.0.1',
      participantSessionId: 'linaw-' + params.userId,
    });
    return {
      ok: false,
      kind: 'nothing_to_assemble',
      error: 'No classified ready ordinances to assemble',
    };
  }

  // 4. Hierarchy (pure builder).
  const toc = buildCodeToc(placements);

  // Per-ordinance section numbers derived from the emitted labels.
  const sectionNumbers = new Map<string, number>();
  for (const titleNode of toc) {
    for (const chapter of titleNode.chapters) {
      for (const section of chapter.sections ?? []) {
        sectionNumbers.set(section.ordinanceId, Number(section.label.replace('Section ', '')));
      }
      for (const article of chapter.articles ?? []) {
        for (const section of article.sections) {
          sectionNumbers.set(section.ordinanceId, Number(section.label.replace('Section ', '')));
        }
      }
    }
  }

  const counts = {
    titles: toc.length,
    chapters: toc.reduce((sum, node) => sum + node.chapters.length, 0),
    sections: sectionNumbers.size,
  };

  // 5. Persist (one transaction): codified placements + NEW draft volume.
  const codeVolumeId = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    for (const [ordinanceId, sectionNumber] of sectionNumbers) {
      await tx.codificationRecord.update({
        where: { ordinanceId },
        data: { sectionInCode: sectionNumber, codStatus: 'codified' },
      });
    }
    await tx.codeVolume.create({
      data: {
        id: codeVolumeId,
        title: LINAW_CODE_VOLUME_TITLE,
        edition: params.edition,
        status: 'draft',
        structure: JSON.stringify(toc),
        generatedById: params.userId,
      },
    });
  });

  // 6. Agent 6 complete + final_code_export gate (D5).
  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 6,
    action: 'complete',
    outputSnapshot: { codeVolumeId, counts },
  });
  await insertLinawAgentDecision(pipelineId, params.userId, {
    agentId: 6,
    action: 'hitl',
    reason: 'final_code_export: code volume awaiting approval before export',
  });

  logModuleEvent({
    module: 'linaw',
    interactionType: 'linaw_assemble',
    content: JSON.stringify({ pipelineId, codeVolumeId, counts }),
    ipAddress: '127.0.0.1',
    participantSessionId: 'linaw-' + params.userId,
  });

  // 7. Response.
  return {
    ok: true,
    response: {
      pipelineId,
      codeVolumeId,
      title: LINAW_CODE_VOLUME_TITLE,
      edition: params.edition,
      toc,
      counts,
      hitlRequired: true,
      gate: 'final_code_export',
      unclassified,
      excluded,
      exceptions,
    },
  };
}
