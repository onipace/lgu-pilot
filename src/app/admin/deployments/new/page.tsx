'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
} from 'lucide-react';

interface EcsInstance {
  id: string;
  name: string;
  province: string;
  public_ip: string;
}

export default function NewDeploymentPage() {
  const [ecsInstances, setEcsInstances] = useState<EcsInstance[]>([]);
  const [loadingEcs, setLoadingEcs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [lguName, setLguName] = useState('');
  const [lguType, setLguType] = useState('municipality');
  const [lguClass, setLguClass] = useState('');
  const [province, setProvince] = useState('');
  const [ecsInstanceId, setEcsInstanceId] = useState('');
  const [containerName, setContainerName] = useState('');
  const [containerPort, setContainerPort] = useState('3000');
  const [domain, setDomain] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [imageTag, setImageTag] = useState('latest');

  // Fetch ECS instances for dropdown
  useEffect(() => {
    const fetchEcs = async () => {
      try {
        const res = await fetch('/api/admin/ecs');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEcsInstances(data.instances || []);
      } catch (err) {
        console.error('Failed to load ECS instances:', err);
      } finally {
        setLoadingEcs(false);
      }
    };
    fetchEcs();
  }, []);

  // Auto-generate container name from LGU name
  const generateContainerName = (name: string): string => {
    return 'esangguni-' + name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  };

  const handleLguNameChange = (value: string) => {
    setLguName(value);
    setContainerName(generateContainerName(value));
  };

  // Generate LGU ID from name
  const generateLguId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        lgu_id: generateLguId(lguName),
        lgu_name: lguName,
        lgu_type: lguType,
        lgu_class: lguClass || null,
        province,
        ecs_instance_id: ecsInstanceId,
        container_name: containerName,
        container_port: parseInt(containerPort) || 3000,
        domain: domain || null,
        openrouter_api_key: openrouterApiKey || null,
        image_tag: imageTag || 'latest',
      };

      const res = await fetch('/api/admin/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const created = await res.json();
      setSuccess(`Deployment "${created.lgu_name}" created successfully!`);

      // Reset form
      setLguName('');
      setLguType('municipality');
      setLguClass('');
      setProvince('');
      setEcsInstanceId('');
      setContainerName('');
      setContainerPort('3000');
      setDomain('');
      setOpenrouterApiKey('');
      setImageTag('latest');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deployment');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)] transition-colors";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] mb-1.5";
  const selectClass = "w-full appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)] transition-colors";

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <a
            href="/admin/deployments"
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </a>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(174_72%_36%/0.15)] border border-[hsl(174_72%_36%/0.3)]">
              <Plus className="h-4 w-4 text-[hsl(174_72%_55%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                New Deployment
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Success state */}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">{success}</p>
              <a
                href="/admin/deployments"
                className="text-xs text-emerald-400/70 hover:text-emerald-300 mt-1 inline-block"
              >
                View all deployments &rarr;
              </a>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm font-semibold text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))] flex items-center gap-2">
              <Server className="h-4 w-4 text-[hsl(var(--pillar-primary))]" />
              LGU Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>LGU Name *</label>
                <input
                  type="text"
                  value={lguName}
                  onChange={(e) => handleLguNameChange(e.target.value)}
                  placeholder="e.g., Lucena City, Sariaya, Tayabas"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>LGU Type *</label>
                <select
                  value={lguType}
                  onChange={(e) => setLguType(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="municipality">Municipality</option>
                  <option value="city">City</option>
                  <option value="component_city">Component City</option>
                  <option value="huc">Highly Urbanized City (HUC)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>LGU Class</label>
                <select
                  value={lguClass}
                  onChange={(e) => setLguClass(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Not specified</option>
                  <option value="1st">1st Class</option>
                  <option value="2nd">2nd Class</option>
                  <option value="3rd">3rd Class</option>
                  <option value="4th">4th Class</option>
                  <option value="5th">5th Class</option>
                  <option value="6th">6th Class</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Province *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="e.g., Quezon, Batangas, Laguna"
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))] flex items-center gap-2">
              <Server className="h-4 w-4 text-[hsl(174_72%_55%)]" />
              Infrastructure
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>ECS Instance *</label>
                {loadingEcs ? (
                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--pillar-muted))] py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading ECS instances...
                  </div>
                ) : (
                  <select
                    value={ecsInstanceId}
                    onChange={(e) => setEcsInstanceId(e.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="">Select ECS instance...</option>
                    {ecsInstances.map(ecs => (
                      <option key={ecs.id} value={ecs.id}>
                        {ecs.name} ({ecs.public_ip}) - {ecs.province}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Container Name</label>
                <input
                  type="text"
                  value={containerName}
                  onChange={(e) => setContainerName(e.target.value)}
                  placeholder="Auto-generated from LGU name"
                  className={inputClass}
                />
                <p className="mt-1 text-[10px] text-[hsl(var(--pillar-muted)/0.6)]">
                  Auto-generated. Edit to override.
                </p>
              </div>

              <div>
                <label className={labelClass}>Container Port</label>
                <input
                  type="number"
                  value={containerPort}
                  onChange={(e) => setContainerPort(e.target.value)}
                  placeholder="3000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g., lucena.esangguni.gov.ph"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Image Tag</label>
                <input
                  type="text"
                  value={imageTag}
                  onChange={(e) => setImageTag(e.target.value)}
                  placeholder="latest"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
              API Keys
            </h2>

            <div>
              <label className={labelClass}>OpenRouter API Key</label>
              <input
                type="password"
                value={openrouterApiKey}
                onChange={(e) => setOpenrouterApiKey(e.target.value)}
                placeholder="sk-or-..."
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-[hsl(var(--pillar-muted)/0.6)]">
                Optional. Can be configured later via deployment settings.
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <a
              href="/admin/deployments"
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting || loadingEcs}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {submitting ? 'Creating...' : 'Create Deployment'}
            </button>
          </div>
        </form>

        {/* Back link */}
        <div className="pt-6">
          <a
            href="/admin/deployments"
            className="text-xs text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors"
          >
            &larr; Back to Deployments
          </a>
        </div>
      </main>
    </div>
  );
}
