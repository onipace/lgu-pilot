'use client';

// src/components/likha/verification-panel.tsx
// Sprint 3 (S3-C4) — L004 HITL verification dialog (DESIGN.md §2.3).
// Side-by-side: ORIGINAL SCAN (zoom/rotate) ↔ EXTRACTED TEXT (editable fields
// with per-field confidence; any field <0.7 renders rose). Reject / Edit &
// Save / Approve & Publish. Focus-trapped, Esc closes, keyboard operable.
// Client-only: no server imports — talks to /api/likha/archive/[id] over HTTP.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Hand,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LIKHA_SUBJECTS,
  type LikhaRecordDetailResponse,
  type MetadataConfidence,
} from '@/types/likha';

interface VerificationPanelProps {
  recordId: string;
  /** When present, the panel renders the rose gate styling + agent note for these exceptions. */
  gate?: { exceptions: string[] } | null;
  onClose: () => void;
  /** Called after a successful PUT so the page can update feed/pipeline state. */
  onDecision?: (result: {
    action: 'approve' | 'edit' | 'reject';
    recordId: string;
    published: boolean;
  }) => void;
}

type DecisionAction = 'approve' | 'edit' | 'reject';

const ROSE = '#F43F5E';
const FOCUS_RING = '#22D3EE';

export default function VerificationPanel({
  recordId,
  gate,
  onClose,
  onDecision,
}: VerificationPanelProps) {
  // ── Data load ──
  const [detail, setDetail] = useState<LikhaRecordDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Editable state ──
  const [ordinanceNumber, setOrdinanceNumber] = useState('');
  const [seriesYear, setSeriesYear] = useState('');
  const [title, setTitle] = useState('');
  const [sectionCount, setSectionCount] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<MetadataConfidence | null>(null);

  // ── Decision state ──
  const [reason, setReason] = useState('');
  const [inFlight, setInFlight] = useState<DecisionAction | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // ── Scan viewer state ──
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/likha/archive/' + recordId);
      if (!res.ok) {
        throw new Error(`Failed to load record (HTTP ${res.status})`);
      }
      const data = (await res.json()) as LikhaRecordDetailResponse;
      setDetail(data);
      const record = data.record;
      setOrdinanceNumber(String(record.ordinanceNumber));
      setSeriesYear(String(record.seriesYear));
      setTitle(record.title);
      setSectionCount('');
      setSubjects(record.subjectTags);
      setConfidence(record.extractionConfidence ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load record');
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // ── A11y: focus trap, Esc closes, focus restore ──
  useEffect(() => {
    previouslyFocused.current =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    const node = panelRef.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]'
      );
      first?.focus();
    }

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      const node = panelRef.current;
      if (!node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !node.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const confidenceFor = (field: keyof MetadataConfidence): number | null =>
    confidence ? confidence[field] : null;

  const isLow = (field: keyof MetadataConfidence): boolean => {
    const value = confidenceFor(field);
    return value !== null && value < 0.7;
  };

  const toggleSubject = (subject: string) => {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const editedFields = () => {
    const record = detail?.record;
    if (!record) return undefined;
    const fields: {
      ordinanceNumber?: number;
      seriesYear?: number;
      title?: string;
      sectionCount?: number;
      subjects?: string[];
    } = {};
    const num = Number(ordinanceNumber);
    if (Number.isFinite(num) && num !== record.ordinanceNumber) fields.ordinanceNumber = num;
    const year = Number(seriesYear);
    if (Number.isFinite(year) && year !== record.seriesYear) fields.seriesYear = year;
    if (title !== record.title) fields.title = title;
    if (sectionCount.trim() !== '') {
      const sections = Number(sectionCount);
      if (Number.isFinite(sections)) fields.sectionCount = sections;
    }
    const original = record.subjectTags;
    if (
      subjects.length !== original.length ||
      subjects.some((s) => !original.includes(s))
    ) {
      fields.subjects = subjects;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  };

  const submit = async (action: DecisionAction) => {
    setDecisionError(null);
    setSavedNote(null);
    setInFlight(action);
    try {
      const payload: Record<string, unknown> = { action };
      if (action === 'reject') payload.reason = reason;
      if (action === 'edit') {
        payload.fields = {
          ordinanceNumber: Number(ordinanceNumber),
          seriesYear: Number(seriesYear),
          title,
          ...(sectionCount.trim() !== '' ? { sectionCount: Number(sectionCount) } : {}),
          subjects,
        };
      }
      if (action === 'approve') {
        const fields = editedFields();
        if (fields) payload.fields = fields;
      }

      const res = await fetch('/api/likha/archive/' + recordId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        published?: boolean;
        archiveStatus?: string;
      };

      if (res.status === 409) {
        setDecisionError('Record changed or already finalized — reload and retry');
        return;
      }
      if (!res.ok) {
        setDecisionError(data.error ?? `Decision failed (HTTP ${res.status})`);
        return;
      }

      if (action === 'edit') {
        setSavedNote('Corrections saved — record still awaits approval.');
      }
      onDecision?.({ action, recordId, published: data.published === true });
      if (action !== 'edit') {
        onClose();
      }
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setInFlight(null);
    }
  };

  const scanMimeType = detail?.scanMimeType ?? null;
  const scanUrl = detail?.scanUrl ?? null;
  const scanAvailable = detail?.scanAvailable ?? false;
  const originalFilename = detail?.record.originalFilename ?? recordId;

  const inputClass = (low: boolean) =>
    cn(
      'w-full rounded-lg bg-[#1E293B] px-3 py-2 text-sm text-white outline-none',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]',
      low ? 'border' : 'border border-[#283147]'
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Verify extraction"
        onKeyDown={handleKeyDown}
        className="w-full max-w-6xl max-h-[90vh] overflow-auto rounded-xl border border-[#283147] bg-[#0F1729] shadow-xl sm:w-[90%]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#283147] px-5 py-4">
          <div className="flex items-center gap-2">
            <Hand size={18} style={{ color: ROSE }} aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white">
              VERIFY EXTRACTION — {originalFilename}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification panel"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#283147] text-[#94A3B8] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Loading record…
          </div>
        )}

        {!loading && loadError && (
          <div className="space-y-3 p-10 text-center">
            <p className="text-sm" style={{ color: ROSE }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadDetail()}
              className="min-h-11 rounded-lg border border-[#283147] px-4 text-sm text-white hover:border-[#94A3B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && detail && (
          <>
            {/* Agent note (rose gate) */}
            {gate && (
              <div
                className="mx-5 mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
                style={{ borderColor: ROSE, color: ROSE }}
              >
                <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <p>
                  <span className="font-semibold">Agent note (Validator): </span>
                  {gate.exceptions.join('; ')}
                </p>
              </div>
            )}

            {/* Body grid: scan left / editable right */}
            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
              {/* LEFT — original scan */}
              <section aria-label="Original scan">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                  ORIGINAL SCAN
                </h3>
                {!scanAvailable && (
                  <p className="rounded-lg border p-4 text-sm" style={{ borderColor: ROSE, color: ROSE }}>
                    Scan unavailable
                  </p>
                )}
                {scanAvailable && scanMimeType === 'application/pdf' && (
                  <div className="space-y-2">
                    <iframe src={scanUrl ?? undefined} title="Original scan (PDF)" className="h-[420px] w-full rounded-lg border border-[#283147]" />
                    <a
                      href={scanUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                      style={{ color: FOCUS_RING }}
                    >
                      Open scan in new tab
                    </a>
                  </div>
                )}
                {scanAvailable && scanMimeType !== 'application/pdf' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                        aria-label="Zoom out"
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-[#283147] px-3 text-xs text-white hover:border-[#94A3B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                      >
                        <ZoomOut size={16} aria-hidden="true" /> Zoom -
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                        aria-label="Zoom in"
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-[#283147] px-3 text-xs text-white hover:border-[#94A3B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                      >
                        <ZoomIn size={16} aria-hidden="true" /> Zoom +
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        aria-label="Rotate scan"
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-[#283147] px-3 text-xs text-white hover:border-[#94A3B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                      >
                        <RotateCw size={16} aria-hidden="true" /> Rotate
                      </button>
                    </div>
                    <div className="h-[420px] overflow-auto rounded-lg border border-[#283147] bg-[#1E293B]">
                      {/* Scans stream through the authenticated route (decision D15); next/image cannot optimize them without a custom loader. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={scanUrl ?? undefined}
                        alt="Original scan"
                        style={{
                          transform: `scale(${zoom}) rotate(${rotation}deg)`,
                          transformOrigin: 'top left',
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* RIGHT — extracted text (editable) */}
              <section aria-label="Extracted text, editable">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                  EXTRACTED TEXT (editable)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="likha-ord-number" className="mb-1 block text-xs text-[#94A3B8]">
                      Ordinance No.
                    </label>
                    <input
                      id="likha-ord-number"
                      type="number"
                      value={ordinanceNumber}
                      onChange={(e) => setOrdinanceNumber(e.target.value)}
                      className={inputClass(isLow('ordinanceNumber'))}
                      style={
                        isLow('ordinanceNumber')
                          ? { borderColor: ROSE, ['--tw-ring-color' as string]: FOCUS_RING }
                          : { ['--tw-ring-color' as string]: FOCUS_RING }
                      }
                    />
                    <ConfidenceLine value={confidenceFor('ordinanceNumber')} low={isLow('ordinanceNumber')} />
                  </div>

                  <div>
                    <label htmlFor="likha-series-year" className="mb-1 block text-xs text-[#94A3B8]">
                      Series Year
                    </label>
                    <input
                      id="likha-series-year"
                      type="number"
                      value={seriesYear}
                      onChange={(e) => setSeriesYear(e.target.value)}
                      className={inputClass(isLow('seriesYear'))}
                      style={
                        isLow('seriesYear')
                          ? { borderColor: ROSE, ['--tw-ring-color' as string]: FOCUS_RING }
                          : { ['--tw-ring-color' as string]: FOCUS_RING }
                      }
                    />
                    <ConfidenceLine value={confidenceFor('seriesYear')} low={isLow('seriesYear')} />
                  </div>

                  <div>
                    <label htmlFor="likha-title" className="mb-1 block text-xs text-[#94A3B8]">
                      Title
                    </label>
                    <textarea
                      id="likha-title"
                      rows={3}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={cn(inputClass(isLow('title')), 'font-serif')}
                      style={
                        isLow('title')
                          ? { borderColor: ROSE, ['--tw-ring-color' as string]: FOCUS_RING }
                          : { ['--tw-ring-color' as string]: FOCUS_RING }
                      }
                    />
                    <ConfidenceLine value={confidenceFor('title')} low={isLow('title')} />
                  </div>

                  <div>
                    <label htmlFor="likha-section-count" className="mb-1 block text-xs text-[#94A3B8]">
                      Sections
                    </label>
                    <input
                      id="likha-section-count"
                      type="number"
                      value={sectionCount}
                      onChange={(e) => setSectionCount(e.target.value)}
                      className={inputClass(isLow('sectionCount'))}
                      style={
                        isLow('sectionCount')
                          ? { borderColor: ROSE, ['--tw-ring-color' as string]: FOCUS_RING }
                          : { ['--tw-ring-color' as string]: FOCUS_RING }
                      }
                    />
                    <ConfidenceLine value={confidenceFor('sectionCount')} low={isLow('sectionCount')} />
                  </div>

                  <fieldset>
                    <legend className="mb-1 text-xs text-[#94A3B8]">Subjects</legend>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {LIKHA_SUBJECTS.map((subject) => (
                        <label
                          key={subject}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-[#94A3B8] hover:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={subjects.includes(subject)}
                            onChange={() => toggleSubject(subject)}
                            className="h-4 w-4"
                            style={{ accentColor: FOCUS_RING }}
                          />
                          {subject}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </section>
            </div>

            {/* Decision bar */}
            <div className="sticky bottom-0 border-t border-[#283147] bg-[#0F1729] px-5 py-4">
              <div className="mb-3">
                <label htmlFor="likha-decision-reason" className="mb-1 block text-xs text-[#94A3B8]">
                  Decision reason (required on reject)
                </label>
                <input
                  id="likha-decision-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-[#283147] bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                />
              </div>

              {decisionError && (
                <p className="mb-3 text-sm" style={{ color: ROSE }} role="alert">
                  {decisionError}
                </p>
              )}
              {savedNote && (
                <p className="mb-3 flex items-center gap-2 text-sm text-[#22C55E]">
                  <CheckCircle2 size={16} aria-hidden="true" /> {savedNote}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={reason.trim() === '' || inFlight !== null}
                  onClick={() => void submit('reject')}
                  className="flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                  style={{ borderColor: ROSE, color: ROSE, ['--tw-ring-color' as string]: FOCUS_RING }}
                >
                  {inFlight === 'reject' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  Reject
                </button>
                <button
                  type="button"
                  disabled={inFlight !== null}
                  onClick={() => void submit('edit')}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-[#334155] px-4 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#475569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                >
                  {inFlight === 'edit' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {'Edit & Save'}
                </button>
                <button
                  type="button"
                  disabled={inFlight !== null}
                  onClick={() => void submit('approve')}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#0044cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                >
                  {inFlight === 'approve' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {'Approve & Publish'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfidenceLine({ value, low }: { value: number | null; low: boolean }) {
  if (value === null) return null;
  return (
    <p className="mt-1 text-[11px]" style={{ color: low ? ROSE : '#94A3B8' }}>
      confidence: {value.toFixed(2)}
    </p>
  );
}
