'use client';

// src/app/admin/bookings/page.tsx — CR-001 Demo Booking System
// Admin dashboard for viewing and managing demo bookings

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Download, RefreshCw, Search } from "lucide-react";
import BookingsTable from "@/components/admin/bookings-table";

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

const STATUS_FILTERS = ["all", "new", "contacted", "confirmed", "completed", "cancelled"];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/bookings?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setBookings(data.bookings);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setStatusCounts(data.statusCounts);
      }
    } catch (err) {
      console.error("[admin/bookings] Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchBookings();
    } catch (err) {
      console.error("[admin/bookings] Status update error:", err);
    }
  };

  const handleNotesChange = async (id: string, adminNotes: string) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminNotes }),
      });
      if (res.ok) fetchBookings();
    } catch (err) {
      console.error("[admin/bookings] Notes update error:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Name", "Email", "Organization", "Position", "Phone", "Preferred Date", "Preferred Time", "Status", "Message"];
    const rows = bookings.map((b) => [
      new Date(b.createdAt).toLocaleDateString(),
      b.fullName,
      b.email,
      b.organization,
      b.position || "",
      b.phone || "",
      b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : "",
      b.preferredSlot || "",
      b.status,
      b.message || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-[hsl(var(--pillar-primary))]" />
            <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">Demo Bookings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {STATUS_FILTERS.filter((s) => s !== "all").map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`rounded-xl border p-3 text-center transition-all ${
                statusFilter === status
                  ? "border-[hsl(var(--pillar-primary))] bg-[hsl(var(--pillar-primary)/0.08)]"
                  : "border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] hover:border-[hsl(var(--pillar-primary)/0.3)]"
              }`}
            >
              <div className="text-2xl font-black text-[hsl(var(--pillar-text))]">{statusCounts[status] || 0}</div>
              <div className="text-[10px] font-semibold uppercase text-[hsl(var(--pillar-muted))]">{status}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
          <input
            type="text"
            placeholder="Search by name, email, or organization..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-[hsl(var(--pillar-primary))] text-white"
                  : "border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]"
              }`}
            >
              {s} {s !== "all" && statusCounts[s] ? `(${statusCounts[s]})` : ""}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-[hsl(var(--pillar-surface))]" />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && (
          <>
            <BookingsTable
              bookings={bookings}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[hsl(var(--pillar-muted))]">
                  Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-[hsl(var(--pillar-border))] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-[hsl(var(--pillar-border))] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
