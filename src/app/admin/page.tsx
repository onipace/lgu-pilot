'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  BarChart2,
  ChevronDown,
  Activity,
  Database,
  Server,
  Globe,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import StatsOverview from '@/components/admin/stats-overview';
import TopTopicsChart from '@/components/admin/top-topics-chart';
import SessionTimeline from '@/components/admin/session-timeline';
import ObraInsights from '@/components/admin/obra-insights';
import SessionsTable from '@/components/admin/sessions-table';
import ExportButton from '@/components/admin/export-button';
import type { AdminStats, WorkshopSession } from '@/types';

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [allSessions, setAllSessions] = useState<WorkshopSession[]>([]);
  const [moduleFilter, setModuleFilter] = useState<'all' | 'ella' | 'obra' | 'yala'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchStats = useCallback(async (sessionId?: string) => {
    try {
      const url = sessionId
        ? `/api/admin/stats?session=${encodeURIComponent(sessionId)}`
        : '/api/admin/stats';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminStats = await res.json();
      setStats(data);
      setAllSessions(data.allSessions ?? []);
      if (!selectedSession && data.workshopSession?.id) {
        setSelectedSession(data.workshopSession.id);
      }
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchStats(selectedSession || undefined), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check user role for super_admin-only cards
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === 'super_admin' || data?.role === 'super_admin') {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId);
    setLoading(true);
    fetchStats(sessionId);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats(selectedSession || undefined);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Quick Access Cards ────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
            Quick Access
          </h2>
          <div className={`grid gap-4 ${isSuperAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-sm'}`}>
            {/* Knowledge Base */}
            <Link
              href="/admin/kb"
              className="group rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 transition-all hover:border-[hsl(158_64%_45%/0.4)] hover:shadow-[0_0_20px_hsl(158_64%_45%/0.12)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(158_64%_45%/0.3)] bg-[hsl(158_64%_45%/0.12)]">
                  <Database className="h-5 w-5 text-[hsl(158_64%_70%)]" />
                </div>
                <ArrowRight className="h-4 w-4 text-[hsl(var(--pillar-muted)/0.4)] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--pillar-text))]" />
              </div>
              <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                Knowledge Base
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--pillar-muted))]">
                Manage ordinances, DILG opinions, SC jurisprudence and other legal documents
              </p>
            </Link>

            {/* Deployments (super_admin only) */}
            {isSuperAdmin && (
              <Link
                href="/admin/deployments"
                className="group rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 transition-all hover:border-[hsl(239_76%_64%/0.4)] hover:shadow-[0_0_20px_hsl(239_76%_64%/0.12)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(239_76%_64%/0.3)] bg-[hsl(239_76%_64%/0.12)]">
                    <Server className="h-5 w-5 text-[hsl(239_76%_80%)]" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[hsl(var(--pillar-muted)/0.4)] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--pillar-text))]" />
                </div>
                <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                  Deployments
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--pillar-muted))]">
                  Manage LGU eSANGGUNI container deployments across ECS instances
                </p>
              </Link>
            )}

            {/* ECS Infrastructure (super_admin only) */}
            {isSuperAdmin && (
              <Link
                href="/admin/ecs"
                className="group rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 transition-all hover:border-[hsl(38_95%_55%/0.4)] hover:shadow-[0_0_20px_hsl(38_95%_55%/0.12)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.12)]">
                    <Globe className="h-5 w-5 text-[hsl(38_95%_65%)]" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[hsl(var(--pillar-muted)/0.4)] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--pillar-text))]" />
                </div>
                <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                  ECS Infrastructure
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--pillar-muted))]">
                  Manage ECS servers, credentials, and health monitoring
                </p>
              </Link>
            )}

            {/* Demo Bookings (CR-001) */}
            <Link
              href="/admin/bookings"
              className="group rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 transition-all hover:border-[hsl(38_95%_55%/0.4)] hover:shadow-[0_0_20px_hsl(38_95%_55%/0.12)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.12)]">
                  <CalendarDays className="h-5 w-5 text-[hsl(38_95%_65%)]" />
                </div>
                <ArrowRight className="h-4 w-4 text-[hsl(var(--pillar-muted)/0.4)] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--pillar-text))]" />
              </div>
              <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                Demo Bookings
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--pillar-muted))]">
                View and manage demo booking requests from prospects
              </p>
            </Link>
          </div>
        </section>

        {/* ── Analytics Toolbar ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">
              Workshop Analytics
            </h1>
            {lastRefreshed && (
              <span className="hidden text-[10px] text-[hsl(var(--pillar-muted))] sm:block">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Session selector */}
            <div className="relative">
              <select
                value={selectedSession}
                onChange={(e) => handleSessionChange(e.target.value)}
                className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] pl-3 pr-8 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              >
                {allSessions.length === 0 ? (
                  <option value="">No sessions yet</option>
                ) : (
                  allSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || s.id}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
            </div>

            {/* Module filter pills */}
            <div className="flex gap-1">
              {(['all', 'ella', 'obra', 'yala'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModuleFilter(m)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    moduleFilter === m
                      ? 'bg-[hsl(var(--pillar-primary))] text-white'
                      : 'border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]'
                  }`}
                >
                  {m === 'all' ? 'All' : m.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <ExportButton sessionId={selectedSession} />
          </div>
        </div>

        <p className="text-xs text-[hsl(var(--pillar-muted))]">
          Real-time participant activity and engagement metrics
        </p>

        {/* ── Error state ───────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Loading skeleton ──────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-[hsl(var(--pillar-surface))]"
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl bg-[hsl(var(--pillar-surface))]"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Stats overview ────────────────────────────────────────── */}
        {!loading && <StatsOverview stats={stats} />}

        {/* ── Charts row ────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Show one chart per module, or just the selected one */}
            {moduleFilter === 'all' ? (
              <div className="space-y-6 md:col-span-2 grid md:grid-cols-3 md:space-y-0 gap-6">
                {(['ella', 'obra', 'yala'] as const).map((mod) => (
                  <TopTopicsChart
                    key={mod}
                    topTopics={stats?.topTopics ?? []}
                    module={mod}
                  />
                ))}
              </div>
            ) : (
              <TopTopicsChart
                topTopics={stats?.topTopics ?? []}
                module={moduleFilter}
              />
            )}
            <SessionTimeline timeline={stats?.activityTimeline ?? []} />
          </div>
        )}

        {/* ── OBRA insights ─────────────────────────────────────────── */}
        {!loading && stats && stats.obraStats.totalDrafts > 0 && (
          <ObraInsights obraStats={stats.obraStats} />
        )}

        {!loading && stats && stats.obraStats.totalDrafts === 0 && (
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.5)] px-6 py-8 text-center">
            <div className="mb-2 flex justify-center">
              <Activity className="h-8 w-8 text-[hsl(var(--pillar-muted)/0.4)]" />
            </div>
            <p className="text-sm font-semibold text-[hsl(var(--pillar-muted))]">
              No OBRA drafts yet in this session
            </p>
            <p className="text-xs text-[hsl(var(--pillar-muted)/0.6)] mt-1">
              OBRA insights will appear once participants use the Ordinance Builder.
            </p>
          </div>
        )}

        {/* ── Sessions table ────────────────────────────────────────── */}
        {!loading && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[hsl(var(--pillar-text))]">
              Participant Sessions
            </h2>
            <SessionsTable sessionId={selectedSession} />
          </div>
        )}

        {/* ── Top participants ──────────────────────────────────────── */}
        {!loading && (stats?.topParticipants ?? []).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[hsl(var(--pillar-text))]">
              Most Active Participants
            </h2>
            <div className="overflow-hidden rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                      Tools Used
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.topParticipants ?? []).map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-[hsl(var(--pillar-border)/0.5)] transition-colors hover:bg-[hsl(var(--pillar-surface-alt)/0.5)]"
                    >
                      <td className="px-4 py-3 font-medium text-[hsl(var(--pillar-text)/0.85)]">
                        {p.name || 'Anonymous'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-[hsl(var(--pillar-text))]">
                        {p.messageCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.modules ?? []).map((mod: string) => {
                            const colors: Record<string, string> = {
                              ella: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)] border-[hsl(239_76%_64%/0.3)]',
                              obra: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)] border-[hsl(158_64%_45%/0.3)]',
                              yala: 'bg-[hsl(38_95%_55%/0.15)] text-[hsl(38_95%_75%)] border-[hsl(38_95%_55%/0.3)]',
                            };
                            return (
                              <span
                                key={mod}
                                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colors[mod] ?? 'bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-muted))] border-[hsl(var(--pillar-border))]'}`}
                              >
                                {mod}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {!loading && !error && stats && stats.totals.sessions === 0 && (
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.5)] px-6 py-16 text-center">
            <div className="mb-3 flex justify-center">
              <BarChart2 className="h-12 w-12 text-[hsl(var(--pillar-muted)/0.3)]" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-[hsl(var(--pillar-text)/0.6)]">
              No activity yet
            </h3>
            <p className="text-sm text-[hsl(var(--pillar-muted))]">
              Analytics will appear once participants start using the workshop tools.
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--pillar-muted)/0.6)]">
              Dashboard auto-refreshes every 30 seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
