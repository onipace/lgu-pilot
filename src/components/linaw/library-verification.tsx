'use client';

// src/components/linaw/library-verification.tsx
// Sprint 5 (S5-C9) — LINAW's OWN review queue + side-by-side verification
// panel (duplicates the proven sibling-module pattern — no shared code).
// Loads the pending_review queue, opens a focus-trapped, Esc-closeable modal
// with the original scan beside the editable extracted text, and PUTs
// approve / reject / edit decisions to /api/linaw/library/<id>.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Loader2, ZoomIn, ZoomOut, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinawLibraryListItem } from '@/types/linaw';

interface DetailRecord {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags: string[];
  sourceType: 'scan' | 'import' | 'manual';
  libraryStatus: string;
  updatedAt: string;
}

interface DetailResponse {
  record: DetailRecord;
  scanAvailable: boolean;
  scanUrl: string | null;
  scanMimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | null;
}

const inputClass =
  'w-full rounded-lg border border-[#283147] bg-[#0F1729] px-3 py-2 text-sm text-white placeholder:text-[#94A3B8]/60 focus:border-[#22D3EE] focus:outline-none';

function SourceBadge({ sourceType }: { sourceType: string }) {
  return (
    <span className="rounded-full border border-[#283147] bg-[#0F1729] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#22D3EE]">
      {sourceType}
    </span>
  );
}

export default function LibraryVerification() {
  const [queue, setQueue] = useState<LinawLibraryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [fields, setFields] = useState({
    ordinanceNumber: '',
    seriesYear: '',
    title: '',
    content: '',
    subjectTags: '',
  });
  const [reason, setReason] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [editSaved, setEditSaved] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/linaw/library?libraryStatus=pending_review&limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setQueue(body.items ?? []);
    } catch {
      setLoadError('Could not load the review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // Focus trap + Esc close + focus restore for the review dialog.
  useEffect(() => {
    if (!detail) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.record.id]);

  async function openRecord(id: string) {
    setDetailLoading(true);
    setDecisionError(null);
    setEditSaved(false);
    setReason('');
    setZoom(1);
    setRotation(0);
    try {
      const res = await fetch('/api/linaw/library/' + id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as DetailResponse;
      setDetail(body);
      setFields({
        ordinanceNumber: String(body.record.ordinanceNumber),
        seriesYear: String(body.record.seriesYear),
        title: body.record.title,
        content: body.record.content,
        subjectTags: (body.record.subjectTags ?? []).join(', '),
      });
    } catch {
      setDecisionError('Could not load the record.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDialog() {
    setDetail(null);
    setDecisionError(null);
    setEditSaved(false);
  }

  async function decide(action: 'approve' | 'reject' | 'edit') {
    if (!detail || decisionBusy) return;
    setDecisionBusy(true);
    setDecisionError(null);
    setEditSaved(false);
    try {
      const payload: Record<string, unknown> = {
        action,
        expectedUpdatedAt: detail.record.updatedAt,
      };
      if (action === 'reject') payload.reason = reason;
      if (action === 'edit') {
        payload.fields = {
          ordinanceNumber: Number(fields.ordinanceNumber),
          seriesYear: Number(fields.seriesYear),
          title: fields.title,
          content: fields.content,
          subjectTags: fields.subjectTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== ''),
        };
      }
      const res = await fetch('/api/linaw/library/' + detail.record.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        setDecisionError('Record changed or already finalized — reload and retry');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDecisionError(body?.error ?? 'Decision failed');
        return;
      }
      if (action === 'edit') {
        setEditSaved(true);
        // Refresh the record so the next decision carries a fresh updated_at.
        const refreshed = await fetch('/api/linaw/library/' + detail.record.id);
        if (refreshed.ok) {
          const body = (await refreshed.json()) as DetailResponse;
          setDetail(body);
        }
        return;
      }
      closeDialog();
      void loadQueue();
    } catch {
      setDecisionError('Decision failed — network error');
    } finally {
      setDecisionBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#94A3B8]">
          Verification — Pending Review
        </h3>
        <button
          type="button"
          onClick={() => void loadQueue()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#283147] px-3 text-xs text-[#94A3B8] hover:border-[#22D3EE] hover:text-white"
        >
          <ClipboardCheck className="h-3.5 w-3.5" /> Refresh queue
        </button>
      </div>

      {loading && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#94A3B8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
        </p>
      )}
      {loadError && <p className="mt-4 text-sm text-[#F43F5E]">{loadError}</p>}
      {!loading && !loadError && queue.length === 0 && (
        <p className="mt-4 text-sm text-[#94A3B8]">No records awaiting review.</p>
      )}

      <ul className="mt-4 space-y-2">
        {queue.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-[#283147] bg-[#0F1729] px-4 py-3"
          >
            <span className="text-sm font-semibold text-white">
              Ord. No. {item.ordinanceNumber}, s. {item.seriesYear}
            </span>
            <SourceBadge sourceType={item.sourceType} />
            <span className="min-w-0 flex-1 truncate text-sm text-[#94A3B8]" title={item.title}>
              {item.title}
            </span>
            <span className="text-xs text-[#94A3B8]">{item.updatedAt}</span>
            <button
              type="button"
              onClick={() => void openRecord(item.id)}
              className="min-h-11 rounded-lg bg-[#0038A8] px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              Review
            </button>
          </li>
        ))}
      </ul>

      {detailLoading && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#94A3B8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening record…
        </p>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Verify record"
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#283147] bg-[#1E293B]"
          >
            <div className="flex items-center justify-between border-b border-[#283147] px-5 py-3">
              <h4 className="text-sm font-semibold text-white">
                Verify Ord. No. {detail.record.ordinanceNumber}, s. {detail.record.seriesYear}
              </h4>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={closeDialog}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#94A3B8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-auto p-5 lg:grid-cols-2">
              {/* LEFT — original scan */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                  Original Scan
                </h5>
                {detail.scanAvailable && detail.scanUrl ? (
                  detail.scanMimeType === 'application/pdf' ? (
                    <iframe
                      title="Original scan (PDF)"
                      src={detail.scanUrl}
                      className="h-[420px] w-full rounded-lg border border-[#283147] bg-white"
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label="Zoom out"
                          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#283147] text-[#94A3B8] hover:text-white"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Zoom in"
                          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#283147] text-[#94A3B8] hover:text-white"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Rotate"
                          onClick={() => setRotation((r) => (r + 90) % 360)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#283147] text-[#94A3B8] hover:text-white"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="overflow-auto rounded-lg border border-[#283147] bg-[#0F1729] p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detail.scanUrl}
                          alt="Original scan"
                          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'top left' }}
                          className="max-w-full"
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <p className="rounded-lg border border-[#283147] bg-[#0F1729] px-4 py-6 text-sm text-[#94A3B8]">
                    No source scan — text-only record.
                  </p>
                )}
              </div>

              {/* RIGHT — extracted text (editable) */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                  Extracted Text (editable)
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs text-[#94A3B8]">
                    Ordinance number
                    <input
                      type="number"
                      value={fields.ordinanceNumber}
                      onChange={(e) => setFields({ ...fields, ordinanceNumber: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-[#94A3B8]">
                    Series year
                    <input
                      type="number"
                      value={fields.seriesYear}
                      onChange={(e) => setFields({ ...fields, seriesYear: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-xs text-[#94A3B8]">
                  Title
                  <input
                    type="text"
                    value={fields.title}
                    onChange={(e) => setFields({ ...fields, title: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1 text-xs text-[#94A3B8]">
                  Content
                  <textarea
                    rows={10}
                    value={fields.content}
                    onChange={(e) => setFields({ ...fields, content: e.target.value })}
                    className={cn(inputClass, 'font-mono text-xs')}
                  />
                </label>
                <label className="block space-y-1 text-xs text-[#94A3B8]">
                  Subject tags (comma-separated)
                  <input
                    type="text"
                    value={fields.subjectTags}
                    onChange={(e) => setFields({ ...fields, subjectTags: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            {/* Decision bar */}
            <div className="space-y-2 border-t border-[#283147] px-5 py-4">
              {decisionError && <p className="text-sm text-[#F43F5E]">{decisionError}</p>}
              {editSaved && (
                <p className="text-sm text-[#22C55E]">Corrections saved — record still awaits review.</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  aria-label="Rejection reason"
                  placeholder="Rejection reason (required to reject)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={cn(inputClass, 'max-w-sm')}
                />
                <button
                  type="button"
                  onClick={() => void decide('reject')}
                  disabled={decisionBusy || reason.trim() === ''}
                  className="min-h-11 rounded-lg bg-[#F43F5E] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void decide('edit')}
                  disabled={decisionBusy}
                  className="min-h-11 rounded-lg border border-[#94A3B8] px-5 text-sm font-semibold text-[#94A3B8] hover:text-white disabled:opacity-40"
                >
                  Edit & Save
                </button>
                <button
                  type="button"
                  onClick={() => void decide('approve')}
                  disabled={decisionBusy}
                  className="min-h-11 rounded-lg bg-[#0038A8] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                >
                  Approve
                </button>
                {decisionBusy && <Loader2 className="h-4 w-4 animate-spin text-[#94A3B8]" />}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
