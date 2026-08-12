# Product Requirements Prompt (PRP)
## PILLAR LIKHA + LINAW — Code Generation Prompt

Feed this PRP to @make_agent during BUILD (or paste into any AI code editor opened on the pillar-pilot repo).

**Archetype:** agentic (AGENTIC.md PRP sections merged) · **Domain:** gov (LGU terminology applied) · **Session:** pillar-likha-linaw-20260809
**Inputs:** docs/PRD.md · docs/DESIGN.md · docs/WORKFLOW-DEFINITION.json · docs/LIKHA-LINAW-Modular-Independence-Audit.md (v2)
**v2 revision (2026-08-09):** Bidirectional no-dependency rule applied — LINAW owns its own library (`linaw_ordinances`), ingestion (bulk import / scan upload with own OCR / manual entry), verification, and BM25 namespace; zero cross-module table reads in BOTH directions; L1 interchange export-package routes added as Should-haves.

---

## PROMPT

```
You are extending an EXISTING Next.js 15.3.8 monolith (pillar-pilot) with two NEW standalone modules:
LIKHA (legislative archive digitization) and LINAW (ordinance codification). Target repo: PILLAR-pilot.
App Router, TypeScript 5, Tailwind CSS, shadcn/ui, better-sqlite3, OpenRouter LLM client at src/lib/ai/llm.ts.

NON-NEGOTIABLE CONSTRAINTS (from the Modular Independence Audit — violation = build failure):
1. ZERO imports from src/app/api/obra/*, src/app/api/chat/*, src/lib/ai/prompts.ts, src/lib/ai/obra-export.ts, or any ELLA/OBRA/YALA component.
2. Reuse ONLY these shared primitives: src/lib/ai/llm.ts, src/lib/db.ts, src/lib/logger.ts, src/lib/user-auth-middleware.ts, src/lib/ai/lightrag.ts (soft), shared UI primitives in src/components/ui/*.
3. All 8 new SQLite tables are ADDITIVE via idempotent CREATE TABLE IF NOT EXISTS in src/lib/db.ts init. Never modify existing tables.
4. BIDIRECTIONAL INDEPENDENCE: LINAW never reads LIKHA tables/routes/services, and LIKHA never reads LINAW. LINAW owns its own library table (linaw_ordinances), its own ingestion (bulk text import, scan upload via src/lib/linaw/ocr.ts, manual entry), its own verification panel, and its own BM25 namespace. Interoperability is ONLY via explicit user-triggered export/import packages (L1 interchange routes, Should-haves). Pattern duplication (two OCR wrappers, two verification panels) is intentional — independence over DRY.
5. Every AI legal decision pauses for human confirmation (HITL) and every agent action + human decision is logged to agent_decisions.

## Overview
Add /likha and /linaw portal pages with agentic pipeline UI (6 glowing agent cards each, sequential processing with delays, activity feed with Confirm/Edit) backed by real API routes: LIKHA uploads scanned ordinance PDFs/images, OCRs them via a module-owned OpenRouter wrapper, parses metadata with LLM, verifies with a human side-by-side panel, publishes to a BM25-searchable archive; LINAW brings an ordinance corpus into its OWN library (bulk text import, scan upload via its own OCR wrapper, or manual entry with its own verification panel), then inventories that library, classifies ordinances into Code Titles/Chapters, scans amendment/repeal cross-references, detects conflicts, collects human confirmations, and assembles a hierarchical Code of Ordinances with TOC. The two modules share nothing at the data layer — each is sellable standalone.

## Tech Stack
- Next.js 15.3.8 (App Router) + TypeScript 5
- React 19 + shadcn/ui components + lucide-react icons
- Tailwind CSS (design tokens from DESIGN.md)
- better-sqlite3 (additive tables)
- OpenRouter via existing src/lib/ai/llm.ts; OCR models google/gemini-2.5-flash (PDF) and qwen/qwen3.7-plus (image), temperature 0, 60s timeout
- BM25 search via module-owned index namespaces (LIKHA archive namespace and LINAW library namespace, siblings of src/lib/data/search-index.json); LightRAG optional soft-dependency with BM25 fallback

## Color Palette
- Background: #0F1729 (dark navy) | Background Secondary: #1E293B (slate)
- Accent Primary: #0038A8 (Philippine Blue; white text only, 9.9:1) | Accent AI: #22D3EE (cyan)
- Text: #FFFFFF, #94A3B8 (text-safe on both backgrounds)
- LIKHA agents: 1 Ingestor #F59E0B · 2 OCR Extractor #10B981 · 3 Metadata Parser #8B5CF6 (text uses #A78BFA) · 4 Subject Classifier #0EA5E9 · 5 Legal Validator #F43F5E · 6 Archiver #6366F1 (text uses #A5B4FC)
- LINAW agents: 1 Inventory Analyst #F59E0B · 2 Code Classifier #8B5CF6 (text #A78BFA) · 3 Cross-Reference Scanner #10B981 · 4 Conflict Detector #F43F5E · 5 Relationship Reviewer #22D3EE · 6 Code Assembler #6366F1 (text #A5B4FC)
- Semantic: success #22C55E · warning #FACC15 · error #F87171 · hitl #F43F5E

## Project Structure
Create these files (all paths relative to repo root):
- src/app/(portal)/likha/page.tsx - LIKHA module page (tabs: Archive Browser / Upload & Digitize / Classification)
- src/app/(portal)/linaw/page.tsx - LINAW module page (tabs: Library & Ingestion / Inventory / Classification / Relationships / Code Assembly)
- src/app/api/likha/upload/route.ts - POST multipart upload (≤10 files, 20 MB each)
- src/app/api/likha/archive/route.ts - GET list/search, PUT :id verify/update
- src/app/api/likha/classify/route.ts - POST AI subject classification
- src/app/api/likha/stats/route.ts - GET archive statistics
- src/app/api/likha/export-package/route.ts - POST L1 interchange bundle (Should): manifest + records + package hash
- src/app/api/linaw/upload/route.ts - POST multipart scan upload (≤10 files, 20 MB each) via module-owned OCR
- src/app/api/linaw/import/route.ts - POST bulk text import (JSON/CSV/DOCX, ≤500 records)
- src/app/api/linaw/library/route.ts - GET list/search, PUT create (manual entry) / :id verify-update
- src/app/api/linaw/inventory/route.ts - GET inventory + gap analysis (reads linaw_ordinances only)
- src/app/api/linaw/classify/route.ts - POST batch code classification, PUT :id override
- src/app/api/linaw/detect-relationships/route.ts - POST cross-reference + conflict scan
- src/app/api/linaw/relationships/route.ts - GET list, PUT :id confirm/reject
- src/app/api/linaw/assemble/route.ts - POST code volume assembly
- src/app/api/linaw/code/route.ts - GET :id code volume
- src/app/api/linaw/export-package/route.ts - POST L1 interchange bundle (Should): manifest + records + relationships + package hash
- src/components/agent-pipeline.tsx - Shared horizontal pipeline visualization
- src/components/agent-card.tsx - Shared agent card with glow/pulse
- src/components/activity-feed.tsx - Shared activity feed with Confirm/Edit/HITL
- src/components/likha/upload-dropzone.tsx - Drag-drop multi-file upload
- src/components/likha/verification-panel.tsx - Side-by-side HITL verification dialog
- src/components/likha/archive-browser.tsx - Search + filters + result cards
- src/components/likha/classification-editor.tsx - Subject classification UI
- src/components/linaw/library-ingestion.tsx - Bulk import + scan upload + manual entry into LINAW's own library
- src/components/linaw/library-verification.tsx - LINAW's own pending_review verification panel (approve/reject/edit)
- src/components/linaw/inventory-dashboard.tsx - Completeness + gaps dashboard (reads linaw_ordinances only)
- src/components/linaw/relationship-review.tsx - Relationship confirmation UI
- src/components/linaw/conflict-panel.tsx - Side-by-side conflict comparison
- src/components/linaw/code-assembly.tsx - Structure editor + TOC preview
- src/lib/likha/ocr.ts - Module-owned OpenRouter multimodal OCR wrapper
- src/lib/likha/agents.ts - LIKHA 6-agent pipeline runner
- src/lib/likha/prompts.ts - LIKHA-owned prompt templates
- src/lib/likha/search.ts - BM25 index namespace management
- src/lib/likha/export.ts - DILG export + L1 interchange package builder
- src/lib/linaw/ocr.ts - Module-owned OpenRouter OCR wrapper (zero imports from likha/, obra/, ella/, yala/)
- src/lib/linaw/agents.ts - LINAW 6-agent pipeline runner
- src/lib/linaw/prompts.ts - LINAW-owned prompt templates
- src/lib/linaw/search.ts - LINAW BM25 library namespace management
- src/lib/linaw/export.ts - Code JSON/TOC export + L1 interchange package builder
- src/types/likha.ts + src/types/linaw.ts - Module interfaces
Additional edits (additive only): src/lib/db.ts (8 new tables), portal header nav (add LIKHA + LINAW links), src/app/globals.css (glow/pulse utilities).
Do NOT create voice-input.tsx, use-voice.ts, or any audio/speech features — not required.

## Components

### Upload Dropzone (LIKHA input method: file upload)
- Drag-drop + browse; accept application/pdf, image/jpeg, image/png; max 10 files, 20 MB each
- Per-file progress rows with status: queued | ingesting | ocr | parsing | verifying | published | error
- Disabled while a pipeline run is active; MIME validation before upload; shows duplicate-hash warning inline

### Agent Pipeline
- Horizontal flow: Brain icon (cyan glow while processing) -> 6 agent cards -> Database icon (green glow on completion); arrows between elements; rose Hand pause icon over the arrow where HITL fires; wraps on mobile maintaining order

### Agent Card (CRITICAL STYLING)
- Fixed height h-56 (224px), uniform for all cards
- Number badge: circular, positioned -top-3 -left-3 with agent number
- Status icon top-right: Loader2 spinning (processing) / Check (completed) / AlertTriangle (error) / Hand (hitl)
- Bot icon centered on agent-color background at 20% opacity
- Agent name bold centered; description centered flex-1 text-xs
- Output section: fixed h-8 at bottom, border-top separator, shows output preview ONLY when status === 'completed'
- Glow: box-shadow matching agent color while processing; pulse: opacity 1 -> 0.6 -> 1, 1.5s ease-in-out infinite
- Respect prefers-reduced-motion: disable pulse/glow animation, keep status icons

Agent definitions (LIKHA pipeline, total 7400ms):
| ID | Name | Color | Delay |
| 1 | Ingestor | #F59E0B | 1000ms |
| 2 | OCR Extractor | #10B981 | 1600ms |
| 3 | Metadata Parser | #8B5CF6 | 1400ms |
| 4 | Subject Classifier | #0EA5E9 | 1200ms |
| 5 | Legal Validator | #F43F5E | 1200ms |
| 6 | Archiver | #6366F1 | 1000ms |

Agent definitions (LINAW pipeline, total 7900ms):
| ID | Name | Color | Delay |
| 1 | Inventory Analyst | #F59E0B | 1100ms |
| 2 | Code Classifier | #8B5CF6 | 1300ms |
| 3 | Cross-Reference Scanner | #10B981 | 1600ms |
| 4 | Conflict Detector | #F43F5E | 1500ms |
| 5 | Relationship Reviewer | #22D3EE | 1100ms |
| 6 | Code Assembler | #6366F1 | 1300ms |

### Activity Feed
- Empty state: "No activities yet. Start a pipeline to see results."
- Cards with left border: success=green, warning=yellow, error=red, hitl=rose; icon + title + right-aligned timestamp
- Pending/HITL items show Confirm (green) + Edit (gray) buttons; Edit opens inline form with editable fields: ordinanceNumber, seriesYear, title, sectionCount, subject, status
- Confirmed badge: green pill with checkmark; rejected items show reason; scrollable max-h container

### Verification Panel (LIKHA HITL dialog)
- Side-by-side: original scan (zoom/rotate) | extracted text with editable fields (ordinanceNumber, seriesYear, title, sectionCount, subjects multi-select)
- Per-field confidence display; any field <0.7 renders rose with agent note
- Actions: Reject / Edit & Save / Approve & Publish; reason required on reject; focus-trapped, Esc closes, keyboard operable

### LINAW Library Ingestion (LINAW input methods: bulk import / scan upload / manual entry)
- Three input modes in one panel: (a) Bulk import — paste/upload JSON/CSV/DOCX, ≤500 records, preview table with duplicate detection on (ordinanceNumber, seriesYear); (b) Scan upload — drag-drop ≤10 PDF/JPG/PNG ≤20 MB each, per-file progress through LINAW's OWN OCR wrapper (src/lib/linaw/ocr.ts); (c) Manual entry — form with ordinanceNumber, seriesYear, title, content, subject tags
- Imported/uploaded records land in linaw_ordinances as pending_review (scans: processing → pending_review after OCR)
- LINAW's own verification queue: review card per record (scan vs extracted text where available), Approve → library_status='ready', Reject with reason; decisions logged
- Zero references to LIKHA: no likha/ imports, no archived_ordinances reads — this panel works even when LIKHA is not installed

### LINAW screens
- Inventory dashboard: completeness score bar, counts by status/subject, year-gap list, per-year bar chart (SVG, no chart lib)
- Relationship review: pending list with confidence; evidence side-by-side panel; Confirm / Edit type+sections / Reject with reason
- Conflict panel: two ordinance excerpts side by side with flagged passages highlighted
- Code assembly: drag-to-reorder Title/Chapter tree, TOC preview pane, AI summary review queue, Export JSON (PDF/DOCX export is post-MVP toggle)

## Interactive Behaviors (Agent Pipeline Logic)

LIHKA pipeline is triggered per uploaded batch; LINAW ingestion is triggered per import/upload/manual-entry action, and the LINAW pipeline is triggered per action button over LINAW's OWN ready library (linaw_ordinances with library_status='ready'). Both run sequentially per agent: onAgentStart -> delay (UI simulation) -> real async work (OCR/LLM may exceed delay; UI shows spinner on the active agent while work continues) -> onAgentComplete.

Data processing rules:
- File hash (SHA-256) computed before OCR; duplicate hash -> warning + link to existing record, skip OCR
- LINAW ingestion: bulk import/scan upload/manual entry write to linaw_ordinances (source_type import|scan|manual); duplicates rejected on (ordinance_number, series_year); pipeline agents see only library_status='ready' records
- OCR: PDF -> google/gemini-2.5-flash, image -> qwen/qwen3.7-plus, temperature 0, 60s timeout, one retry (each module owns its own wrapper)
- Metadata extraction returns JSON {ordinanceNumber, seriesYear, title, sectionCount, confidence per field}
- Classification maps to the 13 Code Titles taxonomy + module subject categories; returns [{label, confidence}]
- Cross-reference scanner regex/LLM pass finds "amending/repealing/pursuant to Ordinance No. X, S. YYYY" and resolves to linaw_ordinances ids; unresolved -> orphan warning
- Archiver and Code Assembler execute ONLY after human confirmation of pending HITL items

Exception flagging rules:
- OCR timeout after retry -> error card + HITL manual entry
- Missing ordinance number or confidence <0.7 -> HITL gate (verification panel)
- Classification confidence <0.6 -> HITL override dropdown
- Orphan cross-reference -> warning; conflicting statuses on one ordinance -> error requiring human resolution
- Relationship confidence <0.6 -> HITL with side-by-side evidence

Callbacks:
- onAgentStart(agentId): status 'processing', glow + pulse
- onAgentComplete(agentId, output): status 'completed' with preview; if output.hitlRequired -> status 'hitl', pause
- onHitlRequired(agentId, hitlItem): rose HITL card in feed; pipeline paused
- onHumanDecision(hitlId, decision, data, reason): persist to agent_decisions; confirm/edit resumes, reject terminates branch
- onPipelineComplete(result): isProcessing=false, output icon glows green, success activity added
- onError(agentId, error): error card, one retry, then HITL escalation

## State Management

// per-module page state
agents: AgentState[]          // 6 agents, statuses idle|processing|completed|error|hitl
activities: ActivityItem[]    // feed items pending|confirmed|editing|rejected
hitlQueue: HitlItem[]         // open human decisions
isProcessing: boolean         // pipeline lock

Functions: runLikhaPipeline(batchId), runLinawPipeline(action, ordinanceIds), importToLibrary(payload), uploadToLibrary(files), createManualRecord(fields), verifyLibraryRecord(id, action, reason), handleConfirm(activityId), handleEdit(activityId, data), handleReject(activityId, reason), resetAgents()

## Types

interface AgentState {
  id: number;
  name: string;
  module: 'likha' | 'linaw';
  description: string;
  status: 'idle' | 'processing' | 'completed' | 'error' | 'hitl';
  color: string;
  glowClass: string;
  output?: AgentOutput;
}

interface AgentOutput {
  // LIKHA
  fileHash?: string;
  rawText?: string;
  ordinanceNumber?: string;
  seriesYear?: number;
  title?: string;
  sectionCount?: number;
  subjects?: Array<{ label: string; confidence: number }>;
  confidence?: number;
  // LINAW
  completenessScore?: number;
  yearGaps?: Array<{ year: number; missing: number[] }>;
  codePlacement?: { titleNumber: number; chapterNumber: number; articleNumber?: number; confidence: number };
  relationships?: Array<{ sourceId: string; targetId: string; type: RelationshipType; sectionRef?: string; confidence: number }>;
  conflicts?: Array<{ ordinanceAId: string; ordinanceBId: string; reason: string; confidence: number }>;
  toc?: CodeTocNode[];
  codeVolumeId?: string;
  // common
  success?: boolean;
  hitlRequired?: boolean;
  exceptions?: string[];
}

type RelationshipType = 'amends' | 'repeals' | 'partial_repeal' | 'supersedes' | 'extends' | 'implements';

interface ActivityItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'hitl';
  status: 'pending' | 'confirmed' | 'editing' | 'rejected';
  title: string;
  details: string;
  timestamp: string;
  data?: AgentOutput;
  userId?: string;
  reason?: string;
}

interface HitlItem {
  id: string;
  activityId: string;
  agentId: number;
  module: 'likha' | 'linaw';
  gate: 'low_confidence_metadata' | 'low_confidence_classification' | 'detected_relationship' | 'code_placement' | 'final_code_export';
  fieldSchema: Record<string, { type: 'text' | 'number' | 'select' | 'multiselect'; label: string; value: unknown }>;
  suggestedAction: 'confirm' | 'reject' | 'edit';
  context: AgentOutput;
}

interface ArchivedOrdinance {
  id: string; ordinanceNumber: number; seriesYear: number; title: string; content: string;
  summary?: string; subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  archiveStatus: 'processing' | 'pending_review' | 'published' | 'flagged';
  scanFilePath?: string; fileHash?: string; uploadedById: string; verifiedById?: string;
  createdAt: string; updatedAt: string;
}

interface LinawOrdinance {
  id: string; ordinanceNumber: number; seriesYear: number; title: string; content: string;
  summary?: string; subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  sourceType: 'scan' | 'import' | 'manual';
  sourceFilename?: string; fileHash?: string;
  libraryStatus: 'processing' | 'pending_review' | 'ready' | 'rejected';
  uploadedById: string; verifiedById?: string;
  createdAt: string; updatedAt: string;
}

interface CodificationRecord {
  id: string; ordinanceId: string; titleNumber?: number; chapterNumber?: number; articleNumber?: number;
  sectionInCode?: number; codStatus: 'unclassified' | 'classified' | 'reviewed' | 'approved' | 'codified';
  aiSuggestion?: string; humanOverride?: string; reviewedById?: string; approvedById?: string; approvedAt?: string;
}

interface OrdinanceRelationship {
  id: string; sourceId: string; targetId: string; type: RelationshipType;
  sectionRef?: string; confidence: number; confirmed: 0 | 1; confirmedById?: string; createdAt: string;
}

interface CodeVolume {
  id: string; title: string; edition: string; status: 'draft' | 'under_review' | 'published';
  structure: string; generatedById?: string; publishedAt?: string; createdAt: string;
}

type CodeTocNode = { title: string; chapters: Array<{ name: string; articles?: Array<{ name: string; sections: Array<{ id: string; ordinanceId: string; label: string }> }> } };

interface AgentDecision {
  id: string; module: 'likha' | 'linaw'; pipelineId: string; agentId: number; agentName: string;
  action: 'start' | 'complete' | 'hitl' | 'confirm' | 'reject' | 'error';
  inputSnapshot?: string; outputSnapshot?: string; confidence?: number;
  userId?: string; reason?: string; createdAt: string;
}

API response envelopes: success -> resource JSON; error -> { error: string, code?: string } with 400/401/404/409/500. List routes accept ?page=&limit=.

## CSS Animations (globals.css — append, do not replace)

:root { --bg-primary: #0F1729; --bg-secondary: #1E293B; --text-primary: #FFFFFF; --text-secondary: #94A3B8; --accent-primary: #0038A8; --accent-ai: #22D3EE; }

.glow-amber   { box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
.glow-emerald { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
.glow-violet  { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
.glow-sky     { box-shadow: 0 0 20px rgba(14, 165, 233, 0.3); }
.glow-rose    { box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
.glow-indigo  { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
.glow-cyan    { box-shadow: 0 0 30px rgba(34, 211, 238, 0.4); }

@keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
.animate-pulse-glow { animation: pulse-glow 1.5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .animate-pulse-glow { animation: none; } }

No recording/voice animations — voice is not a requirement.

## Key Behaviors

1. When Maria uploads files: validate -> POST /api/likha/upload -> run LIKHA pipeline (reset agents, isProcessing=true) -> each agent start -> delay -> complete -> any HITL pauses for human -> Archiver publishes on approval -> success activity.
2. When an agent card is 'completed', show its output preview: 1 "Files validated & hashed" / 2 "Text extracted" / 3 "Metadata parsed" / 4 "Subjects suggested" / 5 "Validation complete" / 6 "Published to archive" (LIKHA); 1 "Inventory analyzed" / 2 "Code placement assigned" / 3 "Relationships detected" / 4 "Conflicts flagged" / 5 "Awaiting human review" / 6 "Code assembled" (LINAW).
3. When the user clicks Confirm on a HITL activity: mark confirmed, persist decision (agent_decisions + domain table), resume pipeline, reset upstream agents to idle after completion.
4. When the user clicks Edit: inline form pre-filled with extraction; save updates data, marks confirmed, resumes.
5. When the user clicks Reject: require reason, log it, terminate that branch; nothing publishes without approval.
6. LINAW actions read ONLY linaw_ordinances records with library_status='ready' — NEVER archived_ordinances or any LIKHA route/service; confirmed repeals update the source ordinance status in linaw_ordinances.
7. Search (archive browser): GET /api/likha/archive?q= with BM25, <500ms, highlighted snippets, filters yearFrom/yearTo/status/subject.
8. All writes log via src/lib/logger.ts with module='likha'|'linaw'.
9. When Atty. Jose ingests the corpus: bulk import (POST /api/linaw/import, ≤500 records) or scan upload (POST /api/linaw/upload, own OCR) or manual entry (PUT /api/linaw/library) -> records land as pending_review -> LINAW's own verification panel approves them to library_status='ready' -> inventory/classification agents can see them.
10. L1 interchange (Should): POST /api/likha/export-package and POST /api/linaw/export-package emit JSON bundles {manifest, records[, relationships], packageHash} for future LINYA import; import endpoints are post-MVP.
11. Boundary check: grepping src/lib/linaw/ and src/app/api/linaw/ for 'likha' or 'archived_ordinances' returns nothing, and grepping src/lib/likha/ and src/app/api/likha/ for 'linaw' or 'linaw_ordinances' returns nothing.

## Database (add to src/lib/db.ts init — additive, idempotent)

CREATE TABLE IF NOT EXISTS archived_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'scan', original_filename TEXT, scan_file_path TEXT, file_hash TEXT, archive_status TEXT DEFAULT 'processing' CHECK(archive_status IN ('processing','pending_review','published','flagged')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, dilg_submitted INTEGER DEFAULT 0, dilg_submitted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
CREATE INDEX IF NOT EXISTS idx_arch_ord_year ON archived_ordinances(series_year);
CREATE INDEX IF NOT EXISTS idx_arch_ord_status ON archived_ordinances(status);
CREATE INDEX IF NOT EXISTS idx_arch_ord_astat ON archived_ordinances(archive_status);

CREATE TABLE IF NOT EXISTS classifications ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL, category TEXT NOT NULL, confidence REAL, assigned_by TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id) ON DELETE CASCADE );

CREATE TABLE IF NOT EXISTS amendment_links ( id TEXT PRIMARY KEY, amending_id TEXT NOT NULL, amended_id TEXT NOT NULL, relationship_type TEXT NOT NULL, detected_by TEXT NOT NULL, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(amending_id) REFERENCES archived_ordinances(id), FOREIGN KEY(amended_id) REFERENCES archived_ordinances(id) );

CREATE TABLE IF NOT EXISTS agent_decisions ( id TEXT PRIMARY KEY, module TEXT NOT NULL, pipeline_id TEXT NOT NULL, agent_id INTEGER NOT NULL, agent_name TEXT NOT NULL, action TEXT NOT NULL, input_snapshot TEXT, output_snapshot TEXT, confidence REAL, user_id TEXT, reason TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE INDEX IF NOT EXISTS idx_agent_dec_pipeline ON agent_decisions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_agent_dec_module ON agent_decisions(module, created_at);

CREATE TABLE IF NOT EXISTS linaw_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('scan','import','manual')), source_filename TEXT, file_hash TEXT, library_status TEXT DEFAULT 'pending_review' CHECK(library_status IN ('processing','pending_review','ready','rejected')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
CREATE INDEX IF NOT EXISTS idx_linaw_ord_year ON linaw_ordinances(series_year);
CREATE INDEX IF NOT EXISTS idx_linaw_ord_lstat ON linaw_ordinances(library_status);

CREATE TABLE IF NOT EXISTS codification_records ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL UNIQUE, title_number INTEGER, chapter_number INTEGER, article_number INTEGER, section_in_code INTEGER, cod_status TEXT DEFAULT 'unclassified' CHECK(cod_status IN ('unclassified','classified','reviewed','approved','codified')), ai_suggestion TEXT, human_override TEXT, reviewed_by_id TEXT, approved_by_id TEXT, approved_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(reviewed_by_id) REFERENCES users(id), FOREIGN KEY(approved_by_id) REFERENCES users(id) );

CREATE TABLE IF NOT EXISTS ordinance_relationships ( id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, relationship_type TEXT NOT NULL, section_ref TEXT, confidence REAL NOT NULL, confirmed INTEGER DEFAULT 0, confirmed_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(source_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(target_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(confirmed_by_id) REFERENCES users(id) );
CREATE INDEX IF NOT EXISTS idx_ord_rel_source ON ordinance_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_ord_rel_target ON ordinance_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_ord_rel_type ON ordinance_relationships(relationship_type);

CREATE TABLE IF NOT EXISTS code_volumes ( id TEXT PRIMARY KEY, title TEXT NOT NULL, edition TEXT NOT NULL, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','under_review','published')), structure TEXT NOT NULL, generated_at TEXT, published_at TEXT, generated_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(generated_by_id) REFERENCES users(id) );

## Run Configuration
- Development: npm run dev (existing pillar-pilot dev server)
- Route paths: /likha and /linaw under the existing portal auth
- Production target: Hostinger VPS, container pillar-pilot (existing compose; additive only)

Generate all files with complete, working code. Use 'use client' for interactive components. Keep all module code inside likha/ and linaw/ namespaces. Ensure consistent styling per DESIGN.md and proper layout at 360px / 768px / 1280px.
```

---

## Usage Instructions (BUILD phase)

1. @instruct_agent slices this PRP into sprint-sized instruction chunks per docs/SPRINT_PLAN.md (created in Phase 0 of BUILD).
2. @make_agent executes chunks with TDD; one git commit per feature (`feat: implement [Feature] pillar-likha-linaw-20260809`).
3. Linter runs per feature (Rule 20); modular-independence boundary is verified per sprint by grepping for forbidden import paths AND for cross-module references in both directions (likha↔linaw).

---

## Verification Checklist

After generation, verify:

- [ ] LIKHA upload accepts 1–10 PDF/JPG/PNG files ≤20 MB with per-file progress; batch completes without timeout
- [ ] OCR wrapper lives at src/lib/likha/ocr.ts, calls OpenRouter directly (gemini-2.5-flash PDF / qwen-3.7-plus image), ≤60s, zero obra/ imports
- [ ] Metadata extraction persists to archived_ordinances; ≥80% accuracy on clear first pages (pilot batch)
- [ ] Verification panel shows scan vs text side-by-side; Approve/Edit/Reject logged with user + timestamp
- [ ] Approval publishes record + BM25 index entry; search <500ms with highlighted snippets; filters work
- [ ] LIKHA pipeline: 6 agents, h-56 cards, glow+pulse on processing, delays 1000/1600/1400/1200/1200/1000ms
- [ ] LINAW bulk import accepts JSON/CSV/DOCX (≤500 records) into linaw_ordinances as pending_review; duplicates on (ordinance_number, series_year) rejected
- [ ] LINAW scan upload (≤10 files ≤20 MB) runs src/lib/linaw/ocr.ts (zero imports from likha/, obra/, ella/, yala/) within 60s; LINAW's own verification panel approves records to library_status='ready'
- [ ] LINAW inventory shows totals, year/status/subject counts, numbering gaps, completeness score from linaw_ordinances only; refresh ≤2s
- [ ] Classification assigns Title/Chapter with confidence; human override persists to codification_records
- [ ] Cross-reference scanner stores relationships; ≥70% precision on explicit references (pilot batch)
- [ ] Conflict detection renders side-by-side evidence with confidence
- [ ] Every detected relationship/conflict requires human confirm/reject with reason; confirmed repeals update status
- [ ] Code assembler produces Titles → Chapters → Articles → Sections JSON + TOC preview
- [ ] All 12 agent cards uniform h-56 with number badges, status icons, border-top output section
- [ ] HITL gates pause pipeline; rose styling; decisions persisted to agent_decisions
- [ ] Confirm/Edit/Reject flows work in activity feed; confirmed badge renders
- [ ] Zero forbidden imports (grep: src/app/api/obra, src/app/api/chat, src/lib/ai/prompts, obra-export)
- [ ] Bidirectional independence (grep): no 'likha' or 'archived_ordinances' inside src/lib/linaw/ and src/app/api/linaw/; no 'linaw' or 'linaw_ordinances' inside src/lib/likha/ and src/app/api/likha/
- [ ] L1 interchange (Should): /api/likha/export-package and /api/linaw/export-package return JSON bundles with manifest + package hash
- [ ] All 8 tables created idempotently; existing tables untouched
- [ ] Responsive at 360px / 768px / 1280px; touch targets ≥44px below 1024px; keyboard-operable HITL dialogs
- [ ] No TypeScript errors; lint passes; only required features present (no voice, no payments, no public portal)
<!-- ARCHETYPE:QUALITY_CHECKLIST merged above; domain: gov terminology applied (constituents, SB, DILG) -->

---

*Prepared by QoderWork (@prp_generator procedure) — PILLAR Likha + Linaw, Super PRIME v3.3 (Expanded, agentic, gov)*
