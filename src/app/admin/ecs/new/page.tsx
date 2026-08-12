'use client';

import { useState } from 'react';
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
} from 'lucide-react';

export default function NewEcsPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState('');
  const [publicIp, setPublicIp] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [sshKeyPath, setSshKeyPath] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        name,
        province,
        region: region || null,
        public_ip: publicIp,
        ssh_port: parseInt(sshPort) || 22,
        ssh_user: sshUser || 'root',
        ssh_key_path: sshKeyPath || null,
        notes: notes || null,
      };

      const res = await fetch('/api/admin/ecs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const created = await res.json();
      setSuccess(`ECS instance "${(created as any).name}" created successfully!`);

      // Reset form
      setName('');
      setProvince('');
      setRegion('');
      setPublicIp('');
      setSshPort('22');
      setSshUser('root');
      setSshKeyPath('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ECS instance');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)] transition-colors";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] mb-1.5";

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <a
            href="/admin/ecs"
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </a>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(239_84%_67%/0.15)] border border-[hsl(239_84%_67%/0.3)]">
              <Plus className="h-4 w-4 text-[hsl(239_84%_80%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                Add ECS Instance
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
                href="/admin/ecs"
                className="text-xs text-emerald-400/70 hover:text-emerald-300 mt-1 inline-block"
              >
                View all ECS instances &rarr;
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
              Server Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Instance Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., ECS-Quezon-01"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Public IP *</label>
                <input
                  type="text"
                  value={publicIp}
                  onChange={(e) => setPublicIp(e.target.value)}
                  placeholder="e.g., 203.177.xx.xx"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Province *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="e.g., Quezon"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Region</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g., Region IV-A (CALABARZON)"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
              SSH Configuration
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>SSH Port</label>
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>SSH User</label>
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>SSH Key Path</label>
                <input
                  type="text"
                  value={sshKeyPath}
                  onChange={(e) => setSshKeyPath(e.target.value)}
                  placeholder="e.g., /root/.ssh/ecs-quezon-01.pem"
                  className={inputClass}
                />
                <p className="mt-1 text-[10px] text-[hsl(var(--pillar-muted)/0.6)]">
                  Path to the SSH private key on the management server.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-5">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
              Additional Information
            </h2>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this ECS instance..."
                rows={3}
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <a
              href="/admin/ecs"
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--pillar-primary)/0.9)] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {submitting ? 'Creating...' : 'Add ECS Instance'}
            </button>
          </div>
        </form>

        {/* Back link */}
        <div className="pt-6">
          <a
            href="/admin/ecs"
            className="text-xs text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors"
          >
            &larr; Back to ECS Infrastructure
          </a>
        </div>
      </main>
    </div>
  );
}
