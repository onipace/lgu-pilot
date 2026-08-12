// src/types/likha.ts
// Sprint 2 — LIKHA module interfaces (PRP-LIKHA Types section, module-narrowed).
// Builds on the Sprint-1 shared generics in @/types/agentic. Pure types + static
// agent definitions: safe to import from BOTH server code and client components.

import type {
  AgentOutputBase,
  AgentState,
  HitlItem,
  AgentDecisionRecord,
} from './agentic';

// ── Agent definitions (WORKFLOW-LIKHA.json — all 6; agents 4–6 stay idle until Sprints 3–4) ──

export interface LikhaAgentDef {
  id: number;
  name: string;
  description: string;
  functionName: string;
  color: string;      // hex, e.g. '#F59E0B'
  glowClass: string;  // e.g. 'glow-amber'
  delayMs: number;    // UI simulation delay
  outputLabel: string;
}

export const LIKHA_AGENT_DEFS: LikhaAgentDef[] = [
  { id: 1, name: 'Ingestor',          description: 'Validates uploads, computes file hashes, stores raw file records', functionName: 'ingestFiles',      color: '#F59E0B', glowClass: 'glow-amber',   delayMs: 1000, outputLabel: 'Files validated & hashed' },
  { id: 2, name: 'OCR Extractor',     description: 'Extracts text from PDFs/images via module-owned OpenRouter wrapper', functionName: 'extractText',    color: '#10B981', glowClass: 'glow-emerald', delayMs: 1600, outputLabel: 'Text extracted' },
  { id: 3, name: 'Metadata Parser',   description: 'Parses ordinance number, series year, title, section count', functionName: 'parseMetadata',    color: '#8B5CF6', glowClass: 'glow-violet',  delayMs: 1400, outputLabel: 'Metadata parsed' },
  { id: 4, name: 'Subject Classifier', description: 'Suggests subject categories with confidence scores', functionName: 'classifySubject',  color: '#0EA5E9', glowClass: 'glow-sky',     delayMs: 1200, outputLabel: 'Subjects suggested' },
  { id: 5, name: 'Legal Validator',   description: 'Flags low-confidence extractions; raises HITL gates', functionName: 'validateExtraction', color: '#F43F5E', glowClass: 'glow-rose',   delayMs: 1200, outputLabel: 'Validation complete' },
  { id: 6, name: 'Archiver',          description: 'Publishes verified records and updates the BM25 index', functionName: 'publishToArchive', color: '#6366F1', glowClass: 'glow-indigo', delayMs: 1000, outputLabel: 'Published to archive' },
];

// ── Outputs ──

export interface LikhaAgentOutput extends AgentOutputBase {
  fileHash?: string;
  originalFilename?: string;
  mimeType?: string;
  rawText?: string;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  sectionCount?: number;
  confidence?: number;
  confidenceByField?: MetadataConfidence;
  subjects?: Array<{ label: string; confidence: number }>;
}

export type LikhaAgentState = AgentState<'likha', LikhaAgentOutput>;

/** HITL item narrowed to LIKHA gates. The gate UI is built in Sprint 3 — type only for now. */
export type LikhaHitlItem = HitlItem<'likha', LikhaAgentOutput> & {
  gate: 'low_confidence_metadata' | 'low_confidence_classification';
};

export type LikhaAgentDecision = AgentDecisionRecord & { module: 'likha' };

// ── Domain entities (PRP-LIKHA Types) ──

export interface MetadataConfidence {
  ordinanceNumber: number;
  seriesYear: number;
  title: number;
  sectionCount: number;
}

export interface ParsedMetadata {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  sectionCount: number;
  confidence: MetadataConfidence;
}

export interface ArchivedOrdinance {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary?: string;
  subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  archiveStatus: 'processing' | 'pending_review' | 'published' | 'flagged';
  sourceType?: string;
  originalFilename?: string;
  scanFilePath?: string;
  fileHash?: string;
  extractionConfidence?: MetadataConfidence;
  uploadedById: string;
  verifiedById?: string;
  createdAt: string;
  updatedAt: string;
}

/** Snake_case row shape as stored in SQLite (mapper lives in agents.ts). */
export interface ArchivedOrdinanceRow {
  id: string;
  ordinance_number: number;
  series_year: number;
  title: string;
  content: string;
  summary: string | null;
  subject_tags: string;
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  source_type: string;
  original_filename: string | null;
  scan_file_path: string | null;
  file_hash: string | null;
  archive_status: 'processing' | 'pending_review' | 'published' | 'flagged';
  uploaded_by_id: string;
  verified_by_id: string | null;
  extraction_confidence: string | null;
  dilg_submitted: number;
  dilg_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Upload + pipeline contracts (L001–L003) ──

export type LikhaUploadFileStatus = 'queued' | 'ingesting' | 'ocr' | 'parsing' | 'verifying' | 'published' | 'error';

export interface LikhaUploadFileResult {
  originalFilename: string;
  status: 'accepted' | 'rejected' | 'duplicate';
  recordId?: string;
  fileHash?: string;
  mimeType?: string;
  sizeBytes: number;
  error?: string;
  existingRecordId?: string; // duplicate → link to the existing archive record
}

export interface LikhaUploadResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  files: LikhaUploadFileResult[];
}

export interface LikhaPipelineFileInput {
  recordId: string;
  originalFilename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  scanFilePath: string;
  fileHash: string;
}

export interface LikhaPipelineFileResult {
  recordId: string;
  originalFilename: string;
  ok: boolean;
  duplicate?: boolean;
  failedAgent?: number;           // 2 = OCR, 3 = Metadata Parser
  error?: string;
  rawTextLength?: number;
  metadata?: ParsedMetadata;
  archiveStatus: 'processing' | 'pending_review' | 'flagged';
  /** Agent 5 (Legal Validator) result — Sprint 3. Present once validation ran. */
  validation?: LikhaValidationResult;
  /** Agent 4 (Subject Classifier) result — Sprint 4. Present once classification ran. */
  classification?: LikhaClassificationResult;
}

export interface LikhaPipelineResponse {
  batchId: string;
  pipelineId: string;
  processed: number;
  failed: number;
  files: LikhaPipelineFileResult[];
}

// ── Sprint 3 contracts (L004 verification, L005 publish, L006 search) ──

/** Subject categories offered by the verification panel multi-select in Sprint 3.
 *  Derived from the DESIGN.md §2.1 wireframe subjects; Sprint 4's L007 taxonomy
 *  supersedes (agent 4 suggests from it; humans keep final say). */
export const LIKHA_SUBJECTS: readonly string[] = [
  'Taxation & Revenue',
  'Business Regulation',
  'Health & Sanitation',
  'Zoning & Land Use',
  'Public Safety & Order',
  'Education',
  'Social Services',
  'Infrastructure & Public Works',
  'Environment & Natural Resources',
  'Budget & Appropriations',
  'Personnel & Administration',
  'General Provisions',
] as const;

/** Agent 5 (Legal Validator) output per record (WORKFLOW-LIKHA.json agent 5). */
export interface LikhaValidationResult {
  hitlRequired: boolean;
  exceptions: string[];
  /** Set when the gate fires (PRD-LIKHA §12.4 row 1). */
  gate?: 'low_confidence_metadata';
}

/** Body of PUT /api/likha/archive/[id] (PRD-LIKHA §12.6: metadata fields + action + reason?). */
export interface LikhaVerificationRequest {
  action: 'approve' | 'edit' | 'reject';
  /** REQUIRED for reject (non-empty); for edit stored as the audit reason 'edit'. */
  reason?: string;
  /** Editable fields (L004): applied on action 'edit' (and validated on 'approve' if present). */
  fields?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    sectionCount?: number;
    subjects?: string[];
  };
  /** Optimistic-concurrency guard — when provided must match stored updated_at (decision D17). */
  expectedUpdatedAt?: string;
}

/** Response of PUT /api/likha/archive/[id]. */
export interface LikhaVerificationResponse {
  recordId: string;
  action: 'approve' | 'edit' | 'reject';
  archiveStatus: 'pending_review' | 'published' | 'flagged';
  /** true only once the Archiver has published (wired in L005). */
  published: boolean;
}

/** GET /api/likha/archive/[id] — detail for the verification panel. */
export interface LikhaRecordDetailResponse {
  record: ArchivedOrdinance;
  scanAvailable: boolean;
  scanUrl: string | null;
  scanMimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | null;
  /** Classifications with provenance (Sprint 4, L007 — PRD §12.6 'ordinance detail + classifications'). */
  classifications?: LikhaClassificationEntry[];
}

/** One result card in the archive browser (L006). */
export interface LikhaArchiveListItem {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  archiveStatus: 'processing' | 'pending_review' | 'published' | 'flagged';
  subjectTags: string[];
  sectionCount: number | null;
  createdAt: string;
  /** Snippet — server-escaped; matched query terms wrapped in <mark> when q is present. */
  snippet: string;
  /** BM25 score — present only for q= searches. */
  score?: number;
}

/** GET /api/likha/archive?q=&yearFrom=&yearTo=&status=&subject=&archiveStatus=&page=&limit= */
export interface LikhaArchiveSearchResponse {
  items: LikhaArchiveListItem[];
  total: number;
  page: number;
  limit: number;
  /** Server-measured latency of this request (PRD: search <500ms). */
  tookMs: number;
}

/** GET /api/likha/stats (DESIGN.md §2.1 header counts + BM25 index size). */
export interface LikhaStatsResponse {
  archived: number;
  published: number;
  pendingReview: number;
  flagged: number;
  byYear: Record<string, number>;
  byStatus: Record<string, number>;
  bySubject: Record<string, number>;
  bm25Indexed: number;
}

// ── Sprint 4 contracts (L007 classification, L010 DILG export, L013 L1 interchange) ──

/** 13-title municipal Code of Ordinances taxonomy (decision D21; PRP: "13 Code Titles
 *  taxonomy + subject categories"). Classifier labels must come from
 *  LIKHA_CODE_TITLES ∪ LIKHA_SUBJECTS. */
export const LIKHA_CODE_TITLES: readonly string[] = [
  'Title I - General Principles',
  'Title II - Local Government Structure & Administration',
  'Title III - Taxation & Fiscal Affairs',
  'Title IV - Public Services & Utilities',
  'Title V - Markets, Trade & Business',
  'Title VI - Health, Sanitation & Welfare',
  'Title VII - Public Safety & Order',
  'Title VIII - Buildings & Construction',
  'Title IX - Zoning, Land Use & Housing',
  'Title X - Agriculture, Fisheries & Livelihood',
  'Title XI - Environment & Natural Resources',
  'Title XII - Education, Culture & Social Development',
  'Title XIII - General & Miscellaneous Provisions',
] as const;

/** Legal label space for L007 classification (decision D21). */
export const LIKHA_CLASSIFICATION_LABELS: readonly string[] = [
  ...LIKHA_CODE_TITLES,
  ...LIKHA_SUBJECTS,
] as const;

/** One AI suggestion from agent 4. */
export interface LikhaClassificationSuggestion {
  label: string;
  confidence: number;
}

/** Agent 4 per-file result attached to LikhaPipelineFileResult.classification (decision D24). */
export interface LikhaClassificationResult {
  subjects: LikhaClassificationSuggestion[];
  /** true when suggestions are empty OR max confidence < 0.6 (gate row 2, PRD §12.4). */
  hitlRequired: boolean;
  /** Set when the gate fires. */
  gate?: 'low_confidence_classification';
}

/** One persisted classifications row (provenance per PRD §12.5). */
export interface LikhaClassificationEntry {
  id: string;
  category: string;
  confidence: number | null;
  /** 'ai' for model suggestions; a user id for admin overrides. */
  assignedBy: string;
  createdAt: string;
}

/** Body of POST /api/likha/classify (PRD §12.6). */
export interface LikhaClassifyRequest {
  ordinanceIds: string[];
}

/** One result entry of POST /api/likha/classify. */
export interface LikhaClassifyResultItem {
  recordId: string;
  ordinanceNumber: number;
  seriesYear: number;
  suggestions: LikhaClassificationSuggestion[];
  /** true when the low_confidence_classification gate fired for this record. */
  hitlRequired: boolean;
}

/** Response of POST /api/likha/classify (decision D22). */
export interface LikhaClassifyResponse {
  classified: number;
  skipped: Array<{ recordId: string; reason: string }>;
  results: LikhaClassifyResultItem[];
}

/** Body of PUT /api/likha/classify/[id] — admin override (decision D25). */
export interface LikhaClassificationOverrideRequest {
  categories: string[];
}

/** Response of PUT /api/likha/classify/[id]. */
export interface LikhaClassificationOverrideResponse {
  recordId: string;
  categories: string[];
  assignedBy: string;
}

// ── L013 L1 interchange package — shapes VERBATIM from docs/INTERCHANGE-SPEC.md v1.0.0 ──

/** INTERCHANGE-SPEC §4 record (module-neutral canonical shape). */
export interface LikhaInterchangeRecord {
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

/** INTERCHANGE-SPEC §3 manifest. Per §2, LIKHA packages carry no relationship array — omitted entirely. */
export interface LikhaInterchangeManifest {
  schemaVersion: '1.0.0';
  module: 'likha';
  interchangeLevel: 'L1';
  exportedAt: string;
  exportedById: string;
  source: {
    table: 'archived_ordinances';
    recordCount: number;
    yearRange: number[];
  };
  exporter: {
    platform: 'esangguni-pilot';
    appVersion: string;
  };
}

/** INTERCHANGE-SPEC §2 package. LIKHA emits manifest + records + packageHash only
 *  (§2: the §5 relationship array is omitted for LIKHA; §6: hash payload = {records}). */
export interface LikhaInterchangePackage {
  manifest: LikhaInterchangeManifest;
  records: LikhaInterchangeRecord[];
  packageHash: string;
}

/** Body of POST /api/likha/export-dilg and POST /api/likha/export-package (PRD §12.6 / SPEC §7). */
export interface LikhaExportRequest {
  ordinanceIds?: string[];
}

/** L010 DILG MC 2026-041 submission package shape (decision D27 — single JSON attachment). */
export interface LikhaDilgPackage {
  manifest: {
    submission: 'DILG MC 2026-041';
    module: 'likha';
    platform: 'esangguni-pilot';
    exportedAt: string;
    exportedById: string;
    recordCount: number;
  };
  records: Array<{
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
    subjectTags: string[];
    fileHash: string | null;
    sourceRecordId: string;
    dilgSubmittedAt: string;
  }>;
}
