'use client';

// src/components/admin/bookings-table.tsx — CR-001 Demo Booking System
// Reusable table for admin demo bookings management

import { useState } from "react";
import { ChevronDown, MessageSquare, Save } from "lucide-react";

interface Booking {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  position?: string | null;
  phone?: string | null;
  preferredDate?: string | null;
  preferredSlot?: string | null;
  message?: string | null;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
}

interface BookingsTableProps {
  bookings: Booking[];
  onStatusChange: (id: string, status: string) => void;
  onNotesChange: (id: string, notes: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_70%)] border-[hsl(239_76%_64%/0.3)]",
  contacted: "bg-[hsl(38_95%_55%/0.15)] text-[hsl(38_80%_50%)] border-[hsl(38_95%_55%/0.3)]",
  confirmed: "bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_40%)] border-[hsl(158_64%_45%/0.3)]",
  completed: "bg-[hsl(var(--pillar-muted)/0.15)] text-[hsl(var(--pillar-muted))] border-[hsl(var(--pillar-border))]",
  cancelled: "bg-[hsl(0_70%_50%/0.15)] text-[hsl(0_70%_45%)] border-[hsl(0_70%_50%/0.3)]",
};

const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];

export default function BookingsTable({ bookings, onStatusChange, onNotesChange }: BookingsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (slot: string | null | undefined) => {
    if (!slot) return "";
    const [h, m] = slot.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
  };

  const handleExpand = (booking: Booking) => {
    if (expandedId === booking.id) {
      setExpandedId(null);
    } else {
      setExpandedId(booking.id);
      setEditingNotes(booking.adminNotes || "");
    }
  };

  const handleSaveNotes = (id: string) => {
    setSavingNotes(id);
    onNotesChange(id, editingNotes);
    setTimeout(() => setSavingNotes(null), 500);
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-6 py-12 text-center">
        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--pillar-muted)/0.3)]" />
        <p className="text-sm font-medium text-[hsl(var(--pillar-muted))]">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))]">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))]">
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Date</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Name</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Organization</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Preferred</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Status</th>
              <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[hsl(var(--pillar-muted))] text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <>
                <tr
                  key={booking.id}
                  className="border-b border-[hsl(var(--pillar-border)/0.5)] transition-colors hover:bg-[hsl(var(--pillar-surface-alt)/0.5)] cursor-pointer"
                  onClick={() => handleExpand(booking)}
                >
                  <td className="px-4 py-3 text-xs text-[hsl(var(--pillar-muted))]">
                    {formatDateTime(booking.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[hsl(var(--pillar-text))]">{booking.fullName}</div>
                    <div className="text-xs text-[hsl(var(--pillar-muted))]">{booking.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--pillar-text))]">{booking.organization}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--pillar-muted))]">
                    {formatDateTime(booking.preferredDate)}
                    {booking.preferredSlot && ` ${formatTime(booking.preferredSlot)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[booking.status] || STATUS_COLORS.new}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={booking.status}
                        onChange={(e) => { e.stopPropagation(); onStatusChange(booking.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-2 py-1 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown className={`h-4 w-4 text-[hsl(var(--pillar-muted))] transition-transform ${expandedId === booking.id ? "rotate-180" : ""}`} />
                    </div>
                  </td>
                </tr>
                {expandedId === booking.id && (
                  <tr key={`${booking.id}-expanded`} className="bg-[hsl(var(--pillar-surface-alt)/0.3)]">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 text-sm">
                          <div><span className="font-semibold text-[hsl(var(--pillar-muted))]">Position:</span> <span className="text-[hsl(var(--pillar-text))]">{booking.position || "—"}</span></div>
                          <div><span className="font-semibold text-[hsl(var(--pillar-muted))]">Phone:</span> <span className="text-[hsl(var(--pillar-text))]">{booking.phone || "—"}</span></div>
                          {booking.message && (
                            <div>
                              <span className="font-semibold text-[hsl(var(--pillar-muted))]">Message:</span>
                              <p className="mt-1 text-[hsl(var(--pillar-text))]">{booking.message}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-[hsl(var(--pillar-muted))]">Admin Notes</label>
                          <div className="flex gap-2">
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              rows={3}
                              className="flex-1 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2 text-sm text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                              placeholder="Add notes..."
                            />
                            <button
                              onClick={() => handleSaveNotes(booking.id)}
                              disabled={savingNotes === booking.id}
                              className="self-end rounded-lg bg-[hsl(var(--pillar-primary))] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[hsl(239_84%_60%)] disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[hsl(var(--pillar-border)/0.5)]">
        {bookings.map((booking) => (
          <div key={booking.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-[hsl(var(--pillar-text))]">{booking.fullName}</div>
                <div className="text-xs text-[hsl(var(--pillar-muted))]">{booking.email}</div>
                <div className="text-xs text-[hsl(var(--pillar-muted))]">{booking.organization}</div>
              </div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[booking.status] || STATUS_COLORS.new}`}>
                {booking.status}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <select
                value={booking.status}
                onChange={(e) => onStatusChange(booking.id, e.target.value)}
                className="appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-2 py-1 text-xs font-semibold"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-xs text-[hsl(var(--pillar-muted))]">
                {formatDateTime(booking.preferredDate)} {formatTime(booking.preferredSlot)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
