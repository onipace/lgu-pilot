// src/lib/linaw/export.ts
// Sprint 7 (S7-C13) — N015 L1 interchange package builder for the LINAW
// module, implementing docs/INTERCHANGE-SPEC.md v1.0.0 §2–§6 as an
// INDEPENDENT implementation (separate SKU — zero shared code with any
// sibling module). Table surface: linaw_ordinances + ordinance_relationships
// ONLY. The builder is pure of logging/auth — the route owns those.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import type {
  LinawInterchangeManifest,
  LinawInterchangePackage,
  LinawInterchangeRecord,
  LinawInterchangeRelationship,
  LinawRelationshipType,
} from '@/types/linaw';

// ── Canonical JSON (INTERCHANGE-SPEC §6) ───────────────────────────────────

/**
 * Canonical JSON serialization: object keys sorted lexicographically at EVERY
 * depth, arrays preserve order, `undefined` object members dropped (JSON
 * semantics; `undefined` array elements serialize as null), no insignificant
 * whitespace, primitives via JSON.stringify. Pure — no I/O, never throws.
 */
export function linawCanonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => linawCanonicalJson(item === undefined ? null : item)).join(',') + ']';
  }
  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined && typeof record[key] !== 'function')
      .sort();
    return (
      '{' +
      keys.map((key) => JSON.stringify(key) + ':' + linawCanonicalJson(record[key])).join(',') +
      '}'
    );
  }
  return 'null';
}

// ── Eligibility + loaders ──────────────────────────────────────────────────

export type LinawExportOutcome =
  | { ok: true; payload: LinawInterchangePackage }
  | { ok: false; kind: 'ineligible'; ineligibleIds: string[]; error: string };

/** The six exportable relationship types — the 'conflict' storage marker is
 *  NOT one of them and NEVER leaves the module through a package. */
const EXPORTABLE_RELATIONSHIP_TYPES: readonly LinawRelationshipType[] = [
  'amends',
  'repeals',
  'partial_repeal',
  'supersedes',
  'extends',
  'implements',
];

interface ReadyRow {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary: string | null;
  subjectTags: string[];
  status: string;
  sourceType: string;
  fileHash: string | null;
}

/** Defensive subject_tags parse — handles both native arrays (Prisma) and JSON strings. */
function parseSubjectTagsForExport(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((tag): tag is string => typeof tag === 'string');
  }
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    return [];
  }
}

/** appVersion from package.json, '0.0.0' fallback (INTERCHANGE-SPEC §3). */
function readLinawAppVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.length > 0
      ? parsed.version
      : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function mapRecord(row: ReadyRow): LinawInterchangeRecord {
  return {
    ordinanceNumber: row.ordinanceNumber,
    seriesYear: row.seriesYear,
    title: row.title,
    content: row.content,
    summary: row.summary ?? null,
    subjectTags: row.subjectTags,
    status: row.status as LinawInterchangeRecord['status'],
    sourceType: row.sourceType as LinawInterchangeRecord['sourceType'],
    fileHash: row.fileHash ?? null,
    sourceRecordId: row.id,
  };
}

// ── Package builder (§2–§6) ────────────────────────────────────────────────

/**
 * Builds the LINAW L1 interchange package (decision D8):
 * - recordIds omitted → every ready row; [] → valid empty package; explicit
 *   ids are ALL-OR-NOTHING (any missing-or-not-ready id refuses the whole
 *   build with the ineligible list — no partials).
 * - records: §4 LINAW mapping over ready rows, ordered chronologically.
 * - relationships: confirmed-only, six-type-only (the conflict marker NEVER),
 *   BOTH endpoints within the exported records set (self-consistency under
 *   filtering), keyed by {ordinanceNumber, seriesYear} ONLY — never internal
 *   ids (§5).
 * - packageHash: 'sha256:' + SHA-256(canonicalJson({records, relationships}))
 *   — the manifest is never hashed (§6).
 */
export async function buildLinawInterchangePackage(params: {
  userId: string;
  recordIds?: string[];
  /** DI for tests; default = current time. */
  now?: () => string;
}): Promise<LinawExportOutcome> {
  const exportedAt = (params.now ?? (() => new Date().toISOString()))();

  // Records loader (eligibility layer).
  let rows: ReadyRow[] = [];
  if (params.recordIds === undefined) {
    const dbRows = await prisma.linawOrdinance.findMany({
      where: { libraryStatus: 'ready' },
      orderBy: [{ seriesYear: 'asc' }, { ordinanceNumber: 'asc' }],
    });
    rows = dbRows.map((r) => ({
      id: r.id,
      ordinanceNumber: r.ordinanceNumber,
      seriesYear: r.seriesYear,
      title: r.title,
      content: r.content,
      summary: r.summary,
      subjectTags: parseSubjectTagsForExport(r.subjectTags),
      status: r.status,
      sourceType: r.sourceType,
      fileHash: r.fileHash,
    }));
  } else if (params.recordIds.length > 0) {
    const ineligibleIds: string[] = [];
    const selected: ReadyRow[] = [];
    for (const recordId of params.recordIds) {
      const r = await prisma.linawOrdinance.findUnique({
        where: { id: recordId },
      });
      if (!r || r.libraryStatus !== 'ready') {
        ineligibleIds.push(recordId);
        continue;
      }
      selected.push({
        id: r.id,
        ordinanceNumber: r.ordinanceNumber,
        seriesYear: r.seriesYear,
        title: r.title,
        content: r.content,
        summary: r.summary,
        subjectTags: parseSubjectTagsForExport(r.subjectTags),
        status: r.status,
        sourceType: r.sourceType,
        fileHash: r.fileHash,
      });
    }
    if (ineligibleIds.length > 0) {
      return {
        ok: false,
        kind: 'ineligible',
        ineligibleIds,
        error: 'Records not eligible for export (ready only): ' + ineligibleIds.join(', '),
      };
    }
    rows = selected.sort(
      (a, b) => a.seriesYear - b.seriesYear || a.ordinanceNumber - b.ordinanceNumber
    );
  }
  // recordIds === [] → zero rows: a valid empty package.

  const records = rows.map(mapRecord);
  const exportedRecordIds = new Set(rows.map((row) => row.id));

  // Relationships (§5): confirmed rows with endpoint metadata; filtered to the
  // six exportable types AND to endpoints present in the exported records set.
  const relRows = await prisma.ordinanceRelationship.findMany({
    where: { confirmed: true },
    include: {
      source: { select: { ordinanceNumber: true, seriesYear: true } },
      target: { select: { ordinanceNumber: true, seriesYear: true } },
    },
  });

  const relationships: LinawInterchangeRelationship[] = relRows
    .filter((row) =>
      (EXPORTABLE_RELATIONSHIP_TYPES as readonly string[]).includes(row.relationshipType)
    )
    .filter(
      (row) => exportedRecordIds.has(row.sourceId) && exportedRecordIds.has(row.targetId)
    )
    .sort(
      (a, b) =>
        a.source.seriesYear - b.source.seriesYear ||
        a.source.ordinanceNumber - b.source.ordinanceNumber ||
        a.target.seriesYear - b.target.seriesYear ||
        a.target.ordinanceNumber - b.target.ordinanceNumber ||
        a.relationshipType.localeCompare(b.relationshipType)
    )
    .map((row) => ({
      sourceOrdinance: { ordinanceNumber: row.source.ordinanceNumber, seriesYear: row.source.seriesYear },
      targetOrdinance: { ordinanceNumber: row.target.ordinanceNumber, seriesYear: row.target.seriesYear },
      type: row.relationshipType as LinawRelationshipType,
      sectionRef: row.sectionRef ?? null,
      confidence: row.confidence,
      confirmedById: row.confirmedById ?? '',
    }));

  // Manifest (§3).
  const years = records.map((r) => r.seriesYear);
  const manifest: LinawInterchangeManifest = {
    schemaVersion: '1.0.0',
    module: 'linaw',
    interchangeLevel: 'L1',
    exportedAt,
    exportedById: params.userId,
    source: {
      table: 'linaw_ordinances',
      recordCount: records.length,
      yearRange: records.length > 0 ? [Math.min(...years), Math.max(...years)] : [],
    },
    exporter: {
      platform: 'esangguni-pilot',
      appVersion: readLinawAppVersion(),
    },
  };

  // Hash (§6): the payload literal is EXACTLY { records, relationships } —
  // relationships ALWAYS present for LINAW; the manifest is never hashed.
  const packageHash =
    'sha256:' +
    crypto
      .createHash('sha256')
      .update(linawCanonicalJson({ records, relationships }))
      .digest('hex');

  return { ok: true, payload: { manifest, records, relationships, packageHash } };
}
