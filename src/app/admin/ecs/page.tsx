'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Globe,
  Shield,
  Activity,
  Plus,
  RefreshCw,
  MapPin,
  Cpu,
  HardDrive,
  Clock,
  Container,
  Key,
  Trash2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface EcsInstance {
  id: string;
  name: string;
  province: string;
  region: string | null;
  public_ip: string;
  ssh_port: number;
  ssh_user: string;
  status: string;
  last_health_check: string | null;
  notes: string | null;
  deployment_count: number;
  running_count: number;
  created_at: string;
}

interface HealthCheck {
  ecs_id: string;
  status: string;
  docker_version: string;
  containers_running: number;
  containers_total: number;
  cpu_usage: string;
  memory_usage: string;
  disk_usage: string;
  uptime: string;
  last_check: string;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  online: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', icon: CheckCircle2, label: 'Online' },
  offline: { color: 'text-red-400 bg-red-400/10 border-red-400/30', icon: XCircle, label: 'Offline' },
  error: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', icon: AlertCircle, label: 'Error' },
  unknown: { color: 'text-slate-400 bg-slate-400/10 border-slate-400/30', icon: AlertCircle, label: 'Unknown' },
};

export default function EcsPage() {
  const [instances, setInstances] = useState<EcsInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [healthChecks, setHealthChecks] = useState<Record<string, HealthCheck>>({});
  const [healthLoading, setHealthLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInstances(data.instances || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ECS instances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const checkHealth = async (ecsId: string) => {
    setHealthLoading(ecsId);
    try {
      const res = await fetch(`/api/admin/ecs/${ecsId}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthCheck = await res.json();
      setHealthChecks(prev => ({ ...prev, [ecsId]: data }));
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setHealthLoading(null);
    }
  };

  const deleteInstance = async (ecsId: string) => {
    try {
      const res = await fetch(`/api/admin/ecs/${ecsId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setDeleteConfirm(null);
      fetchInstances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInstances();
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(239_84%_67%/0.15)] border border-[hsl(239_84%_67%/0.3)]">
              <Server className="h-4 w-4 text-[hsl(239_84%_80%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                eSANGGUNI
              </span>
              <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">
                ECS Infrastructure
              </span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-[hsl(var(--pillar-primary)/0.3)] bg-[hsl(var(--pillar-primary)/0.1)] px-2.5 py-0.5 sm:flex">
              <Shield className="h-3 w-3 text-[hsl(var(--pillar-primary))]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-primary))]">
                Super Admin
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
              href="/admin/ecs/new"
              className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add ECS Instance
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">
              ECS Infrastructure
            </h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))] mt-0.5">
              {instances.length} instance{instances.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-[hsl(var(--pillar-surface))]" />
            ))}
          </div>
        )}

        {/* ECS Instance Cards */}
        {!loading && instances.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map(instance => {
              const status = statusConfig[instance.status] || statusConfig.unknown;
              const StatusIcon = status.icon;
              const health = healthChecks[instance.id];

              return (
                <div
                  key={instance.id}
                  className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-5 space-y-4 transition-all hover:border-[hsl(var(--pillar-primary)/0.3)]"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))] flex items-center gap-2">
                        <Server className="h-4 w-4 text-[hsl(var(--pillar-primary)/0.6)]" />
                        {instance.name}
                      </h3>
                      <p className="text-[10px] font-mono text-[hsl(var(--pillar-muted)/0.7)]">
                        {instance.public_ip}:{instance.ssh_port}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{instance.province}{instance.region ? `, ${instance.region}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <Container className="h-3.5 w-3.5" />
                      <span>
                        {instance.running_count || 0} / {instance.deployment_count || 0} deployments running
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted))]">
                      <Globe className="h-3.5 w-3.5" />
                      <span className="font-mono text-[10px]">{instance.ssh_user}@{instance.public_ip}</span>
                    </div>
                    {instance.last_health_check && (
                      <div className="flex items-center gap-2 text-[hsl(var(--pillar-muted)/0.7)]">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Last check: {new Date(instance.last_health_check).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Health check results */}
                  {health && (
                    <div className="rounded-lg border border-[hsl(var(--pillar-border)/0.5)] bg-[hsl(var(--pillar-surface-alt)/0.5)] p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                        Health Check
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5 text-[hsl(var(--pillar-muted))]">
                          <Cpu className="h-3 w-3" />
                          <span>CPU: {health.cpu_usage}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[hsl(var(--pillar-muted))]">
                          <Activity className="h-3 w-3" />
                          <span>Mem: {health.memory_usage}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[hsl(var(--pillar-muted))]">
                          <HardDrive className="h-3 w-3" />
                          <span>Disk: {health.disk_usage}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[hsl(var(--pillar-muted))]">
                          <Container className="h-3 w-3" />
                          <span>{health.containers_running}/{health.containers_total} containers</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-[hsl(var(--pillar-muted)/0.5)]">
                        Checked: {new Date(health.last_check).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {instance.notes && (
                    <p className="text-[10px] text-[hsl(var(--pillar-muted)/0.6)] italic">
                      {instance.notes}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[hsl(var(--pillar-border)/0.5)]">
                    <button
                      onClick={() => checkHealth(instance.id)}
                      disabled={healthLoading === instance.id}
                      className="flex items-center gap-1 rounded-lg border border-[hsl(var(--pillar-primary)/0.3)] bg-[hsl(var(--pillar-primary)/0.1)] px-2.5 py-1.5 text-[10px] font-semibold text-[hsl(var(--pillar-primary))] transition-colors hover:bg-[hsl(var(--pillar-primary)/0.2)] disabled:opacity-50"
                    >
                      {healthLoading === instance.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Activity className="h-3 w-3" />
                      )}
                      Check Health
                    </button>
                    <a
                      href={`/admin/deployments?ecs_id=${instance.id}`}
                      className="flex items-center gap-1 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2.5 py-1.5 text-[10px] font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
                    >
                      <Container className="h-3 w-3" />
                      Deployments
                    </a>
                    {deleteConfirm === instance.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => deleteInstance(instance.id)}
                          className="rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-400/20"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-2.5 py-1.5 text-[10px] font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(instance.id)}
                        disabled={instance.deployment_count > 0}
                        className="flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-400/20 ml-auto disabled:opacity-30 disabled:cursor-not-allowed"
                        title={instance.deployment_count > 0 ? 'Remove deployments first' : 'Delete instance'}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && instances.length === 0 && (
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.5)] px-6 py-16 text-center">
            <div className="mb-3 flex justify-center">
              <Server className="h-12 w-12 text-[hsl(var(--pillar-muted)/0.3)]" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-[hsl(var(--pillar-text)/0.6)]">
              No ECS instances registered
            </h3>
            <p className="text-sm text-[hsl(var(--pillar-muted))]">
              Register your first ECS server to start deploying LGU instances.
            </p>
            <a
              href="/admin/ecs/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)]"
            >
              <Plus className="h-4 w-4" />
              Add ECS Instance
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
