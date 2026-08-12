'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Clock, CheckCircle2, XCircle, Search, ChevronDown,
  MapPin, Mail, Phone, RefreshCw, Loader2, Shield, UserX,
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  lgu_name: string;
  lgu_type: string | null;
  lgu_class: string | null;
  province: string;
  mobile_phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ userId: string; userName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab, limit: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users || []);
      setPendingCount(data.pending_count || 0);
    } catch (err) {
      console.error('Fetch users failed:', err);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleAction = async (userId: string, action: string, reason?: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setToast({ message: data.message || `User ${action}ed`, type: 'success' });
      fetchUsers();
    } catch (err: any) {
      setToast({ message: err.message || 'Action failed', type: 'error' });
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectReason('');
    }
  };

  const tabs: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'hsl(38 95% 55%)' },
    { key: 'approved', label: 'Approved', icon: CheckCircle2, color: 'hsl(174 72% 36%)' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'hsl(0 72% 51%)' },
  ];

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
          toast.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-300'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
            <h3 className="mb-1 text-lg font-bold text-[hsl(var(--pillar-text))]">Reject Registration</h3>
            <p className="mb-4 text-xs text-[hsl(var(--pillar-muted))]">
              Rejecting <strong>{rejectModal.userName}</strong>. Provide a reason (optional).
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="mb-4 w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] p-3 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 rounded-lg border border-[hsl(var(--pillar-border))] py-2.5 text-sm font-semibold text-[hsl(var(--pillar-muted))] hover:bg-[hsl(var(--pillar-surface-alt))]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(rejectModal.userId, 'reject', rejectReason || undefined)}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--pillar-primary)/0.15)] border border-[hsl(var(--pillar-primary)/0.2)]">
            <Users className="h-5 w-5" style={{ color: 'hsl(var(--pillar-primary))' }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-[hsl(var(--pillar-text))]">User Management</h1>
            <p className="text-xs text-[hsl(var(--pillar-muted))]">Manage registration requests and user accounts</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          className="rounded-lg border border-[hsl(var(--pillar-border))] p-2 text-[hsl(var(--pillar-muted))] hover:bg-[hsl(var(--pillar-surface-alt))] hover:text-[hsl(var(--pillar-text))]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-1">
        {tabs.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
              tab === key
                ? 'bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-text))] shadow-sm'
                : 'text-[hsl(var(--pillar-muted))] hover:text-[hsl(var(--pillar-text))]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" style={tab === key ? { color } : {}} />
            {label}
            {key === 'pending' && pendingCount > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${color}20`, color }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pillar-muted))]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or LGU..."
          className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] py-2.5 pl-10 pr-4 text-sm text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:border-[hsl(var(--pillar-primary)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--pillar-primary)/0.3)]"
        />
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--pillar-muted))]" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--pillar-muted)/0.4)]" />
          <p className="text-sm font-semibold text-[hsl(var(--pillar-muted))]">
            No {tab} registrations found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4 transition-colors hover:border-[hsl(var(--pillar-primary)/0.2)]"
            >
              <div className="flex items-start justify-between gap-4">
                {/* User info */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-[hsl(var(--pillar-text))]">{u.full_name}</span>
                    {u.lgu_type && (
                      <span className="rounded bg-[hsl(var(--pillar-surface-alt))] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[hsl(var(--pillar-muted))]">
                        {u.lgu_type.replace('_', ' ')}
                      </span>
                    )}
                    {u.lgu_class && (
                      <span className="rounded bg-[hsl(var(--pillar-surface-alt))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--pillar-muted))]">
                        {u.lgu_class}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--pillar-muted))]">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {u.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {u.lgu_name}, {u.province}
                    </span>
                    {u.mobile_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {u.mobile_phone}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[hsl(var(--pillar-muted)/0.7)]">
                    <span>Registered: {formatDate(u.created_at)}</span>
                    {u.approved_at && <span>Approved: {formatDate(u.approved_at)}</span>}
                    {u.approved_by_name && <span>by {u.approved_by_name}</span>}
                    {u.login_count > 0 && <span>{u.login_count} login{u.login_count !== 1 ? 's' : ''}</span>}
                    {u.last_login_at && <span>Last: {formatDate(u.last_login_at)}</span>}
                  </div>
                  {u.rejection_reason && (
                    <p className="mt-1 text-xs text-red-400/80">Reason: {u.rejection_reason}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {tab === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(u.id, 'approve')}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {actionLoading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectModal({ userId: u.id, userName: u.full_name })}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  {tab === 'approved' && (
                    <button
                      onClick={() => handleAction(u.id, 'deactivate')}
                      disabled={actionLoading === u.id}
                      className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pillar-border))] px-3 py-2 text-xs font-bold text-[hsl(var(--pillar-muted))] transition-colors hover:border-red-500/30 hover:text-red-400 disabled:opacity-50"
                    >
                      {actionLoading === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
