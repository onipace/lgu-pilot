'use client';

// src/app/admin/availability/page.tsx — CR-001 Demo Booking System
// Admin page for configuring demo availability schedule

import { useEffect, useState } from "react";
import { Calendar, Plus, Save, Trash2, Clock } from "lucide-react";

interface AvailabilityRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

interface BlockedDate {
  date: string;
  reason?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_DURATIONS = [15, 30, 45, 60];

export default function AdminAvailabilityPage() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const [preview, setPreview] = useState<Array<{ date: string; dayLabel: string; slots: string[] }>>([]);

  useEffect(() => {
    fetch("/api/admin/availability", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRules(data.rules);
          setBlockedDates(data.blockedDates);
        }
      })
      .catch((err) => console.error("[admin/availability] Fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Compute preview whenever rules change
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const previewDays: Array<{ date: string; dayLabel: string; slots: string[] }> = [];

    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      const dayRules = rules.filter((r) => r.dayOfWeek === dayOfWeek && r.isActive);

      if (dayRules.length === 0) continue;

      const slots = new Set<string>();
      for (const rule of dayRules) {
        const [startH, startM] = rule.startTime.split(":").map(Number);
        const [endH, endM] = rule.endTime.split(":").map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        for (let m = startMin; m + rule.slotDuration <= endMin; m += rule.slotDuration) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          slots.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
        }
      }

      previewDays.push({
        date: date.toISOString().split("T")[0],
        dayLabel: DAY_NAMES[dayOfWeek],
        slots: Array.from(slots).sort(),
      });
    }

    setPreview(previewDays);
  }, [rules]);

  const getRuleForDay = (dayOfWeek: number): AvailabilityRule | undefined => {
    return rules.find((r) => r.dayOfWeek === dayOfWeek);
  };

  const toggleDay = (dayOfWeek: number) => {
    const existing = getRuleForDay(dayOfWeek);
    if (existing) {
      setRules(rules.filter((r) => r.dayOfWeek !== dayOfWeek));
    } else {
      setRules([
        ...rules,
        { dayOfWeek, startTime: "09:00", endTime: "17:00", slotDuration: 30, isActive: true },
      ]);
    }
  };

  const updateRule = (dayOfWeek: number, field: keyof AvailabilityRule, value: string | number | boolean) => {
    setRules(rules.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)));
  };

  const addBlockedDate = () => {
    if (!newBlockedDate) return;
    if (blockedDates.some((bd) => bd.date === newBlockedDate)) return;
    setBlockedDates([...blockedDates, { date: newBlockedDate, reason: newBlockedReason || undefined }]);
    setNewBlockedDate("");
    setNewBlockedReason("");
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates(blockedDates.filter((bd) => bd.date !== date));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rules, blockedDates }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage("Schedule saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      setSaveMessage("Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-[hsl(var(--pillar-muted)/0.2)]" />
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[hsl(var(--pillar-surface))]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-7 w-7 text-[hsl(var(--pillar-primary))]" />
            <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">Demo Availability</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[hsl(239_84%_60%)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>

        {saveMessage && (
          <div className={`rounded-lg px-4 py-2 text-sm font-medium ${
            saveMessage.startsWith("Error") || saveMessage.startsWith("Failed")
              ? "bg-red-500/10 text-red-300 border border-red-500/30"
              : "bg-[hsl(158_64%_45%/0.1)] text-[hsl(158_64%_40%)] border border-[hsl(158_64%_45%/0.3)]"
          }`}>
            {saveMessage}
          </div>
        )}

        {/* Weekly Schedule */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">Weekly Schedule</h2>
          {DAY_NAMES.map((dayName, dayOfWeek) => {
            const rule = getRuleForDay(dayOfWeek);
            const isActive = !!rule;

            return (
              <div
                key={dayOfWeek}
                className={`rounded-xl border transition-all ${
                  isActive
                    ? "border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))]"
                    : "border-[hsl(var(--pillar-border)/0.5)] bg-[hsl(var(--pillar-surface)/0.3)]"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(dayOfWeek)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      isActive ? "bg-[hsl(var(--pillar-primary))]" : "bg-[hsl(var(--pillar-muted)/0.3)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        isActive ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>

                  {/* Day name */}
                  <span className={`w-24 text-sm font-bold ${isActive ? "text-[hsl(var(--pillar-text))]" : "text-[hsl(var(--pillar-muted)/0.5)]"}`}>
                    {dayName}
                  </span>

                  {/* Time inputs */}
                  {isActive && rule && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[hsl(var(--pillar-muted))]" />
                        <input
                          type="time"
                          value={rule.startTime}
                          onChange={(e) => updateRule(dayOfWeek, "startTime", e.target.value)}
                          className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-2 py-1 text-sm text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                        />
                        <span className="text-[hsl(var(--pillar-muted))]">to</span>
                        <input
                          type="time"
                          value={rule.endTime}
                          onChange={(e) => updateRule(dayOfWeek, "endTime", e.target.value)}
                          className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-2 py-1 text-sm text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[hsl(var(--pillar-muted))]">Every</span>
                        <select
                          value={rule.slotDuration}
                          onChange={(e) => updateRule(dayOfWeek, "slotDuration", parseInt(e.target.value))}
                          className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-2 py-1 text-sm text-[hsl(var(--pillar-text))] focus:outline-none"
                        >
                          {SLOT_DURATIONS.map((d) => (
                            <option key={d} value={d}>{d} min</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Blocked Dates */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">Blocked Dates (Holidays / PTO)</h2>
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-1.5 text-sm text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
              <input
                type="text"
                value={newBlockedReason}
                onChange={(e) => setNewBlockedReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-1.5 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
              <button
                onClick={addBlockedDate}
                disabled={!newBlockedDate}
                className="flex items-center gap-1 rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {blockedDates.length === 0 ? (
              <p className="text-xs text-[hsl(var(--pillar-muted)/0.6)]">No blocked dates configured.</p>
            ) : (
              <div className="space-y-2">
                {blockedDates.map((bd) => (
                  <div key={bd.date} className="flex items-center justify-between rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-[hsl(var(--pillar-text))]">
                        {new Date(bd.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {bd.reason && <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">— {bd.reason}</span>}
                    </div>
                    <button
                      onClick={() => removeBlockedDate(bd.date)}
                      className="text-[hsl(var(--pillar-muted)/0.5)] transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">Preview — Next 7 Days</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {preview.length === 0 ? (
              <p className="text-xs text-[hsl(var(--pillar-muted)/0.6)]">No available days configured.</p>
            ) : (
              preview.map((day) => (
                <div key={day.date} className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-3">
                  <div className="mb-2 text-xs font-bold text-[hsl(var(--pillar-text))]">
                    {day.dayLabel} — {new Date(day.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {day.slots.slice(0, 12).map((slot) => {
                      const [h, m] = slot.split(":").map(Number);
                      const period = h >= 12 ? "PM" : "AM";
                      const displayH = h % 12 || 12;
                      return (
                        <span key={slot} className="rounded border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--pillar-muted))]">
                          {displayH}:{String(m).padStart(2, "0")}{period}
                        </span>
                      );
                    })}
                    {day.slots.length > 12 && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] text-[hsl(var(--pillar-muted)/0.6)]">
                        +{day.slots.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
