'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  Shield,
  FileText,
  Upload,
  Trash2,
  Eye,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  Loader2,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface KBDoc {
  id: string;
  lgu_id: string;
  doc_type: string;
  title: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  metadata: Record<string, unknown> | null;
  section_number: string | null;
  ordinance_number: string | null;
  series_year: number | null;
  ordinance_type: string | null;
  rule_number: number | null;
  topics: string[] | null;
  status: 'pending' | 'indexed' | 'error';
  error_message: string | null;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface KBStats {
  total_documents: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_lgu: { lgu_id: string; count: number }[];
  last_index_run: Record<string, unknown> | null;
  lightrag: {
    total_documents: number;
    total_entities: number;
    total_relations: number;
    status: string;
  } | null;
}

const DOC_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ordinance', label: 'Ordinance' },
  { value: 'ra7160', label: 'R.A. 7160' },
  { value: 'irr', label: 'IRR' },
  { value: 'dilg_opinion', label: 'DILG Opinion' },
  { value: 'jurisprudence', label: 'Jurisprudence' },
  { value: 'policy', label: 'Policy' },
  { value: 'context', label: 'Context' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'indexed', label: 'Indexed' },
  { value: 'error', label: 'Error' },
];

const DOC_TYPE_COLORS: Record<string, string> = {
  ordinance: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)] border-[hsl(239_76%_64%/0.3)]',
  ra7160: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)] border-[hsl(158_64%_45%/0.3)]',
  irr: 'bg-[hsl(38_95%_55%/0.15)] text-[hsl(38_95%_75%)] border-[hsl(38_95%_55%/0.3)]',
  dilg_opinion: 'bg-[hsl(200_80%_50%/0.15)] text-[hsl(200_80%_70%)] border-[hsl(200_80%_50%/0.3)]',
  jurisprudence: 'bg-[hsl(280_60%_55%/0.15)] text-[hsl(280_60%_75%)] border-[hsl(280_60%_55%/0.3)]',
  policy: 'bg-[hsl(340_70%_55%/0.15)] text-[hsl(340_70%_75%)] border-[hsl(340_70%_55%/0.3)]',
  context: 'bg-[hsl(180_50%_50%/0.15)] text-[hsl(180_50%_70%)] border-[hsl(180_50%_50%/0.3)]',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  indexed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  error: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default function KBPage() {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLgu, setFilterLgu] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

  // Actions
  const [reindexing, setReindexing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<KBDoc | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('doc_type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterLgu) params.set('lgu_id', filterLgu);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/kb/documents?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocs(data.documents);
      setTotalPages(data.pagination.total_pages);
      setTotalDocs(data.pagination.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterLgu, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/kb/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: KBStats = await res.json();
      setStats(data);
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/kb/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchDocs();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReindex = async () => {
    const lguId = filterLgu || prompt('Enter LGU ID to re-index:');
    if (!lguId) return;

    setReindexing(true);
    try {
      const res = await fetch('/api/admin/kb/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lgu_id: lguId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      alert(`Re-indexing complete. ${data.documents_indexed} documents indexed.`);
      fetchDocs();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-indexing failed');
    } finally {
      setReindexing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredDocs = searchQuery
    ? docs.filter((d) =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ordinance_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.section_number?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : docs;

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(239_76%_64%/0.15)] border border-[hsl(239_76%_64%/0.3)]">
              <Database className="h-4 w-4 text-[hsl(239_76%_80%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                eSANGGUNI
              </span>
              <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">
                Knowledge Base
              </span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.1)] px-2.5 py-0.5 sm:flex">
              <Shield className="h-3 w-3 text-[hsl(38_95%_65%)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(38_95%_65%)]">
                Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/kb/upload"
              className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Link>
            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(158_64%_45%/0.3)] bg-[hsl(158_64%_45%/0.1)] px-3 py-1.5 text-xs font-semibold text-[hsl(158_64%_70%)] transition-colors hover:bg-[hsl(158_64%_45%/0.2)] disabled:opacity-50"
            >
              {reindexing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Re-index
            </button>
            <button
              onClick={() => {
                fetchDocs();
                fetchStats();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-xs text-[hsl(var(--pillar-muted))]">
          <Link href="/admin" className="hover:text-[hsl(var(--pillar-text))] transition-colors">
            Admin
          </Link>
          <span>/</span>
          <span className="text-[hsl(var(--pillar-text))] font-semibold">Knowledge Base</span>
        </nav>

        {/* ── Stats Overview ─────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Documents"
              value={stats.total_documents}
              icon={<FileText className="h-4 w-4" />}
              color="text-[hsl(239_76%_80%)]"
              bgColor="bg-[hsl(239_76%_64%/0.15)]"
              borderColor="border-[hsl(239_76%_64%/0.3)]"
            />
            <StatCard
              label="Indexed"
              value={stats.by_status.indexed || 0}
              icon={<CheckCircle2 className="h-4 w-4" />}
              color="text-emerald-400"
              bgColor="bg-emerald-400/10"
              borderColor="border-emerald-400/30"
            />
            <StatCard
              label="Pending"
              value={stats.by_status.pending || 0}
              icon={<Clock className="h-4 w-4" />}
              color="text-amber-400"
              bgColor="bg-amber-400/10"
              borderColor="border-amber-400/30"
            />
            <StatCard
              label="LightRAG Entities"
              value={stats.lightrag?.total_entities ?? '--'}
              icon={<Zap className="h-4 w-4" />}
              color="text-[hsl(158_64%_70%)]"
              bgColor="bg-[hsl(158_64%_45%/0.15)]"
              borderColor="border-[hsl(158_64%_45%/0.3)]"
            />
          </div>
        )}

        {/* ── LightRAG Status ────────────────────────────────────────── */}
        {stats?.lightrag && (
          <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${stats.lightrag.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-[hsl(var(--pillar-text))]">
                LightRAG: {stats.lightrag.status || 'unknown'}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-[hsl(var(--pillar-muted))]">
              <span>Docs: {stats.lightrag.total_documents}</span>
              <span>Entities: {stats.lightrag.total_entities}</span>
              <span>Relations: {stats.lightrag.total_relations}</span>
            </div>
            {stats.last_index_run && (
              <div className="ml-auto text-xs text-[hsl(var(--pillar-muted))]">
                Last index: {formatDate(stats.last_index_run.started_at as string)}
              </div>
            )}
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">
              Documents
            </h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))] mt-0.5">
              {totalDocs} document{totalDocs !== 1 ? 's' : ''} in knowledge base
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] pl-8 pr-3 py-2 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)] w-48"
              />
            </div>

            {/* Type filter */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] pl-3 pr-8 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] pl-3 pr-8 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
            </div>

            {/* LGU filter */}
            <input
              type="text"
              placeholder="LGU ID..."
              value={filterLgu}
              onChange={(e) => { setFilterLgu(e.target.value); setPage(1); }}
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)] w-28"
            />
          </div>
        </div>

        {/* ── Loading skeleton ───────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[hsl(var(--pillar-surface))]"
              />
            ))}
          </div>
        )}

        {/* ── Documents table ────────────────────────────────────────── */}
        {!loading && filteredDocs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      LGU
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-[hsl(var(--pillar-border)/0.5)] transition-colors hover:bg-[hsl(var(--pillar-surface-alt)/0.5)]"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-[hsl(var(--pillar-text))] max-w-xs truncate">
                            {doc.title}
                          </div>
                          {(doc.ordinance_number || doc.section_number) && (
                            <div className="text-[10px] text-[hsl(var(--pillar-muted))] mt-0.5">
                              {doc.ordinance_number && `Ord. ${doc.ordinance_number}`}
                              {doc.ordinance_number && doc.section_number && ' / '}
                              {doc.section_number && `Sec. ${doc.section_number}`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${DOC_TYPE_COLORS[doc.doc_type] || 'bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-muted))] border-[hsl(var(--pillar-border))]'}`}>
                          {doc.doc_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[hsl(var(--pillar-muted))]">
                        {doc.lgu_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[doc.status] || ''}`}>
                          {doc.status === 'error' && <AlertCircle className="h-2.5 w-2.5" />}
                          {doc.status === 'indexed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {doc.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--pillar-muted))]">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewDoc(doc)}
                            className="rounded-lg p-1.5 text-[hsl(var(--pillar-muted))] transition-colors hover:bg-[hsl(var(--pillar-surface-alt))] hover:text-[hsl(var(--pillar-text))]"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="rounded-lg p-1.5 text-[hsl(var(--pillar-muted))] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[hsl(var(--pillar-border))] px-4 py-3">
                <span className="text-xs text-[hsl(var(--pillar-muted))]">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!loading && !error && filteredDocs.length === 0 && (
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.5)] px-6 py-16 text-center">
            <div className="mb-3 flex justify-center">
              <Database className="h-12 w-12 text-[hsl(var(--pillar-muted)/0.3)]" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-[hsl(var(--pillar-text)/0.6)]">
              No documents found
            </h3>
            <p className="text-sm text-[hsl(var(--pillar-muted))]">
              {searchQuery || filterType || filterStatus || filterLgu
                ? 'Try adjusting your filters.'
                : 'Upload documents to build your knowledge base.'}
            </p>
            {!searchQuery && !filterType && !filterStatus && !filterLgu && (
              <Link
                href="/admin/kb/upload"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Documents
              </Link>
            )}
          </div>
        )}
      </main>

      {/* ── Document View Modal ──────────────────────────────────────── */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-6 py-4">
              <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                Document Details
              </h2>
              <button
                onClick={() => setViewDoc(null)}
                className="rounded-lg p-1 text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
              >
                &times;
              </button>
            </div>
            <div className="space-y-4 px-6 py-4 text-xs">
              <DetailRow label="ID" value={viewDoc.id} mono />
              <DetailRow label="Title" value={viewDoc.title} />
              <DetailRow label="Type" value={viewDoc.doc_type} />
              <DetailRow label="LGU" value={viewDoc.lgu_id} mono />
              <DetailRow label="Status" value={viewDoc.status} />
              {viewDoc.section_number && <DetailRow label="Section" value={viewDoc.section_number} />}
              {viewDoc.ordinance_number && <DetailRow label="Ordinance #" value={viewDoc.ordinance_number} />}
              {viewDoc.series_year && <DetailRow label="Series Year" value={String(viewDoc.series_year)} />}
              {viewDoc.ordinance_type && <DetailRow label="Ordinance Type" value={viewDoc.ordinance_type} />}
              {viewDoc.topics && viewDoc.topics.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="w-24 shrink-0 font-semibold text-[hsl(var(--pillar-muted))]">Topics</span>
                  <div className="flex flex-wrap gap-1">
                    {viewDoc.topics.map((t, i) => (
                      <span key={i} className="rounded-full border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2 py-0.5 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {viewDoc.file_name && <DetailRow label="File" value={viewDoc.file_name} />}
              {viewDoc.file_size && <DetailRow label="Size" value={`${(viewDoc.file_size / 1024).toFixed(1)} KB`} />}
              <DetailRow label="Created" value={formatDate(viewDoc.created_at)} />
              {viewDoc.indexed_at && <DetailRow label="Indexed" value={formatDate(viewDoc.indexed_at)} />}
              {viewDoc.error_message && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
                  <strong>Error:</strong> {viewDoc.error_message}
                </div>
              )}
              {viewDoc.content && (
                <div>
                  <span className="block font-semibold text-[hsl(var(--pillar-muted))] mb-1">Content Preview</span>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] p-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--pillar-text)/0.8)]">
                    {viewDoc.content.substring(0, 2000)}
                    {viewDoc.content.length > 2000 && '...'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper components ────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-4 py-4`}>
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-xs font-semibold text-[hsl(var(--pillar-muted))]">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-black ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 font-semibold text-[hsl(var(--pillar-muted))]">{label}</span>
      <span className={`text-[hsl(var(--pillar-text))] break-all ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
