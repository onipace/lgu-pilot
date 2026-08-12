'use client';

// src/app/dashboard/page.tsx
// Post-login app hub — 5 module cards (3+2 grid) as the demo home base.
// Each card links to its tool page. "Back to Menu" on each tool returns here.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  FileText,
  MessageSquare,
  Archive,
  Scale,
  LogOut,
  Shield,
} from 'lucide-react';
import { MODULE_CONFIG } from '@/lib/workshop-config';

const MODULES = [
  { ...MODULE_CONFIG.ella, icon: BookOpen, href: '/ella' },
  { ...MODULE_CONFIG.obra, icon: FileText, href: '/obra' },
  { ...MODULE_CONFIG.yala, icon: MessageSquare, href: '/yala' },
  { ...MODULE_CONFIG.likha, icon: Archive, href: '/likha' },
  { ...MODULE_CONFIG.linaw, icon: Scale, href: '/linaw' },
];

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check admin session first, then user session
    async function checkAuth() {
      try {
        const adminRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (adminRes.ok) {
          const data = await adminRes.json();
          setUser(data.user);
          setLoading(false);
          return;
        }
      } catch {}

      try {
        const userRes = await fetch('/api/auth/user/me', { credentials: 'include' });
        if (userRes.ok) {
          const data = await userRes.json();
          setUser(data.user);
          setLoading(false);
          return;
        }
      } catch {}

      // Not authenticated — redirect to login
      router.push('/login?returnUrl=/dashboard');
    }

    checkAuth();
  }, [router]);

  async function handleLogout() {
    // Clear both admin and user sessions
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    try {
      await fetch('/api/auth/user/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--pillar-primary))] border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))]">
      {/* ── Header ── */}
      <header className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[hsl(var(--pillar-primary))]" />
            <span className="text-lg font-bold tracking-wide text-white">eSANGGUNI</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-[hsl(var(--pillar-text))]">
                {user.display_name || user.username}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--pillar-muted))]">
                {user.role?.replace('_', ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] px-3 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Module Grid ── */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
            Welcome back
          </p>
          <h1 className="text-3xl font-black text-[hsl(var(--pillar-text))]">
            Choose Your Tool
          </h1>
          <p className="mt-3 text-sm text-[hsl(var(--pillar-muted))] max-w-lg mx-auto">
            Each AI-powered tool handles a specific part of the legislative process.
          </p>
        </div>

        {/* Row 1: 3 cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-5">
          {MODULES.slice(0, 3).map((mod) => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}
        </div>

        {/* Row 2: 2 cards, centered */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-2xl mx-auto">
          {MODULES.slice(3).map((mod) => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ModuleCard({ mod }: { mod: (typeof MODULES)[number] }) {
  const Icon = mod.icon;

  return (
    <Link
      href={mod.href}
      className="group relative overflow-hidden rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 transition-all hover:border-[hsl(var(--pillar-primary)/0.4)] hover:shadow-lg hover:shadow-[hsl(var(--pillar-primary)/0.08)]"
    >
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 h-1 w-full"
        style={{ background: mod.accentColor }}
      />

      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${mod.accentColor.replace(')', '/0.15)')}` }}
        >
          <Icon className="h-6 w-6" style={{ color: mod.accentColor }} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-lg font-black tracking-wide text-[hsl(var(--pillar-text))]">
            {mod.name}
          </p>
          <p className="text-xs font-semibold text-[hsl(var(--pillar-muted))]">
            {mod.fullName}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--pillar-muted))]">
        {mod.tagline}
      </p>
    </Link>
  );
}
