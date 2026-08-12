'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ArrowLeft, RefreshCw } from 'lucide-react';

export default function PendingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get user info — but they might not be logged in yet
    fetch('/api/auth/user/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUserEmail(data.user?.email || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06]"
          style={{ background: 'hsl(var(--pillar-gold))', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to eSANGGUNI
        </Link>

        <div className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8 text-center">
          {/* Clock icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--pillar-gold)/0.15)] border border-[hsl(var(--pillar-gold)/0.3)]">
            <Clock className="h-8 w-8" style={{ color: 'hsl(38 95% 55%)' }} />
          </div>

          <h1 className="mb-2 text-xl font-black text-[hsl(var(--pillar-text))]">
            Awaiting Approval
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-[hsl(var(--pillar-muted))]">
            Your registration has been submitted and is pending review by an administrator.
            You will receive an email notification once your account is approved.
          </p>

          {userEmail && (
            <div className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] p-4 mb-6">
              <p className="text-xs text-[hsl(var(--pillar-muted))] mb-1">Registered email</p>
              <p className="text-sm font-bold text-[hsl(var(--pillar-text))]">{userEmail}</p>
            </div>
          )}

          <div className="mb-6 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt)] p-4">
            <div className="flex items-start gap-3 text-left">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--pillar-muted))]" />
              <div>
                <p className="text-xs font-semibold text-[hsl(var(--pillar-text))]">What happens next?</p>
                <p className="mt-1 text-xs text-[hsl(var(--pillar-muted))]">
                  An administrator will review your registration details. This usually takes 1-2 business days. Once approved, you can sign in to access E.L.L.A., O.B.R.A., and Y.A.L.A.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Go to Login
            </Link>
            <Link
              href="/register"
              className="text-xs font-semibold text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
            >
              Register a different email
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
