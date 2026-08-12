'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, FileText } from 'lucide-react';

interface SessionRow {
  id: string;
  workshop_session_id: string;
  participant_name: string;
  module: string;
  started_at: string;
  last_active_at: string;
  message_count: number;
  draft_count: number;
}

interface SessionsTableProps {
  sessionId: string;
}

const MODULE_BADGE: Record<string, string> = {
  ella: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)] border-[hsl(239_76%_64%/0.3)]',
  obra: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)] border-[hsl(158_64%_45%/0.3)]',
  yala: 'bg-[hsl(38_95%_55%/0.15)] text-[hsl(38_95%_75%)] border-[hsl(38_95%_55%/0.3)]',
};

export default function SessionsTable({ sessionId }: SessionsTableProps) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session: sessionId, page: String(page) });
      const res = await fetch(`/api/admin/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotalPages(data.pages || 1);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, page]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-[hsl(216_20%_65%)]">
        Participant Sessions
      </h3>

      <div className="rounded-xl border border-[hsl(224_27%_22%)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(224_27%_22%)] bg-[hsl(224_35%_15%)]">
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Participant</th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Module</th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Started</th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Last Active</th>
              <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Messages</th>
              <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">Drafts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-[hsl(216_20%_45%)]">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-[hsl(216_20%_45%)]">No sessions recorded yet</td></tr>
            ) : sessions.map((s, i) => (
              <tr key={s.id} className={`border-b border-[hsl(224_27%_20%)] transition-colors hover:bg-[hsl(224_35%_17%)] ${i % 2 === 0 ? '' : 'bg-[hsl(224_35%_14%)]'}`}>
                <td className="py-3 px-4 font-medium text-[hsl(214_100%_97%)]">
                  {s.participant_name || <span className="text-[hsl(216_20%_45%)]">Anonymous</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${MODULE_BADGE[s.module] || MODULE_BADGE.ella}`}>
                    {s.module}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-[hsl(216_20%_55%)]">{formatTime(s.started_at)}</td>
                <td className="py-3 px-4 text-xs text-[hsl(216_20%_55%)]">{formatTime(s.last_active_at)}</td>
                <td className="py-3 px-4 text-right">
                  <span className="flex items-center justify-end gap-1.5 text-xs text-[hsl(239_76%_75%)]">
                    <MessageSquare className="h-3 w-3" />{s.message_count}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="flex items-center justify-end gap-1.5 text-xs text-[hsl(158_64%_60%)]">
                    <FileText className="h-3 w-3" />{s.draft_count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[hsl(216_20%_50%)]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(224_27%_25%)] text-[hsl(216_20%_60%)] transition-colors hover:border-[hsl(239_84%_67%/0.5)] hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(224_27%_25%)] text-[hsl(216_20%_60%)] transition-colors hover:border-[hsl(239_84%_67%/0.5)] hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
