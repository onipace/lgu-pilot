'use client';

// src/components/likha/classification-editor.tsx
// Sprint 4 (S4-C5) — L007 Classification tab editor. Record queue (published +
// pending_review), select + Run Classification, suggestion panels with
// confidence bars, the rose low-confidence (<0.6) HITL treatment, the admin
// override multi-select (Code Titles + subject categories), and provenance
// (AI vs user-id). Client-only: codes against the S4-C1 contracts; the routes
// live at /api/likha/classify + /api/likha/classify/[id] + /api/likha/archive.

import { useCallback, useEffect, useState } from 'react';
import { Tags, Sparkles, Check, Loader2, AlertTriangle, UserRound, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LIKHA_CODE_TITLES,
  LIKHA_SUBJECTS,
  type LikhaArchiveListItem,
  type LikhaArchiveSearchResponse,
  type LikhaClassificationEntry,
  type LikhaClassificationSuggestion,
  type LikhaClassifyResponse,
  type LikhaRecordDetailResponse,
} from '@/types/likha';

const ACCENT = '#0038A8';
const CARD = '#1E293B';
const BORDER = '#283147';
const ROSE = '#F43F5E';
const CYAN = '#22D3EE';
const GRAY_BTN = '#334155';

interface SuggestionPanel {
  suggestions: LikhaClassificationSuggestion[];
  hitlRequired: boolean;
}

export default function ClassificationEditor({ className }: { className?: string }) {
  // ── Record queue (published + pending_review) ──
  const [records, setRecords] = useState<LikhaArchiveListItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // ── Selection + run state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // ── Per-record suggestion panels + persisted classifications (provenance) ──
  const [panels, setPanels] = useState<Record<string, SuggestionPanel>>({});
  const [entries, setEntries] = useState<Record<string, LikhaClassificationEntry[]>>({});

  // ── Override state ──
  const [overrideSelections, setOverrideSelections] = useState<Record<string, string[]>>({});
  const [overrideBusy, setOverrideBusy] = useState<Record<string, boolean>>({});
  const [overrideError, setOverrideError] = useState<Record<string, string | null>>({});
  const [overrideSaved, setOverrideSaved] = useState<Record<string, boolean>>({});

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const [pendingRes, publishedRes] = await Promise.all([
        fetch('/api/likha/archive?archiveStatus=pending_review&limit=50'),
        fetch('/api/likha/archive?archiveStatus=published&limit=50'),
      ]);
      if (!pendingRes.ok || !publishedRes.ok) {
        throw new Error('Failed to load records');
      }
      const pending = (await pendingRes.json()) as LikhaArchiveSearchResponse;
      const published = (await publishedRes.json()) as LikhaArchiveSearchResponse;
      // pending_review first, then published.
      setRecords([...pending.items, ...published.items]);
    } catch {
      setQueueError('Could not load the classification queue.');
      setRecords([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  /** Fetch persisted classifications (provenance) for one record. */
  const fetchEntries = useCallback(async (recordId: string) => {
    try {
      const res = await fetch('/api/likha/archive/' + recordId);
      if (!res.ok) return;
      const detail = (await res.json()) as LikhaRecordDetailResponse;
      setEntries((prev) => ({ ...prev, [recordId]: detail.classifications ?? [] }));
    } catch {
      // silent — provenance simply stays hidden
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // Load provenance for queued records so previously-classified rows show it.
  useEffect(() => {
    for (const record of records) {
      void fetchEntries(record.id);
    }
  }, [records, fetchEntries]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(records.map((r) => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  async function runClassification(): Promise<void> {
    if (selectedIds.size === 0 || running) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch('/api/likha/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordinanceIds: Array.from(selectedIds) }),
      });
      if (res.status === 401) {
        setRunError('Session expired — reload and sign in.');
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRunError(body.error ?? 'Invalid request.');
        return;
      }
      if (!res.ok) {
        setRunError('Classification failed — try again.');
        return;
      }
      const data = (await res.json()) as LikhaClassifyResponse;
      const nextPanels: Record<string, SuggestionPanel> = {};
      for (const item of data.results) {
        nextPanels[item.recordId] = {
          suggestions: item.suggestions,
          hitlRequired: item.hitlRequired,
        };
        void fetchEntries(item.recordId);
      }
      setPanels((prev) => ({ ...prev, ...nextPanels }));
    } catch {
      setRunError('Classification failed — try again.');
    } finally {
      setRunning(false);
    }
  }

  function toggleOverrideCategory(recordId: string, category: string): void {
    setOverrideSaved((prev) => ({ ...prev, [recordId]: false }));
    setOverrideError((prev) => ({ ...prev, [recordId]: null }));
    setOverrideSelections((prev) => {
      const current = prev[recordId] ?? [];
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, [recordId]: next };
    });
  }

  async function applyOverride(recordId: string): Promise<void> {
    const categories = overrideSelections[recordId] ?? [];
    if (categories.length === 0 || overrideBusy[recordId]) return;
    setOverrideBusy((prev) => ({ ...prev, [recordId]: true }));
    setOverrideError((prev) => ({ ...prev, [recordId]: null }));
    try {
      const res = await fetch('/api/likha/classify/' + recordId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setOverrideError((prev) => ({
          ...prev,
          [recordId]: body.error ?? `Override failed (HTTP ${res.status})`,
        }));
        return;
      }
      setOverrideSaved((prev) => ({ ...prev, [recordId]: true }));
      void fetchEntries(recordId);
    } catch {
      setOverrideError((prev) => ({ ...prev, [recordId]: 'Override failed — try again.' }));
    } finally {
      setOverrideBusy((prev) => ({ ...prev, [recordId]: false }));
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selection toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#283147] bg-[#1E293B] p-4">
        <Tags className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
        <button
          type="button"
          onClick={selectAll}
          className="min-h-11 rounded-lg border border-[#283147] px-3 text-xs font-semibold text-[#94A3B8] hover:text-white"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearSelection}
          className="min-h-11 rounded-lg border border-[#283147] px-3 text-xs font-semibold text-[#94A3B8] hover:text-white"
        >
          Clear
        </button>
        <span className="text-xs text-[#94A3B8]">{selectedCount} selected</span>
        <button
          type="button"
          onClick={() => void runClassification()}
          disabled={selectedCount === 0 || running}
          className="ml-auto flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          Run Classification
        </button>
      </div>

      {runError && (
        <p className="rounded-lg border px-4 py-3 text-xs" style={{ borderColor: ROSE, color: ROSE }}>
          {runError}
        </p>
      )}

      {/* Record queue */}
      {loadingQueue ? (
        <p className="text-sm text-[#94A3B8]">Loading records…</p>
      ) : queueError ? (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: ROSE }}>
            {queueError}
          </p>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="min-h-11 rounded-lg border border-[#283147] px-4 text-xs font-semibold text-[#94A3B8] hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No records to classify yet — publish records first.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const panel = panels[record.id];
            const recordEntries = entries[record.id] ?? [];
            const showPanel = Boolean(panel) || recordEntries.length > 0;
            const isPublished = record.archiveStatus === 'published';
            const chosen = overrideSelections[record.id] ?? [];
            return (
              <li key={record.id} className="rounded-xl border border-[#283147] bg-[#1E293B] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select Ordinance No. ${record.ordinanceNumber}, S. ${record.seriesYear}`}
                    checked={selectedIds.has(record.id)}
                    onChange={() => toggleSelect(record.id)}
                    className="h-5 w-5 min-h-11 min-w-11 accent-[#0038A8]"
                  />
                  <span className="font-mono text-xs text-white">
                    Ordinance No. {record.ordinanceNumber}, S. {record.seriesYear}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[#94A3B8]">{record.title}</span>
                  <span
                    className="rounded-full px-2 py-1 text-[10px] font-bold"
                    style={
                      isPublished
                        ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }
                        : { backgroundColor: 'rgba(250,204,21,0.15)', color: '#FACC15' }
                    }
                  >
                    {isPublished ? 'PUBLISHED' : 'PENDING REVIEW'}
                  </span>
                </div>

                {showPanel && (
                  <div
                    className="mt-3 space-y-3 border-l-2 pl-4"
                    style={{ borderColor: panel?.hitlRequired ? ROSE : BORDER }}
                  >
                    {/* Suggestions with confidence bars */}
                    {panel && panel.suggestions.length > 0 && (
                      <div className="space-y-2">
                        {panel.suggestions.map((s) => (
                          <div key={s.label} className="flex items-center gap-3">
                            <span className="w-56 truncate text-xs text-white">{s.label}</span>
                            <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.round(s.confidence * 100)}%`, backgroundColor: CYAN }}
                              />
                            </div>
                            <span className="w-10 text-right font-mono text-[10px] text-[#94A3B8]">
                              {s.confidence.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {panel && panel.hitlRequired && (
                      <div className="flex items-start gap-2 text-xs" style={{ color: ROSE }}>
                        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                        <span>
                          Confidence below 0.6 — human override required (SB Secretary / Legal Officer)
                        </span>
                      </div>
                    )}

                    {/* Provenance (persisted classifications) */}
                    {recordEntries.length > 0 && (
                      <div className="space-y-1">
                        {recordEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-2 text-xs text-[#94A3B8]">
                            {entry.assignedBy === 'ai' ? (
                              <>
                                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                  {entry.category} — AI
                                  {entry.confidence !== null ? ` — confidence ${entry.confidence.toFixed(2)}` : ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                  {entry.category} — Override by {entry.assignedBy.slice(0, 8)}…
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Override multi-select */}
                    <details className="text-xs">
                      <summary className="min-h-11 cursor-pointer select-none text-[#94A3B8] hover:text-white">
                        Override subject categories
                      </summary>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <fieldset>
                          <legend className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
                            Code Titles
                          </legend>
                          <div className="space-y-1">
                            {LIKHA_CODE_TITLES.map((title) => (
                              <label key={title} className="flex min-h-11 items-center gap-2 text-xs text-white">
                                <input
                                  type="checkbox"
                                  checked={chosen.includes(title)}
                                  onChange={() => toggleOverrideCategory(record.id, title)}
                                  className="h-4 w-4 accent-[#0038A8]"
                                />
                                <span className="truncate">{title}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset>
                          <legend className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
                            Subject categories
                          </legend>
                          <div className="space-y-1">
                            {LIKHA_SUBJECTS.map((subject) => (
                              <label key={subject} className="flex min-h-11 items-center gap-2 text-xs text-white">
                                <input
                                  type="checkbox"
                                  checked={chosen.includes(subject)}
                                  onChange={() => toggleOverrideCategory(record.id, subject)}
                                  className="h-4 w-4 accent-[#0038A8]"
                                />
                                <span className="truncate">{subject}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void applyOverride(record.id)}
                          disabled={chosen.length === 0 || overrideBusy[record.id]}
                          className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: GRAY_BTN }}
                        >
                          {overrideBusy[record.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          )}
                          Apply Override
                        </button>
                        {overrideSaved[record.id] && (
                          <span
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold"
                            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
                          >
                            <Check className="h-3 w-3" aria-hidden="true" /> Override saved
                          </span>
                        )}
                        {overrideError[record.id] && (
                          <span className="text-xs" style={{ color: ROSE }}>
                            {overrideError[record.id]}
                          </span>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
