'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2, FileSearch, Paperclip, X, Eye, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ReviewResultsPanel } from '@/components/obra/draft-wizard';
import type { SelectedFixes } from '@/components/obra/draft-wizard';
import type { ReviewResult } from '@/types';
import { getOrCreateSessionId } from '@/components/pillar/participant-id';
import { exportAsDocx, exportAsPdf, extractTitle } from '@/lib/obra-export';
import { cn } from '@/lib/utils';

interface DraftReviewerProps {
  participantName?: string | null;
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.txt';

export default function DraftReviewer({ participantName }: DraftReviewerProps) {
  const [draftText, setDraftText] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  // Modal position/size state
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ w: 768, h: 600 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Analyze timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analysisAreaRef = useRef<HTMLDivElement>(null);

  // Apply fixes state
  const [isApplying, setIsApplying] = useState(false);
  const [hasFixesApplied, setHasFixesApplied] = useState(false);

  // Extract timer state
  const [extractElapsed, setExtractElapsed] = useState(0);
  const extractTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (isReviewing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isReviewing]);

  // Extract timer effect
  useEffect(() => {
    if (isExtracting) {
      setExtractElapsed(0);
      extractTimerRef.current = setInterval(() => {
        setExtractElapsed((s) => s + 1);
      }, 1000);
    } else {
      if (extractTimerRef.current) {
        clearInterval(extractTimerRef.current);
        extractTimerRef.current = null;
      }
    }
    return () => {
      if (extractTimerRef.current) clearInterval(extractTimerRef.current);
    };
  }, [isExtracting]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: modalPos.x, posY: modalPos.y };
  }, [isMaximized, modalPos]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setModalPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: modalSize.w, h: modalSize.h };
  }, [isMaximized, modalSize]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setModalSize({
        w: Math.max(400, resizeStart.current.w + dx),
        h: Math.max(300, resizeStart.current.h + dy),
      });
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  // Center modal on open
  useEffect(() => {
    if (showPreview && !isMaximized) {
      setModalPos({
        x: Math.max(0, (window.innerWidth - modalSize.w) / 2),
        y: Math.max(0, (window.innerHeight - modalSize.h) / 2),
      });
    }
  }, [showPreview]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
      setModalPos({
        x: Math.max(0, (window.innerWidth - modalSize.w) / 2),
        y: Math.max(0, (window.innerHeight - modalSize.h) / 2),
      });
    } else {
      setIsMaximized(true);
      setModalPos({ x: 0, y: 0 });
    }
  };

  // ── File upload handler ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const MAX_CLIENT_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_CLIENT_SIZE) {
      setExtractError('File is too large (max 20 MB). Please use a smaller file or paste text manually.');
      setUploadedFileName(null);
      return;
    }

    setExtractError(null);
    setUploadedFileName(file.name);
    setFileMimeType(file.type);
    setIsExtracting(true);

    const reader = new FileReader();
    reader.onload = () => setFileDataUrl(reader.result as string);
    reader.readAsDataURL(file);

    const doExtract = async () => {
      try {
        const form = new FormData();
        form.append('file', file);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        let res: Response;
        try {
          res = await fetch('/api/obra/extract', {
            method: 'POST',
            body: form,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        let data: { text?: string; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          data = { error: 'Unexpected server response. Please paste text manually.' };
        }

        if (!res.ok || data.error) {
          setExtractError(data.error ?? 'Extraction failed. Please paste text manually.');
          setUploadedFileName(null);
        } else {
          setDraftText(data.text ?? '');
          setReviewResult(null);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setExtractError('Upload timed out. The file may be too large. Please paste text manually.');
        } else {
          setExtractError('Could not reach extraction service. Please paste text manually.');
        }
        setUploadedFileName(null);
      } finally {
        setIsExtracting(false);
      }
    };

    doExtract();
  };

  const clearUpload = () => {
    setUploadedFileName(null);
    setExtractError(null);
    setDraftText('');
    setReviewResult(null);
    setFileDataUrl(null);
    setFileMimeType(null);
    setShowPreview(false);
    setHasFixesApplied(false);
  };

  // ── Apply Fixes handler ─────────────────────────────────────────────────
  const handleApplyFixes = async (selectedFixes: SelectedFixes) => {
    if (!reviewResult || !draftText.trim()) return;
    setIsApplying(true);
    try {
      const response = await fetch('/api/obra/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draftText,
          selectedFixes,
          reviewResult: {
            structuralIssues: reviewResult.structuralIssues,
            missingSections: reviewResult.missingSections,
            risks: reviewResult.risks,
            citationWarnings: reviewResult.citationWarnings,
          },
          participantName: participantName || undefined,
          sessionId: getOrCreateSessionId(),
        }),
      });
      const data = await response.json();
      if (data.draft) {
        setDraftText(data.draft);
        setHasFixesApplied(true);
      }
    } catch {
      // Handle silently
    } finally {
      setIsApplying(false);
    }
  };

  // ── Export handler ──────────────────────────────────────────────────────
  const handleExport = (format: 'docx' | 'pdf', text: string) => {
    const title = extractTitle(text);
    if (format === 'docx') {
      exportAsDocx(text, title);
    } else {
      exportAsPdf(text, title);
    }
  };

  // ── Analyze handler ────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!draftText.trim()) return;
    setIsReviewing(true);
    setReviewResult(null);

    // Auto-scroll to analysis area after a brief delay
    setTimeout(() => {
      analysisAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);

    try {
      const response = await fetch('/api/obra/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draftText,
          participantName: participantName || undefined,
          sessionId: getOrCreateSessionId(),
        }),
      });
      const data: ReviewResult = await response.json();
      setReviewResult(data);
    } catch { /* handle silently */ }
    finally { setIsReviewing(false); }
  };

  // Format elapsed time
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Progressive time estimate for the analysis card
  const getEstimate = (s: number): string => {
    if (s < 60) return 'This may take up to 1 minute\u2026';
    if (s < 120) return 'This may take up to 2 minutes\u2026';
    if (s < 180) return 'This may take up to 3 minutes\u2026';
    if (s < 300) return 'This may take more than 3 minutes\u2026';
    if (s < 420) return 'This may take more than 5 minutes\u2026';
    if (s < 600) return 'This may take more than 7 minutes\u2026';
    return 'This is taking longer than usual\u2026';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-3">
      <div>
        <h3 className="mb-1 text-lg font-semibold text-[hsl(214_100%_97%)]">
          Review an Existing Draft
        </h3>
        <p className="mb-4 text-sm text-[hsl(216_20%_55%)]">
          Paste an existing ordinance draft below and analyze it for compliance with R.A. 7160 and proper legislative structure.
        </p>

        {/* ── Label row with upload button ─────────────────────────────────── */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[hsl(216_20%_55%)]">
            Draft text
          </span>

          <div className="flex items-center gap-2">
            {/* Extraction timer */}
            {isExtracting && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-[hsl(158_64%_60%)]">
                <span className="h-2 w-2 rounded-full bg-[hsl(158_64%_50%)] animate-pulse" />
                {formatTime(extractElapsed)}
              </span>
            )}
            {!isExtracting && extractElapsed > 0 && (
              <span className="text-[10px] text-[hsl(216_20%_45%)]">
                Extracted in {formatTime(extractElapsed)}
              </span>
            )}
            {/* Uploaded file badge — clickable to preview */}
            {uploadedFileName && !isExtracting && (
              <span className="flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_45%/0.4)] bg-[hsl(158_64%_45%/0.1)] px-2 py-1 text-xs text-[hsl(158_64%_70%)]">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 hover:text-[hsl(158_64%_85%)] transition-colors cursor-pointer"
                  title="Click to preview uploaded file"
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[160px] truncate">{uploadedFileName}</span>
                  <Eye className="h-3 w-3 shrink-0 opacity-60" />
                </button>
                <button
                  onClick={clearUpload}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Clear uploaded file"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                isExtracting
                  ? 'cursor-not-allowed border-[hsl(224_27%_22%)] text-[hsl(216_20%_40%)]'
                  : 'border-[hsl(224_27%_25%)] text-[hsl(216_20%_65%)] hover:border-[hsl(158_64%_45%/0.5)] hover:bg-[hsl(158_64%_45%/0.08)] hover:text-[hsl(158_64%_70%)]'
              )}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Extracting…
                </>
              ) : (
                <>
                  <Paperclip className="h-3.5 w-3.5" />
                  Upload File
                </>
              )}
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Extraction error */}
        {extractError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {extractError}
          </div>
        )}

        {/* Textarea */}
        <Textarea
          placeholder="Paste your ordinance draft text here, or upload a file above…"
          rows={12}
          value={draftText}
          onChange={e => setDraftText(e.target.value)}
          className="mb-4 font-mono text-sm bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(158_64%_45%)] resize-y"
        />

        {/* Analyze button with timer */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={!draftText.trim() || isReviewing || isExtracting}
            className="gap-2 bg-[hsl(158_64%_45%)] text-white hover:bg-[hsl(158_64%_37%)] disabled:opacity-50"
          >
            {isReviewing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</>
            ) : (
              <><FileSearch className="h-4 w-4" />Analyze Draft</>
            )}
          </Button>

          {/* Timer display */}
          {isReviewing && (
            <span className="flex items-center gap-1.5 text-sm font-mono text-[hsl(158_64%_60%)]">
              <span className="h-2 w-2 rounded-full bg-[hsl(158_64%_50%)] animate-pulse" />
              {formatTime(elapsedSeconds)}
            </span>
          )}
          {!isReviewing && elapsedSeconds > 0 && (
            <span className="text-xs text-[hsl(216_20%_45%)]">
              Completed in {formatTime(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Analysis progress area — scroll target */}
      <div ref={analysisAreaRef}>
        {isReviewing && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] py-10">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(158_64%_50%)]" />
            <p className="mt-3 text-sm font-medium text-[hsl(214_100%_97%)]">
              Analyzing compliance with R.A. 7160…
            </p>
            <p className="mt-1 text-xs text-[hsl(216_20%_50%)]">
              Checking legal basis, structure, and potential risks
            </p>
            <p className="mt-2 text-xs text-[hsl(216_20%_50%)]">
              {getEstimate(elapsedSeconds)}
            </p>
          </div>
        )}

        {reviewResult && !isReviewing && (
          <ReviewResultsPanel
            result={reviewResult}
            draftText={draftText}
            hasFixesApplied={hasFixesApplied}
            onApplyFixes={handleApplyFixes}
            onExport={handleExport}
            onReanalyze={handleAnalyze}
            isApplying={isApplying}
          />
        )}
      </div>

      {/* ── File Preview Modal (draggable, resizable, maximizable) ──────── */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/70"
          onClick={() => setShowPreview(false)}
        >
          <div
            ref={modalRef}
            className={cn(
              "absolute flex flex-col rounded-2xl border border-[hsl(224_27%_25%)] bg-[hsl(222_47%_9%)] shadow-2xl",
              isMaximized ? "inset-2 rounded-none" : ""
            )}
            style={isMaximized ? undefined : {
              left: modalPos.x,
              top: modalPos.y,
              width: modalSize.w,
              height: modalSize.h,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header — drag handle */}
            <div
              className="flex items-center justify-between border-b border-[hsl(224_27%_22%)] px-4 py-2.5 cursor-move select-none"
              onMouseDown={handleDragStart}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="h-3.5 w-3.5 text-[hsl(216_20%_35%)] shrink-0" />
                <Paperclip className="h-3.5 w-3.5 text-[hsl(158_64%_60%)] shrink-0" />
                <h3 className="text-sm font-semibold text-[hsl(214_100%_97%)] truncate">
                  {uploadedFileName}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={toggleMaximize}
                  className="rounded-lg p-1.5 text-[hsl(216_20%_55%)] hover:bg-[hsl(224_27%_22%)] hover:text-white transition-colors"
                  title={isMaximized ? "Restore" : "Maximize"}
                >
                  {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg p-1.5 text-[hsl(216_20%_55%)] hover:bg-[hsl(224_27%_22%)] hover:text-red-400 transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto p-5 min-h-0">
              {fileMimeType?.startsWith('image/') && fileDataUrl ? (
                <img
                  src={fileDataUrl}
                  alt={uploadedFileName || 'Uploaded file'}
                  className="mx-auto max-h-full rounded-lg object-contain"
                />
              ) : fileMimeType === 'application/pdf' && fileDataUrl ? (
                <iframe
                  src={fileDataUrl}
                  title={uploadedFileName || 'Uploaded PDF'}
                  className="h-full w-full rounded-lg border border-[hsl(224_27%_22%)]"
                />
              ) : (
                <pre className="h-full overflow-auto whitespace-pre-wrap rounded-lg bg-[hsl(224_35%_13%)] p-4 font-mono text-xs text-[hsl(214_100%_90%)] leading-relaxed">
                  {draftText || 'No extracted text available.'}
                </pre>
              )}
            </div>

            {/* Resize handle (bottom-right corner) */}
            {!isMaximized && (
              <div
                className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                onMouseDown={handleResizeStart}
              >
                <svg className="h-4 w-4 text-[hsl(216_20%_35%)]" viewBox="0 0 16 16" fill="none">
                  <path d="M14 14L8 14M14 14L14 8M14 14L6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
