// src/lib/likha/search.ts
// Sprint 3 (S3-C5) — LIKHA-owned BM25 namespace (decision D13).
// Exclusively manages src/lib/data/likha-search-index.json: a gitignored
// RUNTIME artifact mirroring the sibling shape
// { documents, idf, avgDocLength, totalDocs } (see src/lib/data/search-index.json).
// Lazily loads the index into memory on first use; rebuildIndex() recreates it
// from archive_status='published' rows. Tests ALWAYS inject a temp index path —
// the dev index is never touched by tests. LightRAG stays unwired this sprint
// (decision D14): BM25 is the authoritative search path.

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import type { LikhaArchiveListItem } from '@/types/likha';

// ── Index shapes (sibling-pattern namespace) ──────────────────────────────

/** One indexed document. Content is kept for snippet extraction (pilot scale). */
export interface LikhaIndexDoc {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: string;
  subjectTags: string[];
  sectionCount: number | null;
  createdAt: string;
  /** Full token bag (content + title, duplicates kept for term frequency). */
  terms: string[];
  /** Title token bag — weighted x2 at scoring time. */
  titleTerms: string[];
  content: string;
}

interface LikhaIndexFile {
  documents: LikhaIndexDoc[];
  idf: Record<string, number>;
  avgDocLength: number;
  totalDocs: number;
}

/** Record shape accepted by indexRecord (server code maps DB rows to this). */
export interface LikhaIndexableRecord {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  status: string;
  subjectTags: string[];
  sectionCount?: number | null;
  createdAt?: string;
}

/** Search hit — callers add archiveStatus (the index holds published docs only). */
export type LikhaSearchHit = Omit<LikhaArchiveListItem, 'archiveStatus'>;

export interface LikhaSearchFilters {
  yearFrom?: number;
  yearTo?: number;
  status?: string;
  subject?: string;
  page?: number;
  limit?: number;
}

export interface LikhaSearchResult {
  items: LikhaSearchHit[];
  total: number;
  page: number;
  limit: number;
}

export interface LikhaSearchOptions {
  indexPath: string;
}

export interface LikhaSearch {
  indexRecord(rec: LikhaIndexableRecord): void;
  removeRecord(id: string): void;
  search(q: string, filters: LikhaSearchFilters): LikhaSearchResult;
  rebuildIndex(): Promise<void>;
  stats(): { totalDocs: number };
}

// ── Pure helpers ───────────────────────────────────────────────────────────

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const SNIPPET_MAX_LENGTH = 280;

/** Tokenizer: lowercase, strip non-alphanumerics (keep digits), drop <2 chars. */
export function tokenizeLikhaText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/** HTML-escape — applied BEFORE marking (escape-then-mark rule). */
export function escapeLikhaHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termFrequency(bag: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of bag) {
    tf.set(term, (tf.get(term) ?? 0) + 1);
  }
  return tf;
}

/** Document length used for BM25 normalization (title terms count twice). */
function documentLength(doc: LikhaIndexDoc): number {
  return doc.terms.length + doc.titleTerms.length;
}

/**
 * Pure BM25 scorer (k1 = 1.2, b = 0.75). `terms` is the scoring bag — callers
 * pass content+title terms with the title terms included a second time so the
 * title carries the x2 weight (decision D13).
 */
export function scoreDocument(
  terms: string[],
  queryTerms: string[],
  idf: Record<string, number>,
  avgDocLength: number
): number {
  if (terms.length === 0 || queryTerms.length === 0) return 0;
  const tf = termFrequency(terms);
  const dl = terms.length;
  const avgdl = avgDocLength > 0 ? avgDocLength : 1;

  let score = 0;
  for (const term of queryTerms) {
    const freq = tf.get(term);
    if (!freq) continue;
    const termIdf = idf[term] ?? 0;
    if (termIdf <= 0) continue;
    score +=
      (termIdf * (freq * (BM25_K1 + 1))) /
      (freq + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgdl));
  }
  return score;
}

/** Case-insensitive occurrence scan (returns start indices). */
function findOccurrences(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  if (!needle) return positions;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let from = 0;
  while (from <= lowerHay.length - lowerNeedle.length) {
    const idx = lowerHay.indexOf(lowerNeedle, from);
    if (idx === -1) break;
    positions.push(idx);
    from = idx + Math.max(1, lowerNeedle.length);
  }
  return positions;
}

/**
 * Snippet builder — best ~220-char content window around the densest
 * query-term cluster; the window is HTML-escaped FIRST, then every matched
 * query-term occurrence is wrapped in <mark>. Output bounded to 280 chars.
 */
export function buildLikhaSnippet(
  content: string,
  query: string,
  maxLength: number = SNIPPET_MAX_LENGTH
): string {
  const text = content ?? '';
  const queryTerms = tokenizeLikhaText(query);
  if (queryTerms.length === 0) {
    return escapeLikhaHtml(text.slice(0, 200));
  }

  // Candidate window starts: one per query-term occurrence.
  const positions: number[] = [];
  for (const term of queryTerms) {
    positions.push(...findOccurrences(text, term));
  }

  let start = 0;
  const windowLength = 220;
  if (positions.length > 0) {
    positions.sort((a, b) => a - b);
    let bestStart = positions[0];
    let bestCount = 0;
    for (const pos of positions) {
      const count = positions.filter((p) => p >= pos && p <= pos + windowLength).length;
      if (count > bestCount) {
        bestCount = count;
        bestStart = pos;
      }
    }
    start = Math.max(0, bestStart - 40);
  }

  // Marking: full phrase alternative first, then individual query terms.
  const alternatives = [query.trim(), ...queryTerms]
    .filter((alt) => alt.length >= 2)
    .map(escapeRegExp);
  const marker =
    alternatives.length > 0 ? new RegExp('(' + alternatives.join('|') + ')', 'gi') : null;

  // Shrink the window until the escaped+marked output fits the bound.
  let length = Math.min(windowLength, Math.max(0, text.length - start));
  while (length > 0) {
    let window = text.slice(start, start + length);
    // Snap to word edges when we are mid-content (cosmetic, keeps words whole).
    if (start > 0) {
      const spaceIdx = window.indexOf(' ');
      if (spaceIdx !== -1 && spaceIdx < 30) window = window.slice(spaceIdx + 1);
    }
    if (start + length < text.length) {
      const spaceIdx = window.lastIndexOf(' ');
      if (spaceIdx > window.length - 30 && spaceIdx !== -1) window = window.slice(0, spaceIdx);
    }
    let marked = escapeLikhaHtml(window);
    if (marker) marked = marked.replace(marker, '<mark>$1</mark>');
    if (marked.length <= maxLength) return marked;
    length -= 30;
  }
  return '';
}

// ── Index file I/O + statistics ────────────────────────────────────────────

function emptyIndex(): LikhaIndexFile {
  return { documents: [], idf: {}, avgDocLength: 0, totalDocs: 0 };
}

/** Standard BM25 idf: ln((N - df + 0.5) / (df + 0.5) + 1). */
function recomputeStatistics(index: LikhaIndexFile): void {
  const totalDocs = index.documents.length;
  const df = new Map<string, number>();
  let lengthSum = 0;
  for (const doc of index.documents) {
    lengthSum += documentLength(doc);
    const unique = new Set<string>([...doc.terms, ...doc.titleTerms]);
    for (const term of unique) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf: Record<string, number> = {};
  for (const [term, freq] of df) {
    idf[term] = Math.log((totalDocs - freq + 0.5) / (freq + 0.5) + 1);
  }
  index.idf = idf;
  index.avgDocLength = totalDocs > 0 ? lengthSum / totalDocs : 0;
  index.totalDocs = totalDocs;
}

function atomicWrite(indexPath: string, index: LikhaIndexFile): void {
  const dir = path.dirname(indexPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = indexPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(index), 'utf8');
  fs.renameSync(tmpPath, indexPath);
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Creates an isolated LIKHA search namespace bound to `indexPath`.
 * The index file loads lazily on first use; a missing file starts empty.
 */
export function createLikhaSearch(opts: LikhaSearchOptions): LikhaSearch {
  let state: LikhaIndexFile | null = null;

  function load(): LikhaIndexFile {
    if (state) return state;
    try {
      const raw = fs.readFileSync(opts.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LikhaIndexFile>;
      state = {
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        idf: parsed.idf && typeof parsed.idf === 'object' ? parsed.idf : {},
        avgDocLength: typeof parsed.avgDocLength === 'number' ? parsed.avgDocLength : 0,
        totalDocs: typeof parsed.totalDocs === 'number' ? parsed.totalDocs : 0,
      };
    } catch {
      state = emptyIndex();
    }
    return state;
  }

  function upsert(rec: LikhaIndexableRecord): void {
    const index = load();
    const titleTerms = tokenizeLikhaText(rec.title);
    const doc: LikhaIndexDoc = {
      id: rec.id,
      ordinanceNumber: rec.ordinanceNumber,
      seriesYear: rec.seriesYear,
      title: rec.title,
      status: rec.status,
      subjectTags: Array.isArray(rec.subjectTags) ? rec.subjectTags : [],
      sectionCount: rec.sectionCount ?? null,
      createdAt: rec.createdAt ?? '',
      terms: [...tokenizeLikhaText(rec.content), ...titleTerms],
      titleTerms,
      content: rec.content,
    };
    const existing = index.documents.findIndex((d) => d.id === rec.id);
    if (existing >= 0) {
      index.documents[existing] = doc; // update semantics — never duplicate
    } else {
      index.documents.push(doc);
    }
  }

  function persist(): void {
    const index = load();
    recomputeStatistics(index);
    atomicWrite(opts.indexPath, index);
  }

  return {
    indexRecord(rec: LikhaIndexableRecord): void {
      upsert(rec);
      persist();
    },

    removeRecord(id: string): void {
      const index = load();
      const before = index.documents.length;
      index.documents = index.documents.filter((d) => d.id !== id);
      if (index.documents.length !== before) persist();
    },

    search(q: string, filters: LikhaSearchFilters): LikhaSearchResult {
      const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
      const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit ?? 20) || 20));
      const queryTerms = tokenizeLikhaText(q ?? '');
      if (queryTerms.length === 0) {
        return { items: [], total: 0, page, limit };
      }

      const index = load();
      const scored: Array<{ doc: LikhaIndexDoc; score: number }> = [];
      for (const doc of index.documents) {
        // Metadata filters first (year / legal status / subject).
        if (filters.yearFrom !== undefined && doc.seriesYear < filters.yearFrom) continue;
        if (filters.yearTo !== undefined && doc.seriesYear > filters.yearTo) continue;
        if (filters.status !== undefined && doc.status !== filters.status) continue;
        if (filters.subject !== undefined && !doc.subjectTags.includes(filters.subject)) continue;

        const score = scoreDocument(
          [...doc.terms, ...doc.titleTerms],
          queryTerms,
          index.idf,
          index.avgDocLength
        );
        if (score > 0) scored.push({ doc, score });
      }

      scored.sort(
        (a, b) =>
          b.score - a.score ||
          b.doc.seriesYear - a.doc.seriesYear ||
          b.doc.ordinanceNumber - a.doc.ordinanceNumber
      );

      const total = scored.length;
      const pageItems = scored.slice((page - 1) * limit, page * limit);
      return {
        items: pageItems.map(({ doc, score }) => ({
          id: doc.id,
          ordinanceNumber: doc.ordinanceNumber,
          seriesYear: doc.seriesYear,
          title: doc.title,
          status: doc.status as LikhaSearchHit['status'],
          subjectTags: doc.subjectTags,
          sectionCount: doc.sectionCount,
          createdAt: doc.createdAt,
          snippet: buildLikhaSnippet(doc.content, q),
          score,
        })),
        total,
        page,
        limit,
      };
    },

    /** Clears the index and reindexes every archive_status='published' row. */
    async rebuildIndex(): Promise<void> {
      const rows = await prisma.archivedOrdinance.findMany({
        where: { archiveStatus: 'published' },
        select: {
          id: true,
          ordinanceNumber: true,
          seriesYear: true,
          title: true,
          content: true,
          status: true,
          subjectTags: true,
          sectionCount: true,
          createdAt: true,
        },
      });

      state = emptyIndex();
      for (const row of rows) {
        const subjectTags = Array.isArray(row.subjectTags)
          ? (row.subjectTags as string[]).filter((s): s is string => typeof s === 'string')
          : [];
        upsert({
          id: row.id,
          ordinanceNumber: row.ordinanceNumber,
          seriesYear: row.seriesYear,
          title: row.title,
          content: row.content,
          status: row.status,
          subjectTags,
          sectionCount: row.sectionCount,
          createdAt: row.createdAt.toISOString(),
        });
      }
      persist();
    },

    stats(): { totalDocs: number } {
      return { totalDocs: load().totalDocs };
    },
  };
}

// ── Default singleton (decision D13) ───────────────────────────────────────

/** Index path resolves lazily so tests can set LIKHA_SEARCH_INDEX_PATH anytime. */
function defaultIndexPath(): string {
  return (
    process.env.LIKHA_SEARCH_INDEX_PATH ||
    path.join(process.cwd(), 'src', 'lib', 'data', 'likha-search-index.json')
  );
}

let singleton: LikhaSearch | null = null;
function bound(): LikhaSearch {
  if (!singleton) {
    singleton = createLikhaSearch({ indexPath: defaultIndexPath() });
  }
  return singleton;
}

/**
 * The LIKHA BM25 namespace singleton used by the Archiver + archive routes.
 * Reads process.env.LIKHA_SEARCH_INDEX_PATH lazily; default is the gitignored
 * runtime file src/lib/data/likha-search-index.json.
 */
export const likhaSearch: LikhaSearch = {
  indexRecord: (rec) => bound().indexRecord(rec),
  removeRecord: (id) => bound().removeRecord(id),
  search: (q, filters) => bound().search(q, filters),
  rebuildIndex: () => bound().rebuildIndex(),
  stats: () => bound().stats(),
};
