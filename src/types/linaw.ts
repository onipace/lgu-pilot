// src/types/linaw.ts
// Sprint 5 — LINAW module interfaces (PRP-LINAW Types section, module-narrowed).
// Builds on the Sprint-1 shared generics in @/types/agentic. Pure types + static
// agent definitions: safe to import from BOTH server code and client components.
// The six pipeline agents are DEFINED here for display; their runner is Sprint 6.

import type {
  AgentOutputBase,
  AgentState,
  HitlItem,
  AgentDecisionRecord,
} from './agentic';

// ── Agent definitions (WORKFLOW-LINAW.json — all 6; IDLE until Sprint 6) ──

export interface LinawAgentDef {
  id: number;
  name: string;
  description: string;
  functionName: string;
  color: string;      // hex, e.g. '#F59E0B'
  glowClass: string;  // e.g. 'glow-amber'
  delayMs: number;    // UI simulation delay (used by the Sprint-6 runner)
  outputLabel: string;
}

export const LINAW_AGENT_DEFS: LinawAgentDef[] = [
  { id: 1, name: 'Inventory Analyst',      description: 'Computes inventory completeness and year gaps',        functionName: 'analyzeInventory',     color: '#F59E0B', glowClass: 'glow-amber',   delayMs: 1100, outputLabel: 'Inventory analyzed' },
  { id: 2, name: 'Code Classifier',        description: 'Assigns ordinances to Code Titles/Chapters',         functionName: 'classifyToCode',       color: '#8B5CF6', glowClass: 'glow-violet',  delayMs: 1300, outputLabel: 'Code placement assigned' },
  { id: 3, name: 'Cross-Referencer',         description: 'Detects amendment/repeal/supersede relationships',  functionName: 'scanCrossReferences',  color: '#10B981', glowClass: 'glow-emerald', delayMs: 1600, outputLabel: 'Relationships detected' },
  { id: 4, name: 'Conflict Detector',      description: 'Flags semantic contradictions across ordinances',    functionName: 'detectConflicts',      color: '#F43F5E', glowClass: 'glow-rose',    delayMs: 1500, outputLabel: 'Conflicts flagged' },
  { id: 5, name: 'Relationship Reviewer',  description: 'Presents relationships for human confirmation (HITL)', functionName: 'reviewRelationships',  color: '#22D3EE', glowClass: 'glow-cyan',    delayMs: 1100, outputLabel: 'Awaiting human review' },
  { id: 6, name: 'Code Assembler',         description: 'Builds hierarchical Code of Ordinances with TOC',    functionName: 'assembleCode',         color: '#6366F1', glowClass: 'glow-indigo',  delayMs: 1300, outputLabel: 'Code assembled' },
];

// ── Domain entity (row contract of linaw_ordinances — the ONLY ordinance table LINAW touches) ──

export interface LinawOrdinance {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary?: string;
  subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  sourceType: 'scan' | 'import' | 'manual';
  sourceFilename?: string;
  fileHash?: string;
  libraryStatus: 'processing' | 'pending_review' | 'ready' | 'rejected';
  uploadedById: string;
  verifiedById?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Outputs / HITL (narrowings of the shared kit generics) ──

export interface LinawAgentOutput extends AgentOutputBase {
  completenessScore?: number;
  yearGaps?: Array<{ year: number; missing: number[] }>;
  codePlacement?: { titleNumber: number; chapterNumber: number; articleNumber?: number; confidence: number };
  relationships?: Array<{ sourceId: string; targetId: string; type: LinawRelationshipType; sectionRef?: string; confidence: number }>;
  conflicts?: Array<{ ordinanceAId: string; ordinanceBId: string; reason: string; confidence: number }>;
  toc?: CodeTocNode[];
  codeVolumeId?: string;
}

export type LinawRelationshipType = 'amends' | 'repeals' | 'partial_repeal' | 'supersedes' | 'extends' | 'implements';

export type LinawAgentState = AgentState<'linaw', LinawAgentOutput>;

export type LinawHitlGate =
  | 'low_confidence_classification'
  | 'detected_relationship'
  | 'code_placement'
  | 'final_code_export';

export type LinawHitlItem = HitlItem<'linaw', LinawAgentOutput> & { gate: LinawHitlGate };

export type LinawDecisionRecord = AgentDecisionRecord & { module: 'linaw' };

// ── N013 bulk import contracts ──

export interface ParsedImportRecord {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags: string[];
}

export interface LinawImportResponse {
  batchId: string;
  imported: number;
  skippedDuplicates: number;
  /** PRD §12.6 verbatim item shape: { id, library_status } (snake_case by contract). */
  records: Array<{ id: string; library_status: 'pending_review' }>;
  invalidRecords: Array<{ index: number; error: string }>;
}

// ── N014 scan upload contracts ──

export interface LinawUploadFileResult {
  /** Record id (PRD §12.6 literal key `id`). */
  id?: string;
  /** PRD §12.6 literal key `hash` — SHA-256 of the uploaded bytes. */
  hash: string;
  status: 'accepted' | 'duplicate' | 'duplicate_metadata' | 'ocr_failed' | 'rejected';
  originalFilename: string;
  mimeType?: string;
  sizeBytes: number;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  /** Per-field confidence from LINAW's own metadata parse (response/audit-only — decision D4). */
  confidence?: { ordinanceNumber: number; seriesYear: number; title: number };
  error?: string;
}

export interface LinawUploadResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  failed: number;
  files: LinawUploadFileResult[];
}

// ── Library list / detail / verification contracts ──

export interface LinawLibraryListItem {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: LinawOrdinance['status'];
  libraryStatus: LinawOrdinance['libraryStatus'];
  sourceType: LinawOrdinance['sourceType'];
  subjectTags: string[];
  snippet: string;
  updatedAt: string;
}

export interface LinawLibraryListResponse {
  items: LinawLibraryListItem[];
  total: number;
  page: number;
  limit: number;
  tookMs: number;
}

export interface LinawLibraryDetailResponse {
  record: LinawOrdinance;
  scanAvailable: boolean;
  scanUrl: string | null;
  scanMimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | null;
}

export interface LinawManualCreateRequest {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags?: string[];
}

export interface LinawVerificationRequest {
  action: 'approve' | 'reject' | 'edit';
  /** Required (non-empty) when action === 'reject'. */
  reason?: string;
  fields?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    subjectTags?: string[];
  };
  /** Optimistic-concurrency guard: must equal the row's current updated_at when provided. */
  expectedUpdatedAt?: string;
}

export interface LinawVerificationResponse {
  recordId: string;
  action: 'approve' | 'reject' | 'edit';
  libraryStatus: 'pending_review' | 'ready' | 'rejected';
  reason?: string;
}

// ── Sprint 6: N001 inventory contracts ──

export interface LinawInventoryResponse {
  totals: { ordinances: number; years: number; subjects: number };
  byYear: Array<{ year: number; count: number }>;
  byStatus: Array<{ status: LinawOrdinance['status']; count: number }>;
  bySubject: Array<{ subject: string; count: number }>;
  /** Range years with zero ready ordinances → {year, missing: []}; years present with
   *  numbering holes → {year, missing: [absent ordinance numbers]}. Years clean → omitted.
   *  SYSTEM_TEST D-2 bound: at most 500 entries are emitted (ascending from the window
   *  minimum) and each missing[] list is capped at 500 absent numbers (lowest first);
   *  see `truncated`. */
  yearGaps: Array<{ year: number; missing: number[] }>;
  /** SYSTEM_TEST D-2: true when the gap list was capped — either more than 500 gap
   *  entries exist in the corpus window or a single year has more than 500 missing
   *  ordinance numbers. Always present; false when nothing was capped. */
  truncated: boolean;
  /** round(100 × yearsWithReadyRows / totalYearsInRange, 1); 0 when the ready library is empty. */
  completenessScore: number;
  /** Server-side elapsed ms — the ≤2s dashboard-refresh SLA is asserted against this. */
  tookMs: number;
}

// ── Sprint 6: N002 classification contracts ──

export interface LinawCodePlacement {
  titleNumber: number;
  chapterNumber: number;
  articleNumber?: number;
  confidence: number;
}

export interface LinawClassifyRequest {
  /** Optional: absent or [] → every ready ordinance; else restricts the batch. */
  ordinanceIds?: string[];
}

export interface LinawClassifyResultItem {
  recordId: string;
  ordinanceNumber: number;
  seriesYear: number;
  /** null when the LLM output was unparseable (record then carries the low_confidence gate). */
  placement: LinawCodePlacement | null;
  hitlRequired: boolean;
  gate?: 'code_placement' | 'low_confidence_classification';
}

export interface LinawClassifyResponse {
  pipelineId: string;
  classified: number;
  skipped: Array<{ recordId: string; reason: string }>;
  results: LinawClassifyResultItem[];
  exceptions: string[];
}

export interface LinawClassifyOverrideRequest {
  titleNumber: number;
  chapterNumber: number;
  articleNumber?: number;
  /** REQUIRED non-empty — human overrides always carry a reason. */
  reason: string;
}

export interface LinawClassifyOverrideResponse {
  recordId: string;
  codStatus: 'reviewed';
  titleNumber: number;
  chapterNumber: number;
  articleNumber?: number;
  reviewedBy: string;
}

// ── Sprint 6: N003/N004 detection contracts ──

export interface LinawDetectRequest {
  /** Optional: absent or [] → scan every ready ordinance (sources); targets always resolve ready-wide. */
  ordinanceIds?: string[];
}

export interface LinawOrphanWarning {
  sourceId: string;
  referencedNumber: number;
  /** 0 when the reference carried no series year (still an orphan). */
  referencedYear: number;
  rawQuote: string;
  warning: 'missing target';
}

export interface LinawRelationshipEndpoint {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
}

export interface LinawRelationshipRecord {
  id: string;
  sourceId: string;
  targetId: string;
  type: LinawRelationshipType;
  sectionRef?: string;
  confidence: number;
  confirmed: 0 | 1;
  /** Sprint 7 (D1): 1 when a human rejected the detection; confirmed stays 0. */
  rejected?: 0 | 1;
  createdAt: string;
  /** Present on list responses (joined metadata). */
  source?: LinawRelationshipEndpoint;
  target?: LinawRelationshipEndpoint;
}

export interface LinawConflictExcerpt {
  ordinanceId: string;
  passage: string;
}

export interface LinawConflictRecord {
  id: string;
  ordinanceAId: string;
  ordinanceBId: string;
  reason: string;
  confidence: number;
  excerpts: LinawConflictExcerpt[];
  confirmed: 0 | 1;
  /** Sprint 7 (D1): 1 when a human rejected the detection; confirmed stays 0. */
  rejected?: 0 | 1;
  createdAt: string;
}

export interface LinawConflictListItem extends LinawConflictRecord {
  ordinanceA: LinawRelationshipEndpoint;
  ordinanceB: LinawRelationshipEndpoint;
}

export interface LinawDetectResponse {
  pipelineId: string;
  scanned: number;
  relationshipsDetected: number;
  relationshipsPersisted: number;
  skippedExisting: number;
  orphans: LinawOrphanWarning[];
  conflictsDetected: number;
  conflictsPersisted: number;
  conflicts: LinawConflictRecord[];
  /** True when any relationship/conflict was detected OR any confidence gate fired. */
  hitlRequired: boolean;
  exceptions: string[];
}

export interface LinawRelationshipsListResponse {
  items: LinawRelationshipRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface LinawConflictsListResponse {
  items: LinawConflictListItem[];
  total: number;
  page: number;
  limit: number;
}

// ── Sprint 7: N005 relationship decision contracts ──

export interface LinawRelationshipDecisionRequest {
  action: 'confirm' | 'reject';
  /** REQUIRED non-empty when action === 'reject' (audited to agent_decisions.reason). */
  reason?: string;
}

export interface LinawRelationshipStatusUpdate {
  /** The ordinance whose legal status changed — decision D2: the relationship's TARGET. */
  ordinanceId: string;
  ordinanceNumber: number;
  seriesYear: number;
  from: LinawOrdinance['status'];
  to: LinawOrdinance['status'];
}

export interface LinawRelationshipDecisionResponse {
  id: string;
  action: 'confirm' | 'reject';
  confirmed: 0 | 1;
  rejected: 0 | 1;
  /** Present ONLY when a confirm actually flipped the target's status (D2: active/amended origins only). */
  statusUpdate?: LinawRelationshipStatusUpdate;
}

// ── Sprint 7: N007 summary contracts ──

export interface LinawSummarizeRequest {
  /** Optional: absent or [] → every ready ordinance WITHOUT an existing summary; explicit ids regenerate. */
  ordinanceIds?: string[];
}

export interface LinawSummarizeResultItem {
  recordId: string;
  ordinanceNumber: number;
  seriesYear: number;
  summary: string;
}

export interface LinawSummarizeResponse {
  pipelineId: string;
  summarized: number;
  /** Already-summary'd rows skipped under the implicit (no-ids) batch. */
  skipped: Array<{ recordId: string; reason: string }>;
  results: LinawSummarizeResultItem[];
  /** Per-record LLM failures (D12): the batch never 500s. */
  failed: Array<{ recordId: string; reason: string }>;
}

export interface LinawSummaryEditRequest {
  /** REQUIRED non-empty — human-edited summaries are the authoritative text. */
  summary: string;
}

export interface LinawSummaryEditResponse {
  recordId: string;
  summary: string;
  editedById: string;
}

// ── Sprint 7: N006 code assembly contracts ──

export interface CodeSectionRef {
  id: string;
  ordinanceId: string;
  /** 'Section N' — N auto-numbered sequentially per chapter (decision D6). */
  label: string;
  /** Additive display fields (decision D11) — assembly output carries them; PRP base shape kept. */
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  summary?: string;
}

export interface CodeTocArticle {
  name: string;
  sections: CodeSectionRef[];
}

export interface CodeTocChapter {
  name: string;
  /** Chapter-level sections: ordinances placed without an article (decision D11). */
  sections?: CodeSectionRef[];
  articles?: CodeTocArticle[];
}

export interface CodeTocNode {
  /** e.g. 'Title 3 — Taxation and Revenue' (named from LINAW_CODE_TITLES; 'Title N' fallback). */
  title: string;
  chapters: CodeTocChapter[];
}

export interface LinawAssembleRequest {
  /** REQUIRED non-empty edition label for the new code volume. */
  edition: string;
}

export interface LinawAssembleResponse {
  pipelineId: string;
  codeVolumeId: string;
  title: string;
  edition: string;
  toc: CodeTocNode[];
  counts: { titles: number; chapters: number; sections: number };
  /** Agent 6 raises final_code_export after every successful assembly (decision D5). */
  hitlRequired: true;
  gate: 'final_code_export';
  /** Ready ordinances with no placement — non-blocking exceptions (D6). */
  unclassified: Array<{ recordId: string; ordinanceNumber: number; seriesYear: number }>;
  /** Ready ordinances excluded by legal status (repealed/superseded/expired — D6). */
  excluded: Array<{ recordId: string; ordinanceNumber: number; seriesYear: number; status: LinawOrdinance['status'] }>;
  exceptions: string[];
}

export interface LinawCodeVolumeSummary {
  id: string;
  title: string;
  edition: string;
  status: 'draft' | 'under_review' | 'published';
  createdAt: string;
}

export interface LinawCodeVolumeListResponse {
  items: LinawCodeVolumeSummary[];
  total: number;
}

export interface LinawCodeVolumeDetail {
  id: string;
  title: string;
  edition: string;
  status: 'draft' | 'under_review' | 'published';
  toc: CodeTocNode[];
  generatedById: string | null;
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// ── Sprint 7: N015 L1 interchange contracts (INTERCHANGE-SPEC v1.0.0 verbatim shapes) ──

export interface LinawExportRequest {
  /** Optional: absent → all ready rows; [] → valid empty package; ineligible id → whole-request 409 (D8). */
  ordinanceIds?: string[];
}

export interface LinawInterchangeRecord {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary: string | null;
  subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  sourceType: 'scan' | 'import' | 'manual';
  fileHash: string | null;
  sourceRecordId: string;
}

export interface LinawInterchangeRelationship {
  sourceOrdinance: { ordinanceNumber: number; seriesYear: number };
  targetOrdinance: { ordinanceNumber: number; seriesYear: number };
  type: LinawRelationshipType;
  sectionRef: string | null;
  confidence: number;
  confirmedById: string;
}

export interface LinawInterchangeManifest {
  schemaVersion: '1.0.0';
  module: 'linaw';
  interchangeLevel: 'L1';
  exportedAt: string;
  exportedById: string;
  source: { table: 'linaw_ordinances'; recordCount: number; yearRange: number[] };
  exporter: { platform: 'esangguni-pilot'; appVersion: string };
}

export interface LinawInterchangePackage {
  manifest: LinawInterchangeManifest;
  records: LinawInterchangeRecord[];
  /** ALWAYS present for LINAW packages (may be []); hashed alongside records (D8). */
  relationships: LinawInterchangeRelationship[];
  packageHash: string;
}
