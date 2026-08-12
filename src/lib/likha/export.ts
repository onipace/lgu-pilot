// src/lib/likha/export.ts
// Sprint 4 — LIKHA export builders (SPRINT_PLAN: "src/lib/likha/export.ts owns
// the builder"). S4-C4 ships the shared published-only row loader + eligibility
// layer and the L010 DILG MC 2026-041 builder (decision D27, single JSON
// attachment, dilg_submitted markers). S4-C7 appends the L1 interchange builder
// (INTERCHANGE-SPEC v1.0.0 §2–§4 + §6) into this same file.
//
// Table surface is exactly two LIKHA tables: archived_ordinances + classifications.
// The builders are pure of logging/auth concerns — the routes (S4-C8) own those.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import type {
  LikhaDilgPackage,
  LikhaInterchangePackage,
  LikhaInterchangeRecord,
} from '@/types/likha';

/** Outcome of an export build: payload on success, ineligible ids in refusal. */
export type LikhaExportOutcome<T> =
  | { ok: true; payload: T }
  | { ok: false; kind: 'ineligible'; ineligibleIds: string[]; error: string };

export interface BuildExportParams {
  userId: string;
  /** When omitted → all published rows. Empty array → zero-record package (decision D23). */
  recordIds?: string[];
  /** DI for tests; default new Date().toISOString(). */
  now?: () => string;
}

/** Published-row shape loaded for export (both builders). */
export interface PublishedRow {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary: string | null;
  subjectTags: unknown;
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  sourceType: string;
  fileHash: string | null;
  archiveStatus: string;
}

const CHRONOLOGICAL_ORDER = [{ seriesYear: 'asc' as const }, { ordinanceNumber: 'asc' as const }];

/**
 * Shared published-only loader used by buildDilgPackage (L010) and the S4-C7
 * L1 builder buildInterchangePackage. Loads exportable rows (decision D23 —
 * published only, all-or-nothing).
 * - recordIds omitted  → every archive_status='published' row, chronological.
 * - recordIds === []   → zero rows (valid empty package).
 * - recordIds present  → each id must exist AND be published; any failure
 *   collects into ineligibleIds and the whole load is refused (no partials).
 */
export async function loadExportableRows(
  params: BuildExportParams
): Promise<{ rows: PublishedRow[] } | { ineligibleIds: string[] }> {
  if (params.recordIds === undefined) {
    const rows = await prisma.archivedOrdinance.findMany({
      where: { archiveStatus: 'published' },
      orderBy: CHRONOLOGICAL_ORDER,
      select: {
        id: true,
        ordinanceNumber: true,
        seriesYear: true,
        title: true,
        content: true,
        summary: true,
        subjectTags: true,
        status: true,
        sourceType: true,
        fileHash: true,
        archiveStatus: true,
      },
    });
    return { rows: rows as unknown as PublishedRow[] };
  }

  if (params.recordIds.length === 0) {
    return { rows: [] };
  }

  const found = await prisma.archivedOrdinance.findMany({
    where: { id: { in: params.recordIds } },
    select: {
      id: true,
      ordinanceNumber: true,
      seriesYear: true,
      title: true,
      content: true,
      summary: true,
      subjectTags: true,
      status: true,
      sourceType: true,
      fileHash: true,
      archiveStatus: true,
    },
  });
  const byId = new Map(found.map((row) => [row.id, row]));

  const ineligibleIds: string[] = [];
  const eligible: PublishedRow[] = [];
  for (const id of params.recordIds) {
    const row = byId.get(id);
    if (!row || row.archiveStatus !== 'published') {
      ineligibleIds.push(id);
    } else {
      eligible.push(row as unknown as PublishedRow);
    }
  }
  if (ineligibleIds.length > 0) {
    return { ineligibleIds };
  }

  eligible.sort(
    (a, b) => a.seriesYear - b.seriesYear || a.ordinanceNumber - b.ordinanceNumber
  );
  return { rows: eligible };
}

/** subjectTags is a native Json field in Prisma — already a JS array. */
function safeSubjectTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string');
}

/**
 * subjectTags = the row's subject_tags JSON UNION its classifications rows'
 * categories (INTERCHANGE-SPEC §4 LIKHA mapping / decision D27). Tags come
 * first, classifications appended; deduplicated, order preserved.
 */
async function subjectTagsFor(row: PublishedRow): Promise<string[]> {
  const tags = safeSubjectTags(row.subjectTags);
  const seen = new Set<string>(tags);
  const out = [...tags];
  const classRows = await prisma.classification.findMany({
    where: { ordinanceId: row.id },
    orderBy: { createdAt: 'asc' },
    select: { category: true },
  });
  for (const c of classRows) {
    if (!seen.has(c.category)) {
      seen.add(c.category);
      out.push(c.category);
    }
  }
  return out;
}

/**
 * L010 — builds the DILG MC 2026-041 submission package (decision D27).
 * Published rows only; on success marks every included row dilg_submitted=true
 * with the SAME timestamp carried by manifest.exportedAt + each record's
 * dilgSubmittedAt. No logging here — the route logs (S4-C8).
 */
export async function buildDilgPackage(params: BuildExportParams): Promise<LikhaExportOutcome<LikhaDilgPackage>> {
  const loaded = await loadExportableRows(params);

  if ('ineligibleIds' in loaded) {
    return {
      ok: false,
      kind: 'ineligible',
      ineligibleIds: loaded.ineligibleIds,
      error: 'Records not eligible for export (published only): ' + loaded.ineligibleIds.join(', '),
    };
  }

  const now = (params.now ?? (() => new Date().toISOString()))();

  const records: LikhaDilgPackage['records'] = [];
  for (const row of loaded.rows) {
    records.push({
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      title: row.title,
      status: row.status,
      subjectTags: await subjectTagsFor(row),
      fileHash: row.fileHash,
      sourceRecordId: row.id,
      dilgSubmittedAt: now,
    });
  }

  // Mark all included rows as DILG-submitted
  await prisma.$transaction(async (tx) => {
    for (const row of loaded.rows) {
      await tx.archivedOrdinance.update({
        where: { id: row.id },
        data: { dilgSubmitted: true, dilgSubmittedAt: new Date(now) },
      });
    }
  });

  return {
    ok: true,
    payload: {
      manifest: {
        submission: 'DILG MC 2026-041',
        module: 'likha',
        platform: 'esangguni-pilot',
        exportedAt: now,
        exportedById: params.userId,
        recordCount: records.length,
      },
      records,
    },
  };
}

// ── Sprint 4 (S4-C7): L013 L1 interchange builder ─────────────────────────
// docs/INTERCHANGE-SPEC.md v1.0.0 VERBATIM: §2 package {manifest, records,
// packageHash} (the §5 array is omitted for LIKHA packages), §3 manifest,
// §4 LIKHA record mapping, §6 packageHash. The hash covers the canonical
// JSON of { records } ONLY — the manifest is never hashed.

/** INTERCHANGE-SPEC §6 — canonical JSON: object keys sorted
 *  lexicographically at EVERY depth, no insignificant whitespace. Recursive;
 *  arrays preserve order. Pure — no I/O. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const member = obj[key];
      if (member === undefined) continue; // JSON semantics — dropped
      parts.push(JSON.stringify(key) + ':' + canonicalJson(member));
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value) as string;
}

/** D29 — exporter.appVersion read from package.json `version` at build time. */
function readAppVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * L013 — builds the L1 interchange package (INTERCHANGE-SPEC v1.0.0).
 * Published rows only (decision D23, shared loader); record mapping per §4;
 * manifest per §3; packageHash per §6 over the canonical JSON of {records}.
 * No logging here — the route logs (S4-C8).
 */
export async function buildInterchangePackage(
  params: BuildExportParams
): Promise<LikhaExportOutcome<LikhaInterchangePackage>> {
  const loaded = await loadExportableRows(params);

  if ('ineligibleIds' in loaded) {
    return {
      ok: false,
      kind: 'ineligible',
      ineligibleIds: loaded.ineligibleIds,
      error: 'Records not eligible for export (published only): ' + loaded.ineligibleIds.join(', '),
    };
  }

  const now = (params.now ?? (() => new Date().toISOString()))();

  const records: LikhaInterchangeRecord[] = [];
  for (const row of loaded.rows) {
    records.push({
      ordinanceNumber: row.ordinanceNumber,
      seriesYear: row.seriesYear,
      title: row.title,
      content: row.content,
      summary: row.summary,
      subjectTags: await subjectTagsFor(row),
      status: row.status,
      sourceType: (row.sourceType || 'scan') as LikhaInterchangeRecord['sourceType'],
      fileHash: row.fileHash,
      sourceRecordId: row.id,
    });
  }

  const years = records.map((r) => r.seriesYear);
  const yearRange = years.length > 0 ? [Math.min(...years), Math.max(...years)] : [];

  // §6 — payload object literal { records } EXACTLY (§2: the §5 array is
  // omitted for LIKHA packages, so it never enters the hashed payload).
  const packageHash =
    'sha256:' + crypto.createHash('sha256').update(canonicalJson({ records })).digest('hex');

  return {
    ok: true,
    payload: {
      manifest: {
        schemaVersion: '1.0.0',
        module: 'likha',
        interchangeLevel: 'L1',
        exportedAt: now,
        exportedById: params.userId,
        source: {
          table: 'archived_ordinances',
          recordCount: records.length,
          yearRange,
        },
        exporter: {
          platform: 'esangguni-pilot',
          appVersion: readAppVersion(),
        },
      },
      records,
      packageHash,
    },
  };
}
