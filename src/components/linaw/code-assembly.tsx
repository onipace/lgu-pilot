'use client';

// src/components/linaw/code-assembly.tsx
// Sprint 7 (S7-C11) — N006 Code Assembly tab (replaces the Sprint-6 stub):
// assembly controls + volume selector, hierarchical structure tree, flat TOC
// preview pane, the N007 summaries review queue, and the export bar gated by
// the final_code_export HITL acknowledgment (D5/D10). Props-only — the page
// feeds it; NO fetch here. Drag-to-reorder is deliberately NOT implemented
// (structure order is deterministic from placements — D10, MAINTAIN-phase
// candidate). PDF/DOCX export is rendered as a disabled post-MVP toggle.

import { useState } from 'react';
import { BookMarked, Download, FileJson, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CodeTocNode,
  LinawCodeVolumeDetail,
  LinawCodeVolumeSummary,
} from '@/types/linaw';

export interface CodeAssemblyQueueItem {
  recordId: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  summary: string;
}

interface CodeAssemblyProps {
  volumes: LinawCodeVolumeSummary[]; // newest first
  volume: LinawCodeVolumeDetail | null; // selected/latest volume detail
  summariesQueue: CodeAssemblyQueueItem[];
  edition: string;
  busy: boolean;
  /** User acknowledged the final_code_export gate. */
  exportApproved: boolean;
  onEditionChange: (edition: string) => void;
  onAssemble: () => void;
  onGenerateSummaries: () => void;
  onSaveSummary: (recordId: string, summary: string) => void;
  /** Acknowledges the final_code_export HITL card. */
  onApproveExport: () => void;
  onExportJson: () => void;
}

function StatusChip({ status }: { status: LinawCodeVolumeSummary['status'] }) {
  const color =
    status === 'published' ? '#22C55E' : status === 'under_review' ? '#FACC15' : '#94A3B8';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color, backgroundColor: color + '22' }}
    >
      {status}
    </span>
  );
}

export default function CodeAssembly({
  volumes,
  volume,
  summariesQueue,
  edition,
  busy,
  exportApproved,
  onEditionChange,
  onAssemble,
  onGenerateSummaries,
  onSaveSummary,
  onApproveExport,
  onExportJson,
}: CodeAssemblyProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function draftFor(item: CodeAssemblyQueueItem): string {
    return drafts[item.recordId] ?? item.summary ?? '';
  }

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <BookMarked className="h-4 w-4 text-[#6366F1]" />
        Code of Ordinances Assembly
      </h3>

      {/* 1 ── Assembly controls ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs text-[#94A3B8]">
            Edition
            <input
              type="text"
              value={edition}
              onChange={(e) => onEditionChange(e.target.value)}
              placeholder="Edition label for the new code volume"
              className="mt-1 min-h-11 w-full rounded-md border border-[#283147] bg-[#0F1729] px-3 text-sm text-white placeholder:text-[#64748B] focus:border-[#6366F1] focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || edition.trim().length === 0}
            onClick={onAssemble}
            className="min-h-11 rounded-lg bg-[#6366F1] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Assembling…' : 'Assemble Code Volume'}
          </button>
        </div>

        {volumes.length > 0 && (
          <ul className="mt-4 space-y-2" aria-label="Assembled code volumes">
            {volumes.map((v) => (
              <li
                key={v.id}
                aria-current={volume?.id === v.id}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                  volume?.id === v.id
                    ? 'border-[#6366F1] bg-[#0F1729]'
                    : 'border-[#283147] bg-[#0F1729]/50'
                )}
              >
                <span className="font-semibold text-white">{v.title}</span>
                <span className="text-[#94A3B8]">· {v.edition}</span>
                <StatusChip status={v.status} />
                <span className="ml-auto text-[10px] text-[#64748B]">{v.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2 ── Structure tree ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
          Structure
        </h4>
        {!volume && (
          <p className="mt-3 text-sm text-[#94A3B8]">No code volume yet — assemble one.</p>
        )}
        {volume && (
          <div className="mt-3 space-y-5">
            {volume.toc.map((titleNode) => (
              <StructureTitle key={titleNode.title} node={titleNode} />
            ))}
          </div>
        )}
      </section>

      {/* 3 ── TOC preview pane ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
          Table of Contents preview
        </h4>
        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-[#283147] bg-[#0F1729] p-3">
          {!volume && <p className="text-xs text-[#94A3B8]">Assemble a volume to preview its TOC.</p>}
          {volume && <TocPreview toc={volume.toc} />}
        </div>
      </section>

      {/* 4 ── Summaries review queue (N007) ────────────────────────────── */}
      <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
            Plain-language summaries
          </h4>
          <button
            type="button"
            disabled={busy}
            onClick={onGenerateSummaries}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-[#283147] bg-[#0F1729] px-3 text-xs font-semibold text-white transition-colors hover:border-[#22D3EE] disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#22D3EE]" />
            Generate missing summaries
          </button>
        </div>

        {summariesQueue.length === 0 && (
          <p className="mt-3 text-xs text-[#94A3B8]">
            No ready ordinances in the queue — approve records in the Library tab first.
          </p>
        )}

        <div className="mt-3 space-y-3">
          {summariesQueue.map((item) => {
            const draft = draftFor(item);
            const unchanged = draft.trim() === (item.summary ?? '').trim();
            return (
              <article key={item.recordId} className="rounded-xl border border-[#283147] bg-[#0F1729] p-3">
                <p className="text-xs font-semibold text-white">
                  Ord No. {item.ordinanceNumber}, S. {item.seriesYear} — {item.title}
                </p>
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [item.recordId]: e.target.value }))
                  }
                  rows={3}
                  placeholder="Plain-language summary (2–3 sentences)…"
                  aria-label={`Summary for Ordinance No. ${item.ordinanceNumber}, Series of ${item.seriesYear}`}
                  className="mt-2 w-full rounded-md border border-[#283147] bg-[#1E293B] p-2 text-xs text-white placeholder:text-[#64748B] focus:border-[#22D3EE] focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busy || unchanged || draft.trim().length === 0}
                    onClick={() => onSaveSummary(item.recordId, draft.trim())}
                    className="min-h-11 rounded-md bg-[#22D3EE] px-3 text-xs font-semibold text-[#0F1729] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 5 ── Export bar (final_code_export gate — D5/D10) ─────────────── */}
      <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">Export</h4>
        {volume && volume.status === 'draft' && !exportApproved && (
          <div className="mt-3 rounded-xl border border-[#F43F5E]/50 bg-[#F43F5E]/10 p-3">
            <p className="text-xs font-semibold text-[#F43F5E]">
              final_code_export — review required before export
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              The assembled draft volume must be acknowledged by a human before it can be exported.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onApproveExport}
              className="mt-2 min-h-11 rounded-md bg-[#F43F5E] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Approve for export
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!volume || !exportApproved || busy}
            onClick={onExportJson}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-[#22C55E] px-4 text-xs font-semibold text-[#0F1729] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <FileJson className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <span
            className="flex min-h-11 cursor-not-allowed items-center gap-2 rounded-lg border border-[#283147] bg-[#0F1729] px-4 text-xs font-semibold text-[#64748B] opacity-60"
            title="post-MVP"
            aria-disabled="true"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF / DOCX — post-MVP
          </span>
          {!volume && (
            <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
              <Download className="h-3 w-3" /> Assemble a volume to enable export.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Structure tree renderers ────────────────────────────────────────────────

function StructureTitle({ node }: { node: CodeTocNode }) {
  return (
    <div>
      <h5 className="text-sm font-bold text-white">{node.title}</h5>
      <div className="mt-2 space-y-4 border-l-2 border-[#283147] pl-4">
        {node.chapters.map((chapter) => (
          <div key={chapter.name}>
            <h6 className="text-xs font-semibold uppercase tracking-widest text-[#22D3EE]">
              {chapter.name}
            </h6>
            {chapter.sections && chapter.sections.length > 0 && (
              <ul className="mt-2 space-y-1">
                {chapter.sections.map((section) => (
                  <SectionRow key={section.id} section={section} />
                ))}
              </ul>
            )}
            {chapter.articles &&
              chapter.articles.map((article) => (
                <div key={article.name} className="mt-2">
                  <p className="text-[11px] font-semibold text-[#94A3B8]">{article.name}</p>
                  <ul className="mt-1 space-y-1">
                    {article.sections.map((section) => (
                      <SectionRow key={section.id} section={section} />
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionRow({ section }: { section: { id: string; label: string; ordinanceNumber?: number; seriesYear?: number; title?: string; summary?: string } }) {
  return (
    <li className="rounded-md border border-[#283147] bg-[#0F1729] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-white">{section.label}</span>
        <span className="text-[#94A3B8]">
          Ord No. {section.ordinanceNumber ?? '?'}, S. {section.seriesYear ?? '?'}
        </span>
      </div>
      {section.title && <p className="mt-1 text-[11px] text-[#E2E8F0]">{section.title}</p>}
      {section.summary && (
        <p className="mt-1 text-[10px] italic text-[#94A3B8]">
          {section.summary.length > 160 ? section.summary.slice(0, 160) + '…' : section.summary}
        </p>
      )}
    </li>
  );
}

// ── Flat TOC preview ────────────────────────────────────────────────────────

function TocPreview({ toc }: { toc: CodeTocNode[] }) {
  const lines: Array<{ depth: number; text: string }> = [];
  for (const titleNode of toc) {
    lines.push({ depth: 0, text: titleNode.title });
    for (const chapter of titleNode.chapters) {
      lines.push({ depth: 1, text: chapter.name });
      for (const section of chapter.sections ?? []) {
        lines.push({ depth: 2, text: `${section.label}: ${section.title ?? ''}`.trim() });
      }
      for (const article of chapter.articles ?? []) {
        lines.push({ depth: 2, text: article.name });
        for (const section of article.sections) {
          lines.push({ depth: 3, text: `${section.label}: ${section.title ?? ''}`.trim() });
        }
      }
    }
  }
  return (
    <ol className="space-y-1">
      {lines.map((line, i) => (
        <li
          key={i}
          className={cn(
            'text-[11px]',
            line.depth === 0 && 'font-bold text-white',
            line.depth === 1 && 'pl-3 font-semibold text-[#22D3EE]',
            line.depth === 2 && 'pl-6 text-[#E2E8F0]',
            line.depth === 3 && 'pl-10 text-[#94A3B8]'
          )}
        >
          {line.text}
        </li>
      ))}
    </ol>
  );
}
