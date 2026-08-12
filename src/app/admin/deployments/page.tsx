'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Container,
  Play,
  Square,
  RotateCw,
  Hammer,
  Trash2,
  Plus,
  ChevronDown,
  RefreshCw,
  MapPin,
  Globe,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';

interface Deployment {
  id: string;
  lgu_id: string;
  lgu_name: string;
  lgu_type: string;
  lgu_class: string | null;
  province: string;
  ecs_instance_id: string;
  ecs_name: string | null;
  ecs_public_ip: string | null;
  container_name: string;
  container_port: number;
  image_tag: string;
  status: string;
  domain: string | null;
  last_deployed_at: string | null;
  health_status: string | null;
  error_message: string | null;
  created_at: string;
}

interface DeploymentStats {
  total: number;
  running: number;
  stopped: number;
  error: number;
  building: number;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  running: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', icon: CheckCircle2, label: 'Running' },
  stopped: { color: 'text-slate-400 bg-slate-400/10 border-slate-400/30', icon: Square, label: 'Stopped' },
  error: { color: 'text-red-400 bg-red-400/10 border-red-400/30', icon: XCircle, label: 'Error' },
  building: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', icon: Loader2, label: 'Building' },
  unknown: { color: 'text-slate-500 bg-slate-500/10 border-slate-500/30', icon: AlertCircle, label: 'Unknown' },
};

const lguTypeLabels: Record<string, string> = {
  municipality: 'Municipality',
  city: 'City',
  component_city: 'Component City',
  huc: 'HUC',
};

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeployments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProvince) params.set('province', selectedProvince);
      if (selectedStatus) params.set('status', selectedStatus);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/deployments?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setDeployments(data.deployments || []);

      // Extract unique provinces
      const uniqueProvinces = [...new Set(data.deployments.map((d: Deployment) => d.province))].sort();
      setProvinces(uniqueProvinces as string[]);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deployments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProvince, selectedStatus]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const stats: DeploymentStats = {
    total: deployments.length,
    running: deployments.filter(d => d.status === 'running').length,
    stopped: deployments.filter(d => d.status === 'stopped').length,
    error: deployments.filter(d => d.status === 'error').length,
    building: deployments.filter(d => d.status === 'building').length,
  };

  const executeAction = async (deploymentId: string, action: string) => {
    setActionLoading(deploymentId);
    setActionResult(null);

    try {
      const res = await fetch(`/api/admin/deployments/${deploymentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      setActionResult({
        id: deploymentId,
        message: `Action "${action}" executed. Status: ${result.updated_status}`,
        type: 'success',
      });

      // Refresh list
      fetchDeployments();
    } catch (err) {
      setActionResult({
        id: deploymentId,
        message: err instanceof Error ? err.message : 'Action failed',
        type: 'error',
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionResult(null), 5000);
    }
  };

  const deleteDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment record?')) return;

    try {
      const res = await fetch(`/api/admin/deployments/${deploymentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      fetchDeployments();
    } catch (err) {
      setActionResult({
        id: deploymentId,
        message: err instanceof Error ? err.message : 'Delete failed',
        type: 'error',
      });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeployments();
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(174_72%_36%/0.15)] border border-[hsl(174_72%_36%/0.3)]">
              <Container className="h-4 w-4 text-[hsl(174_72%_55%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                eSANGGUNI
              </span>
              <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">
                Deployment Manager
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href="/admin/deployments/new"
              className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Deployment
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Title and Stats */}
        <div>
          <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">
            LGU Deployments
          </h1>
          <p className="text-xs text-[hsl(var(--pillar-muted))] mt-0.5">
            Manage container deployments across ECS infrastructure
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">Total</p>
            <p className="mt-1 text-2xl font-black text-[hsl(var(--pillar-text))]">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/70">Running</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">{stats.running}</p>
          </div>
          <div className="rounded-xl border border-slate-400/20 bg-slate-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400/70">Stopped</p>
            <p className="mt-1 text-2xl font-black text-slate-400">{stats.stopped}</p>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400/70">Error</p>
            <p className="mt-1 text-2xl font-black text-red-400">{stats.error}</p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/70">Building</p>
            <p className="mt-1 text-2xl font-black text-amber-400">{stats.building}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] pl-3 pr-8 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
            >
              <option value="">All Provinces</option>
              {provinces.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
          </div>

          <div className="flex gap-1">
            {['', 'running', 'stopped', 'error', 'building'].map(s => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  selectedStatus === s
                    ? 'bg-[hsl(var(--pillar-primary))] text-white'
                    : 'border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Action result toast */}
        {actionResult && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            actionResult.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}>
            {actionResult.message}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-[hsl(var(--pillar-surface))]" />
            ))}
          </div>
        )}

        {/* Deployment Cards */}
        {!loading && deployments.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deployments.map(deployment => {
              const status = statusConfig[deployment.status] || statusConfig.unknown;
              const StatusIcon = status.icon;

              return (
                <div
                  key={deployment.id}
                  className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 space-y-4 transition-all hover:border-[hsl(var(--pillar-primary)/0.3)]"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
                        {deployment.lgu_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--pillar-muted))]">
                        <span className="rounded-full border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2 py-0.5 font-semibold">
                          {lguTypeLabels[deployment.lgu_type] || deployment.lgu_type}
                        </span>
                        {deployment.lgu_class && (
                          <span>{deployment.lgu_class} Class</span>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.color}`}>
                      <StatusIcon className={`h-3 w-3 ${deployment.status === 'building' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </div>
                  </div>

                  {/* Info Rows */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{deployment.province}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <Server className="h-3.5 w-3.5" />
                      <span>{deployment.ecs_name || 'Unassigned'}</span>
                      {deployment.ecs_public_ip && (
                        <span className="text-[hsl(var(--pillar-muted)/0.6)]">({deployment.ecs_public_ip})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <Container className="h-3.5 w-3.5" />
                      <code className="font-mono text-[10px]">{deployment.container_name}</code>
                      <span className="text-[hsl(var(--pillar-muted)/0.6)]">:{deployment.container_port}</span>
                    </div>
                    {deployment.domain && (
                      <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                        <Globe className="h-3.5 w-3.5" />
                        <span className="text-[hsl(var(--pillar-primary)/0.8)]">{deployment.domain}</span>
                      </div>
                    )}
                    {deployment.last_deployed_at && (
                      <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted)/0.7)]">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Deployed {new Date(deployment.last_deployed_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {deployment.error_message && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] text-red-300">
                      {deployment.error_message}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[hsl(var(--pillar-border)/0.5)]">
                    {deployment.status !== 'running' && (
                      <button
                        onClick={() => executeAction(deployment.id, 'start')}
                        disabled={actionLoading === deployment.id}
                        className="flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </button>
                    )}
                    {deployment.status === 'running' && (
                      <button
                        onClick={() => executeAction(deployment.id, 'stop')}
                        disabled={actionLoading === deployment.id}
                        className="flex items-center gap-1 rounded-lg border border-slate-400/30 bg-slate-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-400/20 disabled:opacity-50"
                      >
                        <Square className="h-3 w-3" />
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => executeAction(deployment.id, 'restart')}
                      disabled={actionLoading === deployment.id}
                      className="flex items-center gap-1 rounded-lg border border-[hsl(var(--pillar-primary)/0.3)] bg-[hsl(var(--pillar-primary)/0.1)] px-2.5 py-1.5 text-[10px] font-semibold text-[hsl(var(--pillar-primary))] transition-colors hover:bg-[hsl(var(--pillar-primary)/0.2)] disabled:opacity-50"
                    >
                      <RotateCw className={`h-3 w-3 ${actionLoading === deployment.id ? 'animate-spin' : ''}`} />
                      Restart
                    </button>
                    <button
                      onClick={() => executeAction(deployment.id, 'rebuild')}
                      disabled={actionLoading === deployment.id}
                      className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
                    >
                      <Hammer className="h-3 w-3" />
                      Rebuild
                    </button>
                    <button
                      onClick={() => deleteDeployment(deployment.id)}
                      className="flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-400/20 ml-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && deployments.length === 0 && (
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.5)] px-6 py-16 text-center">
            <div className="mb-3 flex justify-center">
              <Container className="h-12 w-12 text-[hsl(var(--pillar-muted)/0.3)]" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-[hsl(var(--pillar-text)/0.6)]">
              No deployments yet
            </h3>
            <p className="text-sm text-[hsl(var(--pillar-muted))]">
              Create your first LGU deployment to get started.
            </p>
            <a
              href="/admin/deployments/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)]"
            >
              <Plus className="h-4 w-4" />
              Create Deployment
            </a>
          </div>
        )}

        {/* Back link */}
        <div className="pt-4">
          <a
            href="/admin"
            className="text-xs text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors"
          >
            &larr; Back to Admin Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
