'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Gauge, TrendingUp, DollarSign, Zap, Download, Settings, X,
  AlertTriangle, RefreshCw, BarChart3,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface StatsData {
  today: PeriodStats;
  this_week: PeriodStats;
  this_month: PeriodStats;
  this_year: PeriodStats;
}

interface PeriodStats {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  call_count: number;
}

interface ModuleData {
  modules: {
    module: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    call_count: number;
    percentage: number;
  }[];
}

interface RouteData {
  routes: {
    route: string;
    module: string;
    total_tokens: number;
    cost_usd: number;
    call_count: number;
    avg_tokens_per_call: number;
  }[];
}

interface UserData {
  users: {
    user_id: string;
    user_name: string;
    total_tokens: number;
    cost_usd: number;
    call_count: number;
    avg_tokens_per_call: number;
  }[];
}

interface BudgetData {
  daily?: BudgetPeriod;
  monthly?: BudgetPeriod;
}

interface BudgetPeriod {
  limit_tokens: number;
  limit_usd: number;
  used_tokens: number;
  used_usd: number;
  percentage: number;
  alert: boolean;
  alert_percentage: number;
}

interface TimeseriesData {
  granularity: string;
  data: {
    period: string;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    call_count: number;
  }[];
}

interface PricingData {
  models: {
    model: string;
    input_price_per_1m: number;
    output_price_per_1m: number;
    is_active: number;
  }[];
}

// ── Constants ───────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  ella: '#6366f1',
  obra: '#f59e0b',
  yala: '#10b981',
};

const MODULE_LABELS: Record<string, string> = {
  ella: 'ELLA',
  obra: 'OBRA',
  yala: 'YALA',
};

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: 'YTD', days: -1 },
];

// ── Helpers ─────────────────────────────────────────────────

function formatDate(days: number): string {
  const now = new Date();
  if (days === 0) {
    return now.toISOString().slice(0, 10);
  }
  if (days === -1) {
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }
  return new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatCost(n: number): string {
  if (n < 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(2);
}

function getBudgetColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

// ── Main Component ─────────────────────────────────────────

export default function TokenMeterPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [budgets, setBudgets] = useState<BudgetData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState(30);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fromDate = formatDate(datePreset);
  const toDate = formatDate(0);

  const fetchData = useCallback(async () => {
    setError(false);
    try {
      const [statsRes, modRes, routeRes, userRes, budgetRes, tsRes, pricingRes] = await Promise.all([
        fetch('/api/admin/tokens/stats'),
        fetch(`/api/admin/tokens/by-module?from=${fromDate}&to=${toDate}`),
        fetch(`/api/admin/tokens/by-route?from=${fromDate}&to=${toDate}`),
        fetch(`/api/admin/tokens/by-user?from=${fromDate}&to=${toDate}&limit=20`),
        fetch('/api/admin/tokens/budgets'),
        fetch(`/api/admin/tokens/timeseries?granularity=${granularity}&from=${fromDate}&to=${toDate}`),
        fetch('/api/admin/tokens/pricing'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (modRes.ok) setModuleData(await modRes.json());
      if (routeRes.ok) setRouteData(await routeRes.json());
      if (userRes.ok) setUserData(await userRes.json());
      if (budgetRes.ok) setBudgets(await budgetRes.json());
      if (tsRes.ok) setTimeseries(await tsRes.json());
      if (pricingRes.ok) setPricing(await pricingRes.json());

      if (statsRes.status === 503) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = (format: 'csv' | 'json') => {
    window.open(`/api/admin/tokens/export?format=${format}&from=${fromDate}&to=${toDate}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--pillar-border))] border-t-[hsl(var(--pillar-primary))]" />
          <span className="text-xs text-[hsl(var(--pillar-muted))]">Loading token meter data...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--pillar-text))]">Token Meter Unavailable</h2>
            <p className="mt-1 text-sm text-[hsl(var(--pillar-muted))]">
              The token meter service is not responding. PILLAR continues to work normally —
              only token usage tracking is affected.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-4 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasData = stats && (stats.today.call_count > 0 || stats.this_week.call_count > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(239_76%_64%/0.3)] bg-[hsl(239_76%_64%/0.12)]">
            <Gauge className="h-4 w-4 text-[hsl(239_76%_80%)]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pillar-text))]">Token Meter</h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))]">LLM token consumption tracking & cost analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Picker */}
          <select
            value={datePreset}
            onChange={(e) => { setLoading(true); setDatePreset(Number(e.target.value)); }}
            className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
          >
            {DATE_PRESETS.map(p => (
              <option key={p.days} value={p.days}>{p.label}</option>
            ))}
          </select>

          {/* Export */}
          <button
            onClick={() => handleExport('csv')}
            disabled={!hasData}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={!hasData}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            onClick={() => { setLoading(true); setRefreshKey(k => k + 1); }}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Empty State ────────────────────────────────────── */}
      {!hasData && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--pillar-surface-alt))]">
              <Zap className="h-7 w-7 text-[hsl(var(--pillar-muted))]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[hsl(var(--pillar-text))]">No Token Usage Recorded Yet</h2>
              <p className="mt-1 max-w-sm text-sm text-[hsl(var(--pillar-muted))]">
                Token usage will appear here once users start interacting with ELLA, OBRA, or YALA.
                The dashboard updates automatically every 60 seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Cards ────────────────────────────────────── */}
      {hasData && stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Today" data={stats.today} icon={<Zap className="h-3.5 w-3.5" />} />
          <StatCard label="This Week" data={stats.this_week} icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <StatCard label="This Month" data={stats.this_month} icon={<BarChart3 className="h-3.5 w-3.5" />} />
          <StatCard label="This Year" data={stats.this_year} icon={<Gauge className="h-3.5 w-3.5" />} />
        </div>
      )}

      {/* ── Budget Status ──────────────────────────────────── */}
      {hasData && budgets && (budgets.daily || budgets.monthly) && (
        <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">Budget Status</h3>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
            >
              <Settings className="h-3 w-3" />
              Configure
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {budgets.daily && <BudgetBar label="Daily" data={budgets.daily} />}
            {budgets.monthly && <BudgetBar label="Monthly" data={budgets.monthly} />}
          </div>
        </div>
      )}

      {/* ── Charts Row ─────────────────────────────────────── */}
      {hasData && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Module Breakdown Pie */}
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
            <h3 className="mb-3 text-sm font-bold text-[hsl(var(--pillar-text))]">Module Breakdown</h3>
            {moduleData && moduleData.modules.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={moduleData.modules.map(m => ({ name: MODULE_LABELS[m.module] || m.module, value: m.total_tokens, percentage: m.percentage }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: any) => `${entry.name} ${entry.percentage}%`}
                    labelLine={false}
                  >
                    {moduleData.modules.map((m) => (
                      <Cell key={m.module} fill={MODULE_COLORS[m.module] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--pillar-surface))',
                      border: '1px solid hsl(var(--pillar-border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatNumber(value) + ' tokens', '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-xs text-[hsl(var(--pillar-muted))]">No module data for this period</div>
            )}
          </div>

          {/* Route Breakdown Bar */}
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
            <h3 className="mb-3 text-sm font-bold text-[hsl(var(--pillar-text))]">Route Breakdown</h3>
            {routeData && routeData.routes.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={routeData.routes.map(r => ({ route: r.route.replace('/api/', ''), tokens: r.total_tokens }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pillar-border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--pillar-muted))', fontSize: 10 }} tickFormatter={formatNumber} />
                  <YAxis type="category" dataKey="route" tick={{ fill: 'hsl(var(--pillar-muted))', fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--pillar-surface))',
                      border: '1px solid hsl(var(--pillar-border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatNumber(value) + ' tokens', '']}
                  />
                  <Bar dataKey="tokens" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-xs text-[hsl(var(--pillar-muted))]">No route data for this period</div>
            )}
          </div>
        </div>
      )}

      {/* ── Consumption Trend ─────────────────────────────── */}
      {hasData && (
        <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">Consumption Trend</h3>
            <div className="flex gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => { setGranularity(g); setLoading(true); }}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${
                    granularity === g
                      ? 'bg-[hsl(var(--pillar-primary)/0.15)] text-[hsl(239_76%_85%)]'
                      : 'text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          {timeseries && timeseries.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeseries.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--pillar-border))" />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--pillar-muted))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--pillar-muted))', fontSize: 10 }} tickFormatter={formatNumber} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--pillar-surface))',
                    border: '1px solid hsl(var(--pillar-border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [formatNumber(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="input_tokens" stroke="#6366f1" strokeWidth={2} dot={false} name="Input" />
                <Line type="monotone" dataKey="output_tokens" stroke="#f59e0b" strokeWidth={2} dot={false} name="Output" />
                <Line type="monotone" dataKey="total_tokens" stroke="#10b981" strokeWidth={2} dot={false} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-xs text-[hsl(var(--pillar-muted))]">No trend data for this period</div>
          )}
        </div>
      )}

      {/* ── Top Users Table ───────────────────────────────── */}
      {hasData && userData && userData.users.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
          <h3 className="mb-3 text-sm font-bold text-[hsl(var(--pillar-text))]">Top Users</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[hsl(var(--pillar-border))] text-[hsl(var(--pillar-muted))]">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">User</th>
                  <th className="pb-2 pr-4 font-semibold">Tokens</th>
                  <th className="pb-2 pr-4 font-semibold">Calls</th>
                  <th className="pb-2 pr-4 font-semibold">Avg/Call</th>
                  <th className="pb-2 pr-4 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {userData.users.map((u, i) => (
                  <tr key={u.user_id} className="border-b border-[hsl(var(--pillar-border)/0.5)] last:border-0">
                    <td className="py-2 pr-4 text-[hsl(var(--pillar-muted))]">{i + 1}</td>
                    <td className="py-2 pr-4 font-semibold text-[hsl(var(--pillar-text))]">{u.user_name}</td>
                    <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">{formatNumber(u.total_tokens)}</td>
                    <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">{u.call_count}</td>
                    <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">{formatNumber(u.avg_tokens_per_call)}</td>
                    <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">{formatCost(u.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pricing & Cost Summary ────────────────────────── */}
      {hasData && (
        <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">Model Pricing</h3>
            <button
              onClick={() => setShowPricingModal(true)}
              className="flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
            >
              <Settings className="h-3 w-3" />
              Configure
            </button>
          </div>
          {pricing && pricing.models.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[hsl(var(--pillar-border))] text-[hsl(var(--pillar-muted))]">
                    <th className="pb-2 pr-4 font-semibold">Model</th>
                    <th className="pb-2 pr-4 font-semibold">Input ($/1M)</th>
                    <th className="pb-2 pr-4 font-semibold">Output ($/1M)</th>
                    <th className="pb-2 pr-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.models.map(m => (
                    <tr key={m.model} className="border-b border-[hsl(var(--pillar-border)/0.5)] last:border-0">
                      <td className="py-2 pr-4 font-mono text-[hsl(var(--pillar-text))]">{m.model}</td>
                      <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">${m.input_price_per_1m}</td>
                      <td className="py-2 pr-4 text-[hsl(var(--pillar-text))]">${m.output_price_per_1m}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${m.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[hsl(var(--pillar-muted))]">No pricing configured</p>
          )}
        </div>
      )}

      {/* ── Budget Config Modal ────────────────────────────── */}
      {showBudgetModal && budgets && (
        <BudgetConfigModal
          budgets={budgets}
          onClose={() => setShowBudgetModal(false)}
          onSaved={() => { setShowBudgetModal(false); setRefreshKey(k => k + 1); }}
        />
      )}

      {/* ── Pricing Config Modal ───────────────────────────── */}
      {showPricingModal && pricing && (
        <PricingConfigModal
          pricing={pricing}
          onClose={() => setShowPricingModal(false)}
          onSaved={() => { setShowPricingModal(false); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────

function StatCard({ label, data, icon }: { label: string; data: PeriodStats; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
      <div className="flex items-center gap-1.5 text-[hsl(var(--pillar-muted))]">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-black text-[hsl(var(--pillar-text))]">{formatNumber(data.total_tokens)}</span>
        <span className="text-[10px] text-[hsl(var(--pillar-muted))]">tokens</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-[hsl(var(--pillar-muted))]">
        <span className="flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />{formatCost(data.cost_usd)}</span>
        <span>{data.call_count} calls</span>
      </div>
    </div>
  );
}

function BudgetBar({ label, data }: { label: string; data: BudgetPeriod }) {
  const pct = Math.min(data.percentage, 100);
  const color = getBudgetColor(data.percentage);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-[hsl(var(--pillar-text))]">{label}</span>
        {data.alert && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Alert
          </span>
        )}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--pillar-surface-alt))]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[hsl(var(--pillar-muted))]">
        <span>{formatNumber(data.used_tokens)} / {formatNumber(data.limit_tokens)} tokens</span>
        <span>{data.percentage.toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 text-[10px] text-[hsl(var(--pillar-muted))]">
        {formatCost(data.used_usd)} / {formatCost(data.limit_usd)} USD
      </div>
    </div>
  );
}

function BudgetConfigModal({ budgets, onClose, onSaved }: {
  budgets: BudgetData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [daily, setDaily] = useState({
    max_tokens: budgets.daily?.limit_tokens || 5000000,
    max_cost_usd: budgets.daily?.limit_usd || 10,
    alert_percentage: budgets.daily?.alert_percentage || 80,
  });
  const [monthly, setMonthly] = useState({
    max_tokens: budgets.monthly?.limit_tokens || 100000000,
    max_cost_usd: budgets.monthly?.limit_usd || 200,
    alert_percentage: budgets.monthly?.alert_percentage || 80,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/tokens/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'daily', ...daily }),
      });
      await fetch('/api/admin/tokens/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'monthly', ...monthly }),
      });
      onSaved();
    } catch {
      console.error('Failed to save budgets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Configure Budget Thresholds" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-xs font-bold text-[hsl(var(--pillar-text))]">Daily Limits</h4>
          <div className="grid grid-cols-3 gap-2">
            <ConfigInput label="Max Tokens" value={daily.max_tokens} onChange={(v) => setDaily({ ...daily, max_tokens: v })} />
            <ConfigInput label="Max Cost ($)" value={daily.max_cost_usd} onChange={(v) => setDaily({ ...daily, max_cost_usd: v })} step="0.01" />
            <ConfigInput label="Alert %" value={daily.alert_percentage} onChange={(v) => setDaily({ ...daily, alert_percentage: v })} />
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold text-[hsl(var(--pillar-text))]">Monthly Limits</h4>
          <div className="grid grid-cols-3 gap-2">
            <ConfigInput label="Max Tokens" value={monthly.max_tokens} onChange={(v) => setMonthly({ ...monthly, max_tokens: v })} />
            <ConfigInput label="Max Cost ($)" value={monthly.max_cost_usd} onChange={(v) => setMonthly({ ...monthly, max_cost_usd: v })} step="0.01" />
            <ConfigInput label="Alert %" value={monthly.alert_percentage} onChange={(v) => setMonthly({ ...monthly, alert_percentage: v })} />
          </div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} />
    </ModalShell>
  );
}

function PricingConfigModal({ pricing, onClose, onSaved }: {
  pricing: PricingData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [models, setModels] = useState(pricing.models.map(m => ({ ...m })));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const m of models) {
        await fetch('/api/admin/tokens/pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m.model,
            input_price_per_1m: m.input_price_per_1m,
            output_price_per_1m: m.output_price_per_1m,
          }),
        });
      }
      onSaved();
    } catch {
      console.error('Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Configure Model Pricing" onClose={onClose}>
      <div className="space-y-2">
        {models.map((m, i) => (
          <div key={m.model} className="grid grid-cols-3 items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] p-2">
            <span className="truncate font-mono text-[10px] text-[hsl(var(--pillar-text))]">{m.model}</span>
            <div className="flex flex-col">
              <label className="text-[9px] text-[hsl(var(--pillar-muted))]">Input $/1M</label>
              <input
                type="number"
                step="0.01"
                value={m.input_price_per_1m}
                onChange={(e) => {
                  const updated = [...models];
                  updated[i] = { ...m, input_price_per_1m: Number(e.target.value) };
                  setModels(updated);
                }}
                className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-2 py-1 text-xs text-[hsl(var(--pillar-text))] outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] text-[hsl(var(--pillar-muted))]">Output $/1M</label>
              <input
                type="number"
                step="0.01"
                value={m.output_price_per_1m}
                onChange={(e) => {
                  const updated = [...models];
                  updated[i] = { ...m, output_price_per_1m: Number(e.target.value) };
                  setModels(updated);
                }}
                className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-2 py-1 text-xs text-[hsl(var(--pillar-text))] outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
            </div>
          </div>
        ))}
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} />
    </ModalShell>
  );
}

// ── Modal Helpers ──────────────────────────────────────────

function ModalShell({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">{title}</h3>
          <button onClick={onClose} className="text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfigInput({ label, value, onChange, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[9px] text-[hsl(var(--pillar-muted))]">{label}</label>
      <input
        type="number"
        step={step || '1'}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2 py-1 text-xs text-[hsl(var(--pillar-text))] outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
      />
    </div>
  );
}

function ModalActions({ onClose, onSave, saving }: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        onClick={onClose}
        className="rounded-lg border border-[hsl(var(--pillar-border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(239_76%_58%)] disabled:opacity-50"
      >
        {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
        Save
      </button>
    </div>
  );
}
