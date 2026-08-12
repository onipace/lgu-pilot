'use client';

// src/components/linaw/library-ingestion.tsx
// Sprint 5 (S5-C9) — LINAW library ingestion panel: THREE input modes.
// (a) Bulk import (N013) — JSON/CSV/DOCX file or pasted text with a
//     component-local preview parse (the server is the source of truth).
// (b) Scan upload (N014) — drag-drop ≤10 PDF/JPG/PNG ≤20 MB each.
// (c) Manual entry — direct record creation (PRD §6.5).
// Talks ONLY to /api/linaw/* over HTTP; no server imports.

import { useMemo, useRef, useState } from 'react';
import { FileUp, FileText, UploadCloud, Keyboard, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'import' | 'scan' | 'manual';

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'import', label: 'Bulk Import' },
  { id: 'scan', label: 'Scan Upload' },
  { id: 'manual', label: 'Manual Entry' },
];

const SCAN_LIMIT = 10;
const SCAN_MAX_BYTES = 20 * 1024 * 1024;
const SCAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// ── Component-local preview parsing (same field rules as the server) ──

interface PreviewRow {
  index: number;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  error?: string;
  duplicateOf?: number;
}

function previewNormalize(raw: Record<string, unknown>, index: number): PreviewRow {
  const pick = (camel: string, snake: string) =>
    raw[camel] !== undefined ? raw[camel] : raw[snake];
  const ordinanceNumber = Number(pick('ordinanceNumber', 'ordinance_number'));
  if (!Number.isInteger(ordinanceNumber) || ordinanceNumber <= 0) {
    return { index, error: `record ${index}: ordinanceNumber must be a positive integer` };
  }
  const seriesYear = Number(pick('seriesYear', 'series_year'));
  if (!Number.isInteger(seriesYear) || seriesYear <= 0) {
    return { index, error: `record ${index}: seriesYear must be a positive integer` };
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title === '') return { index, error: `record ${index}: title must be a non-empty string` };
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  if (content === '') return { index, error: `record ${index}: content must be a non-empty string` };
  return { index, ordinanceNumber, seriesYear, title };
}

function previewCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] !== '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((name, i) => {
      obj[name] = (i < r.length ? r[i] : '').trim();
    });
    return obj;
  });
}

function previewRowsFromText(text: string): PreviewRow[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  let raws: Record<string, unknown>[];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : parsed?.records;
      if (!Array.isArray(list)) return null;
      raws = list.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    } catch {
      return null;
    }
  } else {
    const csvRows = previewCsv(text);
    if (csvRows.length === 0) return [];
    raws = csvRows.map((r) => {
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        const canonical =
          key === 'ordinancenumber' || key === 'ordinance_number'
            ? 'ordinanceNumber'
            : key === 'seriesyear' || key === 'series_year'
              ? 'seriesYear'
              : key === 'subjecttags' || key === 'subject_tags'
                ? 'subjectTags'
                : key;
        mapped[canonical] = value;
      }
      return mapped;
    });
  }

  const seen = new Map<string, number>();
  return raws.map((raw, index) => {
    const row = previewNormalize(raw, index);
    if (!row.error && row.ordinanceNumber !== undefined && row.seriesYear !== undefined) {
      const key = `${row.ordinanceNumber}|${row.seriesYear}`;
      const first = seen.get(key);
      if (first !== undefined) row.duplicateOf = first;
      else seen.set(key, index);
    }
    return row;
  });
}

// ── Shared tiny UI atoms ──

function SectionCard(props: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-2xl border border-[#283147] bg-[#1E293B] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-[#94A3B8]">{props.title}</h3>
      {props.hint && <p className="mt-1 text-xs text-[#94A3B8]">{props.hint}</p>}
      <div className="mt-4 space-y-4">{props.children}</div>
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-[#283147] bg-[#0F1729] px-3 py-2 text-sm text-white placeholder:text-[#94A3B8]/60 focus:border-[#22D3EE] focus:outline-none';

export default function LibraryIngestion() {
  const [mode, setMode] = useState<Mode>('import');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importReport, setImportReport] = useState<{
    imported: number;
    skippedDuplicates: number;
    invalidRecords: Array<{ index: number; error: string }>;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Scan state
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [scanRejected, setScanRejected] = useState<Array<{ name: string; error: string }>>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{
    name: string;
    status: string;
    error?: string;
  }> | null>(null);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Manual state
  const [manual, setManual] = useState({
    ordinanceNumber: '',
    seriesYear: '',
    title: '',
    content: '',
    subjectTags: '',
  });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ kind: 'ok' | 'conflict' | 'error'; text: string } | null>(null);

  const isDocx = importFile?.name.toLowerCase().endsWith('.docx');
  const previewRows = useMemo(() => {
    if (isDocx) return null;
    const source = importFile && !isDocx ? null : pasteText;
    if (!source) return null;
    return previewRowsFromText(source);
  }, [pasteText, importFile, isDocx]);

  function pickImportFiles(files: FileList | null) {
    const file = files?.[0] ?? null;
    setImportFile(file);
    setImportReport(null);
    setImportError(null);
  }

  async function submitImport() {
    if (importBusy) return;
    setImportBusy(true);
    setImportReport(null);
    setImportError(null);
    try {
      let res: Response;
      if (importFile) {
        const form = new FormData();
        form.append('file', importFile);
        res = await fetch('/api/linaw/import', { method: 'POST', body: form });
      } else {
        const trimmed = pasteText.trim();
        const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
        res = await fetch('/api/linaw/import', {
          method: 'POST',
          headers: { 'Content-Type': looksJson ? 'application/json' : 'text/csv' },
          body: pasteText,
        });
      }
      const body = await res.json();
      if (!res.ok) {
        setImportError(body.error ?? 'Import failed');
      } else {
        setImportReport({
          imported: body.imported,
          skippedDuplicates: body.skippedDuplicates,
          invalidRecords: body.invalidRecords ?? [],
        });
        setPasteText('');
        setImportFile(null);
        if (importInputRef.current) importInputRef.current.value = '';
      }
    } catch {
      setImportError('Import failed — network error');
    } finally {
      setImportBusy(false);
    }
  }

  function pickScanFiles(files: FileList | null) {
    if (!files) return;
    const accepted: File[] = [];
    const rejected: Array<{ name: string; error: string }> = [];
    for (const f of Array.from(files)) {
      if (!SCAN_TYPES.includes(f.type)) {
        rejected.push({ name: f.name, error: 'Unsupported type — PDF, JPEG or PNG only' });
      } else if (f.size > SCAN_MAX_BYTES) {
        rejected.push({ name: f.name, error: 'File exceeds the 20 MB limit' });
      } else {
        accepted.push(f);
      }
    }
    const room = SCAN_LIMIT - scanFiles.length;
    if (accepted.length > room) {
      for (const overflow of accepted.slice(room)) {
        rejected.push({ name: overflow.name, error: `Batch limit is ${SCAN_LIMIT} files` });
      }
    }
    setScanFiles((prev) => [...prev, ...accepted.slice(0, Math.max(0, room))]);
    setScanRejected(rejected);
    setScanResults(null);
    setScanSummary(null);
  }

  async function submitScan() {
    if (scanBusy || scanFiles.length === 0) return;
    setScanBusy(true);
    setScanResults(scanFiles.map((f) => ({ name: f.name, status: 'queued' })));
    setScanSummary(null);
    try {
      const form = new FormData();
      for (const f of scanFiles) form.append('files', f);
      setScanResults(scanFiles.map((f) => ({ name: f.name, status: 'uploading / OCR running' })));
      const res = await fetch('/api/linaw/upload', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) {
        setScanSummary(`Upload failed: ${body.error ?? res.status}`);
        setScanResults(null);
      } else {
        setScanResults(
          (body.files ?? []).map((f: { originalFilename: string; status: string; error?: string }) => ({
            name: f.originalFilename,
            status: f.status,
            error: f.error,
          }))
        );
        setScanSummary(
          `Accepted ${body.accepted}, duplicates ${body.duplicates}, failed ${body.failed}.`
        );
        setScanFiles([]);
        if (scanInputRef.current) scanInputRef.current.value = '';
      }
    } catch {
      setScanSummary('Upload failed — network error');
      setScanResults(null);
    } finally {
      setScanBusy(false);
    }
  }

  async function submitManual() {
    if (manualBusy) return;
    setManualBusy(true);
    setManualMessage(null);
    try {
      const res = await fetch('/api/linaw/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordinanceNumber: Number(manual.ordinanceNumber),
          seriesYear: Number(manual.seriesYear),
          title: manual.title,
          content: manual.content,
          subjectTags: manual.subjectTags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== ''),
        }),
      });
      if (res.status === 409) {
        setManualMessage({ kind: 'conflict', text: '(ordinance number, series year) already exists' });
      } else if (res.status === 201) {
        setManualMessage({ kind: 'ok', text: 'Record created — it now awaits review.' });
        setManual({ ordinanceNumber: '', seriesYear: '', title: '', content: '', subjectTags: '' });
      } else {
        const body = await res.json().catch(() => null);
        setManualMessage({ kind: 'error', text: body?.error ?? 'Manual entry failed' });
      }
    } catch {
      setManualMessage({ kind: 'error', text: 'Manual entry failed — network error' });
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode switcher (segmented tabs) */}
      <div role="tablist" aria-label="Ingestion mode" className="inline-flex flex-wrap gap-1 rounded-xl border border-[#283147] bg-[#0F1729] p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              'min-h-11 rounded-lg px-4 text-sm font-medium transition-colors',
              mode === m.id ? 'bg-[#0038A8] text-white' : 'text-[#94A3B8] hover:text-white'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'import' && (
        <SectionCard
          title="Bulk Import (JSON / CSV / DOCX)"
          hint="DOCX is parsed server-side — text inside the document must be JSON- or CSV-shaped. Maximum 500 records per batch."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#283147] bg-[#0F1729] px-4 text-sm text-white hover:border-[#22D3EE]"
            >
              <FileUp className="h-4 w-4 text-[#22D3EE]" /> Choose .json / .csv / .docx
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.csv,.docx"
              className="hidden"
              onChange={(e) => pickImportFiles(e.target.files)}
            />
            {importFile && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#283147] bg-[#0F1729] px-3 py-1 text-xs text-white">
                <FileText className="h-3.5 w-3.5 text-[#22D3EE]" /> {importFile.name}
              </span>
            )}
          </div>

          {isDocx && (
            <p className="text-xs text-[#94A3B8]">
              DOCX selected — preview is not available; records are extracted server-side.
            </p>
          )}

          {!importFile && (
            <textarea
              aria-label="Paste JSON or CSV records"
              placeholder='Paste JSON array or CSV text… e.g. [{"ordinanceNumber":1,"seriesYear":2024,"title":"An ordinance …","content":"Section 1. …"}]'
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              className={cn(inputClass, 'font-mono text-xs')}
            />
          )}

          {previewRows && previewRows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-[#283147]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0F1729] text-[#94A3B8]">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Ord. No.</th>
                    <th className="px-3 py-2">Series</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.index}
                      className={cn(
                        'border-t border-[#283147]',
                        row.error ? 'bg-[#F43F5E]/10 text-[#F43F5E]' : 'text-white'
                      )}
                    >
                      <td className="px-3 py-2">{row.index}</td>
                      <td className="px-3 py-2">{row.ordinanceNumber ?? '—'}</td>
                      <td className="px-3 py-2">{row.seriesYear ?? '—'}</td>
                      <td className="px-3 py-2">{row.title ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.error
                          ? row.error
                          : row.duplicateOf !== undefined
                            ? `duplicate of row ${row.duplicateOf} in this batch`
                            : 'ok'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previewRows === null && pasteText.trim() !== '' && !isDocx && (
            <p className="text-xs text-[#F43F5E]">Could not preview this text — the server will validate it.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitImport}
              disabled={importBusy || (!importFile && pasteText.trim() === '')}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importBusy && <Loader2 className="h-4 w-4 animate-spin" />} Import records
            </button>
          </div>

          {importError && (
            <p className="inline-flex items-center gap-2 text-sm text-[#F43F5E]">
              <AlertTriangle className="h-4 w-4" /> {importError}
            </p>
          )}
          {importReport && (
            <div className="space-y-1 text-sm">
              <p className="inline-flex items-center gap-2 text-[#22C55E]">
                <CheckCircle2 className="h-4 w-4" /> Imported {importReport.imported} record(s);
                skipped {importReport.skippedDuplicates} duplicate(s).
              </p>
              {importReport.invalidRecords.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-[#F43F5E]">
                  {importReport.invalidRecords.map((r) => (
                    <li key={r.index}>{r.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {mode === 'scan' && (
        <SectionCard
          title="Scan Upload (PDF / JPG / PNG)"
          hint="Up to 10 files, 20 MB each. Scans land as pending_review — approve them in Verification below."
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="Scan drop zone"
            onClick={() => scanInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') scanInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickScanFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm',
              dragOver ? 'border-[#22D3EE] bg-[#22D3EE]/5 text-white' : 'border-[#283147] text-[#94A3B8]'
            )}
          >
            <UploadCloud className="h-6 w-6 text-[#22D3EE]" />
            Drop scans here or click to choose (≤{SCAN_LIMIT} files, PDF/JPG/PNG, ≤20 MB)
            <input
              ref={scanInputRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => pickScanFiles(e.target.files)}
            />
          </div>

          {scanFiles.length > 0 && (
            <ul className="space-y-1 text-xs text-white">
              {scanFiles.map((f) => (
                <li key={f.name} className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[#22D3EE]" /> {f.name}
                  <span className="text-[#94A3B8]">({Math.ceil(f.size / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          )}
          {scanRejected.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[#F43F5E]">
              {scanRejected.map((r, i) => (
                <li key={i}>{r.name}: {r.error}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={submitScan}
            disabled={scanBusy || scanFiles.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanBusy && <Loader2 className="h-4 w-4 animate-spin" />} Upload & digitize
          </button>

          {scanResults && (
            <ul className="space-y-1 text-xs">
              {scanResults.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-2',
                    r.status === 'accepted'
                      ? 'text-[#22C55E]'
                      : r.status === 'queued' || r.status.startsWith('uploading')
                        ? 'text-[#94A3B8]'
                        : r.status === 'duplicate'
                          ? 'text-[#FACC15]'
                          : 'text-[#F43F5E]'
                  )}
                >
                  {r.name}: {r.status}
                  {r.error ? ` — ${r.error}` : ''}
                </li>
              ))}
            </ul>
          )}
          {scanSummary && <p className="text-sm text-white">{scanSummary}</p>}
        </SectionCard>
      )}

      {mode === 'manual' && (
        <SectionCard title="Manual Entry" hint="Type a record directly — it starts at pending_review.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-[#94A3B8]">
              Ordinance number
              <input
                type="number"
                min={1}
                value={manual.ordinanceNumber}
                onChange={(e) => setManual({ ...manual, ordinanceNumber: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-xs text-[#94A3B8]">
              Series year
              <input
                type="number"
                min={1}
                value={manual.seriesYear}
                onChange={(e) => setManual({ ...manual, seriesYear: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs text-[#94A3B8]">
            Title
            <input
              type="text"
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
              placeholder="An ordinance …"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-xs text-[#94A3B8]">
            Content
            <textarea
              rows={6}
              value={manual.content}
              onChange={(e) => setManual({ ...manual, content: e.target.value })}
              placeholder="Section 1. Title. …"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-xs text-[#94A3B8]">
            Subject tags (comma-separated)
            <input
              type="text"
              value={manual.subjectTags}
              onChange={(e) => setManual({ ...manual, subjectTags: e.target.value })}
              placeholder="health, permits"
              className={inputClass}
            />
          </label>

          <button
            type="button"
            onClick={submitManual}
            disabled={manualBusy}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {manualBusy && <Loader2 className="h-4 w-4 animate-spin" />} <Keyboard className="h-4 w-4" /> Create record
          </button>

          {manualMessage && (
            <p
              className={cn(
                'text-sm',
                manualMessage.kind === 'ok'
                  ? 'text-[#22C55E]'
                  : manualMessage.kind === 'conflict'
                    ? 'text-[#FACC15]'
                    : 'text-[#F43F5E]'
              )}
            >
              {manualMessage.text}
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
