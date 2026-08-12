'use client';

// src/components/likha/upload-dropzone.tsx
// Sprint 2 (S2-C5) — L001 Upload Dropzone (PRP-LIKHA "Upload Dropzone").
// Client-only: drag & drop + browse, client-side validation mirroring the
// server contract (≤10 files / ≤20 MB / PDF-JPG-PNG), single POST to
// /api/likha/upload, per-file status rows incl. inline duplicate warning.

import { useRef, useState } from 'react';
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LikhaUploadFileStatus, LikhaUploadResponse } from '@/types/likha';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Row status = client lifecycle union + server result statuses. */
type RowStatus = LikhaUploadFileStatus | 'accepted' | 'duplicate';

interface UploadRow {
  id: string;
  name: string;
  sizeBytes: number;
  status: RowStatus;
  fileHash?: string;
  existingRecordId?: string;
  error?: string;
}

interface UploadDropzoneProps {
  /** True while a pipeline run is active — dropzone is inert. */
  disabled?: boolean;
  onBatchAccepted?: (result: LikhaUploadResponse) => void;
  onError?: (message: string) => void;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function UploadDropzone({
  disabled = false,
  onBatchAccepted,
  onError,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /** Client-side validation mirroring the server contract. Returns an error message or null. */
  function validateSelection(files: File[]): string | null {
    if (files.length > MAX_FILES) {
      return 'Maximum 10 files per batch';
    }
    const oversize = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversize.length > 0) {
      return `File too large (max 20 MB): ${oversize.map((f) => f.name).join(', ')}`;
    }
    const badType = files.filter((f) => !ALLOWED_MIME_TYPES.includes(f.type));
    if (badType.length > 0) {
      return `Unsupported file type: ${badType.map((f) => f.name).join(', ')} — PDF, JPG or PNG only`;
    }
    return null;
  }

  async function handleFiles(fileList: FileList | File[]) {
    if (disabled || uploading) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const validationError = validateSelection(files);
    if (validationError) {
      setBatchError(validationError);
      onError?.(validationError);
      return;
    }

    setBatchError(null);
    setRows(
      files.map((f, i) => ({
        id: `${f.name}-${f.size}-${i}`,
        name: f.name,
        sizeBytes: f.size,
        status: 'ingesting',
      }))
    );
    setUploading(true);

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('files', f);
      }

      const res = await fetch('/api/likha/upload', { method: 'POST', body: formData });
      const body = (await res.json().catch(() => null)) as
        | LikhaUploadResponse
        | { error?: string }
        | null;

      if (!res.ok || !body) {
        const message =
          body && 'error' in body && body.error ? body.error : 'Upload failed';
        setRows((prev) => prev.map((r) => ({ ...r, status: 'error', error: message })));
        onError?.(message);
        return;
      }

      const result = body as LikhaUploadResponse;
      setRows((prev) =>
        prev.map((row) => {
          const match = result.files.find((f) => f.originalFilename === row.name);
          if (!match) return { ...row, status: 'error', error: 'No server result for file' };
          if (match.status === 'duplicate') {
            return {
              ...row,
              status: 'duplicate',
              fileHash: match.fileHash,
              existingRecordId: match.existingRecordId,
            };
          }
          if (match.status === 'accepted') {
            return { ...row, status: 'accepted', fileHash: match.fileHash };
          }
          return { ...row, status: 'error', error: match.error || 'Rejected' };
        })
      );
      onBatchAccepted?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setRows((prev) => prev.map((r) => ({ ...r, status: 'error', error: message })));
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }

  function statusChip(row: UploadRow) {
    switch (row.status) {
      case 'queued':
        return <span className="text-[10px] text-[#94A3B8]">Queued</span>;
      case 'ingesting':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#22D3EE]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Ingesting…
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#22C55E]">
            <CheckCircle2 className="h-3 w-3" />
            Accepted{row.fileHash ? ` — #${row.fileHash.slice(0, 12)}…` : ''}
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#FACC15]">
            <AlertTriangle className="h-3 w-3" />
            Already archived — existing record {row.existingRecordId ?? 'unknown'}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#F87171]">
            <AlertTriangle className="h-3 w-3" />
            {row.error || 'Error'}
          </span>
        );
      default:
        return <span className="text-[10px] text-[#94A3B8]">{row.status}</span>;
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop area */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload scanned ordinance files"
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !uploading) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed border-[#283147] rounded-xl bg-[#1E293B] p-8 text-center',
          dragOver && !disabled && 'border-[#22D3EE]',
          disabled && 'opacity-50'
        )}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-[#94A3B8]" />
        <p className="mt-3 text-sm font-bold tracking-wide text-white">DRAG &amp; DROP SCAN FILES</p>
        <p className="mt-1 text-xs text-[#94A3B8]">PDF / JPG / PNG — up to 10 files, 20 MB each</p>
        {disabled ? (
          <p className="mt-3 text-xs text-[#94A3B8]">Pipeline running — upload disabled</p>
        ) : (
          <button
            type="button"
            className="mt-4 min-h-11 rounded-md border border-[#283147] bg-[#0F1729] px-4 text-xs font-semibold text-[#22D3EE] hover:border-[#22D3EE]"
            onClick={(e) => {
              e.stopPropagation();
              if (!uploading) inputRef.current?.click();
            }}
          >
            Browse files...
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Indeterminate batch progress bar while the upload is in flight */}
      {uploading && (
        <div className="h-1 overflow-hidden rounded-full bg-[#283147]">
          <div className="h-1 w-1/3 animate-pulse rounded-full bg-[#22D3EE]" />
        </div>
      )}

      {/* Inline batch validation error */}
      {batchError && (
        <p className="flex items-center gap-2 text-xs text-[#F87171]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {batchError}
        </p>
      )}

      {/* Per-file status rows */}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-lg border border-[#283147] bg-[#1E293B] px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              <span className="min-w-0 flex-1 truncate text-xs text-white">{row.name}</span>
              <span className="shrink-0 text-[10px] text-[#94A3B8]">{formatSize(row.sizeBytes)}</span>
              <span className="shrink-0">{statusChip(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
