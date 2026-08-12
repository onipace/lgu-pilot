'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, Loader2 } from 'lucide-react';

interface UserAuthGateProps {
  children: React.ReactNode;
}

/**
 * Client-side auth gate for protected pages (ELLA, OBRA, YALA).
 * Validates the user session and handles:
 * - Loading state while checking auth
 * - Redirect to /login if no session
 * - Pending status page if account not yet approved
 * - Full page render if authenticated
 */
export default function UserAuthGate({ children }: UserAuthGateProps) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'pending' | 'unauthenticated'>('loading');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/user/me', { credentials: 'include' });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setStatus('authenticated');
          return;
        }

        // 401 = no session
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
          setStatus('unauthenticated');
          return;
        }

        // Fallback
        setStatus('unauthenticated');
      } catch {
        setStatus('unauthenticated');
      }
    };

    checkAuth();
  }, []);

  // Handle redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      const currentPath = window.location.pathname;
      router.push(`/login?returnUrl=${encodeURIComponent(currentPath)}`);
    }
  }, [status, router]);

  // ── Loading ─────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--pillar-primary))]" />
          <p className="text-xs text-[hsl(var(--pillar-muted))]">Verifying session...</p>
        </div>
      </div>
    );
  }

  // ── Pending approval ────────────────────────────────────────
  if (status === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--pillar-gold)/0.15)] border border-[hsl(var(--pillar-gold)/0.3)]">
            <Clock className="h-8 w-8" style={{ color: 'hsl(38 95% 55%)' }} />
          </div>
          <h1 className="mb-2 text-xl font-black text-[hsl(var(--pillar-text))]">
            Awaiting Approval
          </h1>
          <p className="mb-6 text-sm text-[hsl(var(--pillar-muted))]">
            Your account is pending admin approval. You&apos;ll receive an email when approved.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── Unauthenticated (redirecting) ──────────────────────────
  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--pillar-primary))]" />
          <p className="text-xs text-[hsl(var(--pillar-muted))]">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // ── Authenticated — render children ────────────────────────
  return <>{children}</>;
}
