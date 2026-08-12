'use client';

// src/components/linaw/classification-panel.tsx
// Sprint 6 (S6-C12) — N002 classification panel (additive file; PRP-LINAW
// names no classification editor, so LINAW gets its own — flagged for
// SPRINT_REVIEW). The page owns the classify fetch (classifyRun); this panel
// renders results + gates + exceptions and persists human overrides via
// PUT /api/linaw/classify/:id (the ONLY fetch here).

import { useState } from 'react';
import { Layers, AlertTriangle, Save } from 'lucide-react';
import type { LinawClassifyResultItem } from '@/types/linaw';

interface ClassificationPanelProps {
  classifyRun: () => Promise<void>;
  running: boolean;
  results: LinawClassifyResultItem[];
  exceptions: string[];
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#22C55E';
  if (confidence >= 0.6) return '#FACC15';
  return '#F87171';
}

export default function ClassificationPanel({
  classifyRun,
  running,
  results,
  exceptions,
}: ClassificationPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Layers className="h-4 w-4 text-[#8B5CF6]" />
          Code Classification
        </h3>
        <button
          type="button"
          onClick={() => void classifyRun()}
          disabled={running}
          className="min-h-11 rounded-lg bg-[#8B5CF6] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {running ? 'Classifying…' : 'Run Code Classifier'}
        </button>
      </div>

      {exceptions.length > 0 && (
        <div className="space-y-1 rounded-2xl border border-[#FACC15]/40 bg-[#1E293B] p-4">
          {exceptions.map((exception, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-[#FACC15]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {exception}
            </p>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">
          No classification run yet — run the Code Classifier over the ready library.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((item) => (
            <ClassifyResultRow key={item.recordId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClassifyResultRow({ item }: { item: LinawClassifyResultItem }) {
  const [titleNumber, setTitleNumber] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [articleNumber, setArticleNumber] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'reviewed' | 'error'; message?: string }>({
    kind: 'idle',
  });

  async function saveOverride(): Promise<void> {
    setSaving(true);
    setStatus({ kind: 'idle' });
    try {
      const payload: Record<string, unknown> = {
        titleNumber: Number(titleNumber),
        chapterNumber: Number(chapterNumber),
        reason,
      };
      if (articleNumber.trim() !== '') payload.articleNumber = Number(articleNumber);

      const res = await fetch(`/api/linaw/classify/${item.recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setStatus({ kind: 'error', message: body?.error ?? `Override failed (HTTP ${res.status})` });
        return;
      }
      setStatus({ kind: 'reviewed' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Override failed',
      });
    } finally {
      setSaving(false);
    }
  }

  const placementLabel = item.placement
    ? `Title ${item.placement.titleNumber} · Chapter ${item.placement.chapterNumber}` +
      (item.placement.articleNumber !== undefined ? ` · Article ${item.placement.articleNumber}` : '')
    : '—';

  return (
    <article className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white">
          Ordinance No. {item.ordinanceNumber}, S. {item.seriesYear}
        </span>
        <span className="text-xs text-[#94A3B8]">{placementLabel}</span>
        {item.placement && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              color: confidenceColor(item.placement.confidence),
              backgroundColor: confidenceColor(item.placement.confidence) + '22',
            }}
          >
            {Math.round(item.placement.confidence * 100)}%
          </span>
        )}
        {item.gate && (
          <span className="rounded-full bg-[#F43F5E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F43F5E]">
            {item.gate}
          </span>
        )}
        {status.kind === 'reviewed' && (
          <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#22C55E]">
            reviewed
          </span>
        )}
      </div>

      {/* Inline override form (decision D6 — reason REQUIRED) */}
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-[#94A3B8]">
          Title
          <input
            type="number"
            min={1}
            max={13}
            value={titleNumber}
            onChange={(e) => setTitleNumber(e.target.value)}
            className="min-h-11 rounded-lg border border-[#283147] bg-[#0F1729] px-3 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-[#94A3B8]">
          Chapter
          <input
            type="number"
            min={1}
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
            className="min-h-11 rounded-lg border border-[#283147] bg-[#0F1729] px-3 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-[#94A3B8]">
          Article (opt.)
          <input
            type="number"
            min={1}
            value={articleNumber}
            onChange={(e) => setArticleNumber(e.target.value)}
            className="min-h-11 rounded-lg border border-[#283147] bg-[#0F1729] px-3 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-[#94A3B8] md:col-span-1">
          Reason (required)
          <textarea
            value={reason}
            required
            onChange={(e) => setReason(e.target.value)}
            rows={1}
            className="min-h-11 rounded-lg border border-[#283147] bg-[#0F1729] px-3 py-2 text-sm text-white"
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void saveOverride()}
          disabled={saving || !titleNumber || !chapterNumber || reason.trim() === ''}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#22C55E] px-4 text-xs font-semibold text-[#0F1729] disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save override'}
        </button>
        {status.kind === 'error' && (
          <p className="text-xs text-[#F87171]">{status.message}</p>
        )}
        {status.kind === 'reviewed' && (
          <p className="text-xs text-[#22C55E]">Override saved — status reviewed.</p>
        )}
      </div>
    </article>
  );
}
