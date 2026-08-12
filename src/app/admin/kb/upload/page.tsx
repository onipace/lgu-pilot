'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Shield,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import Link from 'next/link';

const DOC_TYPES = [
  { value: 'ordinance', label: 'Ordinance' },
  { value: 'ra7160', label: 'R.A. 7160' },
  { value: 'irr', label: 'IRR' },
  { value: 'dilg_opinion', label: 'DILG Opinion' },
  { value: 'jurisprudence', label: 'Jurisprudence' },
  { value: 'policy', label: 'Policy' },
  { value: 'context', label: 'Context' },
];

export default function KBUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [lguId, setLguId] = useState('');
  const [docType, setDocType] = useState('ordinance');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sectionNumber, setSectionNumber] = useState('');
  const [ordinanceNumber, setOrdinanceNumber] = useState('');
  const [seriesYear, setSeriesYear] = useState('');
  const [ordinanceType, setOrdinanceType] = useState('');
  const [ruleNumber, setRuleNumber] = useState('');
  const [topics, setTopics] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null);

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null);

    // Auto-fill title from filename if title is empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(nameWithoutExt);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lguId || !docType || !title) {
      setUploadError('LGU ID, document type, and title are required.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('lgu_id', lguId);
      formData.append('doc_type', docType);
      formData.append('title', title);

      if (file) formData.append('file', file);
      if (sectionNumber) formData.append('section_number', sectionNumber);
      if (ordinanceNumber) formData.append('ordinance_number', ordinanceNumber);
      if (seriesYear) formData.append('series_year', seriesYear);
      if (ordinanceType) formData.append('ordinance_type', ordinanceType);
      if (ruleNumber) formData.append('rule_number', ruleNumber);
      if (topics) formData.append('topics', topics);

      const res = await fetch('/api/admin/kb/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Success state
  if (uploadResult) {
    return (
      <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
        <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
            <Link
              href="/admin/kb"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(239_76%_64%/0.15)] border border-[hsl(239_76%_64%/0.3)]">
              <Database className="h-4 w-4 text-[hsl(239_76%_80%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider">eSANGGUNI</span>
              <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">Upload Complete</span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
            <h2 className="text-xl font-bold text-[hsl(var(--pillar-text))] mb-2">
              Document Uploaded Successfully
            </h2>
            <p className="text-sm text-[hsl(var(--pillar-muted))] mb-6">
              &ldquo;{uploadResult.title as string}&rdquo; has been added to the knowledge base.
            </p>
            <div className="text-xs text-[hsl(var(--pillar-muted))] mb-8">
              <p>Document ID: <span className="font-mono text-[hsl(var(--pillar-text))]">{uploadResult.id as string}</span></p>
              <p className="mt-1">Status: <span className="text-amber-400 font-semibold uppercase">{uploadResult.status as string}</span></p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setUploadResult(null);
                  setFile(null);
                  setTitle('');
                  setSectionNumber('');
                  setOrdinanceNumber('');
                  setSeriesYear('');
                  setOrdinanceType('');
                  setRuleNumber('');
                  setTopics('');
                }}
                className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-4 py-2 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:bg-[hsl(var(--pillar-surface))]"
              >
                Upload Another
              </button>
              <Link
                href="/admin/kb"
                className="rounded-lg bg-[hsl(var(--pillar-primary))] px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
              >
                Back to Knowledge Base
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))]">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface)/0.95)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/kb"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(239_76%_64%/0.15)] border border-[hsl(239_76%_64%/0.3)]">
              <Upload className="h-4 w-4 text-[hsl(239_76%_80%)]" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wider">eSANGGUNI</span>
              <span className="ml-2 text-xs text-[hsl(var(--pillar-muted))]">Upload Document</span>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_95%_55%/0.1)] px-2.5 py-0.5 sm:flex">
              <Shield className="h-3 w-3 text-[hsl(38_95%_65%)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(38_95%_65%)]">
                Admin
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-xs text-[hsl(var(--pillar-muted))]">
          <Link href="/admin" className="hover:text-[hsl(var(--pillar-text))] transition-colors">
            Admin
          </Link>
          <span>/</span>
          <Link href="/admin/kb" className="hover:text-[hsl(var(--pillar-text))] transition-colors">
            Knowledge Base
          </Link>
          <span>/</span>
          <span className="text-[hsl(var(--pillar-text))] font-semibold">Upload</span>
        </nav>

        <div>
          <h1 className="text-2xl font-black text-[hsl(var(--pillar-text))]">
            Upload Document
          </h1>
          <p className="text-xs text-[hsl(var(--pillar-muted))] mt-0.5">
            Add a document to the knowledge base for AI retrieval.
          </p>
        </div>

        {/* ── Error state ────────────────────────────────────────────── */}
        {uploadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Upload Error:</strong> {uploadError}
            </div>
          </div>
        )}

        {/* ── Upload Form ────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required fields */}
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
              Document Information
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* LGU ID */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  LGU ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lguId}
                  onChange={(e) => setLguId(e.target.value)}
                  placeholder="e.g., pitogo-quezon"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  required
                />
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Document Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs font-semibold text-[hsl(var(--pillar-text))] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                  required
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                required
              />
            </div>

            {/* File Upload - Drag & Drop */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-[hsl(var(--pillar-primary))] bg-[hsl(var(--pillar-primary)/0.05)]'
                    : file
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] hover:border-[hsl(var(--pillar-primary)/0.5)]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  className="hidden"
                  accept=".json,.txt,.md,.pdf"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[hsl(var(--pillar-text))]">
                        {file.name}
                      </p>
                      <p className="text-xs text-[hsl(var(--pillar-muted))]">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-2 rounded-lg p-1 text-[hsl(var(--pillar-muted))] hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-[hsl(var(--pillar-muted)/0.4)] mb-2" />
                    <p className="text-sm font-semibold text-[hsl(var(--pillar-muted))]">
                      Drag & drop a file here, or click to browse
                    </p>
                    <p className="mt-1 text-[10px] text-[hsl(var(--pillar-muted)/0.6)]">
                      Supports: JSON, TXT, MD, PDF
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Optional metadata */}
          <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[hsl(var(--pillar-text))]">
              Metadata (Optional)
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Section Number */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Section Number
                </label>
                <input
                  type="text"
                  value={sectionNumber}
                  onChange={(e) => setSectionNumber(e.target.value)}
                  placeholder="e.g., 447"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                />
              </div>

              {/* Ordinance Number */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Ordinance Number
                </label>
                <input
                  type="text"
                  value={ordinanceNumber}
                  onChange={(e) => setOrdinanceNumber(e.target.value)}
                  placeholder="e.g., 01"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                />
              </div>

              {/* Series Year */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Series Year
                </label>
                <input
                  type="text"
                  value={seriesYear}
                  onChange={(e) => setSeriesYear(e.target.value)}
                  placeholder="e.g., 2024"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Ordinance Type */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Ordinance Type
                </label>
                <input
                  type="text"
                  value={ordinanceType}
                  onChange={(e) => setOrdinanceType(e.target.value)}
                  placeholder="e.g., Municipal Ordinance"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                />
              </div>

              {/* Rule Number */}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                  Rule Number
                </label>
                <input
                  type="text"
                  value={ruleNumber}
                  onChange={(e) => setRuleNumber(e.target.value)}
                  placeholder="e.g., 1"
                  className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
                />
              </div>
            </div>

            {/* Topics */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--pillar-muted))] mb-1.5">
                Topics (comma-separated)
              </label>
              <input
                type="text"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="e.g., business permits, zoning, taxation"
                className="w-full rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] px-3 py-2.5 text-xs text-[hsl(var(--pillar-text))] placeholder:text-[hsl(var(--pillar-muted)/0.5)] focus:outline-none focus:border-[hsl(var(--pillar-primary)/0.5)]"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/admin/kb"
              className="rounded-lg border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface-alt))] px-4 py-2.5 text-xs font-semibold text-[hsl(var(--pillar-text))] transition-colors hover:bg-[hsl(var(--pillar-surface))]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--pillar-primary))] px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
