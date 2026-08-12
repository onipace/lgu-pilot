'use client';

// src/app/linaw/page.tsx
// LINAW portal page. All five tabs are LIVE: Library & Ingestion + Library
// Verification, Inventory / Classification / Relationships (relationships
// confirm/reject wired to the N005 PUT endpoint), and Code Assembly
// (structure tree, TOC preview, summaries queue, final_code_export-gated
// JSON export). The pipeline button drives agents 1–6 over the ready library:
// per-agent UI delays (1100/1300/1600/1500/1100/1300ms — client simulation,
// decision D3) while the routes do the real work; HITL surfaces as rose feed
// cards.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentPipeline from '@/components/agent-pipeline';
import ActivityFeed from '@/components/activity-feed';
import LibraryIngestion from '@/components/linaw/library-ingestion';
import LibraryVerification from '@/components/linaw/library-verification';
import InventoryDashboard from '@/components/linaw/inventory-dashboard';
import ClassificationPanel from '@/components/linaw/classification-panel';
import RelationshipReview from '@/components/linaw/relationship-review';
import ConflictPanel from '@/components/linaw/conflict-panel';
import CodeAssembly, { type CodeAssemblyQueueItem } from '@/components/linaw/code-assembly';
import {
  LINAW_AGENT_DEFS,
  type LinawAgentOutput,
  type LinawAgentState,
  type LinawAssembleResponse,
  type LinawClassifyResponse,
  type LinawClassifyResultItem,
  type LinawCodeVolumeDetail,
  type LinawCodeVolumeSummary,
  type LinawConflictListItem,
  type LinawDetectResponse,
  type LinawInventoryResponse,
  type LinawOrphanWarning,
  type LinawRelationshipRecord,
  type LinawSummarizeResponse,
} from '@/types/linaw';
import type { ActivityItem } from '@/types/agentic';

type TabId = 'library' | 'inventory' | 'classification' | 'relationships' | 'code-assembly';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'library', label: 'Library & Ingestion' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'classification', label: 'Classification' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'code-assembly', label: 'Code Assembly' },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function initialAgents(): LinawAgentState[] {
  return LINAW_AGENT_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    module: 'linaw',
    description: def.description,
    status: 'idle',
    color: def.color,
    glowClass: def.glowClass,
  }));
}

export default function LinawPage() {
  const [activeTab, setActiveTab] = useState<TabId>('library');

  // Pipeline visualization state.
  const [agents, setAgents] = useState<LinawAgentState[]>(initialAgents);
  const [activities, setActivities] = useState<Array<ActivityItem<LinawAgentOutput>>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  // Tab-local state.
  const [classifyResults, setClassifyResults] = useState<LinawClassifyResultItem[]>([]);
  const [classifyExceptions, setClassifyExceptions] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<LinawRelationshipRecord[]>([]);
  const [conflicts, setConflicts] = useState<LinawConflictListItem[]>([]);
  const [orphans, setOrphans] = useState<LinawOrphanWarning[]>([]);
  const [relLoading, setRelLoading] = useState(false);

  // Code Assembly tab state (N006/N007).
  const [volumes, setVolumes] = useState<LinawCodeVolumeSummary[]>([]);
  const [volumeDetail, setVolumeDetail] = useState<LinawCodeVolumeDetail | null>(null);
  const [edition, setEdition] = useState('Edition ' + new Date().getUTCFullYear());
  const [exportApproved, setExportApproved] = useState(false);
  const [summariesQueue, setSummariesQueue] = useState<CodeAssemblyQueueItem[]>([]);
  const [codeBusy, setCodeBusy] = useState(false);

  function setAgent(id: number, patch: Partial<LinawAgentState>): void {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addActivities(items: Array<ActivityItem<LinawAgentOutput>>): void {
    setActivities((prev) => [...prev, ...items]);
  }

  // ── Relationships tab data (fetch when the tab opens) ─────────────────────

  const refreshRelationshipLists = useCallback(async () => {
    setRelLoading(true);
    try {
      const [relRes, confRes] = await Promise.all([
        fetch('/api/linaw/relationships?limit=100', { credentials: 'same-origin' }),
        fetch('/api/linaw/conflicts?limit=100', { credentials: 'same-origin' }),
      ]);
      if (relRes.ok) {
        const body = (await relRes.json()) as { items?: LinawRelationshipRecord[] };
        setRelationships(body.items ?? []);
      }
      if (confRes.ok) {
        const body = (await confRes.json()) as { items?: LinawConflictListItem[] };
        setConflicts(body.items ?? []);
      }
    } finally {
      setRelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'relationships') void refreshRelationshipLists();
  }, [activeTab, refreshRelationshipLists]);

  async function scanNow(): Promise<void> {
    setRelLoading(true);
    try {
      const res = await fetch('/api/linaw/detect-relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const body = (await res.json()) as LinawDetectResponse;
        setOrphans(body.orphans ?? []);
      }
    } finally {
      await refreshRelationshipLists();
    }
  }

  // ── N005: real confirm/reject decisions over the PUT endpoint ──

  async function decideRelationshipAction(
    id: string,
    action: 'confirm' | 'reject',
    reason?: string
  ): Promise<void> {
    setRelLoading(true);
    try {
      const res = await fetch('/api/linaw/relationships/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(action === 'reject' ? { action, reason } : { action }),
      });
      if (res.ok) {
        const body = (await res.json()) as { statusUpdate?: { to: string } };
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'success',
            status: 'confirmed',
            title: action === 'confirm' ? 'Relationship confirmed' : 'Relationship rejected',
            details:
              action === 'confirm' && body.statusUpdate
                ? `Target ordinance status updated to ${body.statusUpdate.to}.`
                : action === 'reject'
                  ? 'Rejection reason audited with the decision.'
                  : 'Decision recorded.',
            timestamp: nowIso(),
            data: { preview: action === 'confirm' ? 'Relationship confirmed' : 'Relationship rejected', success: true },
          },
        ]);
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'hitl',
            status: 'pending',
            title: 'Decision failed',
            details: body?.error ?? `Relationship decision failed (HTTP ${res.status})`,
            timestamp: nowIso(),
            data: { preview: 'Decision failed', hitlRequired: true },
          },
        ]);
      }
      await refreshRelationshipLists();
    } finally {
      setRelLoading(false);
    }
  }

  // ── Code Assembly tab data (N006/N007) ────────────────────────────────────

  const refreshCodeAssemblyData = useCallback(async () => {
    try {
      const [codeRes, libRes] = await Promise.all([
        fetch('/api/linaw/code?limit=100', { credentials: 'same-origin' }),
        fetch('/api/linaw/library?libraryStatus=ready&limit=100', { credentials: 'same-origin' }),
      ]);
      if (codeRes.ok) {
        const body = (await codeRes.json()) as { items?: LinawCodeVolumeSummary[] };
        const items = body.items ?? [];
        setVolumes(items);
        // Select the newest volume's detail (list is newest-first).
        if (items.length > 0) {
          const detailRes = await fetch('/api/linaw/code/' + items[0].id, {
            credentials: 'same-origin',
          });
          if (detailRes.ok) {
            setVolumeDetail((await detailRes.json()) as LinawCodeVolumeDetail);
          }
        } else {
          setVolumeDetail(null);
        }
      }
      if (libRes.ok) {
        const body = (await libRes.json()) as {
          items?: Array<{
            id: string;
            ordinanceNumber: number;
            seriesYear: number;
            title: string;
            summary?: string;
          }>;
        };
        setSummariesQueue(
          (body.items ?? []).map((item) => ({
            recordId: item.id,
            ordinanceNumber: item.ordinanceNumber,
            seriesYear: item.seriesYear,
            title: item.title,
            summary: item.summary ?? '',
          }))
        );
      }
    } catch {
      // Non-fatal — the tab renders its empty states.
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'code-assembly') void refreshCodeAssemblyData();
  }, [activeTab, refreshCodeAssemblyData]);

  async function assembleNow(): Promise<void> {
    setCodeBusy(true);
    try {
      const res = await fetch('/api/linaw/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ edition }),
      });
      const body = (await res.json().catch(() => null)) as
        | (LinawAssembleResponse & { error?: string; code?: string; pending?: number })
        | null;
      if (res.ok && body) {
        setVolumeDetail({
          id: body.codeVolumeId,
          title: body.title,
          edition: body.edition,
          status: 'draft',
          toc: body.toc,
          generatedById: null,
          generatedAt: nowIso(),
          publishedAt: null,
          createdAt: nowIso(),
        });
        setExportApproved(false);
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'success',
            status: 'confirmed',
            title: 'Code assembled',
            details: `${body.counts.titles} titles · ${body.counts.chapters} chapters · ${body.counts.sections} sections — edition “${body.edition}” drafted.`,
            timestamp: nowIso(),
            data: { preview: 'Code assembled', success: true },
          },
          {
            id: crypto.randomUUID(),
            type: 'hitl',
            status: 'pending',
            title: 'Review required — final code export',
            details:
              'final_code_export gate raised: review the draft volume and approve it for export in the Code Assembly tab.',
            timestamp: nowIso(),
            data: { preview: 'Review required', hitlRequired: true },
          },
        ]);
        await refreshCodeAssemblyData();
      } else if (res.status === 409 && body?.code === 'PENDING_RELATIONSHIPS') {
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'error',
            status: 'confirmed',
            title: 'Assembler blocked',
            details: `${body.pending ?? 'Pending'} detections await human decision (Relationships tab).`,
            timestamp: nowIso(),
            data: { preview: 'Assembler blocked', success: false },
          },
        ]);
      } else {
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'error',
            status: 'confirmed',
            title: 'Assembler refused',
            details: body?.error ?? `Assembly failed (HTTP ${res.status})`,
            timestamp: nowIso(),
            data: { preview: 'Assembler refused', success: false },
          },
        ]);
      }
    } finally {
      setCodeBusy(false);
    }
  }

  async function generateSummaries(): Promise<void> {
    setCodeBusy(true);
    try {
      const res = await fetch('/api/linaw/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const body = (await res.json()) as LinawSummarizeResponse;
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'success',
            status: 'confirmed',
            title: 'Summary generation finished',
            details: `summarized ${body.summarized} · failed ${body.failed.length}`,
            timestamp: nowIso(),
            data: { preview: 'Summary generation finished', success: true },
          },
        ]);
        await refreshCodeAssemblyData();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'error',
            status: 'confirmed',
            title: 'Summary generation failed',
            details: body?.error ?? `Summarization failed (HTTP ${res.status})`,
            timestamp: nowIso(),
            data: { preview: 'Summary generation failed', success: false },
          },
        ]);
      }
    } finally {
      setCodeBusy(false);
    }
  }

  async function saveSummary(recordId: string, summary: string): Promise<void> {
    setCodeBusy(true);
    try {
      const res = await fetch('/api/linaw/summarize/' + recordId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ summary }),
      });
      if (res.ok) {
        const body = (await res.json()) as { recordId: string; summary: string };
        setSummariesQueue((prev) =>
          prev.map((item) =>
            item.recordId === body.recordId ? { ...item, summary: body.summary } : item
          )
        );
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'success',
            status: 'confirmed',
            title: 'Summary saved',
            details: 'Human-edited summary persisted.',
            timestamp: nowIso(),
            data: { preview: 'Summary saved', success: true },
          },
        ]);
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'error',
            status: 'confirmed',
            title: 'Summary save failed',
            details: body?.error ?? `Summary edit failed (HTTP ${res.status})`,
            timestamp: nowIso(),
            data: { preview: 'Summary save failed', success: false },
          },
        ]);
      }
    } finally {
      setCodeBusy(false);
    }
  }

  function approveExport(): void {
    setExportApproved(true);
    setActivities((prev) =>
      prev.map((a) =>
        a.title === 'Review required — final code export' && a.status === 'pending'
          ? { ...a, status: 'confirmed' }
          : a
      )
    );
  }

  async function exportJson(): Promise<void> {
    if (!volumeDetail) return;
    setCodeBusy(true);
    try {
      const res = await fetch('/api/linaw/code/' + volumeDetail.id, {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const detail = (await res.json()) as LinawCodeVolumeDetail;
      const slug = detail.edition.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `esangguni-linaw-code-${slug || 'volume'}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCodeBusy(false);
    }
  }

  // ── Classification tab run (page owns the fetch; panel renders) ───────────

  async function classifyRun(): Promise<void> {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/linaw/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const body = (await res.json()) as LinawClassifyResponse;
        setClassifyResults(body.results ?? []);
        setClassifyExceptions(body.exceptions ?? []);
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setClassifyExceptions([body?.error ?? `Classification failed (HTTP ${res.status})`]);
      }
    } catch (err) {
      setClassifyExceptions([err instanceof Error ? err.message : 'Classification failed']);
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Pipeline visualization (decision D3: client delays + real routes) ─────

  async function runPipeline(): Promise<void> {
    setAgents(initialAgents());
    setActivities([]);
    setPipelineComplete(false);
    setIsProcessing(true);

    // ── Agent 1: Inventory Analyst ────────────────────────────────────────
    setAgent(1, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[0].delayMs);
    let inventory: LinawInventoryResponse;
    try {
      const res = await fetch('/api/linaw/inventory', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Inventory request failed (HTTP ${res.status})`);
      inventory = (await res.json()) as LinawInventoryResponse;
    } catch (err) {
      failAgent(1, err);
      return;
    }
    setAgent(1, {
      status: 'completed',
      output: {
        preview: LINAW_AGENT_DEFS[0].outputLabel,
        success: true,
        completenessScore: inventory.completenessScore,
        yearGaps: inventory.yearGaps,
      },
    });
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'success',
        status: 'confirmed',
        title: LINAW_AGENT_DEFS[0].outputLabel,
        details: `${inventory.totals.ordinances} ready ordinances · completeness ${inventory.completenessScore}% · ${inventory.yearGaps.length} gap entries`,
        timestamp: nowIso(),
        data: { preview: LINAW_AGENT_DEFS[0].outputLabel, success: true },
      },
    ]);

    // ── Agent 2: Code Classifier ──────────────────────────────────────────
    setAgent(2, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[1].delayMs);
    let classification: LinawClassifyResponse;
    try {
      const res = await fetch('/api/linaw/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Classification failed (HTTP ${res.status})`);
      }
      classification = (await res.json()) as LinawClassifyResponse;
    } catch (err) {
      failAgent(2, err);
      return;
    }
    setClassifyResults(classification.results ?? []);
    setClassifyExceptions(classification.exceptions ?? []);
    setAgent(2, {
      status: 'completed',
      output: {
        preview: LINAW_AGENT_DEFS[1].outputLabel,
        success: true,
        codePlacement: classification.results[0]?.placement ?? undefined,
      },
    });
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'success',
        status: 'confirmed',
        title: LINAW_AGENT_DEFS[1].outputLabel,
        details: `${classification.classified} classified · ${classification.skipped.length} skipped`,
        timestamp: nowIso(),
        data: { preview: LINAW_AGENT_DEFS[1].outputLabel, success: true },
      },
    ]);
    // HITL surfacing (D10): every gated result raises a rose card.
    for (const item of classification.results.filter((r) => r.hitlRequired)) {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'hitl',
          status: 'pending',
          title: 'Review required — code placement',
          details:
            `Ordinance No. ${item.ordinanceNumber}, S. ${item.seriesYear} — gate ${item.gate ?? 'code_placement'}` +
            (item.placement ? `, confidence ${Math.round(item.placement.confidence * 100)}%` : ', unparseable placement') +
            '. Confirm via the Classification tab override.',
          timestamp: nowIso(),
          data: { preview: 'Review required', hitlRequired: true },
        },
      ]);
    }

    // ── Agent 3: Cross-Reference Scanner (the detect call serves 3 AND 4) ──
    setAgent(3, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[2].delayMs);
    let detection: LinawDetectResponse;
    try {
      const res = await fetch('/api/linaw/detect-relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Relationship detection failed (HTTP ${res.status})`);
      }
      detection = (await res.json()) as LinawDetectResponse;
    } catch (err) {
      failAgent(3, err);
      return;
    }
    setOrphans(detection.orphans ?? []);
    setAgent(3, {
      status: 'completed',
      output: {
        preview: LINAW_AGENT_DEFS[2].outputLabel,
        success: true,
        relationships: [],
      },
    });
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'success',
        status: 'confirmed',
        title: LINAW_AGENT_DEFS[2].outputLabel,
        details: `${detection.relationshipsDetected} detected · ${detection.relationshipsPersisted} persisted · ${detection.orphans.length} orphan warnings`,
        timestamp: nowIso(),
        data: { preview: LINAW_AGENT_DEFS[2].outputLabel, success: true },
      },
    ]);

    // ── Agent 4: Conflict Detector (route work already done — consume) ─────
    setAgent(4, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[3].delayMs);
    setAgent(4, {
      status: 'completed',
      output: {
        preview: LINAW_AGENT_DEFS[3].outputLabel,
        success: true,
        conflicts: detection.conflicts.map((c) => ({
          ordinanceAId: c.ordinanceAId,
          ordinanceBId: c.ordinanceBId,
          reason: c.reason,
          confidence: c.confidence,
        })),
      },
    });
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'success',
        status: 'confirmed',
        title: LINAW_AGENT_DEFS[3].outputLabel,
        details: `${detection.conflictsDetected} conflicts flagged · ${detection.exceptions.length} exceptions`,
        timestamp: nowIso(),
        data: { preview: LINAW_AGENT_DEFS[3].outputLabel, success: true },
      },
    ]);

    // Detection HITL (D10): one rose card when anything was detected.
    if (detection.hitlRequired) {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'hitl',
          status: 'pending',
          title: 'Review required — detected relationships',
          details:
            `${detection.relationshipsDetected} relationships + ${detection.conflictsDetected} conflicts detected. ` +
            'Review each detection in the Relationships tab.',
          timestamp: nowIso(),
          data: { preview: 'Review required', hitlRequired: true },
        },
      ]);
    }
    // Orphan warnings surface as yellow cards.
    for (const orphan of detection.orphans) {
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'warning',
          status: 'confirmed',
          title: 'missing target',
          details: `Reference to Ordinance No. ${orphan.referencedNumber}${
            orphan.referencedYear > 0 ? `, S. ${orphan.referencedYear}` : ' (no series year)'
          } not found in the ready library.`,
          timestamp: nowIso(),
          data: { preview: 'missing target', success: false },
        },
      ]);
    }

    // Refresh the relationship/conflict lists after the run.
    void refreshRelationshipLists();

    // ── Agent 5: Relationship Reviewer (1100ms slot — N005) ─────────────────
    setAgent(5, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[4].delayMs);
    let queueItems: LinawRelationshipRecord[] = [];
    try {
      const res = await fetch('/api/linaw/relationships?limit=100', {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`Relationship queue request failed (HTTP ${res.status})`);
      const body = (await res.json()) as { items?: LinawRelationshipRecord[] };
      queueItems = body.items ?? [];
    } catch (err) {
      failAgent(5, err);
      return;
    }
    await refreshRelationshipLists();
    const pendingQueue = queueItems.filter(
      (item) => item.confirmed === 0 && (item.rejected ?? 0) === 0
    );
    if (pendingQueue.length > 0) {
      setAgent(5, {
        status: 'hitl',
        output: { preview: LINAW_AGENT_DEFS[4].outputLabel, success: true },
      });
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'hitl',
          status: 'pending',
          title: 'Review required — detected relationships',
          details: `${pendingQueue.length} detections await human confirmation (Relationships tab).`,
          timestamp: nowIso(),
          data: { preview: 'Review required', hitlRequired: true },
        },
      ]);
    } else {
      setAgent(5, {
        status: 'completed',
        output: { preview: LINAW_AGENT_DEFS[4].outputLabel, success: true },
      });
      addActivities([
        {
          id: crypto.randomUUID(),
          type: 'success',
          status: 'confirmed',
          title: LINAW_AGENT_DEFS[4].outputLabel,
          details: 'Decision queue clear — no pending detections.',
          timestamp: nowIso(),
          data: { preview: LINAW_AGENT_DEFS[4].outputLabel, success: true },
        },
      ]);
    }

    // ── Agent 6: Code Assembler (1300ms slot — gated by agent 5) ────────────
    setAgent(6, { status: 'processing' });
    await sleep(LINAW_AGENT_DEFS[5].delayMs);
    try {
      const res = await fetch('/api/linaw/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ edition }),
      });
      const body = (await res.json().catch(() => null)) as
        | (LinawAssembleResponse & { error?: string; code?: string; pending?: number })
        | null;
      if (res.ok && body) {
        setAgent(6, {
          status: 'completed',
          output: {
            preview: LINAW_AGENT_DEFS[5].outputLabel,
            success: true,
            toc: body.toc,
            codeVolumeId: body.codeVolumeId,
          },
        });
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'success',
            status: 'confirmed',
            title: LINAW_AGENT_DEFS[5].outputLabel,
            details: `${body.counts.titles} titles · ${body.counts.chapters} chapters · ${body.counts.sections} sections drafted.`,
            timestamp: nowIso(),
            data: { preview: LINAW_AGENT_DEFS[5].outputLabel, success: true },
          },
          {
            id: crypto.randomUUID(),
            type: 'hitl',
            status: 'pending',
            title: 'Review required — final code export',
            details:
              'final_code_export gate raised: review the draft volume and approve it for export in the Code Assembly tab.',
            timestamp: nowIso(),
            data: { preview: 'Review required', hitlRequired: true },
          },
        ]);
        setExportApproved(false);
        void refreshCodeAssemblyData();
      } else {
        setAgent(6, { status: 'error' });
        addActivities([
          {
            id: crypto.randomUUID(),
            type: 'error',
            status: 'confirmed',
            title: 'Code Assembler blocked',
            details:
              res.status === 409 && body?.code === 'PENDING_RELATIONSHIPS'
                ? `Assembler blocked — ${body.pending ?? 'pending'} detections await human decision (Relationships tab).`
                : body?.error ?? `Assembly failed (HTTP ${res.status})`,
            timestamp: nowIso(),
            data: { preview: 'Code Assembler blocked', success: false },
          },
        ]);
      }
    } catch (err) {
      failAgent(6, err);
      return;
    }

    setIsProcessing(false);
    setPipelineComplete(true);
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'success',
        status: 'confirmed',
        title: 'Pipeline complete',
        details: 'All 6 agents finished over the ready library.',
        timestamp: nowIso(),
        data: { preview: 'Pipeline complete', success: true },
      },
    ]);
  }

  function failAgent(agentId: number, err: unknown): void {
    const message = err instanceof Error ? err.message : 'Step failed';
    setAgent(agentId, { status: 'error' });
    addActivities([
      {
        id: crypto.randomUUID(),
        type: 'error',
        status: 'confirmed',
        title: `${LINAW_AGENT_DEFS[agentId - 1].name} failed`,
        details: message,
        timestamp: nowIso(),
        data: { preview: message, success: false },
      },
    ]);
    setIsProcessing(false);
  }

  // Feed handlers — Sprint-6 HITL items are acknowledged locally only (D10).
  function handleConfirm(activityId: string): void {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, status: 'confirmed' } : a))
    );
  }
  function handleEdit(activityId: string): void {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, status: 'confirmed' } : a))
    );
  }
  function handleReject(activityId: string, reason: string): void {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, status: 'rejected', reason } : a))
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1729] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Menu
          </Link>
          <h1 className="text-3xl font-black tracking-widest">L.I.N.A.W.</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Legislative Indexing for Normalized &amp; Accessible Wisdom — Library &amp; Codification
          </p>
        </header>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
              Codification Pipeline
            </h2>
            <button
              type="button"
              onClick={() => void runPipeline()}
              disabled={isProcessing}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-[#0038A8] px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Running…' : 'Run Codification Pipeline'}
            </button>
          </div>
          <p className="text-xs text-[#94A3B8]">Runs over the ready library.</p>
          <AgentPipeline agents={agents} isProcessing={isProcessing} pipelineComplete={pipelineComplete} />
          <ActivityFeed
            activities={activities}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
            onReject={handleReject}
          />
        </section>

        <nav aria-label="Module sections" role="tablist" className="flex flex-wrap gap-1 rounded-xl border border-[#283147] bg-[#1E293B] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-h-11 rounded-lg px-4 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-[#0038A8] text-white' : 'text-[#94A3B8] hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'library' && (
          <div className="space-y-6">
            <LibraryIngestion />
            <LibraryVerification />
          </div>
        )}
        {activeTab === 'inventory' && <InventoryDashboard />}
        {activeTab === 'classification' && (
          <ClassificationPanel
            classifyRun={classifyRun}
            running={isProcessing}
            results={classifyResults}
            exceptions={classifyExceptions}
          />
        )}
        {activeTab === 'relationships' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void scanNow()}
                disabled={relLoading}
                className="min-h-11 rounded-lg border border-[#283147] bg-[#0F1729] px-4 text-xs font-semibold text-white transition-colors hover:border-[#10B981] disabled:opacity-50"
              >
                {relLoading ? 'Scanning…' : 'Scan now'}
              </button>
            </div>
            <RelationshipReview
              items={relationships}
              orphans={orphans}
              loading={relLoading}
              busy={relLoading}
              onConfirm={(item) => void decideRelationshipAction(item.id, 'confirm')}
              onReject={(item, reason) => void decideRelationshipAction(item.id, 'reject', reason)}
            />
            <ConflictPanel
              items={conflicts}
              loading={relLoading}
              busy={relLoading}
              onConfirm={(item) => void decideRelationshipAction(item.id, 'confirm')}
              onReject={(item, reason) => void decideRelationshipAction(item.id, 'reject', reason)}
            />
          </div>
        )}
        {activeTab === 'code-assembly' && (
          <CodeAssembly
            volumes={volumes}
            volume={volumeDetail}
            summariesQueue={summariesQueue}
            edition={edition}
            busy={codeBusy}
            exportApproved={exportApproved}
            onEditionChange={setEdition}
            onAssemble={() => void assembleNow()}
            onGenerateSummaries={() => void generateSummaries()}
            onSaveSummary={(recordId, summary) => void saveSummary(recordId, summary)}
            onApproveExport={approveExport}
            onExportJson={() => void exportJson()}
          />
        )}
      </div>
    </div>
  );
}
