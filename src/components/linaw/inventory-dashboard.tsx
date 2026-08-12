'use client';

// src/components/linaw/inventory-dashboard.tsx
// Sprint 6 (S6-C11) — N001 inventory dashboard (PRP-LINAW screens bullet 1,
// PRD §6.8 feature 1). Completeness bar, counts, year-gap list, and a
// hand-built per-year SVG bar chart (NO chart library by design). Fetches
// GET /api/linaw/inventory on mount + Refresh; plain fetch keeps the
// interaction ≤2s.

import { useCallback, useEffect, useState } from 'react';
import { Boxes, RefreshCw, AlertTriangle, CalendarDays, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinawInventoryResponse } from '@/types/linaw';

const STATUS_DOT: Record<string, string> = {
  active: '#22C55E',
  amended: '#FACC15',
  repealed: '#F87171',
  superseded: '#94A3B8',
  expired: '#94A3B8',
};

function completenessColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 60) return '#FACC15';
  return '#F87171';
}

export default function InventoryDashboard() {
  const [data, setData] = useState<LinawInventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/linaw/inventory', { credentials: 'same-origin' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
      }
      setData((await res.json()) as LinawInventoryResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Boxes className="h-4 w-4 text-[#F59E0B]" />
          Ready Library Inventory
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-[#283147] bg-[#0F1729] px-4 text-xs font-semibold text-white transition-colors hover:border-[#F59E0B] disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-[#94A3B8]">Computing inventory…</p>}

      {!loading && error && (
        <div className="rounded-2xl border border-[#F87171]/40 bg-[#1E293B] p-6">
          <p className="text-sm text-[#F87171]">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-11 rounded-lg bg-[#F87171] px-4 text-xs font-semibold text-[#0F1729]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {/* Completeness bar */}
          <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Series completeness
              </p>
              <p className="text-sm font-bold text-white">{data.completenessScore}%</p>
            </div>
            <div
              className="mt-3 h-3 w-full overflow-hidden rounded-full border border-[#283147]"
              style={{ backgroundColor: '#1E293B' }}
              role="progressbar"
              aria-valuenow={data.completenessScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Series completeness score"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, data.completenessScore))}%`,
                  backgroundColor: completenessColor(data.completenessScore),
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#94A3B8]">
              Year coverage over the ready corpus range · computed in {data.tookMs}ms
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Ordinances
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                <Boxes className="h-5 w-5 text-[#F59E0B]" />
                {data.totals.ordinances}
              </p>
            </div>
            <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Series years
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                <CalendarDays className="h-5 w-5 text-[#22D3EE]" />
                {data.totals.years}
              </p>
            </div>
            <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Subjects
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                <Tags className="h-5 w-5 text-[#8B5CF6]" />
                {data.totals.subjects}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* byStatus */}
            <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                By legal status
              </p>
              {data.byStatus.length === 0 ? (
                <p className="mt-3 text-xs text-[#94A3B8]">No ready ordinances yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.byStatus.map((row) => (
                    <li key={row.status} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-white">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_DOT[row.status] ?? '#94A3B8' }}
                        />
                        {row.status}
                      </span>
                      <span className="font-semibold text-[#94A3B8]">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* bySubject */}
            <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                By subject
              </p>
              {data.bySubject.length === 0 ? (
                <p className="mt-3 text-xs text-[#94A3B8]">No subject tags recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.bySubject.map((row) => (
                    <li key={row.subject} className="flex items-center justify-between text-sm">
                      <span className="text-white">{row.subject}</span>
                      <span className="font-semibold text-[#94A3B8]">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Year-gap list */}
          <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
              Series gaps
            </p>
            {data.yearGaps.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-[#22C55E]">
                Series continuity looks complete.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.yearGaps.map((gap) => (
                  <li key={gap.year} className="flex items-start gap-2 text-sm text-white">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FACC15]" />
                    {gap.missing.length === 0 ? (
                      <span>
                        {gap.year} — no ordinances recorded
                      </span>
                    ) : (
                      <span>
                        {gap.year} — missing No. {gap.missing.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Per-year SVG bar chart (hand-built — no chart library) */}
          <YearBarChart data={data} />
        </div>
      )}
    </section>
  );
}

/** Hand-built SVG bar chart over byYear, with gap years as hollow dashed bars. */
function YearBarChart({ data }: { data: LinawInventoryResponse }) {
  const gapYears = new Set(
    data.yearGaps.filter((g) => g.missing.length === 0).map((g) => g.year)
  );
  const countByYear = new Map(data.byYear.map((row) => [row.year, row.count]));
  const years = [...new Set([...countByYear.keys(), ...gapYears])].sort((a, b) => a - b);

  if (years.length === 0) {
    return (
      <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
          Ordinances per year
        </p>
        <p className="mt-3 text-xs text-[#94A3B8]">No ready ordinances to chart yet.</p>
      </div>
    );
  }

  const BAR_WIDTH = 28;
  const GAP = 12;
  const PAD_LEFT = 8;
  const AXIS = 24;
  const H = 180;
  const W = PAD_LEFT + years.length * (BAR_WIDTH + GAP);
  const maxCount = Math.max(1, ...data.byYear.map((row) => row.count));
  const chartHeight = H - 40;

  return (
    <div className="rounded-2xl border border-[#283147] bg-[#1E293B] p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
        Ordinances per year
      </p>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Ordinances per year bar chart">
          {years.map((year, i) => {
            const x = PAD_LEFT + i * (BAR_WIDTH + GAP);
            const isGap = gapYears.has(year) && !countByYear.has(year);
            const count = countByYear.get(year) ?? 0;
            const barHeight = isGap
              ? Math.max(10, chartHeight * 0.12)
              : Math.max(4, Math.round((count / maxCount) * chartHeight));
            const y = H - AXIS - barHeight;
            return (
              <g key={year}>
                {isGap ? (
                  <rect
                    x={x}
                    y={y}
                    width={BAR_WIDTH}
                    height={barHeight}
                    fill="none"
                    stroke="#F87171"
                    strokeDasharray="4 3"
                  >
                    <title>{`${year} · no ordinances recorded`}</title>
                  </rect>
                ) : (
                  <rect x={x} y={y} width={BAR_WIDTH} height={barHeight} fill="#0038A8">
                    <title>{`${year} · ${count} ordinances`}</title>
                  </rect>
                )}
                {!isGap && (
                  <text x={x + BAR_WIDTH / 2} y={y - 4} textAnchor="middle" fill="#FFFFFF" fontSize={10}>
                    {count}
                  </text>
                )}
                <text x={x + BAR_WIDTH / 2} y={H - 8} textAnchor="middle" fill="#94A3B8" fontSize={10}>
                  {year}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
