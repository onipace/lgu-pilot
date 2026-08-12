'use client';

// src/components/likha/archive-browser.tsx
// Sprint 3 (S3-C7) — L006 Archive Browser (DESIGN.md §2.1).
// Stats header, debounced full-text search (300ms, stale-response guard),
// year/status/subject filters, result cards with server-highlighted snippets,
// pagination, and the tookMs perf caption. Client-only: codes against the
// S3-C1 contracts (LikhaArchiveSearchResponse / LikhaStatsResponse); the
// routes live at /api/likha/archive + /api/likha/stats (S3-C6).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LIKHA_SUBJECTS,
  type LikhaArchiveListItem,
  type LikhaArchiveSearchResponse,
  type LikhaStatsResponse,
} from '@/types/likha';

const LEGAL_STATUSES = ['active', 'amended', 'repealed', 'superseded', 'expired'] as const;

const STATUS_BADGE_COLORS: Record<string, string> = {
  ACTIVE: '#22C55E',
  AMENDED: '#FACC15',
  REPEALED: '#F43F5E',
};

const MUTED = '#94A3B8';

interface DebouncedQuery {
  q: string;
  yearFrom: string;
  yearTo: string;
}

export default function ArchiveBrowser({ className }: { className?: string }) {
  // ── Stats header (silent failure hides the line) ──
  const [stats, setStats] = useState<LikhaStatsResponse | null>(null);

  // ── Search + filter state (raw inputs vs debounced fetch values) ──
  const [rawQ, setRawQ] = useState('');
  const [rawYearFrom, setRawYearFrom] = useState('');
  const [rawYearTo, setRawYearTo] = useState('');
  const [debounced, setDebounced] = useState<DebouncedQuery>({ q: '', yearFrom: '', yearTo: '' });
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);

  // ── Results state ──
  const [data, setData] = useState<LikhaArchiveSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/likha/stats')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('stats failed'))))
      .then((json: LikhaStatsResponse) => {
        if (!cancelled) setStats(json);
      })
      .catch(() => {
        if (!cancelled) setStats(null); // silent failure — hide the line
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce 300ms for the text/year inputs before fetching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({ q: rawQ, yearFrom: rawYearFrom, yearTo: rawYearTo });
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQ, rawYearFrom, rawYearTo]);

  const runFetch = useCallback(async () => {
    const requestId = ++requestIdRef.current; // stale-response guard
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const q = debounced.q.trim();
      if (q !== '') params.set('q', q);
      if (debounced.yearFrom.trim() !== '') params.set('yearFrom', debounced.yearFrom.trim());
      if (debounced.yearTo.trim() !== '') params.set('yearTo', debounced.yearTo.trim());
      if (status !== '') params.set('status', status);
      if (subject !== '') params.set('subject', subject);
      params.set('archiveStatus', 'published');
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch('/api/likha/archive?' + params.toString());
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Search failed (HTTP ${res.status})`);
      }
      const json = (await res.json()) as LikhaArchiveSearchResponse;
      if (requestId !== requestIdRef.current) return; // stale response — ignore
      setData(json);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Search failed');
      setData(null);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [debounced, status, subject, page]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  const resetFilters = () => {
    setRawQ('');
    setRawYearFrom('');
    setRawYearTo('');
    setDebounced({ q: '', yearFrom: '', yearTo: '' });
    setStatus('');
    setSubject('');
    setPage(1);
  };

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const inputClass =
    'min-h-11 rounded-lg border border-[#283147] bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]';

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats header (DESIGN.md §2.1) — hidden entirely on fetch failure */}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
          <span>
            Archived: {stats.archived} | Published: {stats.published} | Pending review:{' '}
            {stats.pendingReview} | Flagged: {stats.flagged}
          </span>
          <span>BM25 index: {stats.bm25Indexed} records</span>
        </div>
      )}

      {/* Search row */}
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
        />
        <input
          type="text"
          value={rawQ}
          onChange={(e) => {
            setRawQ(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter triggers immediately (bypasses the 300ms debounce).
              setDebounced({ q: rawQ, yearFrom: rawYearFrom, yearTo: rawYearTo });
              setPage(1);
            }
          }}
          placeholder="business permit fees"
          aria-label="Search the archive"
          className={cn(inputClass, 'w-full pl-9')}
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="likha-browser-year-from" className="mb-1 block text-xs text-[#94A3B8]">
            Year
          </label>
          <div className="flex items-center gap-2">
            <input
              id="likha-browser-year-from"
              type="number"
              value={rawYearFrom}
              onChange={(e) => {
                setRawYearFrom(e.target.value);
                setPage(1);
              }}
              placeholder="from"
              aria-label="Year from"
              className={cn(inputClass, 'w-24')}
            />
            <span className="text-xs text-[#94A3B8]">–</span>
            <input
              type="number"
              value={rawYearTo}
              onChange={(e) => {
                setRawYearTo(e.target.value);
                setPage(1);
              }}
              placeholder="to"
              aria-label="Year to"
              className={cn(inputClass, 'w-24')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="likha-browser-status" className="mb-1 block text-xs text-[#94A3B8]">
            Status
          </label>
          <select
            id="likha-browser-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={cn(inputClass, 'w-40')}
          >
            <option value="">All</option>
            {LEGAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="likha-browser-subject" className="mb-1 block text-xs text-[#94A3B8]">
            Subject
          </label>
          <select
            id="likha-browser-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPage(1);
            }}
            className={cn(inputClass, 'w-56 max-w-full')}
          >
            <option value="">All</option>
            {LIKHA_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={resetFilters}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-[#283147] px-4 text-sm text-[#94A3B8] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
        >
          <X size={14} aria-hidden="true" /> Clear
        </button>
      </div>

      {/* Results */}
      <section aria-label="Archive search results" className="space-y-3">
        {loading && <p className="text-sm text-[#94A3B8]">Searching…</p>}
        {!loading && error && (
          <p className="text-sm" style={{ color: '#F43F5E' }} role="alert">
            {error}
          </p>
        )}
        {!loading && !error && data && data.items.length === 0 && (
          <p className="text-sm text-[#94A3B8]">No ordinances match — adjust filters or search terms.</p>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white">
                RESULTS ({data.total})
              </h2>
              <span className="text-[10px] text-[#475569]">searched in {data.tookMs}ms</span>
            </div>

            <ul className="space-y-3">
              {data.items.map((item) => (
                <ResultCard key={item.id} item={item} />
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#283147] text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="text-xs text-[#94A3B8]">
                Page {data.page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#283147] text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ResultCard({ item }: { item: LikhaArchiveListItem }) {
  const badgeColor = STATUS_BADGE_COLORS[item.status.toUpperCase()] ?? MUTED;
  return (
    <li>
      <article
        tabIndex={0}
        className="space-y-2 rounded-xl border border-[#283147] bg-[#1E293B] p-4 hover:outline hover:outline-2 hover:outline-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
      >
        {/* Line 1 — number/year + legal-status badge + subject chips */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            Ordinance No. <span className="font-mono">{item.ordinanceNumber}</span>, S.{' '}
            <span className="font-mono">{item.seriesYear}</span>
          </h3>
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ borderColor: badgeColor, color: badgeColor }}
          >
            {item.status.toUpperCase()}
          </span>
          {item.subjectTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#283147] px-2 py-0.5 text-[10px] text-[#94A3B8]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Line 2 — title (serif stack per DESIGN.md §4) */}
        <p className="font-serif text-sm text-white">{item.title}</p>

        {/* Line 3 — server-escaped snippet with <mark> highlights */}
        <p
          className="text-xs text-[#94A3B8]"
          dangerouslySetInnerHTML={{ __html: item.snippet }}
        />

        {/* Line 4 — caption */}
        <p className="flex items-center gap-1 text-[10px] text-[#475569]">
          <FileText size={12} aria-hidden="true" />
          Enacted {item.createdAt.slice(0, 10)} | {item.sectionCount ?? '—'} sections
        </p>
      </article>
    </li>
  );
}
