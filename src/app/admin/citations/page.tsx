'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import {
  FileCheck, RefreshCw, ChevronRight, ChevronDown, Brain, Save,
  AlertTriangle, Eye, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface LLMCitation {
  id: string;
  doc_type: string;
  section_number: string | null;
  raw_citation: string;
  title: string | null;
  source_query: string | null;
  module: string;
  relevance_rating: string;
  status: string;
  session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  occurrence_count: number;
  distinct_query_count: number;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface Stats {
  total: number;
  pending: number;
  reviewing: number;
  verified: number;
  added_to_kb: number;
  rejected: number;
  high_pending: number;
  medium_pending: number;
  low_pending: number;
}

interface CitationOccurrence {
  id: string;
  source_query: string;
  response_text: string | null;
  module: string;
  relevance_rating: string;
  session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Config ─────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  { value: 'reviewing', label: 'Reviewing', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'verified', label: 'Verified', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  { value: 'added_to_kb', label: 'Added to KB', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
  { value: 'rejected', label: 'Rejected', cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
];

const RELEVANCE_CONFIG: Record<string, { label: string; dots: number; dotClass: string; textClass: string }> = {
  high: { label: 'High', dots: 3, dotClass: 'bg-amber-400', textClass: 'text-amber-400' },
  medium: { label: 'Medium', dots: 2, dotClass: 'bg-orange-400', textClass: 'text-orange-400' },
  low: { label: 'Low', dots: 1, dotClass: 'bg-red-400', textClass: 'text-red-400' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  jurisprudence: 'SC Case',
  dilg_opinion: 'DILG Op.',
  ordinance: 'Ordinance',
  ra7160: 'R.A. 7160',
  irr: 'IRR',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Main Component ────────────────────────────────────────

export default function CitationsAdminPage() {
  const [citations, setCitations] = useState<LLMCitation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState({ status: '', doc_type: '', relevance_rating: '' });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [sortBy, setSortBy] = useState('last_seen');
  const [occurrences, setOccurrences] = useState<Record<string, CitationOccurrence[]>>({});
  const [responseModalOcc, setResponseModalOcc] = useState<CitationOccurrence | null>(null);

  const fetchCitations = useCallback(async () => {
    setError(false);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.doc_type) params.set('doc_type', filters.doc_type);
    if (filters.relevance_rating) params.set('relevance_rating', filters.relevance_rating);
    params.set('sort', sortBy);
    params.set('page', String(page));
    params.set('limit', '25');

    try {
      const res = await fetch(`/api/admin/citations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCitations(data.citations || []);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortBy]);

  useEffect(() => { fetchCitations(); }, [fetchCitations]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleExpand = async (c: LLMCitation) => {
    const id = c.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setResponseModalOcc(null);
    // Initialize editing state from current values
    setEditingNotes(prev => ({ ...prev, [id]: c.notes || '' }));
    setEditingStatus(prev => ({ ...prev, [id]: c.status }));
    // Fetch occurrence timeline
    if (!occurrences[id]) {
      try {
        const res = await fetch(`/api/admin/citations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOccurrences(prev => ({ ...prev, [id]: data.occurrences || [] }));
        }
      } catch {
        // Non-blocking
      }
    }
  };

  const handleSave = async (id: string) => {
    setSaving(id);
    setSaveMsg(null);
    const body: { status?: string; notes?: string } = {};
    const citation = citations.find(c => c.id === id);
    if (citation) {
      if (editingStatus[id] !== citation.status) body.status = editingStatus[id];
      if ((editingNotes[id] || '') !== (citation.notes || '')) body.notes = editingNotes[id] || '';
    }

    if (body.status === undefined && body.notes === undefined) {
      setSaveMsg({ id, ok: true, text: 'No changes to save' });
      setTimeout(() => setSaveMsg(null), 2000);
      setSaving(null);
      return;
    }

    try {
      const res = await fetch(`/api/admin/citations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      // Update local state
      setCitations(prev => prev.map(c => c.id === id ? data.citation : c));
      setSaveMsg({ id, ok: true, text: 'Saved successfully' });
      setTimeout(() => setSaveMsg(null), 3000);
      fetchCitations();
    } catch {
      setSaveMsg({ id, ok: false, text: 'Failed to save' });
    } finally {
      setSaving(null);
    }
  };

  const getStatusConfig = (status: string) =>
    STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  const getRelevanceConfig = (rating: string) =>
    RELEVANCE_CONFIG[rating] || RELEVANCE_CONFIG.low;

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--pillar-border))] border-t-[hsl(var(--pillar-primary))]" />
          <span className="text-xs text-[hsl(var(--pillar-muted))]">Loading citations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--pillar-text))]">Citations Unavailable</h2>
            <p className="mt-1 text-sm text-[hsl(var(--pillar-muted))]">
              Could not load citation data. Please try again.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchCitations(); }}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-4 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[hsl(var(--pillar-text))]">
            <FileCheck className="h-5 w-5 text-[hsl(var(--pillar-primary))]" />
            LLM Citations
          </h1>
          <p className="mt-1 text-xs text-[hsl(var(--pillar-muted))]">
            Citations generated by the AI that are not yet in the knowledge base.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchCitations(); }}
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Stats Summary ──────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} cls="border-slate-500/20" />
          <StatCard label="Pending" value={stats.pending} cls="border-amber-500/20" />
          <StatCard label="High Rel." value={stats.high_pending} cls="border-amber-400/20" />
          <StatCard label="Med Rel." value={stats.medium_pending} cls="border-orange-400/20" />
          <StatCard label="Low Rel." value={stats.low_pending} cls="border-red-400/20" />
          <StatCard label="Added to KB" value={stats.added_to_kb} cls="border-teal-500/20" />
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={v => handleFilterChange('status', v)}
          options={[
            { value: '', label: 'All Statuses' },
            ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={filters.doc_type}
          onChange={v => handleFilterChange('doc_type', v)}
          options={[
            { value: '', label: 'All Types' },
            ...Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          label="Relevance"
          value={filters.relevance_rating}
          onChange={v => handleFilterChange('relevance_rating', v)}
          options={[
            { value: '', label: 'All Relevance' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <FilterSelect
          label="Sort"
          value={sortBy}
          onChange={v => { setSortBy(v); setPage(1); }}
          options={[
            { value: 'last_seen', label: 'Most Recent' },
            { value: 'occurrences', label: 'Most Occurrences' },
            { value: 'distinct_queries', label: 'Most Unique Queries' },
          ]}
        />
        {(filters.status || filters.doc_type || filters.relevance_rating) && (
          <button
            onClick={() => { setFilters({ status: '', doc_type: '', relevance_rating: '' }); setPage(1); }}
            className="text-xs text-[hsl(var(--pillar-muted))] underline hover:text-[hsl(var(--pillar-primary))]"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      {citations.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
          <div className="text-center">
            <Brain className="mx-auto h-8 w-8 text-[hsl(var(--pillar-muted))] opacity-40" />
            <p className="mt-3 text-sm text-[hsl(var(--pillar-muted))]">
              No LLM citations found. Citations will appear here when ELLA or OBRA generates
              legal references not in the knowledge base.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[hsl(var(--pillar-border))]">
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Citation</th>
                  <th className="w-20 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Type</th>
                  <th className="w-24 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Relevance</th>
                  <th className="w-16 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Occ.</th>
                  <th className="w-16 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Queries</th>
                  <th className="w-28 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Last Seen</th>
                  <th className="w-24 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Status</th>
                </tr>
              </thead>
              <tbody>
                {citations.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const statusCfg = getStatusConfig(c.status);
                  const relCfg = getRelevanceConfig(c.relevance_rating);
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="cursor-pointer border-b border-[hsl(var(--pillar-border))] transition-colors hover:bg-[hsl(var(--pillar-surface-alt))]"
                        onClick={() => handleExpand(c)}
                      >
                        <td className="px-3 py-2.5 text-[hsl(var(--pillar-muted))]">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="overflow-hidden">
                            <div className="break-words text-xs font-semibold text-[hsl(var(--pillar-text))]">{c.raw_citation}</div>
                            {c.title && (
                              <div className="break-words text-[10px] text-[hsl(var(--pillar-muted))]">{c.title}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--pillar-muted))]">
                            {DOC_TYPE_LABELS[c.doc_type] || c.doc_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="flex gap-px">
                              {[1, 2, 3].map(i => (
                                <span
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${i <= relCfg.dots ? relCfg.dotClass : 'bg-current opacity-15'}`}
                                />
                              ))}
                            </span>
                            <span className={`text-[10px] font-semibold ${relCfg.textClass}`}>{relCfg.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-semibold text-[hsl(var(--pillar-text))]">{c.occurrence_count}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-semibold text-[hsl(var(--pillar-primary))]">{c.distinct_query_count ?? 1}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-[hsl(var(--pillar-muted))]">
                          {formatDate(c.last_seen_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
                          <td colSpan={8} className="px-3 py-2.5">
                            {/* Compact metadata row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[hsl(var(--pillar-muted))]">
                              <span className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-1.5 py-0.5 font-semibold uppercase text-[hsl(var(--pillar-text))]">{c.module}</span>
                              <span>First: {formatDate(c.first_seen_at)}</span>
                              <span>Last: {formatDate(c.last_seen_at)}</span>
                              {c.reviewed_by && <span>Reviewed: {c.reviewed_by}</span>}
                            </div>
                            {/* Compact admin controls */}
                            <div className="mt-2 flex flex-wrap items-end gap-2">
                              <div>
                                <select
                                  value={editingStatus[c.id] ?? c.status}
                                  onChange={e => setEditingStatus(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--pillar-text))] focus:border-[hsl(var(--pillar-primary))]"
                                >
                                  {STATUS_OPTIONS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="min-w-[200px] flex-1">
                                <input
                                  type="text"
                                  value={editingNotes[c.id] ?? c.notes ?? ''}
                                  onChange={e => setEditingNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  placeholder="Admin notes..."
                                  className="w-full rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-2 py-1 text-[10px] text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted))] focus:border-[hsl(var(--pillar-primary))]"
                                />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSave(c.id); }}
                                disabled={saving === c.id}
                                className="flex items-center gap-1 rounded bg-[hsl(var(--pillar-primary))] px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.8)] disabled:opacity-50"
                              >
                                {saving === c.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save
                              </button>
                              {saveMsg && saveMsg.id === c.id && (
                                <span className={`text-[10px] ${saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {saveMsg.text}
                                </span>
                              )}
                            </div>

                            {/* Occurrence Timeline */}
                            <div className="mt-2 border-t border-[hsl(var(--pillar-border))] pt-2">
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                                  Occurrence Timeline
                                </span>
                                {occurrences[c.id] && (
                                  <span className="text-[10px] text-[hsl(var(--pillar-muted))]">
                                    {occurrences[c.id].length} sighting{occurrences[c.id].length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              {occurrences[c.id] ? (
                                <div className="max-h-60 space-y-1.5 overflow-y-auto overflow-x-hidden">
                                  {occurrences[c.id].map((occ) => {
                                    const occRel = getRelevanceConfig(occ.relevance_rating);
                                    return (
                                      <div key={occ.id} className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs leading-relaxed text-[hsl(var(--pillar-text))]">{occ.source_query}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[hsl(var(--pillar-muted))]">
                                              <span>{formatDate(occ.created_at)}</span>
                                              {occ.user_name && <span>· {occ.user_name}</span>}
                                              <span className="rounded border border-[hsl(var(--pillar-border))] px-1 uppercase">{occ.module}</span>
                                              <span className="flex gap-px">
                                                {[1, 2, 3].map(i => (
                                                  <span key={i} className={`h-1 w-1 rounded-full ${i <= occRel.dots ? occRel.dotClass : 'bg-current opacity-15'}`} />
                                                ))}
                                              </span>
                                            </div>
                                          </div>
                                          {occ.response_text && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setResponseModalOcc(occ); }}
                                              className="flex shrink-0 items-center gap-1 rounded border border-[hsl(var(--pillar-border))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--pillar-primary))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.4)] hover:bg-[hsl(var(--pillar-primary)/0.1)]"
                                              title="View full response"
                                            >
                                              <Eye className="h-3 w-3" />
                                              Response
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 py-2">
                                  <RefreshCw className="h-3 w-3 animate-spin text-[hsl(var(--pillar-muted))]" />
                                  <span className="text-[10px] text-[hsl(var(--pillar-muted))]">Loading occurrences...</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Response Modal ──────────────────────────────────── */}
      {responseModalOcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setResponseModalOcc(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[hsl(var(--pillar-border))] px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">AI Response</h3>
                <p className="mt-0.5 text-[10px] text-[hsl(var(--pillar-muted))]">
                  {responseModalOcc.module} · {formatDate(responseModalOcc.created_at)}
                  {responseModalOcc.user_name && ` · ${responseModalOcc.user_name}`}
                </p>
              </div>
              <button onClick={() => setResponseModalOcc(null)} className="rounded-lg p-1 text-[hsl(var(--pillar-muted))] transition-colors hover:bg-[hsl(var(--pillar-surface))] hover:text-[hsl(var(--pillar-text))]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3">
              <div className="mb-3 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">User Question</span>
                <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--pillar-text))]">{responseModalOcc.source_query}</p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Response</span>
                <div className="mt-1 max-h-[50vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[hsl(var(--pillar-text))]">{responseModalOcc.response_text}</pre>
                </div>
              </div>
            </div>
            <div className="border-t border-[hsl(var(--pillar-border))] px-4 py-2">
              <button onClick={() => setResponseModalOcc(null)} className="rounded-lg bg-[hsl(var(--pillar-surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:bg-[hsl(var(--pillar-border))]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[hsl(var(--pillar-muted))]">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-lg border ${cls} bg-[hsl(var(--pillar-surface-alt))] p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[hsl(var(--pillar-text))]">{value}</p>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2 py-1.5 text-xs text-[hsl(var(--pillar-text))] focus:border-[hsl(var(--pillar-primary))]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
