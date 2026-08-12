// src/lib/linaw/import-parser.ts
// Sprint 5 (S5-C3) — N013 bulk-import parsing library for LINAW's own library.
// Pure functions: NO DB access, NO network, zero I/O beyond the zlib inflate
// used by the dependency-free DOCX fallback (decision D1).
//
// DOCX limitations (decision D1): only plain text runs survive (tables and
// text boxes flatten to runs), data-descriptor zips are rejected, and records
// inside the document must be JSON- or CSV-shaped text.

import { inflateRawSync } from 'node:zlib';
import type { ParsedImportRecord } from '@/types/linaw';

/** Maximum records per import batch — enforced by the route, exported for it. */
export const MAX_IMPORT_RECORDS = 500;

/** Raised when a DOCX buffer cannot be parsed by the raw-text fallback. */
export class DocxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxParseError';
  }
}

const PK_LOCAL_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const DOC_XML_ENTRY = 'word/document.xml';

/**
 * Dependency-free raw DOCX text extraction (decision D1). Scans ZIP local
 * file headers (`PK\x03\x04`), locates `word/document.xml`, inflates it with
 * zlib (method 8) or copies it (method 0), then strips the XML down to text.
 */
export function extractDocxText(buffer: Buffer): string {
  let pos = 0;
  while (pos + 30 <= buffer.length) {
    const idx = buffer.indexOf(PK_LOCAL_SIG, pos);
    if (idx === -1 || idx + 30 > buffer.length) break;

    const flags = buffer.readUInt16LE(idx + 6);
    const method = buffer.readUInt16LE(idx + 8);
    const compressedSize = buffer.readUInt32LE(idx + 18);
    const nameLen = buffer.readUInt16LE(idx + 26);
    const extraLen = buffer.readUInt16LE(idx + 28);
    const nameStart = idx + 30;
    if (nameStart + nameLen > buffer.length) break;
    const filename = buffer.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;

    if (filename === DOC_XML_ENTRY) {
      if ((flags & 0x08) !== 0) {
        throw new DocxParseError('unsupported DOCX: data-descriptor zip entries');
      }
      let xml: string;
      if (method === 0) {
        xml = buffer.toString('utf8', dataStart, dataStart + compressedSize);
      } else if (method === 8) {
        let compressed: Buffer;
        if (compressedSize > 0) {
          compressed = buffer.subarray(dataStart, dataStart + compressedSize);
        } else {
          // Size missing — slice up to the next PK signature before inflating.
          const next = buffer.indexOf(PK_LOCAL_SIG, dataStart);
          compressed =
            next === -1
              ? buffer.subarray(dataStart)
              : buffer.subarray(dataStart, next);
        }
        xml = inflateRawSync(compressed).toString('utf8');
      } else {
        throw new DocxParseError('unsupported DOCX: compression method ' + method);
      }
      return docxXmlToText(xml);
    }

    // Skip past this entry when its size is known; otherwise keep scanning.
    pos = (flags & 0x08) === 0 && compressedSize > 0 ? dataStart + compressedSize : idx + 4;
  }
  throw new DocxParseError('not a DOCX: word/document.xml missing');
}

/** word/document.xml → plain text: paragraph/break/tab mapping, tag strip, entity decode. */
function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<w:tab\s*\/>/g, '\t');
  const noTags = withBreaks.replace(/<[^>]*>/g, '');
  const decoded = noTags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  return decoded
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .join('\n');
}

// ── Per-record validation ──

/** CSV header (lowercased) → canonical camelCase key used by normalizeImportRecord. */
const CANONICAL_HEADER_KEYS: Record<string, string> = {
  ordinancenumber: 'ordinanceNumber',
  ordinance_number: 'ordinanceNumber',
  seriesyear: 'seriesYear',
  series_year: 'seriesYear',
  title: 'title',
  content: 'content',
  subjecttags: 'subjectTags',
  subject_tags: 'subjectTags',
};

const MAX_TAGS = 20;
const MAX_TAG_CHARS = 60;

function normalizeTags(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(';')
      : [];
  return list
    .map((entry) => String(entry).trim())
    .filter((entry) => entry !== '')
    .slice(0, MAX_TAGS)
    .map((entry) => entry.slice(0, MAX_TAG_CHARS));
}

/**
 * Validates one raw import row (camelCase OR snake_case keys) into a
 * ParsedImportRecord. Error messages carry the caller's 0-based index.
 */
export function normalizeImportRecord(
  raw: unknown,
  index: number
): { ok: true; record: ParsedImportRecord } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `record ${index}: title must be a non-empty string` };
  }
  const obj = raw as Record<string, unknown>;
  const pick = (camel: string, snake: string): unknown =>
    obj[camel] !== undefined ? obj[camel] : obj[snake];

  const ordinanceNumber = Number(pick('ordinanceNumber', 'ordinance_number'));
  if (!Number.isInteger(ordinanceNumber) || ordinanceNumber <= 0) {
    return { ok: false, error: `record ${index}: ordinanceNumber must be a positive integer` };
  }
  const seriesYear = Number(pick('seriesYear', 'series_year'));
  if (!Number.isInteger(seriesYear) || seriesYear <= 0) {
    return { ok: false, error: `record ${index}: seriesYear must be a positive integer` };
  }
  const titleRaw = pick('title', 'title');
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
  if (title === '') {
    return { ok: false, error: `record ${index}: title must be a non-empty string` };
  }
  const contentRaw = pick('content', 'content');
  const content = typeof contentRaw === 'string' ? contentRaw.trim() : '';
  if (content === '') {
    return { ok: false, error: `record ${index}: content must be a non-empty string` };
  }

  return {
    ok: true,
    record: {
      ordinanceNumber,
      seriesYear,
      title,
      content,
      subjectTags: normalizeTags(pick('subjectTags', 'subject_tags')),
    },
  };
}

// ── CSV (minimal RFC-4180-style) ──

/**
 * Minimal RFC-4180-style CSV parser: first non-empty line is the header;
 * double-quoted fields may contain commas, `""` escapes, and embedded
 * newlines (CRLF preserved inside quotes); unquoted fields are trimmed;
 * blank lines are skipped; rows with fewer fields than the header get ''
 * for the missing columns and extra fields are dropped.
 */
export function parseCsvRows(text: string): Record<string, string>[] {
  const grid: string[][] = [];
  const quotedGrid: boolean[][] = [];
  let row: string[] = [];
  let rowQuoted: boolean[] = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    rowQuoted.push(quoted);
    field = '';
    quoted = false;
  };
  const pushRow = () => {
    pushField();
    grid.push(row);
    quotedGrid.push(rowQuoted);
    row = [];
    rowQuoted = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      quoted = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') continue; // CRLF outside quotes → single newline
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  const keepIndexes: number[] = [];
  grid.forEach((r, i) => {
    if (!(r.length === 1 && r[0].trim() === '')) keepIndexes.push(i);
  });
  if (keepIndexes.length === 0) return [];

  const header = grid[keepIndexes[0]].map((h) => h.trim());
  return keepIndexes.slice(1).map((idx) => {
    const r = grid[idx];
    const q = quotedGrid[idx];
    const obj: Record<string, string> = {};
    header.forEach((name, i) => {
      const raw = i < r.length ? r[i] : '';
      obj[name] = q[i] ? raw : raw.trim();
    });
    return obj;
  });
}

// ── Payload entry point ──

/**
 * Parses a full import payload. `docxBuffer` runs through extractDocxText
 * first (decision D1); the resulting text is then format-detected: trimmed
 * text starting with `{` or `[` is JSON (bare array or `{records: [...]}`),
 * anything else is CSV (headers matched case-insensitively).
 */
export function parseImportPayload(input: {
  text?: string;
  docxBuffer?: Buffer;
}): { records: ParsedImportRecord[]; invalidRecords: Array<{ index: number; error: string }> } {
  let text = input.text ?? '';
  if (input.docxBuffer) {
    text = extractDocxText(input.docxBuffer);
  }
  const trimmed = text.trim();
  if (trimmed === '') return { records: [], invalidRecords: [] };

  let rows: unknown[];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON import payload');
    }
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { records?: unknown }).records)
    ) {
      rows = (parsed as { records: unknown[] }).records;
    } else {
      throw new Error('Invalid JSON import payload');
    }
  } else {
    rows = parseCsvRows(text).map((csvRow) => {
      const mapped: Record<string, unknown> = {};
      for (const [header, value] of Object.entries(csvRow)) {
        const canonical = CANONICAL_HEADER_KEYS[header.toLowerCase()];
        if (canonical) mapped[canonical] = value;
      }
      return mapped;
    });
  }

  const records: ParsedImportRecord[] = [];
  const invalidRecords: Array<{ index: number; error: string }> = [];
  rows.forEach((row, index) => {
    const result = normalizeImportRecord(row, index);
    if (result.ok) {
      records.push(result.record);
    } else {
      invalidRecords.push({ index, error: result.error });
    }
  });
  return { records, invalidRecords };
}
