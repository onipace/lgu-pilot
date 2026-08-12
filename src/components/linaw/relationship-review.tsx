'use client';

// src/components/linaw/relationship-review.tsx
// Sprint 6 (S6-C12) shell — Sprint 7 (S7-C5) enables the N005 decision flow:
// pending rows get a live Confirm (green) and Reject (rose, inline reason
// required); confirmed rows show a 'confirmed' note; rejected rows show a
// rose 'rejected' chip. Orphan warnings render as yellow 'missing target'
// cards. Props-only — the page feeds it; NO fetch here.

import { useState } from 'react';
import { Network, AlertTriangle } from 'lucide-react';
import type { LinawOrphanWarning, LinawRelationshipRecord, LinawRelationshipType } from '@/types/linaw';

const TYPE_CHIP: Record<LinawRelationshipType, string> = {
  amends: '#FACC15',
  repeals: '#F87171',
  partial_repeal: '#F87171',
  supersedes: '#F43F5E',
  extends: '#22C55E',
  implements: '#22D3EE',
};

interface RelationshipReviewProps {
  items: LinawRelationshipRecord[];
  orphans: LinawOrphanWarning[];
  loading: boolean;
  /** Sprint 7 (N005): decision callbacks — the page owns the PUT calls. */
  onConfirm: (item: LinawRelationshipRecord) => void;
  onReject: (item: LinawRelationshipRecord, reason: string) => void;
  busy?: boolean;
}

export default function RelationshipReview({
  items,
  orphans,
  loading,
  onConfirm,
  onReject,
  busy,
}: RelationshipReviewProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function startReject(item: LinawRelationshipRecord): void {
    setRejectingId(item.id);
    setRejectReason('');
  }

  function submitReject(item: LinawRelationshipRecord): void {
    const reason = rejectReason.trim();
    if (reason.length === 0) return;
    setRejectingId(null);
    setRejectReason('');
    onReject(item, reason);
  }

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Network className="h-4 w-4 text-[#10B981]" />
        Detected Relationships
      </h3>

      {loading && <p className="text-sm text-[#94A3B8]">Loading relationships…</p>}

      {!loading && items.length === 0 && orphans.length === 0 && (
        <p className="text-sm text-[#94A3B8]">No relationships detected yet — run the pipeline.</p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const color = TYPE_CHIP[item.type] ?? '#94A3B8';
            const rejected = (item.rejected ?? 0) === 1;
            const pending = item.confirmed === 0 && !rejected;
            return (
              <article key={item.id} className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-white">
                    Ord No. {item.source?.ordinanceNumber ?? '?'}, S. {item.source?.seriesYear ?? '?'}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color, backgroundColor: color + '22' }}
                  >
                    {item.type}
                  </span>
                  <span className="text-[#94A3B8]">→</span>
                  <span className="font-semibold text-white">
                    Ord No. {item.target?.ordinanceNumber ?? '?'}, S. {item.target?.seriesYear ?? '?'}
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
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {item.sectionRef ? `${item.sectionRef} · ` : ''}
                  confidence {Math.round(item.confidence * 100)}%
                </p>

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
        </div>
      )}

      {orphans.length > 0 && (
        <div className="space-y-2">
          {orphans.map((orphan, i) => (
            <div key={i} className="rounded-2xl border border-[#FACC15]/40 bg-[#1E293B] p-4">
              <p className="flex items-start gap-2 text-xs text-[#FACC15]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  missing target — reference to Ordinance No. {orphan.referencedNumber}
                  {orphan.referencedYear > 0 ? `, S. ${orphan.referencedYear}` : ' (no series year)'} not
                  found in the ready library
                </span>
              </p>
              <p className="mt-1 pl-5 text-[10px] italic text-[#94A3B8]">“{orphan.rawQuote}”</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
