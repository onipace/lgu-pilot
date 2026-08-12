'use client';

import { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMessage = data?.error || 'Invalid username or password. Please check your credentials and try again.';
        throw new Error(errorMessage);
      }

      window.location.href = '/admin';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to connect to the server. Please check your internet connection and try again.';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4">
      {/* Subtle radial glow behind card */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-[hsl(239_84%_67%/0.06)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8 shadow-2xl">
          {/* Logo / Branding */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[hsl(239_76%_64%/0.3)] bg-[hsl(239_76%_64%/0.12)]">
              <Lock className="h-6 w-6 text-[hsl(239_76%_80%)]" />
            </div>
            <h1 className="text-xl font-black tracking-wider text-[hsl(var(--pillar-text))]">
              eSANGGUNI
            </h1>
            <p className="mt-1 text-xs font-medium tracking-wide text-[hsl(var(--pillar-muted))]">
              Admin Portal
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 rounded-lg border-2 border-red-500/50 bg-red-500/15 px-4 py-3 shadow-lg">
              <p className="text-sm font-semibold text-red-200">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted)/0.6)]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="admin"
                  disabled={loading}
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 pl-10 pr-3 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted)/0.6)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  disabled={loading}
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 pl-10 pr-10 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--pillar-muted)/0.5)] transition-colors hover:text-[hsl(var(--pillar-text))]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-[hsl(var(--pillar-muted)/0.5)]">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
