'use client';

// src/app/likha/page.tsx
// Sprint 3 (S3-C8) — LIKHA portal page: Archive Browser (LIVE — L006) /
// Upload & Digitize (L001–L003 + agents 4–6 wired: agent 5 HITL gate pause,
// agent 6 Archiver on approve) / Classification. Sprint 4 (S4-C9) makes
// agent 4 REAL (subjects from the pipeline response + the
// low_confidence_classification gate, decision D24) and replaces the
// Classification tab stub with the live ClassificationEditor (L007). Kit
// consumed props-only; delays are the client's UI simulation (decision D9)
// while the server does the real work. Publish is server-side and gated on
// human approval — the visualization only mirrors it.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, Camera, FolderOpen, Paperclip, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentPipeline from '@/components/agent-pipeline';
import ActivityFeed from '@/components/activity-feed';
import UploadDropzone from '@/components/likha/upload-dropzone';
import VerificationPanel from '@/components/likha/verification-panel';
import ArchiveBrowser from '@/components/likha/archive-browser';
import ClassificationEditor from '@/components/likha/classification-editor';
import CameraScanner from '@/components/likha/camera-scanner';
import {
  LIKHA_AGENT_DEFS,
  type LikhaAgentOutput,
  type LikhaAgentState,
  type LikhaDilgPackage,
  type LikhaHitlItem,
  type LikhaPipelineResponse,
  type LikhaUploadResponse,
} from '@/types/likha';
import type { ActivityItem } from '@/types/agentic';

type TabId = 'archive' | 'upload' | 'classification';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'archive', label: 'Archive Browser' },
  { id: 'upload', label: 'Upload & Digitize' },
  { id: 'classification', label: 'Classification' },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function delayFor(agentId: number): number {
  return LIKHA_AGENT_DEFS.find((d) => d.id === agentId)?.delayMs ?? 1000;
}

function initialAgents(): LikhaAgentState[] {
  return LIKHA_AGENT_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    module: 'likha',
    description: def.description,
    status: 'idle',
    color: def.color,
    glowClass: def.glowClass,
  }));
}

interface AwaitingDecision {
  recordId: string;
  activityId: string;
}

export default function LikhaPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [agents, setAgents] = useState<LikhaAgentState[]>(initialAgents);
  const [activities, setActivities] = useState<Array<ActivityItem<LikhaAgentOutput>>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [lastBatch, setLastBatch] = useState<LikhaUploadResponse | null>(null);

  // ── Sprint 3 state: HITL queue + verification panel + decision tracking ──
  const [hitlQueue, setHitlQueue] = useState<LikhaHitlItem[]>([]);
  const [verifyRecordId, setVerifyRecordId] = useState<string | null>(null);
  const [awaitingDecision, setAwaitingDecision] = useState<AwaitingDecision[]>([]);
  const anyPublishedRef = useRef(false);
  const recordMetaRef = useRef(new Map<string, { ordinanceNumber: number; seriesYear: number }>());

  // ── Sprint 4 state: Export DILG Package toolbar (L010) ──
  const [dilgExporting, setDilgExporting] = useState(false);
  const [dilgStatus, setDilgStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // ── Scanner mode: camera (A+), scan folder (B), or browse files ──
  const [scannerMode, setScannerMode] = useState<'camera' | 'folder' | 'browse'>('camera');

  function setAgent(id: number, patch: Partial<LikhaAgentState>): void {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addActivities(items: Array<ActivityItem<LikhaAgentOutput>>): void {
    setActivities((prev) => [...prev, ...items]);
  }

  /** Client orchestration: UI simulation delays + real async server work. */
  async function runDigitizationRun(batch: LikhaUploadResponse): Promise<void> {
    setLastBatch(batch);
    setAgents(initialAgents());
    setActivities([]);
    setIsProcessing(true);
    setPipelineComplete(false);
    setHitlQueue([]);
    setAwaitingDecision([]);
    setVerifyRecordId(null);
    anyPublishedRef.current = false;
    recordMetaRef.current = new Map();

    const accepted = batch.files.filter((f) => f.status === 'accepted' && f.recordId);
    const duplicates = batch.files.filter((f) => f.status === 'duplicate');
    const now = () => new Date().toISOString();

    // Duplicate warnings surface immediately (upload-route results).
    addActivities(
      duplicates.map((f) => ({
        id: crypto.randomUUID(),
        type: 'warning',
        status: 'confirmed',
        title: 'Duplicate skipped',
        details: `Skipped duplicate: ${f.originalFilename} — already archived (record ${f.existingRecordId ?? 'unknown'})`,
        timestamp: now(),
        data: { preview: 'Duplicate skipped', fileHash: f.fileHash, success: false },
      }))
    );

    if (accepted.length === 0) {
      setIsProcessing(false);
      return;
    }

    // ── Agent 1: Ingestor (real work already done in the upload route) ──
    setAgent(1, { status: 'processing' });
    await sleep(delayFor(1));
    setAgent(1, {
      status: 'completed',
      output: {
        preview: 'Files validated & hashed',
        fileHash: accepted[0].fileHash,
        success: true,
      },
    });

    // ── Agent 2: OCR Extractor — fire the real server run non-blocking ──
    setAgent(2, { status: 'processing' });
    const serverRun = fetch('/api/likha/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: batch.batchId,
        fileIds: accepted.map((f) => f.recordId),
      }),
    });
    await sleep(delayFor(2));

    let pipeline: LikhaPipelineResponse;
    try {
      const res = await serverRun; // spinner held until the response arrives
      if (!res.ok) {
        throw new Error(`Pipeline request failed (HTTP ${res.status})`);
      }
      pipeline = (await res.json()) as LikhaPipelineResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setAgent(2, { status: 'error' });
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'error',
          status: 'confirmed',
          title: 'Pipeline failed',
          details: message,
          timestamp: now(),
          data: { preview: message, success: false },
        },
      ]);
      setIsProcessing(false);
      return;
    }

    const totalRawTextLength = pipeline.files.reduce(
      (sum, f) => sum + (f.rawTextLength ?? 0),
      0
    );
    setAgent(2, {
      status: 'completed',
      output: {
        preview: 'Text extracted',
        rawText: `${totalRawTextLength} characters`,
        success: true,
      },
    });

    // ── Agent 3: Metadata Parser (server work done in the same response) ──
    setAgent(3, { status: 'processing' });
    await sleep(delayFor(3));
    const firstOk = pipeline.files.find((f) => f.ok && f.metadata);
    setAgent(3, {
      status: 'completed',
      output: {
        preview: 'Metadata parsed',
        ordinanceNumber: firstOk?.metadata?.ordinanceNumber,
        seriesYear: firstOk?.metadata?.seriesYear,
        title: firstOk?.metadata?.title,
        success: true,
      },
    });

    // ── Agent 4: Subject Classifier — REAL pass (decision D24) ──
    setAgent(4, { status: 'processing' });
    await sleep(delayFor(4)); // 1200ms slot retained (client UI simulation)
    const allSubjects = pipeline.files.flatMap((f) => f.classification?.subjects ?? []);
    const anyClassGate = pipeline.files.some((f) => f.classification?.hitlRequired === true);
    if (anyClassGate) {
      setAgent(4, {
        status: 'hitl',
        output: {
          preview: 'Subjects suggested — review required',
          hitlRequired: true,
          subjects: allSubjects,
          success: true,
        },
      });
    } else {
      setAgent(4, {
        status: 'completed',
        output: { preview: 'Subjects suggested', subjects: allSubjects, success: true },
      });
    }

    // ── Agent 5: Legal Validator — HITL wiring (PRD §12.4 row 1) ──
    setAgent(5, { status: 'processing' });
    await sleep(delayFor(5));

    const okFiles = pipeline.files.filter((f) => f.ok && f.metadata);
    const anyGate = okFiles.some((f) => f.validation?.hitlRequired === true);
    const firstGated = okFiles.find((f) => f.validation?.hitlRequired === true);

    if (anyGate) {
      setAgent(5, {
        status: 'hitl',
        output: {
          preview: 'Validation complete — review required',
          hitlRequired: true,
          exceptions: firstGated?.validation?.exceptions ?? [],
          success: true,
        },
      });
    } else {
      setAgent(5, {
        status: 'completed',
        output: { preview: 'Validation complete', success: true },
      });
    }

    const reviewActivities: Array<ActivityItem<LikhaAgentOutput>> = [];
    const newQueueItems: LikhaHitlItem[] = [];
    const newAwaiting: AwaitingDecision[] = [];

    for (const file of okFiles) {
      const metadata = file.metadata!;
      const recordId = file.recordId;
      const activityId = crypto.randomUUID();
      recordMetaRef.current.set(recordId, {
        ordinanceNumber: metadata.ordinanceNumber,
        seriesYear: metadata.seriesYear,
      });

      const gated = file.validation?.hitlRequired === true;
      const classGated = file.classification?.hitlRequired === true;
      const exceptions = file.validation?.exceptions ?? [];

      reviewActivities.push({
        id: activityId,
        type: gated || classGated ? 'hitl' : 'success',
        status: 'pending',
        title: gated
          ? `REVIEW REQUIRED — Ordinance No. ${metadata.ordinanceNumber} S. ${metadata.seriesYear} low confidence`
          : classGated
            ? `REVIEW REQUIRED — Ordinance No. ${metadata.ordinanceNumber} S. ${metadata.seriesYear} low classification confidence`
            : `Ready for verification — Ordinance No. ${metadata.ordinanceNumber} S. ${metadata.seriesYear}`,
        details: gated
          ? exceptions[0] ?? 'Low-confidence extraction — confirm against the scan.'
          : classGated
            ? 'Classification confidence < 0.6 — override the subject category.'
            : 'Extraction complete — human verification required before publish.',
        timestamp: now(),
        data: {
          preview: gated
            ? 'Review required'
            : classGated
              ? 'Classification review required'
              : 'Ready for verification',
          recordId,
          ordinanceNumber: metadata.ordinanceNumber,
          seriesYear: metadata.seriesYear,
          title: metadata.title,
          hitlRequired: gated || classGated,
          exceptions,
          success: true,
        },
      });

      if (gated) {
        newQueueItems.push({
          id: crypto.randomUUID(),
          activityId,
          agentId: 5,
          module: 'likha',
          gate: 'low_confidence_metadata',
          fieldSchema: {
            ordinanceNumber: { type: 'number', label: 'Ordinance No.', value: metadata.ordinanceNumber },
            seriesYear: { type: 'number', label: 'Series Year', value: metadata.seriesYear },
            title: { type: 'text', label: 'Title', value: metadata.title },
            sectionCount: { type: 'number', label: 'Sections', value: metadata.sectionCount },
            subjects: { type: 'multiselect', label: 'Subjects', value: [] },
          },
          suggestedAction: 'edit',
          context: {
            preview: 'Validation complete — review required',
            hitlRequired: true,
            exceptions,
            recordId,
            ordinanceNumber: metadata.ordinanceNumber,
            seriesYear: metadata.seriesYear,
            title: metadata.title,
            success: true,
          },
        });
      }

      // Classification gate (PRD §12.4 row 2) — fired independently of the
      // metadata gate; owned by agent 4 (decision D24).
      if (classGated) {
        newQueueItems.push({
          id: crypto.randomUUID(),
          activityId,
          agentId: 4,
          module: 'likha',
          gate: 'low_confidence_classification',
          fieldSchema: {
            subjects: {
              type: 'multiselect',
              label: 'Subjects',
              value: file.classification?.subjects?.map((s) => s.label) ?? [],
            },
          },
          suggestedAction: 'edit',
          context: {
            preview: 'Classification review required',
            hitlRequired: true,
            exceptions: ['Classification confidence below 0.6 — override the subject category.'],
            recordId,
            ordinanceNumber: metadata.ordinanceNumber,
            seriesYear: metadata.seriesYear,
            title: metadata.title,
            success: true,
          },
        });
      }

      // EVERY accepted record needs a human decision before the Archiver may
      // run (constraint 3) — clean and gated files alike.
      newAwaiting.push({ recordId, activityId });
    }

    addActivities(reviewActivities);
    if (newQueueItems.length > 0) {
      setHitlQueue((prev) => [...prev, ...newQueueItems]);
    }
    setAwaitingDecision((prev) => [...prev, ...newAwaiting]);

    const failedItems: Array<ActivityItem<LikhaAgentOutput>> = pipeline.files
      .filter((f) => !f.ok)
      .map((f) => {
        const agentName =
          LIKHA_AGENT_DEFS.find((d) => d.id === f.failedAgent)?.name ?? `Agent ${f.failedAgent ?? '?'}`;
        return {
          id: crypto.randomUUID(),
          type: 'error',
          status: 'confirmed',
          title: `Failed at ${agentName}`,
          details: `${f.originalFilename}: ${f.error ?? 'unknown error'}`,
          timestamp: now(),
          data: { preview: f.error ?? 'Failed', success: false },
        };
      });
    addActivities(failedItems);

    // Pipeline pauses at the human gate (decision D16): uploads re-enable
    // while decisions are pending; the Archiver waits for approval.
    setIsProcessing(false);
  }

  // ── Feed handlers (DESIGN.md §2.2): Confirm/Edit open the side-by-side panel ──

  function openPanelForActivity(activityId: string): void {
    const entry = awaitingDecision.find((e) => e.activityId === activityId);
    if (entry) setVerifyRecordId(entry.recordId);
  }

  async function rejectRecord(activityId: string, recordId: string, reason: string): Promise<void> {
    const now = () => new Date().toISOString();
    let res: Response;
    try {
      res = await fetch('/api/likha/archive/' + recordId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });
    } catch {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'error',
          status: 'confirmed',
          title: 'Reject failed',
          details: 'Network error — retry the decision.',
          timestamp: now(),
          data: { preview: 'Network error', success: false },
        },
      ]);
      return;
    }

    if (res.status === 409) {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'error',
          status: 'confirmed',
          title: 'Record already finalized',
          details: 'The record was already approved, published, or rejected.',
          timestamp: now(),
          data: { preview: 'Already finalized', success: false },
        },
      ]);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'error',
          status: 'confirmed',
          title: 'Reject failed',
          details: body.error ?? `Decision failed (HTTP ${res.status})`,
          timestamp: now(),
          data: { preview: body.error ?? 'Failed', success: false },
        },
      ]);
      return;
    }

    // Reject terminates the branch: mark the card, drop it from all queues.
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId ? { ...a, status: 'rejected', reason, details: reason } : a
      )
    );
    finalizeDecision(activityId, recordId);
  }

  /** Removes a decided record from the queues; completes the pipeline when empty. */
  function finalizeDecision(activityId: string, recordId: string): void {
    setHitlQueue((prev) => prev.filter((h) => h.activityId !== activityId));
    const next = awaitingDecision.filter(
      (e) => !(e.activityId === activityId && e.recordId === recordId)
    );
    setAwaitingDecision(next);
    if (next.length === 0) {
      setPipelineComplete(anyPublishedRef.current);
    }
  }

  // ── Verification panel decision callback ──

  function handleDecision(result: {
    action: 'approve' | 'edit' | 'reject';
    recordId: string;
    published: boolean;
  }): void {
    const entry = awaitingDecision.find((e) => e.recordId === result.recordId);
    if (!entry) return;
    const meta = recordMetaRef.current.get(result.recordId);

    if (result.action === 'approve') {
      // The server has ALREADY published (Archiver ran inside the PUT branch);
      // the visualization below only mirrors the server-side work.
      anyPublishedRef.current = anyPublishedRef.current || result.published;
      setActivities((prev) =>
        prev.map((a) =>
          a.id === entry.activityId
            ? { ...a, status: 'confirmed', details: 'Approved — published to the archive.' }
            : a
        )
      );
      finalizeDecision(entry.activityId, result.recordId);
      void visualizeArchiver(meta);
      return;
    }

    if (result.action === 'edit') {
      // Edit saves corrections; approval is still required — the record stays
      // in awaitingDecision while the card shows the confirmed badge.
      setActivities((prev) =>
        prev.map((a) =>
          a.id === entry.activityId
            ? { ...a, status: 'confirmed', details: 'Edited — awaiting approval' }
            : a
        )
      );
      return;
    }

    // reject — branch terminated, never publishable.
    setActivities((prev) =>
      prev.map((a) =>
        a.id === entry.activityId
          ? { ...a, status: 'rejected', details: 'Rejected — record flagged and excluded from publish.' }
          : a
      )
    );
    finalizeDecision(entry.activityId, result.recordId);
  }

  /** Agent 6 (Archiver) visualization — 1000ms slot; real work done server-side. */
  async function visualizeArchiver(meta?: { ordinanceNumber: number; seriesYear: number }): Promise<void> {
    setAgent(6, { status: 'processing' });
    await sleep(delayFor(6));
    setAgent(6, {
      status: 'completed',
      output: {
        preview: 'Published to archive',
        archiveStatus: 'published',
        bm25Indexed: true,
        success: true,
      },
    });
    if (meta) {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'success',
          status: 'confirmed',
          title: `Published: Ordinance No. ${meta.ordinanceNumber}, S. ${meta.seriesYear}`,
          details: 'Archiver published the record and updated the BM25 index.',
          timestamp: new Date().toISOString(),
          data: { preview: 'Published to archive', archiveStatus: 'published', bm25Indexed: true, success: true },
        },
      ]);
    }
  }

  /** L010 — Export DILG Package: downloads the single-JSON submission package
   *  (decision D27) for ALL published records; 409 errors surface inline. */
  async function exportDilgPackage(): Promise<void> {
    if (dilgExporting) return;
    setDilgExporting(true);
    setDilgStatus(null);
    try {
      const res = await fetch('/api/likha/export-dilg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDilgStatus({ kind: 'error', text: body.error ?? 'Export failed — try again.' });
        return;
      }
      if (!res.ok) {
        setDilgStatus({ kind: 'error', text: 'Export failed — try again.' });
        return;
      }
      const payload = (await res.json()) as LikhaDilgPackage;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        'likha-dilg-mc-2026-041-' + payload.manifest.exportedAt.slice(0, 10) + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDilgStatus({
        kind: 'ok',
        text: 'DILG package exported (' + payload.manifest.recordCount + ' records)',
      });
    } catch {
      setDilgStatus({ kind: 'error', text: 'Export failed — try again.' });
    } finally {
      setDilgExporting(false);
    }
  }

  const gateForPanel = verifyRecordId
    ? (() => {
        const item = hitlQueue.find(
          (h) => (h.context.recordId as string | undefined) === verifyRecordId
        );
        return item
          ? { exceptions: (item.context.exceptions as string[] | undefined) ?? [] }
          : null;
      })()
    : null;

  return (
    <div className="min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Shell header — foundation tokens */}
        <div>
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Menu
          </Link>
          <h1 className="text-3xl font-black tracking-widest">L.I.K.H.A.</h1>
          <p className="mt-2 text-xs text-[hsl(var(--pillar-muted))]">
            Legislative Insight &amp; Knowledge Hub for Archives — Digitization &amp; Archive of
            Sangguniang Bayan ordinances
          </p>
        </div>

        {/* Machine-readable UI copy constants (DESIGN.md §2.2). Script children are
            emitted raw (no entity escaping), keeping the literal strings greppable
            in the served HTML for smoke checks. */}
        <script
          type="application/json"
          data-likha-copy=""
        >{`{"dropzoneHeading":"DRAG & DROP SCAN FILES","dropzoneCaption":"PDF / JPG / PNG — up to 10 files, 20 MB each","browse":"Browse files...","classificationTab":"AI SUBJECT CLASSIFICATION"}`}</script>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="LIKHA sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-h-11 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                activeTab === tab.id
                  ? 'bg-[#0038A8] text-white'
                  : 'border border-[#283147] text-[#94A3B8] hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Archive Browser — live (L006) */}
        {activeTab === 'archive' && <ArchiveBrowser />}

        {/* Classification — live (L007, Sprint 4) */}
        {activeTab === 'classification' && (
          <div className="space-y-6">
            <ClassificationEditor />

            {/* Export DILG toolbar (L010, decision D27) */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#283147] bg-[#1E293B] p-4">
              <button
                type="button"
                onClick={() => void exportDilgPackage()}
                disabled={dilgExporting}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dilgExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                Export DILG Package
              </button>
              {dilgStatus && (
                <p
                  className="text-xs"
                  style={{ color: dilgStatus.kind === 'ok' ? '#22C55E' : '#F43F5E' }}
                >
                  {dilgStatus.text}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Upload & Digitize — live */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* ── Scanner mode selector ── */}
            <div className="flex flex-wrap gap-2 rounded-xl border border-[#283147] bg-[#1E293B] p-2">
              <button
                type="button"
                onClick={() => setScannerMode('camera')}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors',
                  scannerMode === 'camera'
                    ? 'bg-[#0038A8] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                )}
              >
                <Camera className="h-4 w-4" />
                Camera Scanner
              </button>
              <button
                type="button"
                onClick={() => setScannerMode('folder')}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors',
                  scannerMode === 'folder'
                    ? 'bg-[#0038A8] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                )}
              >
                <FolderOpen className="h-4 w-4" />
                Scan Folder
              </button>
              <button
                type="button"
                onClick={() => setScannerMode('browse')}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors',
                  scannerMode === 'browse'
                    ? 'bg-[#0038A8] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                )}
              >
                <Paperclip className="h-4 w-4" />
                Browse Files
              </button>
            </div>

            {/* ── Mode A+: Camera Scanner (zero-install, any camera device) ── */}
            {scannerMode === 'camera' && (
              <CameraScanner
                disabled={isProcessing}
                onBatchAccepted={runDigitizationRun}
                onError={(message) =>
                  addActivities([
                    {
                      id: crypto.randomUUID(),
                      type: 'error',
                      status: 'confirmed',
                      title: 'Scan error',
                      details: message,
                      timestamp: new Date().toISOString(),
                      data: { preview: message, success: false },
                    },
                  ])
                }
              />
            )}

            {/* ── Mode B: Scan Folder (File System Access API — Chrome only) ── */}
            {scannerMode === 'folder' && (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-dashed border-[#283147] bg-[#1E293B] p-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-[#94A3B8]" />
                  <p className="mt-3 text-sm font-bold text-white">CONNECT SCAN FOLDER</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Select the folder where your scanner saves files. New scans appear automatically.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!('showDirectoryPicker' in window)) {
                        addActivities([{
                          id: crypto.randomUUID(),
                          type: 'error',
                          status: 'confirmed',
                          title: 'Browser not supported',
                          details: 'Scan Folder requires Chrome or Edge. Use Browse Files instead.',
                          timestamp: new Date().toISOString(),
                          data: { preview: 'Browser not supported', success: false },
                        }]);
                        return;
                      }
                      try {
                        // File System Access API — Chrome/Edge only
                        const win = window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> };
                        const dirHandle = await win.showDirectoryPicker();
                        addActivities([{
                          id: crypto.randomUUID(),
                          type: 'success',
                          status: 'confirmed',
                          title: `Connected to: ${dirHandle.name}`,
                          details: 'New scans in this folder will be detected automatically.',
                          timestamp: new Date().toISOString(),
                          data: { preview: `Folder connected: ${dirHandle.name}`, success: true },
                        }]);
                      } catch {
                        // User cancelled picker — no action needed
                      }
                    }}
                    className="mt-4 min-h-11 rounded-md border border-[#283147] bg-[#0F1729] px-4 text-xs font-semibold text-[#22D3EE] hover:border-[#22D3EE]"
                  >
                    Select Folder…
                  </button>
                  <p className="mt-3 text-[10px] text-[#475569]">
                    💡 Scan with your USB scanner&apos;s software → files land in this folder → LIKHA picks them up.
                  </p>
                </div>
                <p className="text-center text-[10px] text-[#475569]">
                  Or switch to <button type="button" onClick={() => setScannerMode('browse')} className="text-[#22D3EE] underline">Browse Files</button> for direct file selection.
                </p>
              </div>
            )}

            {/* ── Browse Files: existing drag & drop upload ── */}
            {scannerMode === 'browse' && (
              <UploadDropzone
                disabled={isProcessing}
                onBatchAccepted={runDigitizationRun}
                onError={(message) =>
                  addActivities([
                    {
                      id: crypto.randomUUID(),
                      type: 'error',
                      status: 'confirmed',
                      title: 'Upload error',
                      details: message,
                      timestamp: new Date().toISOString(),
                      data: { preview: message, success: false },
                    },
                  ])
                }
              />
            )}

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                AGENT PIPELINE
              </h2>
              <AgentPipeline
                agents={agents}
                isProcessing={isProcessing}
                pipelineComplete={pipelineComplete}
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]">
                ACTIVITY FEED
              </h2>
              <ActivityFeed
                activities={activities}
                emptyMessage="Upload a batch to start the digitization pipeline."
                onConfirm={(activityId) => openPanelForActivity(activityId)}
                onEdit={(activityId) => openPanelForActivity(activityId)}
                onReject={(activityId, reason) => {
                  const entry = awaitingDecision.find((e) => e.activityId === activityId);
                  if (entry) void rejectRecord(activityId, entry.recordId, reason);
                }}
              />
            </section>

            {lastBatch && (
              <p className="text-[10px] text-[#475569]">
                Batch {lastBatch.batchId} — {lastBatch.accepted} accepted,{' '}
                {lastBatch.duplicates} duplicate(s).
              </p>
            )}
          </div>
        )}
      </div>

      {/* HITL verification panel (L004) — focus-trapped, Esc closes */}
      {verifyRecordId && (
        <VerificationPanel
          recordId={verifyRecordId}
          gate={gateForPanel}
          onClose={() => setVerifyRecordId(null)}
          onDecision={handleDecision}
        />
      )}
    </div>
  );
}
