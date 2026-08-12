'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart2,
  Database,
  Users,
  Server,
  Globe,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
} from 'lucide-react';
import type { AdminUserRecord } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: typeof BarChart2;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Analytics', href: '/admin', icon: BarChart2 },
  { label: 'Knowledge Base', href: '/admin/kb', icon: Database },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Deployments', href: '/admin/deployments', icon: Server, superAdminOnly: true },
  { label: 'ECS', href: '/admin/ecs', icon: Globe, superAdminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUserRecord | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Check auth on mount and route change; skip redirect when already on login page
  useEffect(() => {
    const checkAuth = async () => {
      if (pathname === '/admin/login') {
        setAuthChecked(true);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          window.location.href = '/admin/login';
          return;
        }
        const data = await res.json();
        setUser(data.user ?? data);
      } catch {
        window.location.href = '/admin/login';
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/admin/login';
    }
  };

  // Skip nav shell on login page
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading spinner while checking auth
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--pillar-border))] border-t-[hsl(var(--pillar-primary))]" />
          <span className="text-xs text-[hsl(var(--pillar-muted))]">Authenticating...</span>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  const filteredNav = NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* ── Top Navigation Bar ────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.97)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            {/* Brand */}
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(239_76%_64%/0.3)] bg-[hsl(239_76%_64%/0.12)]">
                <BarChart2 className="h-4 w-4 text-[hsl(239_76%_80%)]" />
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-black tracking-wider text-[hsl(var(--pillar-text))]">
                  eSANGGUNI
                </span>
                <span className="ml-1.5 text-[10px] font-medium text-[hsl(var(--pillar-muted))]">
                  Admin
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {filteredNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[hsl(var(--pillar-primary)/0.15)] text-[hsl(239_76%_85%)]'
                        : 'text-[hsl(var(--pillar-muted))] hover:bg-[hsl(var(--pillar-surface-alt))] hover:text-[hsl(var(--pillar-text))]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: User info + Logout (desktop) */}
          <div className="hidden items-center gap-3 md:flex">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-3 py-1.5 text-xs transition-colors hover:border-[hsl(var(--pillar-primary)/0.3)]"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--pillar-primary)/0.2)]">
                    <Shield className="h-3 w-3 text-[hsl(239_76%_80%)]" />
                  </div>
                  <span className="font-semibold text-[hsl(var(--pillar-text))]">
                    {user.display_name || user.username}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      isSuperAdmin
                        ? 'border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.12)] text-[hsl(38_95%_65%)]'
                        : 'border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] text-[hsl(var(--pillar-muted))]'
                    }`}
                  >
                    {isSuperAdmin ? 'Super Admin' : 'LGU Admin'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-[hsl(var(--pillar-muted))]" />
                </button>

                {/* User dropdown */}
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-1 shadow-xl">
                      <div className="border-b border-[hsl(var(--pillar-border))] px-3 py-2">
                        <p className="text-xs font-semibold text-[hsl(var(--pillar-text))]">
                          {user.display_name || user.username}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--pillar-muted))]">
                          @{user.username}
                        </p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4 text-[hsl(var(--pillar-text))]" />
            ) : (
              <Menu className="h-4 w-4 text-[hsl(var(--pillar-text))]" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] md:hidden">
            <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3">
              {filteredNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[hsl(var(--pillar-primary)/0.15)] text-[hsl(239_76%_85%)]'
                        : 'text-[hsl(var(--pillar-muted))] hover:bg-[hsl(var(--pillar-surface-alt))] hover:text-[hsl(var(--pillar-text))]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}

              <div className="!mt-3 border-t border-[hsl(var(--pillar-border))] pt-3">
                {user && (
                  <div className="mb-2 flex items-center gap-2 px-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--pillar-primary)/0.2)]">
                      <Shield className="h-3 w-3 text-[hsl(239_76%_80%)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--pillar-text))]">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--pillar-muted))]">
                        {isSuperAdmin ? 'Super Admin' : 'LGU Admin'}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── Page Content ──────────────────────────────────────────── */}
      <main>{children}</main>
    </div>
  );
}
