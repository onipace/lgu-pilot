'use client';

// src/app/contact/page.tsx — CR-001 Demo Booking System
// Public booking page for demo requests

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  BookOpen,
  FileText,
  MessageSquare,
  Archive,
  Scale,
  Loader2,
} from "lucide-react";
import DemoCalendar from "@/components/contact/demo-calendar";
import HCaptchaWrapper from "@/components/contact/hcaptcha-wrapper";
import siteConfig from "@/lib/data/site-config.json";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organization: "",
    position: "",
    phone: "",
    message: "",
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSlotSelect = (date: string, slot: string) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.organization.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          preferredDate: selectedDate || null,
          preferredSlot: selectedSlot || null,
          hCaptchaToken: captchaToken || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-[hsl(var(--pillar-bg))]">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-8 text-center sm:p-12">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[hsl(158_64%_45%)]" />
            <h1 className="mb-2 text-2xl font-black text-[hsl(var(--pillar-text))]">
              Demo Request Received!
            </h1>
            <p className="mb-6 text-[hsl(var(--pillar-muted))]">
              Thank you, <strong>{formData.fullName}</strong>. We&apos;ll contact you at{" "}
              <strong>{formData.email}</strong> within 1 business day to confirm your demo schedule.
            </p>

            {(selectedDate || selectedSlot) && (
              <div className="mb-6 rounded-xl border border-[hsl(158_64%_45%/0.3)] bg-[hsl(158_64%_45%/0.08)] p-4">
                <p className="text-sm font-semibold text-[hsl(158_64%_40%)]">Your preferred schedule:</p>
                <p className="mt-1 text-[hsl(var(--pillar-text))]">
                  {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  {selectedSlot && (() => {
                    const [h, m] = selectedSlot.split(":").map(Number);
                    const period = h >= 12 ? "PM" : "AM";
                    const displayH = h % 12 || 12;
                    return ` at ${displayH}:${String(m).padStart(2, "0")} ${period}`;
                  })()}
                </p>
              </div>
            )}

            <div className="mb-6 rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] p-4 text-left">
              <p className="mb-2 text-xs font-bold uppercase text-[hsl(var(--pillar-muted))]">What happens next:</p>
              <div className="space-y-2 text-sm text-[hsl(var(--pillar-text))]">
                <p>1. Our team reviews your request</p>
                <p>2. You receive a confirmation email with demo details</p>
                <p>3. We walk you through ELLA, OBRA, YALA, LIKHA, and LINAW</p>
                <p>4. Q&A session to address your specific LGU needs</p>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--pillar-primary))] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)]"
            >
              Back to Home
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))]">
      {/* Header */}
      <div className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))]">
        <div className="mx-auto max-w-6xl px-6 py-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--pillar-primary)/0.3)] bg-[hsl(var(--pillar-primary)/0.08)] px-4 py-1.5">
            <CalendarDays className="h-4 w-4 text-[hsl(var(--pillar-primary))]" />
            <span className="text-xs font-semibold text-[hsl(var(--pillar-primary))]">Book a Demo</span>
          </div>
          <h1 className="text-3xl font-black text-[hsl(var(--pillar-text))] sm:text-4xl">
            See eSANGGUNI in Action
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[hsl(var(--pillar-muted))]">
            Schedule a personalized demo and discover how AI-powered tools can transform your LGU&apos;s legislative workflow.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Left: Form (2/3) */}
          <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
            {/* Contact info fields */}
            <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                Contact Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="Juan Dela Cruz"
                    className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="juan@lgu.gov.ph"
                    className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                    LGU / Organization <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    required
                    placeholder="Municipality of Example"
                    className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                    Position / Role
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    placeholder="SB Secretary"
                    className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(042) 123-4567"
                    className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  />
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                Preferred Date & Time
              </h2>
              <DemoCalendar
                onSlotSelect={handleSlotSelect}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
              />
              <p className="mt-2 text-xs text-[hsl(var(--pillar-muted)/0.6)]">
                Select a date and time that works for you. If no slots are available, you can still submit and we&apos;ll find a time.
              </p>
            </div>

            {/* Message */}
            <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
              <label className="mb-1 block text-xs font-semibold text-[hsl(var(--pillar-text))]">
                Message / Questions (optional)
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                placeholder="Tell us about your LGU's needs or any questions you have..."
                className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.4)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
            </div>

            {/* hCaptcha */}
            <HCaptchaWrapper
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
            />

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--pillar-primary))] px-8 py-4 text-base font-semibold text-white transition-all hover:bg-[hsl(239_84%_60%)] hover:shadow-[0_0_30px_hsl(239_84%_67%/0.5)] disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request Demo
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Right: Info panel (1/3) */}
          <div className="space-y-6">
            {/* What you'll see */}
            <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                What You&apos;ll See
              </h3>
              <div className="space-y-3">
                {[
                  { icon: BookOpen, name: "E.L.L.A.", desc: "AI-powered legal research" },
                  { icon: FileText, name: "O.B.R.A.", desc: "Ordinance drafting assistant" },
                  { icon: MessageSquare, name: "Y.A.L.A.", desc: "Constituent AI assistant" },
                  { icon: Archive, name: "L.I.K.H.A.", desc: "Archive digitizer" },
                  { icon: Scale, name: "L.I.N.A.W.", desc: "Ordinance codifier" },
                ].map(({ icon: Icon, name, desc }) => (
                  <div key={name} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))]">
                      <Icon className="h-4 w-4 text-[hsl(var(--pillar-primary))]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[hsl(var(--pillar-text))]">{name}</div>
                      <div className="text-xs text-[hsl(var(--pillar-muted))]">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                Contact Us Directly
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[hsl(var(--pillar-muted))]" />
                  <span className="text-sm text-[hsl(var(--pillar-text))]">{siteConfig.contactEmail}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-[hsl(var(--pillar-muted))]" />
                  <span className="text-sm text-[hsl(var(--pillar-text))]">{siteConfig.contactPhone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-[hsl(var(--pillar-muted))]" />
                  <span className="text-sm text-[hsl(var(--pillar-text))]">{siteConfig.address}</span>
                </div>
              </div>
            </div>

            {/* Response time */}
            <div className="rounded-xl border border-[hsl(var(--pillar-primary)/0.2)] bg-[hsl(var(--pillar-primary)/0.05)] p-4">
              <p className="text-xs font-semibold text-[hsl(var(--pillar-primary))]">
                We typically respond within 1 business day. For urgent inquiries, call us directly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
