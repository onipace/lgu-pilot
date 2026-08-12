'use client';

// src/components/linaw/conflict-panel.tsx
// Sprint 6 (S6-C12) — N004 conflict evidence panel (PRD §6.8 feature 4):
// side-by-side excerpts with flagged-passage styling. Sprint 7 (S7-C5) adds
// Confirm/Reject over the SAME decision endpoint as relationships (decision
// D3 — conflict rows are ordinance_relationships rows). Props-only — the page
// feeds it; NO fetch here.

import { useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import type { LinawConflictListItem } from '@/types/linaw';

interface ConflictPanelProps {
  items: LinawConflictListItem[];
  loading: boolean;
  /** Sprint 7 (N005/D3): decision callbacks — the page owns the PUT calls. */
  onConfirm: (item: LinawConflictListItem) => void;
  onReject: (item: LinawConflictListItem, reason: string) => void;
  busy?: boolean;
}

export default function ConflictPanel({ items, loading, onConfirm, onReject, busy }: ConflictPanelProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function startReject(item: LinawConflictListItem): void {
    setRejectingId(item.id);
    setRejectReason('');
  }

  function submitReject(item: LinawConflictListItem): void {
    const reason = rejectReason.trim();
    if (reason.length === 0) return;
    setRejectingId(null);
    setRejectReason('');
    onReject(item, reason);
  }

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <AlertOctagon className="h-4 w-4 text-[#F43F5E]" />
        Flagged Conflicts
      </h3>

      {loading && <p className="text-sm text-[#94A3B8]">Loading conflicts…</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-[#94A3B8]">No conflicts flagged.</p>
      )}

      {items.map((item) => {
        const rejected = (item.rejected ?? 0) === 1;
        const pending = item.confirmed === 0 && !rejected;
        return (
          <article key={item.id} className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-white">
                Ord No. {item.ordinanceA.ordinanceNumber}, S. {item.ordinanceA.seriesYear}
              </span>
              <span className="text-[#F43F5E]">↔</span>
              <span className="font-semibold text-white">
                Ord No. {item.ordinanceB.ordinanceNumber}, S. {item.ordinanceB.seriesYear}
              </span>
              <span className="rounded-full bg-[#F43F5E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F43F5E]">
                {Math.round(item.confidence * 100)}%
              </span>
              <span
                className={
                  item.confirmed === 1
                    ? 'rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#22C55E]'
                    : rejected
                      ? 'rounded-full bg-[#F43F5E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F43F5E]'
                      : 'rounded-full bg-[#94A3B8]/15 px-2 py-0.5 text-[10px] font-semibold text-[#94A3B8]'
                }
              >
                {item.confirmed === 1 ? 'confirmed' : rejected ? 'rejected' : 'pending'}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">{item.reason}</p>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <EvidenceColumn
                title={`Ord No. ${item.ordinanceA.ordinanceNumber}, S. ${item.ordinanceA.seriesYear}`}
                heading={item.ordinanceA.title}
                passages={item.excerpts
                  .filter((e) => e.ordinanceId === item.ordinanceAId)
                  .map((e) => e.passage)}
              />
              <EvidenceColumn
                title={`Ord No. ${item.ordinanceB.ordinanceNumber}, S. ${item.ordinanceB.seriesYear}`}
                heading={item.ordinanceB.title}
                passages={item.excerpts
                  .filter((e) => e.ordinanceId === item.ordinanceBId)
                  .map((e) => e.passage)}
              />
            </div>

            {item.confirmed === 1 && (
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#22C55E]">
                confirmed — decision recorded
              </p>
            )}

            {pending && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirm(item)}
                    className="min-h-11 rounded-md bg-[#22C55E] px-3 text-xs font-semibold text-[#0F1729] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startReject(item)}
                    className="min-h-11 rounded-md bg-[#F87171] px-3 text-xs font-semibold text-[#0F1729] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
                {rejectingId === item.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitReject(item);
                        if (e.key === 'Escape') setRejectingId(null);
                      }}
                      placeholder="Reason (required) — audited with the decision"
                      aria-label="Rejection reason"
                      className="min-h-11 min-w-0 flex-1 rounded-md border border-[#283147] bg-[#0F1729] px-3 text-xs text-white placeholder:text-[#64748B] focus:border-[#F87171] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || rejectReason.trim().length === 0}
                      onClick={() => submitReject(item)}
                      className="min-h-11 rounded-md bg-[#F43F5E] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function EvidenceColumn({
  title,
  heading,
  passages,
}: {
  title: string;
  heading: string;
  passages: string[];
}) {
  return (
    <div className="rounded-xl border border-[#283147] bg-[#0F1729] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{title}</p>
      <p className="mt-1 text-xs text-white">{heading}</p>
      {passages.length === 0 ? (
        <p className="mt-2 text-[10px] italic text-[#94A3B8]">No excerpt captured.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {passages.map((passage, i) => (
            <blockquote
              key={i}
              className="rounded-md border-l-4 border-[#F43F5E] bg-[#1E293B] p-2 text-xs italic text-[#E2E8F0]"
            >
              {passage}
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
