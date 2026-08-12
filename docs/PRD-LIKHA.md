# Product Requirements Document (PRD) — LIKHA
## PILLAR-pilot Smart Legislation Platform — LIKHA Module
### Legislative Insight & Knowledge Hub for Archives

**Version:** v3.3 Expanded (Super PRIME) — Module PRD v2.1 (split edition)
**Date:** August 9, 2026
**Author:** QoderWork — PILLAR Smart Legislation Team
**Status:** Draft for Review
**Session:** pillar-likha-linaw-20260809
**Archetype:** agentic-workflow (resolved per Rule 24: flag → agentic)
**Domain:** gov (Philippine LGU, gov-pack overlay per Rule 26)
**Inputs:** docs/IDEA-REPORT.md (opportunity 88/100), docs/LIKHA-LINAW-Modular-Independence-Audit.md (v2, PASS — bidirectional), docs/DESIGN.md, docs/INTERCHANGE-SPEC.md

> **Module scope & independence:** This PRD covers LIKHA only. LIKHA is a fully standalone module and SKU: it has zero code imports from and zero data reads of any other PILLAR module. Its only touchpoint with the outside world beyond shared platform primitives is the L1 file-interchange export defined in `docs/INTERCHANGE-SPEC.md`. Shared agentic UI kit visuals are canonical in `docs/DESIGN.md`.

---

## 1. Executive Summary

L.I.K.H.A. (Legislative Insight & Knowledge Hub for Archives) is a standalone, agentic-workflow module for the PILLAR-pilot platform that digitizes, indexes, and safeguards municipal ordinances for Sangguniang Bayan (SB) offices.

LIKHA turns paper and scanned ordinances into a searchable, auditable digital archive. It runs inside the existing Next.js 15.3.8 monolith on Hostinger VPS but is fully standalone: it owns its own data tables, ingestion, verification, search namespace, agents, prompts, and export logic, importing only shared platform primitives (LLM client, DB handle, auth middleware, logger) and never reading any other module's tables. Interoperability is by explicit user-triggered file interchange only (`docs/INTERCHANGE-SPEC.md`), keeping LIKHA sellable as an independent SKU.

**Value Proposition:** A municipal SB secretary can drag a box of scanned ordinances into LIKHA, have AI agents extract and classify each record with human verification, and build the municipality's permanent, DILG-compliant digital archive — with no other module required.

---

## 2. Problem Statement

Municipal LGUs in the Philippines manage decades of paper ordinances that are unindexed, deteriorating, and difficult to retrieve. This leads to:
- **Lost institutional memory:** 349+ ordinances from 1989–2025 are unindexed and at risk from flood, fire, or termites.
- **Slow legal retrieval:** SB staff spend hours locating ordinances during sessions or legal reviews.
- **Manual DILG compliance:** Encoding submissions for DILG MC 2026-041 (e-Legis Reference System) and RA 12254 (E-Governance Act) are overwhelming.
- **No durable digital record:** Without a verified archive, downstream legal work (codification, lineage tracing) has no trustworthy source.

---

## 3. Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| **Maria — SB Secretary** | Records officer for the Sangguniang Bayan of Pitogo, Quezon | Digitize, index, retrieve, and export ordinance records quickly and safely |
| **Atty. Jose — SB Member / Legal Officer** | Sangguniang Bayan member and legal reviewer | Retrieve verified ordinance texts and metadata for legal review |
| **Elena — Municipal Citizen** | Resident checking local business permit or tax rules | Search active ordinances online in plain language |

---

## 4. Technical Specifications

### 4.1 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 15.3.8 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x / 4.x |
| UI Components | shadcn/ui + shared agentic kit | Latest |
| Icons | lucide-react | Latest |
| Database | SQLite (better-sqlite3) | 11.x |
| LLM Client | OpenRouter (module-owned wrapper) | Via `src/lib/ai/llm.ts` |
| OCR | OpenRouter multimodal | `google/gemini-2.5-flash` (PDFs), `qwen/qwen3.7-plus` (images) |
| Search | BM25 fallback + optional LightRAG | LIKHA-owned index namespace |
| Auth | Existing PILLAR auth middleware | `src/lib/user-auth-middleware.ts` |
| Logging | Existing PILLAR logger | `src/lib/logger.ts` with `module='likha'` |

> **Note:** LIKHA owns its own prompts, agents, export logic, and API routes. It does not import from `obra/`, `ella/`, `yala/`, or any other PILLAR module.

### 4.2 Project Structure (Agentic)

```
PILLAR-pilot/
├── src/
│   ├── app/
│   │   ├── (portal)/
│   │   │   └── likha/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── likha/
│   │   │       ├── upload/route.ts
│   │   │       ├── archive/route.ts
│   │   │       ├── classify/route.ts
│   │   │       ├── stats/route.ts
│   │   │       ├── export-dilg/route.ts
│   │   │       └── export-package/route.ts
│   │   └── globals.css
│   ├── components/
│   │   ├── agent-pipeline.tsx        # shared agentic UI kit (spec: DESIGN.md)
│   │   ├── agent-card.tsx            # shared agentic UI kit
│   │   ├── activity-feed.tsx         # shared agentic UI kit
│   │   └── likha/
│   │       ├── upload-dropzone.tsx
│   │       ├── verification-panel.tsx
│   │       ├── archive-browser.tsx
│   │       └── classification-editor.tsx
│   ├── lib/
│   │   ├── likha/
│   │   │   ├── ocr.ts
│   │   │   ├── agents.ts
│   │   │   ├── prompts.ts
│   │   │   ├── search.ts
│   │   │   └── export.ts
│   │   ├── ai/llm.ts                 # shared platform primitive
│   │   ├── db.ts                     # shared platform primitive
│   │   ├── logger.ts                 # shared platform primitive
│   │   └── user-auth-middleware.ts   # shared platform primitive
│   └── types/
│       └── likha.ts
├── docs/
│   ├── PRD-LIKHA.md
│   ├── INTERCHANGE-SPEC.md
│   └── LIKHA-LINAW-Modular-Independence-Audit.md
└── package.json
```

---

## 5. Color System (Agentic + Gov)

| Element | Color | Hex Code |
|---------|-------|----------|
| Background Primary | Dark Navy | #0F1729 |
| Background Secondary | Slate | #1E293B |
| Text Primary | White | #FFFFFF |
| Text Secondary | Slate 400 | #94A3B8 |
| Accent Primary | Philippine Blue | #0038A8 |
| Accent AI | Cyan | #22D3EE |
| Agent 1 — Ingestor | Amber | #F59E0B |
| Agent 2 — OCR Extractor | Emerald | #10B981 |
| Agent 3 — Metadata Parser | Violet | #8B5CF6 (text-safe #A78BFA) |
| Agent 4 — Subject Classifier | Sky | #0EA5E9 |
| Agent 5 — Legal Validator | Rose | #F43F5E |
| Agent 6 — Archiver | Indigo | #6366F1 (text-safe #A5B4FC) |

> **Note:** Each agent has a distinct color for glow effects in the pipeline visualization. HITL gates render in rose/red when awaiting human approval.

---

## 6. Feature Requirements

### 6.1 Input Components

#### Upload Dropzone Component

**File:** `src/components/likha/upload-dropzone.tsx`

| Requirement | Description |
|-------------|-------------|
| Drag-and-drop | Accept PDF, JPG, PNG up to 20 MB per file |
| Multi-file | Up to 10 files per batch |
| Progress | Per-file progress bar and status (queued / OCR / verifying / done / error) |
| Disabled State | Disable during active agent pipeline |
| Validation | Reject unsupported MIME types before upload |

#### Search Input Component

**File:** `src/components/likha/archive-browser.tsx` (embedded)

| Requirement | Description |
|-------------|-------------|
| Full-text search | BM25-powered query input with debounce |
| Filters | Year range, status (active/amended/repealed/superseded/expired), subject category |
| Disabled State | Disable while index is rebuilding |

### 6.2 Agent Pipeline Component (shared kit)

**File:** `src/components/agent-pipeline.tsx` — visual spec canonical in DESIGN.md

| Requirement | Description |
|-------------|-------------|
| Layout | Horizontal flow: Input Icon → Agent 1 → … → Agent N → Output Icon |
| Input Icon | Brain icon with cyan glow (#22D3EE) when processing |
| Output Icon | Database/target icon with green glow when all agents complete |
| Arrows | Right arrow icons between each element |
| HITL Gate | Rose pause icon appears between agents when human approval is required |
| Responsive | Wrap on smaller screens, maintain visual flow |

### 6.3 Agent Card Component (shared kit)

**File:** `src/components/agent-card.tsx`

| Requirement | Description |
|-------------|-------------|
| Fixed Height | h-56 (224px) uniform for all cards |
| Number Badge | Circular badge at top-left positioned -top-3 -left-3 with agent number |
| Status Icon | Top-right: Loader2 spinning (processing), Check (complete), AlertTriangle (error), Hand (paused for HITL) |
| Bot Icon | Centered robot/bot icon with agent color background at 20% opacity |
| Agent Name | Bold title below icon, centered |
| Description | Centered description text with flex-1 spacing to fill vertical space |
| Output Section | Fixed h-8 section at bottom with border-top separator, shows result preview |
| Glow Effect | Color-matched box-shadow glow when status is 'processing' |
| Pulse Animation | Opacity pulse (1 → 0.6 → 1) loop during processing state |

### 6.4 Activity Feed Component (shared kit)

**File:** `src/components/activity-feed.tsx`

| Requirement | Description |
|-------------|-------------|
| Empty State | "No activities yet. Start a pipeline to see results." |
| Activity Card | Left border color based on type: success=green, warning=yellow, error=red, hitl=rose |
| Status Icons | CheckCircle (success), AlertTriangle (warning), XCircle (error), Hand (hitl) |
| Timestamp | Right-aligned time display |
| Action Buttons | "Confirm" (green) and "Edit" (gray) buttons for HITL/pending activities |
| Edit Mode | Inline form with editable fields: ordinance number, series year, title, sections, subject, status |
| Confirmed Badge | Green pill badge with checkmark after confirmation |
| Scrollable | Max height container with overflow-y scroll |

### 6.5 LIKHA Agent Pipeline Logic

**File:** `src/lib/likha/agents.ts`

**Agent Processing Table:**

| Agent | Delay | Function |
|-------|-------|----------|
| 1. Ingestor | 1000ms | Validate upload, compute file hash, store raw file record |
| 2. OCR Extractor | 1600ms | Call module-owned OCR wrapper; return raw text and per-page metadata |
| 3. Metadata Parser | 1400ms | Extract ordinance number, series year, title, section count via LLM |
| 4. Subject Classifier | 1200ms | Suggest ≥1 subject category with confidence score |
| 5. Legal Validator | 1200ms | Flag low-confidence extractions, missing ordinance number, or unreadable scans |
| 6. Archiver | 1000ms | On human approval, publish record, cache hash, create BM25 index entry |

**Pipeline total: 7400ms** (within the 5–8s @workflow_designer guidance; real LLM/OCR latency is async outside the UI simulation delays).

**Data Processing Rules:**
- File hash is computed before OCR to detect duplicates.
- OCR wrapper uses `google/gemini-2.5-flash` for PDFs and `qwen/qwen3.7-plus` for images.
- Metadata extraction returns structured JSON with confidence scores.
- Classifier outputs subject labels mapped to Code Titles/Chapters.
- Validator raises HITL if any critical field confidence < 0.7 or file is unreadable.
- Archiver runs only after human confirmation; all edits are logged.

**Exception Flagging Rules:**
- Duplicate file hash → warning, skip OCR, surface existing record.
- OCR timeout (>60s) → error, retry once, then escalate to HITL.
- Missing ordinance number → HITL gate with manual entry form.
- Low classification confidence (<0.6) → HITL gate with override dropdown.

### 6.6 Agent Definitions

| ID | Name | Module | Description | Color | Glow Class | Delay |
|----|------|--------|-------------|-------|------------|-------|
| 1 | Ingestor | LIKHA | Validates uploads, computes hashes, stores raw files | #F59E0B | glow-amber | 1000ms |
| 2 | OCR Extractor | LIKHA | Extracts text from PDFs/images via OpenRouter | #10B981 | glow-emerald | 1600ms |
| 3 | Metadata Parser | LIKHA | Parses ordinance number, year, title, sections | #8B5CF6 | glow-violet | 1400ms |
| 4 | Subject Classifier | LIKHA | Suggests subject categories for archive retrieval | #0EA5E9 | glow-sky | 1200ms |
| 5 | Legal Validator | LIKHA | Flags low-confidence or invalid extractions | #F43F5E | glow-rose | 1200ms |
| 6 | Archiver | LIKHA | Publishes verified records and updates search index | #6366F1 | glow-indigo | 1000ms |

### 6.7 MVP Feature Requirements (LIKHA — 7 features)

1. **Batch upload of scanned ordinance PDFs/images**
   - Drag-and-drop up to 10 files, max 20 MB each.
   - Progress indicator per file.

2. **Module-owned OCR wrapper**
   - Path: `src/lib/likha/ocr.ts`.
   - Calls OpenRouter directly; PDFs → `google/gemini-2.5-flash`, images → `qwen/qwen3.7-plus`.
   - Returns text within 60 seconds.

3. **Auto-parse ordinance metadata**
   - Extract ordinance number, series year, title, section count.
   - Store in `archived_ordinances` table.

4. **Human verification side-by-side view**
   - Original scan on left, extracted text on right.
   - Editable fields and Approve/Edit/Reject actions.
   - All actions logged with user ID and timestamp.

5. **Publish to archive with BM25 index entry**
   - On approval, status changes to `published`, hash cached.
   - BM25 index entry created/updated in LIKHA's own namespace.

6. **Full-text archive browser with filters**
   - Search <500ms; filters by year, status, subject.
   - Highlight matched terms in snippets.

7. **AI-assisted subject classification**
   - Suggest ≥1 subject category with confidence score.
   - Admin override; stored with `assigned_by` field.

**Should-have (L1 interchange):** `POST /api/likha/export-package` emits the interchange JSON bundle per `docs/INTERCHANGE-SPEC.md` (manifest + records + package hash). Export-only in MVP; import is post-MVP.

---

## 7. User Flows

### 7.1 LIKHA Primary Flow

1. Maria navigates to the LIKHA module from the sidebar.
2. She drags a batch of scanned ordinance PDFs into the upload dropzone.
3. The Ingestor agent validates files and computes hashes.
4. The OCR Extractor agent calls the module-owned OCR wrapper.
5. The Metadata Parser agent extracts ordinance number, year, title, sections.
6. The Subject Classifier agent suggests categories.
7. The Legal Validator agent flags any low-confidence items.
8. If HITL is triggered, the pipeline pauses and Maria reviews side-by-side, then confirms or edits.
9. The Archiver agent publishes verified records and updates the BM25 index.
10. Records appear in the archive browser with full-text search.

### 7.2 HITL Review Flow

1. Agent raises a HITL gate (low confidence, missing field, or unreadable scan).
2. Activity feed shows a rose-bordered card with "Review Required".
3. User clicks "Review" to open side-by-side or inline edit form.
4. User edits fields, selects an action, and provides a reason.
5. User clicks "Confirm" or "Reject".
6. Pipeline resumes or terminates based on action; all decisions are logged in `agent_decisions`.

### 7.3 Edit Flow

1. User clicks "Edit" on a pending HITL activity.
2. Inline form appears with pre-filled extracted data.
3. User modifies fields as needed.
4. User saves; activity updates and shows "Confirmed" badge.
5. Agents reset to idle state; downstream pipeline can resume.

---

## 8. State Management

### 8.1 Application State

```typescript
// page.tsx state
agents: AgentState[]        // Pipeline agents with status: 'idle' | 'processing' | 'completed' | 'error' | 'hitl'
activities: ActivityItem[]  // Processed activities with pending/confirmed/editing/hitl status
isProcessing: boolean       // Pipeline lock - prevents concurrent submissions
hitlQueue: HitlItem[]       // Pending human approval items
```

### 8.2 AgentState Interface

```typescript
interface AgentState {
  id: number;
  name: string;
  module: 'likha';
  description: string;
  status: 'idle' | 'processing' | 'completed' | 'error' | 'hitl';
  color: string;
  glowClass: string;
  output?: AgentOutput;
}
```

### 8.3 AgentOutput Interface

```typescript
interface AgentOutput {
  fileHash?: string;
  rawText?: string;
  ordinanceNumber?: string;
  seriesYear?: number;
  title?: string;
  sectionCount?: number;
  subjects?: Array<{ label: string; confidence: number }>;
  confidence?: number;
  exceptions?: string[];
  success?: boolean;
  confirmation?: string;
  hitlRequired?: boolean;
}
```

### 8.4 ActivityItem / HitlItem Interfaces

```typescript
interface ActivityItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'hitl';
  status: 'pending' | 'confirmed' | 'editing' | 'rejected';
  title: string;
  details: string;
  timestamp: Date;
  data?: AgentOutput;
  userId?: string;
  reason?: string;
}

interface HitlItem {
  id: string;
  activityId: string;
  agentId: number;
  module: 'likha';
  fieldSchema: Record<string, { type: string; label: string; value: any }>;
  suggestedAction: 'confirm' | 'reject' | 'edit';
  context: AgentOutput;
}
```

---

## 9. CSS Requirements

### 9.1 Global Styles (globals.css)

**CSS Variables:**
- `--bg-primary: #0F1729`
- `--bg-secondary: #1E293B`
- `--text-primary: #FFFFFF`
- `--text-secondary: #94A3B8`
- `--accent-primary: #0038A8`
- `--accent-ai: #22D3EE`

**Glow Classes:**

```css
.glow-amber { box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
.glow-emerald { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
.glow-violet { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
.glow-sky { box-shadow: 0 0 20px rgba(14, 165, 233, 0.3); }
.glow-rose { box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
.glow-indigo { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
.glow-cyan { box-shadow: 0 0 30px rgba(34, 211, 238, 0.4); }
```

**Pulse Animation:**

```css
@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.animate-pulse-glow { animation: pulse-glow 1.5s ease-in-out infinite; }
```

---

## 10. Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| Mobile (<768px) | Stack agent cards vertically, simplified filters, hamburger sidebar |
| Tablet (768px–1024px) | 2-column layout for verification panels, horizontal pipeline wraps |
| Desktop (>1024px) | Full layout with sidebar, pipeline, activity feed, and detail panel |

---

## 11. Acceptance Criteria

### Core Functionality
- [ ] LIKHA upload accepts 1–10 files up to 20 MB each and shows per-file progress.
- [ ] OCR wrapper returns text within 60 seconds for supported file types.
- [ ] Metadata extraction achieves ≥80% accuracy on clearly scanned first pages.
- [ ] Side-by-side verification supports Approve/Edit/Reject with audit logging.
- [ ] BM25 search returns results in <500ms with highlighted snippets.

### Agent Pipeline
- [ ] 6 agents process sequentially with visible delays (1000/1600/1400/1200/1200/1000ms).
- [ ] Agent cards have uniform h-56 (224px) height.
- [ ] Agent cards show color-matched glow + opacity pulse during processing.
- [ ] HITL gates pause the pipeline and render rose-bordered activity cards.
- [ ] Confirming a HITL item resets agents to idle and resumes downstream agents.

### Activity Feed
- [ ] Empty state message displays when no activities exist.
- [ ] Confirm and Edit buttons appear for HITL/pending activities.
- [ ] Confirmed badge displays after confirmation.
- [ ] Rejected items are logged with reason and do not publish bad data.

### Visual Design
- [ ] Dark theme matches color palette specification.
- [ ] Agent colors are distinct and match the color system.
- [ ] Responsive layout works at all breakpoints.

### Technical
- [ ] Zero imports from `obra/`, `ella/`, or `yala/` modules.
- [ ] Module independence (grep-verified): no imports of or table reads from any other PILLAR module inside `src/lib/likha/` or `src/app/api/likha/`.
- [ ] L1 interchange (Should): `POST /api/likha/export-package` produces the JSON bundle exactly per `docs/INTERCHANGE-SPEC.md` (manifest + records + package hash).
- [ ] All new database tables are additive; existing tables are not modified.
- [ ] All agent decisions are logged in `agent_decisions` with user ID and timestamp.
- [ ] No TypeScript errors.

---

## 12. Agentic Workflow Definition

### 12.1 Orchestrator State Machine

```
[idle] → submit(input) → [running]
[running] → onAgentStart(id) → [processing_agent_N]
[processing_agent_N] → onAgentComplete(id, output) → [running] OR [hitl]
[hitl] → humanConfirm(data) → [running]
[hitl] → humanReject(reason) → [terminal_rejected]
[running] → onPipelineComplete(result) → [completed]
[running] → onError(id, error) → [error]
[completed] → reset() → [idle]
[error] → retry() → [running]
```

### 12.2 Callback Architecture

| Callback | Trigger | Action |
|----------|---------|--------|
| onAgentStart(agentId) | Agent begins processing | Set agent status to 'processing', apply glow + pulse |
| onAgentComplete(agentId, output) | Agent finishes | Set status to 'completed', show output preview; if output.hitlRequired, set status to 'hitl' |
| onHitlRequired(agentId, hitlItem) | Agent needs human decision | Pause pipeline, add HITL card to activity feed |
| onHumanDecision(hitlId, decision, data) | User confirms/rejects/edits | Resume or terminate pipeline; log decision |
| onPipelineComplete(result) | All agents finished | Set isProcessing=false, add success activity |
| onError(agentId, error) | Agent error | Set status to 'error', log error, offer retry |

### 12.3 Audit Trail Schema

Every agent action and human decision is persisted to `agent_decisions` (module-scoped rows with `module='likha'`):

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| module | TEXT | 'likha' |
| pipeline_id | TEXT | Correlates a single run |
| agent_id | INTEGER | Agent number |
| agent_name | TEXT | Human-readable agent name |
| action | TEXT | 'start', 'complete', 'hitl', 'confirm', 'reject', 'error' |
| input_snapshot | JSON | Input data at decision time |
| output_snapshot | JSON | Output data or human-edited data |
| confidence | REAL | Model confidence when applicable |
| user_id | TEXT | Approver/rejector ID (NULL for agent-only actions) |
| reason | TEXT | Human-provided reason for reject/override |
| created_at | DATETIME | Timestamp |

### 12.4 HITL Gate Specifications

| Gate | Trigger | Required Role | Output |
|------|---------|---------------|--------|
| Low-confidence metadata | confidence < 0.7 on number/year/title | SB Secretary / Admin | Corrected metadata or rejection |
| Low-confidence classification | classification confidence < 0.6 | SB Secretary / Legal Officer | Override category or rejection |

### 12.5 Data Model (Additive SQLite Tables)

All tables are created via idempotent `CREATE TABLE IF NOT EXISTS` in `src/lib/db.ts` initialization. No existing table is modified (per the Modular Independence Audit v2).

| Table | Owner | Purpose | Key Columns |
|-------|-------|---------|-------------|
| `archived_ordinances` | LIKHA | Digitized ordinance records (single source of truth) | id, ordinance_number, series_year, title, content, summary, subject_tags(JSON), status(active/amended/repealed/superseded/expired), archive_status(processing/pending_review/published/flagged), scan_file_path, file_hash, uploaded_by_id, verified_by_id, dilg_submitted, UNIQUE(ordinance_number, series_year) |
| `classifications` | LIKHA | Subject classifications with provenance | id, ordinance_id, category, confidence, assigned_by('ai' or user id) |
| `amendment_links` | LIKHA | Lightweight amendment/repeal/supersede links detected during archiving | id, amending_id, amended_id, relationship_type, detected_by, confirmed |
| `agent_decisions` | Shared audit (module-scoped rows) | Immutable audit trail (schema in §12.3) | id, module, pipeline_id, agent_id, agent_name, action, input_snapshot, output_snapshot, confidence, user_id, reason, created_at |

Indexes: `archived_ordinances(series_year)`, `archived_ordinances(status)`, `archived_ordinances(archive_status)`, `agent_decisions(pipeline_id)`, `agent_decisions(module, created_at)`.

### 12.6 API Contract

All routes are protected by `withUserAuth`. Errors follow `{ error: string, code?: string }`; list routes support `?page=&limit=`.

**LIKHA** (`src/app/api/likha/*`):

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| POST | `/api/likha/upload` | multipart/form-data, ≤10 files (PDF/JPG/PNG, ≤20 MB each) | `{ batchId, files: [{ id, status, hash }] }` |
| GET | `/api/likha/archive` | `?q=&yearFrom=&yearTo=&status=&subject=` | paginated ordinance list + snippets |
| GET | `/api/likha/archive/:id` | — | ordinance detail + classifications |
| PUT | `/api/likha/archive/:id` | metadata fields + action(approve/edit/reject) + reason? | updated record; 409 on conflict |
| POST | `/api/likha/classify` | `{ ordinanceIds: string[] }` | classifications with confidence |
| GET | `/api/likha/stats` | — | counts by year/status/subject |
| POST | `/api/likha/export-dilg` (Should) | `{ ordinanceIds? }` | DILG package download |
| POST | `/api/likha/export-package` (Should, L1) | `{ ordinanceIds? }` | interchange JSON bundle per `docs/INTERCHANGE-SPEC.md` |

---

## 13. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | OCR ≤60s; search ≤500ms; dashboard updates ≤2s |
| Security | All routes protected by `withUserAuth`; file hashes verified; no PII leakage |
| Compliance | Align with DILG MC 2026-041 and RA 12254; FOI-ready public search |
| Modularity | Zero runtime imports from ELLA/OBRA/YALA; standalone SKU — zero reads of any other module's tables; interoperability via user-triggered file interchange only |
| Auditability | Every agent action and human decision logged |
| Accessibility | WCAG 2.1 AA contrast ratios; keyboard-navigable HITL forms |
| Maintainability | Module-owned prompts, agents, exports; additive DB changes only |
| Disaster recovery | File hashes cached; archive records exportable to DILG package and L1 interchange package |

---

## 14. Success Metrics and KPIs

### Gov Domain KPIs (Aligned with GOV_KPIS)

| KPI | Formula | Target |
|-----|---------|--------|
| Archive Digitization Rate | `digitized_ordinances / total_ordinances * 100` | >90% |
| Average Retrieval Time | Time from search query to result | <500ms |
| Human Verification Rate | `hitl_items / total_pipeline_runs * 100` | <20% (indicates good OCR/classifier quality) |
| Citizen Search Adoption | `public_searches / month` | Trending up |

### Module-Specific KPIs

| KPI | Target |
|-----|--------|
| OCR accuracy on clear scans | ≥80% first-page metadata extraction |
| BM25 search latency | <500ms |
| End-to-end archive publish time | <3 minutes per ordinance (including HITL) |

---

## 15. Completion Gate Evidence — ARCHITECT

- [x] Archetype resolved: `agentic` (Rule 24 — from flag, logged in session.archetype_context)
- [x] Domain pack applied: `gov` overlay composed without structural fork (Rule 26)
- [x] Module PRD split from combined edition (v2.1, 2026-08-09) — LIKHA fully self-contained
- [x] All 7 LIKHA MVP features have detailed requirements (§6.7); L013 L1 interchange export as Should per INTERCHANGE-SPEC
- [x] Acceptance criteria specific and testable (§11)
- [x] Agent pipeline defined, 6 agents (within 3–6 bound per pipeline)
- [x] Input/output contracts specified (§6.5–6.6, WORKFLOW-LIKHA.json)
- [x] Callback architecture defined incl. HITL extensions (§12.2)
- [x] Data model additive-only (§12.5); API contracts documented (§12.6)

---

*Prepared by QoderWork — PILLAR LIKHA Module, PRIME v3.3 Engagement (pillar-likha-linaw-20260809)*
