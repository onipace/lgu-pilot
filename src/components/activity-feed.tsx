'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Hand, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityItem, ActivityType } from '@/types/agentic';

interface ActivityFeedProps {
  activities: ActivityItem[];
  emptyMessage?: string;
  onConfirm?: (activityId: string) => void;
  onEdit?: (activityId: string, data: Record<string, unknown>) => void;
  onReject?: (activityId: string, reason: string) => void;
  className?: string;
}

/** Left-border + icon color by activity type (DESIGN.md palette). */
const TYPE_META: Record<ActivityType, { Icon: typeof CheckCircle2; color: string }> = {
  success: { Icon: CheckCircle2, color: '#22C55E' },
  warning: { Icon: AlertTriangle, color: '#FACC15' },
  error: { Icon: XCircle, color: '#F87171' },
  hitl: { Icon: Hand, color: '#F43F5E' },
};

/** Extract scalar (string/number) fields from arbitrary output data — fully generic. */
function scalarEntries(data: Record<string, unknown> | undefined): [string, string | number][] {
  if (!data) return [];
  return Object.entries(data).filter(
    (entry): entry is [string, string | number] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number'
  );
}

/** camelCase key → "Title Case Label" (e.g. seriesYear → "Series Year"). */
function labelFromKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * ActivityFeed — shared, module-neutral activity feed with Confirm / Edit / Reject.
 * Callbacks-only integration; the inline edit form is generated neutrally from the
 * scalar fields of each item's data. No fetch, no DB, no domain field names.
 */
export default function ActivityFeed({
  activities,
  emptyMessage = 'No activities yet. Start a pipeline to see results.',
  onConfirm,
  onEdit,
  onReject,
  className,
}: ActivityFeedProps) {
  // UI-only state: which card is in edit/reject mode and its local inputs.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (activities.length === 0) {
    return <p className={cn('text-sm text-[#94A3B8]', className)}>{emptyMessage}</p>;
  }

  return (
    <div className={cn('max-h-96 space-y-3 overflow-y-auto', className)}>
      {activities.map((item) => {
        const meta = TYPE_META[item.type];
        const TypeIcon = meta.Icon;
        const isEditing = editingId === item.id;
        const isRejecting = rejectingId === item.id;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-[#283147] bg-[#1E293B] p-3"
            style={{ borderLeft: `4px solid ${meta.color}` }}
          >
            {/* Header row: icon + title + timestamp */}
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
              <span className="text-sm font-semibold text-white">{item.title}</span>
              <span className="ml-auto shrink-0 text-[10px] text-[#94A3B8]">{item.timestamp}</span>
            </div>

            {/* Details */}
            <p className="mt-1 text-xs text-[#94A3B8]">{item.details}</p>

            {/* Status badges */}
            {item.status === 'confirmed' && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] text-[#22C55E]">
                <Check className="h-3 w-3" />
                Confirmed
              </span>
            )}
            {item.status === 'rejected' && (
              <p className="mt-2 text-xs text-[#F43F5E]">Rejected{item.reason ? `: ${item.reason}` : ''}</p>
            )}

            {/* Pending actions */}
            {item.status === 'pending' && !isEditing && !isRejecting && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm?.(item.id)}
                  className="min-h-11 rounded-md px-3 text-xs font-semibold text-[#0F1729]"
                  style={{ backgroundColor: '#22C55E' }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(Object.fromEntries(scalarEntries(item.data)));
                    setEditingId(item.id);
                  }}
                  className="min-h-11 rounded-md px-3 text-xs font-semibold text-white"
                  style={{ backgroundColor: '#334155' }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReason('');
                    setRejectingId(item.id);
                  }}
                  className="min-h-11 px-2 text-[10px] text-[#64748B] underline-offset-2 hover:text-[#F43F5E] hover:underline"
                >
                  Reject
                </button>
              </div>
            )}

            {/* Inline edit form — generated neutrally from scalar fields of item.data */}
            {item.status === 'pending' && isEditing && (
              <div className="mt-3 space-y-2 rounded-md border border-[#283147] bg-[#0F1729] p-3">
                {scalarEntries(item.data).map(([key, value]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      {labelFromKey(key)}
                    </span>
                    <input
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={String(draft[key] ?? '')}
                      onChange={(e) => {
                        const next = typeof value === 'number' ? Number(e.target.value) : e.target.value;
                        setDraft((prev) => ({ ...prev, [key]: next }));
                      }}
                      className="w-full rounded-md border border-[#283147] bg-[#1E293B] px-2 py-1.5 text-xs text-white outline-none focus:border-[#22D3EE]"
                    />
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onEdit?.(item.id, draft);
                      setEditingId(null);
                    }}
                    className="min-h-11 rounded-md px-3 text-xs font-semibold text-[#0F1729]"
                    style={{ backgroundColor: '#22C55E' }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="min-h-11 rounded-md px-3 text-xs font-semibold text-white"
                    style={{ backgroundColor: '#334155' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Inline reject flow — requires a non-empty reason */}
            {item.status === 'pending' && isRejecting && (
              <div className="mt-3 space-y-2 rounded-md border border-[#283147] bg-[#0F1729] p-3">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for rejection"
                  className="w-full rounded-md border border-[#283147] bg-[#1E293B] px-2 py-1.5 text-xs text-white outline-none focus:border-[#F43F5E]"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => {
                      if (!reason.trim()) return;
                      onReject?.(item.id, reason.trim());
                      setRejectingId(null);
                    }}
                    className="min-h-11 rounded-md px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: '#F43F5E' }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingId(null)}
                    className="min-h-11 rounded-md px-3 text-xs font-semibold text-white"
                    style={{ backgroundColor: '#334155' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
