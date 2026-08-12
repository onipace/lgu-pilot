// src/lib/linaw/search.ts
// Sprint 6 (S6-C4) — LINAW-owned BM25 library namespace (deferred from
// Sprint 5 per its decision D5; decision D2 this sprint).
// Exclusively manages src/lib/data/linaw-search-index.json: a gitignored
// RUNTIME artifact shaped { documents, idf, avgDocLength, totalDocs }.
// Lazily loads the index into memory on first use; rebuildIndex() recreates
// it from library_status='ready' rows ONLY (boundary rule 4). Tests ALWAYS
// inject a temp index path — the dev index is never touched by tests.
// Mirrors the ARCHITECTURE of the sibling module's proven namespace but is an
// INDEPENDENT implementation: ZERO shared code, ZERO imports from it.
// The library list route keeps SQL LIKE this sprint (decision D2): the index
// is ready-only by law while the verification queue must also search
// pending_review rows. The namespace ships tested + idle for route consumers.

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

// ── Index shapes ───────────────────────────────────────────────────────────

/** One indexed document. Content is kept for snippet extraction (pilot scale). */
export interface LinawIndexDoc {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: string;
  subjectTags: string[];
  libraryStatus: string;
  createdAt: string;
  /** Full token bag (content + title, duplicates kept for term frequency). */
  terms: string[];
  /** Title token bag — weighted x2 at scoring time. */
  titleTerms: string[];
  content: string;
}

interface LinawIndexFile {
  documents: LinawIndexDoc[];
  idf: Record<string, number>;
  avgDocLength: number;
  totalDocs: number;
}

/** Record shape accepted by indexRecord (server code maps DB rows to this). */
export interface LinawIndexableRecord {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  status: string;
  subjectTags: string[];
  libraryStatus?: string;
  createdAt?: string;
}

/** Search hit (items of LinawSearchResult). */
export interface LinawSearchHit {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: string;
  subjectTags: string[];
  createdAt: string;
  snippet: string;
  score: number;
}

export interface LinawSearchFilters {
  yearFrom?: number;
  yearTo?: number;
  status?: string;
  subject?: string;
  page?: number;
  limit?: number;
}

export interface LinawSearchResult {
  items: LinawSearchHit[];
  total: number;
  page: number;
  limit: number;
}

export interface LinawSearchOptions {
  indexPath: string;
}

export interface LinawSearch {
  indexRecord(rec: LinawIndexableRecord): void;
  removeRecord(id: string): void;
  search(q: string, filters?: LinawSearchFilters): LinawSearchResult;
  rebuildIndex(): Promise<void>;
  stats(): { totalDocs: number };
}

// ── Pure helpers (linaw-prefixed — LINAW's own tokenizer/escaper/snippet) ──

const LINAW_BM25_K1 = 1.2;
const LINAW_BM25_B = 0.75;
const LINAW_SNIPPET_MAX_LENGTH = 280;

/** Tokenizer: lowercase, strip non-alphanumerics (keep digits), drop <2 chars. */
export function tokenizeLinawText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/** HTML-escape — applied BEFORE marking (escape-then-mark rule). */
export function escapeLinawHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linawEscapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function linawTermFrequency(bag: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of bag) {
    tf.set(term, (tf.get(term) ?? 0) + 1);
  }
  return tf;
}

/**
 * Pure BM25 scorer (k1 = 1.2, b = 0.75). `terms` is the scoring bag — callers
 * pass content+title terms with the title terms included a second time so the
 * title carries the x2 weight.
 */
export function scoreLinawDocument(
  terms: string[],
  queryTerms: string[],
  idf: Record<string, number>,
  avgDocLength: number
): number {
  if (terms.length === 0 || queryTerms.length === 0) return 0;
  const tf = linawTermFrequency(terms);
  const dl = terms.length;
  const avgdl = avgDocLength > 0 ? avgDocLength : 1;

  let score = 0;
  for (const term of queryTerms) {
    const freq = tf.get(term);
    if (!freq) continue;
    const termIdf = idf[term] ?? 0;
    if (termIdf <= 0) continue;
    score +=
      (termIdf * (freq * (LINAW_BM25_K1 + 1))) /
      (freq + LINAW_BM25_K1 * (1 - LINAW_BM25_B + (LINAW_BM25_B * dl) / avgdl));
  }
  return score;
}

/** Case-insensitive occurrence scan (returns start indices). */
function linawFindOccurrences(haystack: string, needle: string): number[] {
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
export function buildLinawSnippet(
  content: string,
  query: string,
  maxLength: number = LINAW_SNIPPET_MAX_LENGTH
): string {
  const text = content ?? '';
  const queryTerms = tokenizeLinawText(query);
  if (queryTerms.length === 0) {
    return escapeLinawHtml(text.slice(0, 200));
  }

  const positions: number[] = [];
  for (const term of queryTerms) {
    positions.push(...linawFindOccurrences(text, term));
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

  const alternatives = [query.trim(), ...queryTerms]
    .filter((alt) => alt.length >= 2)
    .map(linawEscapeRegExp);
  const marker =
    alternatives.length > 0 ? new RegExp('(' + alternatives.join('|') + ')', 'gi') : null;

  let length = Math.min(windowLength, Math.max(0, text.length - start));
  while (length > 0) {
    let window = text.slice(start, start + length);
    if (start > 0) {
      const spaceIdx = window.indexOf(' ');
      if (spaceIdx !== -1 && spaceIdx < 30) window = window.slice(spaceIdx + 1);
    }
    if (start + length < text.length) {
      const spaceIdx = window.lastIndexOf(' ');
      if (spaceIdx > window.length - 30 && spaceIdx !== -1) window = window.slice(0, spaceIdx);
    }
    let marked = escapeLinawHtml(window);
    if (marker) marked = marked.replace(marker, '<mark>$1</mark>');
    if (marked.length <= maxLength) return marked;
    length -= 30;
  }
  return '';
}

// ── Index file I/O + statistics ────────────────────────────────────────────

function linawEmptyIndex(): LinawIndexFile {
  return { documents: [], idf: {}, avgDocLength: 0, totalDocs: 0 };
}

/** Standard BM25 idf: ln((N - df + 0.5) / (df + 0.5) + 1). */
function linawRecomputeStatistics(index: LinawIndexFile): void {
  const totalDocs = index.documents.length;
  const df = new Map<string, number>();
  let lengthSum = 0;
  for (const doc of index.documents) {
    lengthSum += doc.terms.length + doc.titleTerms.length;
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

function linawAtomicWrite(indexPath: string, index: LinawIndexFile): void {
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
 * Creates an isolated LINAW search namespace bound to `indexPath`.
 * The index file loads lazily on first use; a missing/corrupt file starts
 * empty (never throws).
 */
export function createLinawSearch(opts: LinawSearchOptions): LinawSearch {
  let state: LinawIndexFile | null = null;

  function load(): LinawIndexFile {
    if (state) return state;
    try {
      const raw = fs.readFileSync(opts.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LinawIndexFile>;
      state = {
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        idf: parsed.idf && typeof parsed.idf === 'object' ? parsed.idf : {},
        avgDocLength: typeof parsed.avgDocLength === 'number' ? parsed.avgDocLength : 0,
        totalDocs: typeof parsed.totalDocs === 'number' ? parsed.totalDocs : 0,
      };
    } catch {
      state = linawEmptyIndex();
    }
    return state;
  }

  function upsert(rec: LinawIndexableRecord): void {
    const index = load();
    const titleTerms = tokenizeLinawText(rec.title);
    const doc: LinawIndexDoc = {
      id: rec.id,
      ordinanceNumber: rec.ordinanceNumber,
      seriesYear: rec.seriesYear,
      title: rec.title,
      status: rec.status,
      subjectTags: Array.isArray(rec.subjectTags) ? rec.subjectTags : [],
      libraryStatus: rec.libraryStatus ?? 'ready',
      createdAt: rec.createdAt ?? '',
      terms: [...tokenizeLinawText(rec.content), ...titleTerms],
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
    linawRecomputeStatistics(index);
    linawAtomicWrite(opts.indexPath, index);
  }

  return {
    indexRecord(rec: LinawIndexableRecord): void {
      upsert(rec);
      persist();
    },

    removeRecord(id: string): void {
      const index = load();
      const before = index.documents.length;
      index.documents = index.documents.filter((d) => d.id !== id);
      if (index.documents.length !== before) persist();
    },

    search(q: string, filters: LinawSearchFilters = {}): LinawSearchResult {
      const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
      const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit ?? 20) || 20));
      const queryTerms = tokenizeLinawText(q ?? '');
      if (queryTerms.length === 0) {
        return { items: [], total: 0, page, limit };
      }

      const index = load();
      const scored: Array<{ doc: LinawIndexDoc; score: number }> = [];
      for (const doc of index.documents) {
        // Metadata filters first (year / legal status / subject).
        if (filters.yearFrom !== undefined && doc.seriesYear < filters.yearFrom) continue;
        if (filters.yearTo !== undefined && doc.seriesYear > filters.yearTo) continue;
        if (filters.status !== undefined && doc.status !== filters.status) continue;
        if (filters.subject !== undefined && !doc.subjectTags.includes(filters.subject)) continue;

        const score = scoreLinawDocument(
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
          status: doc.status,
          subjectTags: doc.subjectTags,
          createdAt: doc.createdAt,
          snippet: buildLinawSnippet(doc.content, q),
          score,
        })),
        total,
        page,
        limit,
      };
    },

    /** Clears the index and reindexes every library_status='ready' row. */
    async rebuildIndex(): Promise<void> {
      const rows = await prisma.linawOrdinance.findMany({
        where: { libraryStatus: 'ready' },
        select: {
          id: true,
          ordinanceNumber: true,
          seriesYear: true,
          title: true,
          content: true,
          status: true,
          subjectTags: true,
          libraryStatus: true,
          createdAt: true,
        },
      });

      state = linawEmptyIndex();
      for (const row of rows) {
        const subjectTags = Array.isArray(row.subjectTags)
          ? (row.subjectTags as unknown[]).filter((s): s is string => typeof s === 'string')
          : [];
        upsert({
          id: row.id,
          ordinanceNumber: row.ordinanceNumber,
          seriesYear: row.seriesYear,
          title: row.title,
          content: row.content,
          status: row.status,
          subjectTags,
          libraryStatus: row.libraryStatus,
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

// ── Default singleton (decision D2) ────────────────────────────────────────

/** Index path resolves lazily so tests can set LINAW_SEARCH_INDEX_PATH anytime. */
function linawDefaultIndexPath(): string {
  return (
    process.env.LINAW_SEARCH_INDEX_PATH ||
    path.join(process.cwd(), 'src', 'lib', 'data', 'linaw-search-index.json')
  );
}

let linawSingleton: LinawSearch | null = null;
function linawBound(): LinawSearch {
  if (!linawSingleton) {
    linawSingleton = createLinawSearch({ indexPath: linawDefaultIndexPath() });
  }
  return linawSingleton;
}

/**
 * The LINAW BM25 namespace singleton. Reads process.env.LINAW_SEARCH_INDEX_PATH
 * lazily; default is the gitignored runtime file
 * src/lib/data/linaw-search-index.json. Shipped tested + idle this sprint —
 * the library list route keeps SQL LIKE (decision D2).
 */
export const linawSearch: LinawSearch = {
  indexRecord: (rec) => linawBound().indexRecord(rec),
  removeRecord: (id) => linawBound().removeRecord(id),
  search: (q, filters) => linawBound().search(q, filters),
  rebuildIndex: () => linawBound().rebuildIndex(),
  stats: () => linawBound().stats(),
};
