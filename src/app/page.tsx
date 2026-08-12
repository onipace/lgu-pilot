'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  FileText,
  MessageSquare,
  ChevronRight,
  Scale,
  Users,
  Award,
  Archive,
  Clock,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ModuleCard from '@/components/pillar/module-card';
import OrdinanceLifecycle from '@/components/shared/ordinance-lifecycle';
import { MODULE_CONFIG } from '@/lib/workshop-config';

const MODULES = [
  { ...MODULE_CONFIG.ella, icon: BookOpen },
  { ...MODULE_CONFIG.obra, icon: FileText },
  { ...MODULE_CONFIG.yala, icon: MessageSquare },
  { ...MODULE_CONFIG.likha, icon: Archive },
  { ...MODULE_CONFIG.linaw, icon: Scale },
];

const BENEFITS = [
  {
    icon: Clock,
    title: 'Save Weeks of Research',
    description: 'Find relevant laws, precedents, and DILG opinions in seconds — not days. AI searches 2,643 legal documents instantly.',
    accent: 'hsl(239 76% 64%)',
  },
  {
    icon: Shield,
    title: 'Reduce Legal Errors',
    description: 'Every answer is grounded in actual Philippine law with citations. No guesswork, no hallucinations — just verified legal guidance.',
    accent: 'hsl(158 64% 45%)',
  },
  {
    icon: Users,
    title: 'Serve Constituents Better',
    description: 'Answer citizen questions about permits, taxes, and ordinances 24/7 through AI — in Filipino, English, or Bisaya.',
    accent: 'hsl(38 95% 55%)',
  },
];

const KNOWLEDGE_CATEGORIES = [
  { value: '532', label: 'R.A. 7160 Sections' },
  { value: '39', label: 'IRR Provisions' },
  { value: '1,562', label: 'DILG Opinions' },
  { value: '161', label: 'SC Jurisprudence' },
  { value: '349', label: 'Pitogo Ordinances' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* ─ Navigation ─────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[hsl(var(--pillar-bg)/0.95)] backdrop-blur-md border-b border-[hsl(var(--pillar-border))]'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl font-bold text-white tracking-wide">
              eSANGGUNI
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#benefits" className="text-sm font-medium text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Benefits</Link>
            <Link href="#modules" className="text-sm font-medium text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Tools</Link>
            <Link href="#process" className="text-sm font-medium text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">How It Works</Link>
            <Link href="/login" className="text-sm font-medium text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Login</Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)] hover:shadow-[0_0_20px_hsl(239_84%_67%/0.4)]"
            >
              Book a Demo
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-[hsl(var(--pillar-muted))]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[hsl(var(--pillar-bg)/0.98)] backdrop-blur-md border-b border-[hsl(var(--pillar-border))] px-6 py-4">
            <div className="flex flex-col gap-4">
              <Link href="#benefits" className="text-sm font-medium text-[hsl(var(--pillar-muted))]" onClick={() => setMobileMenuOpen(false)}>Benefits</Link>
              <Link href="#modules" className="text-sm font-medium text-[hsl(var(--pillar-muted))]" onClick={() => setMobileMenuOpen(false)}>Tools</Link>
              <Link href="#process" className="text-sm font-medium text-[hsl(var(--pillar-muted))]" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
              <Link href="/login" className="text-sm font-medium text-[hsl(var(--pillar-muted))]" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Book a Demo
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/images/esangguni-hero.jpg"
            alt="Philippine municipal landscape with Mt. Banahaw at golden hour"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlays for text readability — darker for bright photo */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-12 text-center md:text-left md:pt-28 md:pb-16">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pillar-gold))] animate-pulse" />
              AI for Local Government
            </div>

            {/* Headline */}
            <h1 className="mb-3 text-4xl font-black leading-tight tracking-tight text-white md:text-6xl lg:text-7xl">
              Smart Legislation
              <br />
              for LGUs
            </h1>

            {/* Subheadline */}
            <p className="mb-6 text-lg text-white/80 md:text-xl max-w-3xl">
              AI-powered legislative platform that helps transform how Philippine local government units research laws, draft ordinances, respond to constituent inquiries, digitize archives, codify ordinances and generate insights — faster and more accurately than ever.
            </p>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 sm:flex-row md:items-start">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--pillar-primary))] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)] hover:shadow-[0_0_30px_hsl(239_84%_67%/0.5)] active:scale-[0.97]"
              >
                Book a Demo
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span>DILG MC 2026-041 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Powered by BAYANAIHAN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="h-6 w-6 text-white/50 rotate-90" />
        </div>
      </section>

      {/* ── Benefits Section ───────────────────────────────────────── */}
      <section id="benefits" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-gold))]">
            Why eSANGGUNI
          </p>
          <h2 className="text-3xl font-black text-[hsl(var(--pillar-text))] md:text-4xl">
            Built for The SANGGUNIAN
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--pillar-muted))] max-w-2xl mx-auto">
            Designed to empower vice mayors, sanggunian members, and staff for legislative excellence.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description, accent }, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8"
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
              >
                <Icon className="h-6 w-6" style={{ color: accent }} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[hsl(var(--pillar-text))]">{title}</h3>
              <p className="text-sm leading-relaxed text-[hsl(var(--pillar-muted))]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ordinance Lifecycle ───────────────────────────────────── */}
      <section id="process" className="border-y border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.3)]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-gold))]">
              The Complete Ordinance Lifecycle
            </p>
            <h2 className="text-3xl font-black text-[hsl(var(--pillar-text))] md:text-4xl">
              Powered by AI
            </h2>
            <p className="mt-4 text-sm text-[hsl(var(--pillar-muted))] max-w-2xl mx-auto">
              From legal research to codified law, eSANGGUNI guides every stage of your legislative workflow. Research precedents, draft ordinances, assess compliance risks, archive documents, codify volumes, track lineage, and generate insights — all in one platform built for the Sanggunian.
            </p>
          </div>

          <OrdinanceLifecycle />
        </div>
      </section>

      {/* ── Module Cards ───────────────────────────────────────────── */}
      <section id="modules" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
            AI Tools
          </p>
          <h2 className="text-3xl font-black text-[hsl(var(--pillar-text))] md:text-4xl">
            Five Tools, One Platform
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--pillar-muted))] max-w-2xl mx-auto">
            Each tool handles a specific part of your legislative work. Research, draft, simulate, digitize, and codify — all in one place.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
          {MODULES.map((mod) => (
            <ModuleCard
              key={mod.id}
              acronym={mod.name}
              fullName={mod.fullName}
              workshopTopic={mod.workshopSubtopic}
              description={mod.description}
              tagline={mod.tagline}
              accentColor={mod.accentColor}
              accentClass={mod.accentClass}
              buttonClass={mod.buttonClass}
              href={mod.href}
              icon={mod.icon}
            />
          ))}
        </div>
      </section>

      {/* ── Knowledge Base ─────────────────────────────────────────── */}
      <section className="border-y border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.3)]">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
            Legal Knowledge Base
          </p>
          <h2 className="text-2xl font-black text-[hsl(var(--pillar-text))] md:text-3xl">
            2,643 Legal Documents at Your Fingertips
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--pillar-muted))] max-w-xl mx-auto">
            Every answer is grounded in actual Philippine law — not guesswork.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {KNOWLEDGE_CATEGORIES.map(({ value, label }, i) => (
              <div
                key={i}
                className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-4 py-5 text-center"
              >
                <span className="block text-2xl font-black text-[hsl(var(--pillar-text))]">{value}</span>
                <span className="mt-1 block text-xs text-[hsl(var(--pillar-muted))]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────── */}
      <section className="border-t border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.3)]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-black text-[hsl(var(--pillar-text))] md:text-4xl">
            Ready to Transform Your LGU Legislation?
          </h2>
          <p className="mt-4 text-base text-[hsl(var(--pillar-muted))] max-w-xl mx-auto">
            See how eSANGGUNI empowers your Sanggunian with AI-powered legal research, ordinance drafting, and constituent services.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--pillar-primary))] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)] hover:shadow-[0_0_30px_hsl(239_84%_67%/0.5)]"
            >
              Book a Demo
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.4)]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <span className="text-lg font-black tracking-widest text-[hsl(var(--pillar-text))]">
                  eSANGGUNI
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--pillar-muted))] max-w-md">
                AI-powered smart legislation platform for Philippine Local Government Units. Helping LGUs research, draft, and codify ordinances faster and more accurately.
              </p>
              <p className="mt-4 text-xs text-[hsl(var(--pillar-muted))/0.6]">
                Powered by BAYANAIHAN · Sangguniang Bayan ng Pitogo, Quezon
              </p>
            </div>

            {/* Tools */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))] mb-4">AI Tools</h3>
              <ul className="space-y-2">
                <li><Link href="/ella" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">E.L.L.A. — Legal Researcher</Link></li>
                <li><Link href="/obra" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">O.B.R.A. — Ordinance Builder</Link></li>
                <li><Link href="/yala" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Y.A.L.A. — AI Assistant</Link></li>
                <li><Link href="/likha" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">L.I.K.H.A. — Archive Digitizer</Link></li>
                <li><Link href="/linaw" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">L.I.N.A.W. — Ordinance Codifier</Link></li>
              </ul>
            </div>

            {/* Platform */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))] mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><Link href="/login" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Login</Link></li>
                <li><Link href="/register" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Register</Link></li>
                <li><Link href="/admin" className="text-sm text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))] transition-colors">Admin</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-[hsl(var(--pillar-border))] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[hsl(var(--pillar-muted))]">
            <span>© {new Date().getFullYear()} eSANGGUNI. All rights reserved.</span>
            <span>DILG MC 2026-041 Compliant · Republic of the Philippines</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
