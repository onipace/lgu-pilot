'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail, Lock, User, MapPin, Phone, Eye, EyeOff,
  ChevronRight, ArrowLeft, CheckCircle2,
} from 'lucide-react';

function getSafeReturnUrl(raw: string | null): string {
  if (!raw) return '/';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//')) return '/';
  return raw.startsWith('/') ? raw : '/';
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const returnUrl = getSafeReturnUrl(searchParams.get('returnUrl'));
  const returnUrlQs = returnUrl === '/' ? '' : `?returnUrl=${encodeURIComponent(returnUrl)}`;

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    lgu_name: '',
    lgu_type: '',
    lgu_class: '',
    province: '',
    mobile_phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          lgu_name: form.lgu_name.trim(),
          lgu_type: form.lgu_type || undefined,
          lgu_class: form.lgu_class || undefined,
          province: form.province.trim(),
          mobile_phone: form.mobile_phone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4">
        <div className="pointer-events-none fixed inset-0">
          <div
            className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06]"
            style={{ background: 'hsl(var(--pillar-teal))', filter: 'blur(120px)' }}
          />
        </div>

        <div className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--pillar-teal)/0.15)] border border-[hsl(var(--pillar-teal)/0.3)]">
            <CheckCircle2 className="h-8 w-8" style={{ color: 'hsl(174 72% 36%)' }} />
          </div>
          <h1 className="mb-2 text-xl font-black text-[hsl(var(--pillar-text))]">
            Registration Submitted
          </h1>
          <p className="mb-6 text-sm text-[hsl(var(--pillar-muted))]">
            Your account is pending admin approval. You will receive an email notification once approved.
          </p>
          <div className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] p-4 mb-6">
            <p className="text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1">Registered email</p>
            <p className="text-sm font-bold text-[hsl(var(--pillar-text))]">{form.email}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/login${returnUrlQs}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Go to Login
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={returnUrl}
              className="text-xs font-semibold text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
            >
              Back to eSANGGUNI
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────
  const inputClass =
    'w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50';
  const selectClass =
    'w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] py-2.5 px-3 text-sm text-[hsl(var(--pillar-text))] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)] disabled:opacity-50';
  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))]';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--pillar-bg))] px-4 py-10">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06]"
          style={{ background: 'hsl(var(--pillar-primary))', filter: 'blur(120px)' }}
        />
      </div>

      <div className="relative w-full max-w-lg">
        <Link
          href={returnUrl}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to eSANGGUNI
        </Link>

        <div className="rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8">
          <div className="mb-8 text-center">
            <h1 className="mb-1 text-2xl font-black tracking-widest text-[hsl(var(--pillar-text))]">
              P.I.L.L.A.R.
            </h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))]">Register for an account</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className={labelClass}>Full Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Password row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Min. 8 chars"
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    placeholder="Repeat"
                    required
                    disabled={loading}
                    className={inputClass}
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
            </div>

            {/* LGU Information */}
            <div className="border-t border-[hsl(var(--pillar-border))] pt-4 mt-2">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                LGU Information
              </p>

              <div className="space-y-3">
                {/* LGU Name + Province */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>LGU / Municipality *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                      <input
                        type="text"
                        value={form.lgu_name}
                        onChange={(e) => update('lgu_name', e.target.value)}
                        placeholder="Pitogo"
                        required
                        disabled={loading}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Province *</label>
                    <input
                      type="text"
                      value={form.province}
                      onChange={(e) => update('province', e.target.value)}
                      placeholder="Quezon"
                      required
                      disabled={loading}
                      className={selectClass}
                    />
                  </div>
                </div>

                {/* LGU Type + Class */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>LGU Type</label>
                    <select
                      value={form.lgu_type}
                      onChange={(e) => update('lgu_type', e.target.value)}
                      disabled={loading}
                      className={selectClass}
                    >
                      <option value="">Select type</option>
                      <option value="municipality">Municipality</option>
                      <option value="city">City</option>
                      <option value="component_city">Component City</option>
                      <option value="huc">Highly Urbanized City</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Income Class</label>
                    <select
                      value={form.lgu_class}
                      onChange={(e) => update('lgu_class', e.target.value)}
                      disabled={loading}
                      className={selectClass}
                    >
                      <option value="">Select class</option>
                      <option value="1st">1st Class</option>
                      <option value="2nd">2nd Class</option>
                      <option value="3rd">3rd Class</option>
                      <option value="4th">4th Class</option>
                      <option value="5th">5th Class</option>
                      <option value="6th">6th Class</option>
                    </select>
                  </div>
                </div>

                {/* Mobile Phone */}
                <div>
                  <label className={labelClass}>Mobile Phone (Optional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
                    <input
                      type="tel"
                      value={form.mobile_phone}
                      onChange={(e) => update('mobile_phone', e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      disabled={loading}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  Submit Registration
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[hsl(var(--pillar-muted))]">
              Already have an account?{' '}
              <Link
                href={`/login${returnUrlQs}`}
                className="font-semibold text-[hsl(var(--pillar-primary))] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
