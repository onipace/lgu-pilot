'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ChevronRight, ArrowLeft } from 'lucide-react';

function getSafeReturnUrl(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//')) return '/dashboard';
  return raw.startsWith('/') ? raw : '/dashboard';
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const returnUrl = getSafeReturnUrl(searchParams.get('returnUrl'));

  useEffect(() => {
    fetch('/api/auth/user/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) window.location.href = returnUrl;
      })
      .catch(() => {});
  }, [returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setLoading(true);

    try {
      // Try admin login first
      const adminRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: email.trim(), password }),
      });

      if (adminRes.ok) {
        window.location.href = returnUrl;
        return;
      }

      // Fall back to regular user login
      const userRes = await fetch('/api/auth/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await userRes.json().catch(() => null);
      if (!userRes.ok) {
        setError(data?.error || 'Invalid email or password. Please check your credentials and try again.');
        setErrorCode(data?.code || null);
        setLoading(false);
        return;
      }

      window.location.href = returnUrl;
    } catch (err) {
      setError('Unable to connect to the server. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06]"
          style={{ background: 'hsl(var(--pillar-primary))', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to eSANGGUNI
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-1 text-2xl font-black tracking-widest text-[hsl(var(--pillar-text))]">
              eSANGGUNI
            </h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))]">Sign in to your account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border-2 border-red-500/50 bg-red-500/15 px-5 py-4 shadow-lg">
              <p className="text-sm font-semibold text-red-200">{error}</p>
              {errorCode === 'ACCOUNT_PENDING' && (
                <Link
                  href="/pending"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-300 underline hover:text-red-200"
                >
                  Check status <ChevronRight className="h-3 w-3" />
                </Link>
              )}
              {errorCode === 'ACCOUNT_REJECTED' && (
                <Link
                  href="/register"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-300 underline hover:text-red-200"
                >
                  Re-register <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email or Username */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com or admin username"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 pl-10 pr-10 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Sign In
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[hsl(var(--pillar-muted))]">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-semibold text-[hsl(var(--pillar-primary))] hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
