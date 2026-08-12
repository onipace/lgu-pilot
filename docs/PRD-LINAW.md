# Product Requirements Document (PRD) — LINAW
## PILLAR-pilot Smart Legislation Platform — LINAW Module
### Legislative Indexing for Normalized & Accessible Wisdom

**Version:** v3.3 Expanded (Super PRIME) — Module PRD v2.1 (split edition)
**Date:** August 9, 2026
**Author:** QoderWork — PILLAR Smart Legislation Team
**Status:** Draft for Review
**Session:** pillar-likha-linaw-20260809
**Archetype:** agentic-workflow (resolved per Rule 24: flag → agentic)
**Domain:** gov (Philippine LGU, gov-pack overlay per Rule 26)
**Inputs:** docs/IDEA-REPORT.md (opportunity 88/100), docs/LIKHA-LINAW-Modular-Independence-Audit.md (v2, PASS — bidirectional), docs/DESIGN.md, docs/INTERCHANGE-SPEC.md

> **Module scope & independence:** This PRD covers LINAW only. LINAW is a fully standalone module and SKU: it has zero code imports from and zero data reads of any other PILLAR module. It owns its entire ingestion chain and its own ordinance library. Its only touchpoint with the outside world beyond shared platform primitives is the L1 file-interchange export defined in `docs/INTERCHANGE-SPEC.md`. Shared agentic UI kit visuals are canonical in `docs/DESIGN.md`.

---

## 1. Executive Summary

L.I.N.A.W. (Legislative Indexing for Normalized & Accessible Wisdom) is a standalone, agentic-workflow module for the PILLAR-pilot platform that turns an ordinance corpus into a structured, relationship-aware Code of Ordinances for Sangguniang Bayan (SB) offices.

LINAW brings an ordinance corpus into its OWN library — via bulk text import, scan upload with module-owned OCR, or manual entry — verifies each record with its own review panel, then runs AI agents that classify ordinances into Code Titles/Chapters, detect amendments, repeals, and conflicts, and assemble a print-ready Code. It runs inside the existing Next.js 15.3.8 monolith on Hostinger VPS but is fully standalone: it owns its own data tables, ingestion, verification, search namespace, agents, prompts, and export logic, importing only shared platform primitives (LLM client, DB handle, auth middleware, logger) and never reading any other module's tables. Interoperability is by explicit user-triggered file interchange only (`docs/INTERCHANGE-SPEC.md`), keeping LINAW sellable as an independent SKU — an LGU can codify its code with LINAW alone.

**Value Proposition:** With or without any other module, the Sanggunian can bring its ordinance corpus into LINAW, where AI agents detect amendments, repeals, and conflicts — pausing at every legal decision for a human approver — and finally assemble a print-ready Code of Ordinances that is transparent, searchable, and DILG-compliant.

---

## 2. Problem Statement

Municipal LGUs in the Philippines manage decades of ordinances whose relationships are untracked:
- **Unsafe codification:** Amendment chains and contradictions are hard to trace, so the municipal code is often outdated or internally inconsistent.
- **No structured code:** Ordinances exist as loose documents; there is no Titles → Chapters → Articles → Sections assembly with a table of contents.
- **Slow legal retrieval:** SB staff spend hours locating which ordinances amend or repeal which during sessions or legal reviews.
- **Manual DILG compliance:** Encoding submissions for DILG MC 2026-041 (e-Legis Reference System) and RA 12254 (E-Governance Act) are overwhelming.

---

## 3. Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| **Atty. Jose — SB Member / Legal Officer** | Sangguniang Bayan member and legal reviewer | Detect conflicts, trace amendment chains, approve codification proposals, export the municipal code |
| **Maria — SB Secretary** | Records officer for the Sangguniang Bayan of Pitogo, Quezon | Bring the ordinance corpus into the library, verify records, review detected relationships |
| **Elena — Municipal Citizen** | Resident checking local business permit or tax rules | Read the assembled Code and plain-language summaries |

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
| Search | BM25 fallback + optional LightRAG | LINAW-owned library namespace |
| Auth | Existing PILLAR auth middleware | `src/lib/user-auth-middleware.ts` |
| Logging | Existing PILLAR logger | `src/lib/logger.ts` with `module='linaw'` |

> **Note:** LINAW owns its own prompts, agents, ingestion, export logic, and API routes. It does not import from `obra/`, `ella/`, `yala/`, or any other PILLAR module. Pattern duplication with sibling modules (separate OCR wrapper, separate verification panel) is intentional — module independence takes precedence over DRY because the modules are separate SKUs.

### 4.2 Project Structure (Agentic)

```
PILLAR-pilot/
├── src/
│   ├── app/
│   │   ├── (portal)/
│   │   │   └── linaw/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── linaw/
│   │   │       ├── upload/route.ts
│   │   │       ├── import/route.ts
│   │   │       ├── library/route.ts
│   │   │       ├── inventory/route.ts
│   │   │       ├── classify/route.ts
│   │   │       ├── detect-relationships/route.ts
│   │   │       ├── relationships/route.ts
│   │   │       ├── conflicts/route.ts
│   │   │       ├── assemble/route.ts
│   │   │       ├── code/route.ts
│   │   │       └── export-package/route.ts
│   │   └── globals.css
│   ├── components/
│   │   ├── agent-pipeline.tsx        # shared agentic UI kit (spec: DESIGN.md)
│   │   ├── agent-card.tsx            # shared agentic UI kit
│   │   ├── activity-feed.tsx         # shared agentic UI kit
│   │   └── linaw/
│   │       ├── library-ingestion.tsx
│   │       ├── library-verification.tsx
│   │       ├── inventory-dashboard.tsx
│   │       ├── relationship-review.tsx
│   │       ├── conflict-panel.tsx
│   │       └── code-assembly.tsx
│   ├── lib/
│   │   ├── linaw/
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
│       └── linaw.ts
├── docs/
│   ├── PRD-LINAW.md
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
| Agent 1 — Inventory Analyst | Amber | #F59E0B |
| Agent 2 — Code Classifier | Violet | #8B5CF6 (text-safe #A78BFA) |
| Agent 3 — Cross-Reference Scanner | Emerald | #10B981 |
| Agent 4 — Conflict Detector | Rose | #F43F5E |
| Agent 5 — Relationship Reviewer | Cyan | #22D3EE |
| Agent 6 — Code Assembler | Indigo | #6366F1 (text-safe #A5B4FC) |

> **Note:** Each agent has a distinct color for glow effects in the pipeline visualization. HITL gates render in rose/red when awaiting human approval.

---

## 6. Feature Requirements

### 6.1 Input Components

#### Library Ingestion Component

**File:** `src/components/linaw/library-ingestion.tsx`

| Requirement | Description |
|-------------|-------------|
| Bulk text import | JSON/CSV/DOCX up to 500 records per batch with preview table |
| Scan upload | Drag-drop up to 10 files (PDF/JPG/PNG), ≤20 MB each, per-file progress |
| Manual entry | Form: ordinance number, series year, title, content, subject tags |
| Duplicate detection | Inline warning on (ordinance number, series year) collisions |
| Disabled State | Disable during active agent pipeline |

#### Library Search Input

**File:** `src/components/linaw/inventory-dashboard.tsx` (embedded)

| Requirement | Description |
|-------------|-------------|
| Full-text search | BM25-powered query over LINAW's own library namespace with debounce |
| Filters | Library status, year range, subject category |

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
| Edit Mode | Inline form with editable fields per gate context |
| Confirmed Badge | Green pill badge with checkmark after confirmation |
| Scrollable | Max height container with overflow-y scroll |

### 6.5 LINAW Standalone Ingestion (N013/N014 + Manual Entry)

LINAW owns its entire ingestion chain and never reads any other module's tables or routes. All records land in LINAW's own `linaw_ordinances` library table.

**Input Methods:**

| Method | Route | Rules |
|--------|-------|-------|
| Bulk text import (N013) | `POST /api/linaw/import` | JSON/CSV/DOCX up to 500 records per batch; each record inserted into `linaw_ordinances` with `source_type='import'`, `library_status='pending_review'`; duplicates rejected on `(ordinance_number, series_year)` |
| Scan upload (N014) | `POST /api/linaw/upload` | Up to 10 files (PDF/JPG/PNG, ≤20 MB each); module-owned OCR at `src/lib/linaw/ocr.ts` (`google/gemini-2.5-flash` PDFs, `qwen/qwen3.7-plus` images; zero imports from `obra/`, `ella/`, `yala/`, or any other PILLAR module); text returned ≤60s; records start `library_status='processing'` → `pending_review` |
| Manual entry | `PUT /api/linaw/library` | Form-created record with `source_type='manual'`, starts `pending_review` |

**Own Verification Panel:** Each `pending_review` record is reviewed in LINAW's own verification panel (`src/components/linaw/library-verification.tsx`; scan vs extracted text side-by-side where a source file exists). Approve → `library_status='ready'` (eligible for inventory/classification). Reject → record marked rejected with reason. All decisions logged with user ID + timestamp.

**Library Lifecycle:** `processing → pending_review → ready` (or `rejected`). Only `ready` records are visible to the LINAW pipeline agents.

### 6.6 LINAW Agent Pipeline Logic

**File:** `src/lib/linaw/agents.ts`

**Agent Processing Table:**

| Agent | Delay | Function |
|-------|-------|----------|
| 1. Inventory Analyst | 1100ms | Scan LINAW's own `linaw_ordinances` library, compute completeness score, identify year gaps |
| 2. Code Classifier | 1300ms | Assign each ordinance to Title/Chapter/Article with confidence score |
| 3. Cross-Reference Scanner | 1600ms | Detect explicit amendment/repeal/supersede references with precision ≥70% |
| 4. Conflict Detector | 1500ms | Flag potential contradictions on the same subject with confidence score |
| 5. Relationship Reviewer | 1100ms | Present detected relationships to human; await confirmation/rejection |
| 6. Code Assembler | 1300ms | Build hierarchical structure (Titles → Chapters → Articles → Sections), generate TOC |

**Pipeline total: 7900ms** (within the 5–8s @workflow_designer guidance).

**Data Processing Rules:**
- Inventory Analyst reads only LINAW's own `linaw_ordinances` records with `library_status='ready'`.
- Code Classifier uses the library's own subject metadata as prior input.
- Cross-Reference Scanner parses ordinance numbers in text and links them to `linaw_ordinances` records.
- Conflict Detector compares sections under the same subject and flags semantic contradictions.
- Relationship Reviewer creates HITL gates for every detected amendment/repeal/conflict.
- Code Assembler renumbers sections and generates JSON + TOC preview.

**Exception Flagging Rules:**
- Orphan reference (target ordinance not in library) → warning with "missing target" flag.
- Conflicting statuses on same ordinance → error, require human resolution.
- Multiple amendment chains → warning, visualize chain for human review.
- Low relationship confidence (<0.6) → HITL gate with side-by-side comparison.

### 6.7 Agent Definitions

| ID | Name | Module | Description | Color | Glow Class | Delay |
|----|------|--------|-------------|-------|------------|-------|
| 1 | Inventory Analyst | LINAW | Computes inventory completeness and year gaps | #F59E0B | glow-amber | 1100ms |
| 2 | Code Classifier | LINAW | Assigns ordinances to Code Titles/Chapters | #8B5CF6 | glow-violet | 1300ms |
| 3 | Cross-Reference Scanner | LINAW | Detects amendment/repeal/supersede relationships | #10B981 | glow-emerald | 1600ms |
| 4 | Conflict Detector | LINAW | Flags semantic contradictions across ordinances | #F43F5E | glow-rose | 1500ms |
| 5 | Relationship Reviewer | LINAW | Presents relationships for human confirmation | #22D3EE | glow-cyan | 1100ms |
| 6 | Code Assembler | LINAW | Builds hierarchical Code of Ordinances with TOC | #6366F1 | glow-indigo | 1300ms |

### 6.8 MVP Feature Requirements (LINAW — 9 features)

1. **Inventory dashboard with gap analysis**
   - Show totals, counts by year/status/subject, missing gaps, completeness score.
   - Update within 2 seconds of data changes. Reads `linaw_ordinances` only.

2. **AI subject classification into Code Titles/Chapters**
   - Batch classification with confidence score.
   - Human override; stored in `codification_records`.

3. **Cross-reference scanner for amendments/repeals**
   - Identify explicit references with ≥70% precision.
   - Store in `ordinance_relationships`.

4. **Conflict detection across ordinances**
   - Flag contradictions on same subject with confidence and side-by-side view.

5. **Relationship confirmation workflow**
   - Staff/Member/Admin confirm or reject each relationship with reason.
   - Confirmed status updates source ordinance status when applicable.

6. **Code volume assembly with TOC**
   - Generate hierarchical structure (Titles → Chapters → Articles → Sections).
   - Auto-numbering; JSON/TOC preview.

7. **AI-generated plain-language summaries**
   - 2–3 sentence summaries per ordinance.
   - Human editable; included in code export.

8. **Bulk text import into LINAW's own library (N013)**
   - JSON/CSV/DOCX up to 500 records per batch → `linaw_ordinances` as `pending_review`.
   - Duplicate rejection on `(ordinance_number, series_year)`.

9. **Scan upload with module-owned OCR + own verification (N014)**
   - Up to 10 files (PDF/JPG/PNG, ≤20 MB each) via `POST /api/linaw/upload`.
   - OCR at `src/lib/linaw/ocr.ts` returns text ≤60s; zero imports from `obra/`, `ella/`, `yala/`, or any other PILLAR module.
   - LINAW's own verification panel; approved records become `library_status='ready'`.

**Should-have (L1 interchange):** `POST /api/linaw/export-package` emits the interchange JSON bundle per `docs/INTERCHANGE-SPEC.md` (manifest + records + relationships + package hash). Export-only in MVP; import is post-MVP.

---

## 7. User Flows

### 7.1 LINAW Primary Flow

1. Atty. Jose opens LINAW and brings the municipality's ordinance corpus into LINAW's own library — bulk text import, scan upload (module-owned OCR), or manual entry.
2. He reviews `pending_review` items in LINAW's own verification panel and approves them (`library_status='ready'`).
3. He runs the Inventory Analyst to see completeness across the ready library.
4. He starts the Code Classifier on the ready ordinances.
5. The Cross-Reference Scanner detects amendment/repeal links.
6. The Conflict Detector flags potential contradictions.
7. The Relationship Reviewer presents each detected relationship for human confirmation.
8. Atty. Jose confirms, rejects, or edits each relationship with a reason.
9. The Code Assembler builds the hierarchical Code of Ordinances.
10. Atty. Jose reviews the TOC preview and exports to PDF/DOCX.

### 7.2 HITL Review Flow

1. Agent raises a HITL gate (detected relationship, low-confidence placement, or final export).
2. Activity feed shows a rose-bordered card with "Review Required".
3. User clicks "Review" to open side-by-side evidence or inline edit form.
4. User edits fields, selects an action, and provides a reason.
5. User clicks "Confirm" or "Reject".
6. Pipeline resumes or terminates based on action; all decisions are logged in `agent_decisions`.

### 7.3 Edit Flow

1. User clicks "Edit" on a pending HITL activity.
2. Inline form appears with pre-filled detected data.
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
  module: 'linaw';
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
  completenessScore?: number;
  yearGaps?: Array<{ year: number; missing: number[] }>;
  codePlacement?: { title: string; chapter: string; article?: string; confidence: number };
  relationships?: Array<{ sourceId: string; targetId: string; type: string; confidence: number }>;
  conflicts?: Array<{ ordinanceAId: string; ordinanceBId: string; reason: string; confidence: number }>;
  toc?: Array<{ title: string; chapters: Array<{ name: string; sections: string[] }> }>;
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
  module: 'linaw';
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
- [ ] LINAW bulk import accepts JSON/CSV/DOCX (≤500 records) into `linaw_ordinances` as `pending_review`, rejecting duplicates on (ordinance_number, series_year).
- [ ] LINAW scan upload accepts ≤10 files (≤20 MB each), OCR via `src/lib/linaw/ocr.ts` returns text ≤60s, and LINAW's own verification panel sets `library_status='ready'` on approval.
- [ ] Manual entry creates a `linaw_ordinances` record with `source_type='manual'`.
- [ ] LINAW inventory dashboard updates within 2 seconds of data changes.
- [ ] Cross-reference scanner achieves ≥70% precision on explicit references.
- [ ] Code assembler produces valid Titles → Chapters → Articles → Sections hierarchy.

### Agent Pipeline
- [ ] 6 agents process sequentially with visible delays (1100/1300/1600/1500/1100/1300ms).
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
- [ ] Module independence (grep-verified): no imports of or table reads from any other PILLAR module inside `src/lib/linaw/` or `src/app/api/linaw/`.
- [ ] L1 interchange (Should): `POST /api/linaw/export-package` produces the JSON bundle exactly per `docs/INTERCHANGE-SPEC.md` (manifest + records + relationships + package hash).
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

Every agent action and human decision is persisted to `agent_decisions` (module-scoped rows with `module='linaw'`):

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| module | TEXT | 'linaw' |
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
| Low-confidence classification | classification confidence < 0.6 | SB Secretary / Legal Officer | Override category or rejection |
| Detected relationship | cross-reference or conflict found | SB Member / Legal Officer | Confirm, edit, or reject relationship |
| Code placement | code classifier confidence < 0.7 | Legal Officer / Admin | Override Title/Chapter/Article |
| Final code export | before PDF/DOCX export | SB Member / Admin | Approve final code volume |

### 12.5 Data Model (Additive SQLite Tables)

All tables are created via idempotent `CREATE TABLE IF NOT EXISTS` in `src/lib/db.ts` initialization. No existing table is modified (per the Modular Independence Audit v2).

| Table | Owner | Purpose | Key Columns |
|-------|-------|---------|-------------|
| `linaw_ordinances` | LINAW | LINAW's own ordinance library (self-contained source of truth) | id, ordinance_number, series_year, title, content, summary, subject_tags(JSON), status(active/amended/repealed/superseded/expired), source_type(scan/import/manual), source_filename, file_hash, library_status(processing/pending_review/ready/rejected), uploaded_by_id, verified_by_id, UNIQUE(ordinance_number, series_year) |
| `codification_records` | LINAW | Code placement per ordinance | id, ordinance_id(UNIQUE, FK → `linaw_ordinances`), title_number, chapter_number, article_number, section_in_code, cod_status(unclassified/classified/reviewed/approved/codified), ai_suggestion(JSON), human_override(JSON), reviewed_by_id, approved_by_id |
| `ordinance_relationships` | LINAW | Detected cross-references pending human confirmation | id, source_id(FK → `linaw_ordinances`), target_id(FK → `linaw_ordinances`), relationship_type(amends/repeals/partial_repeal/supersedes/extends/implements), section_ref, confidence, confirmed, confirmed_by_id |
| `code_volumes` | LINAW | Assembled Code of Ordinances volumes | id, title, edition, status(draft/under_review/published), structure(TOC JSON), generated_by_id, published_at |
| `agent_decisions` | Shared audit (module-scoped rows) | Immutable audit trail (schema in §12.3) | id, module, pipeline_id, agent_id, agent_name, action, input_snapshot, output_snapshot, confidence, user_id, reason, created_at |

Indexes: `linaw_ordinances(series_year)`, `linaw_ordinances(library_status)`, `ordinance_relationships(source_id)`, `ordinance_relationships(target_id)`, `ordinance_relationships(relationship_type)`, `agent_decisions(pipeline_id)`, `agent_decisions(module, created_at)`.

### 12.6 API Contract

All routes are protected by `withUserAuth`. Errors follow `{ error: string, code?: string }`; list routes support `?page=&limit=`.

**LINAW** (`src/app/api/linaw/*`):

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| POST | `/api/linaw/upload` | multipart/form-data, ≤10 files (PDF/JPG/PNG, ≤20 MB each) | `{ batchId, files: [{ id, status, hash }] }` (module-owned OCR) |
| POST | `/api/linaw/import` | JSON/CSV/DOCX, ≤500 records | `{ imported, skippedDuplicates, records: [{ id, library_status }] }` |
| GET | `/api/linaw/library` | `?q=&libraryStatus=&page=&limit=` | paginated `linaw_ordinances` list |
| PUT | `/api/linaw/library` / `/:id` | create (manual entry) or action(approve/reject/edit) + reason? | updated record; 409 on (ordinance_number, series_year) conflict |
| GET | `/api/linaw/inventory` | — | totals, gaps, completeness score (reads `linaw_ordinances` only) |
| POST | `/api/linaw/classify` | `{ ordinanceIds? }` | code placements with confidence |
| PUT | `/api/linaw/classify/:id` | title/chapter/article override + reason | updated codification_record |
| POST | `/api/linaw/detect-relationships` | `{ ordinanceIds? }` | detected relationships + conflicts |
| GET | `/api/linaw/relationships` | `?status=&type=` | paginated relationships |
| PUT | `/api/linaw/relationships/:id` | `{ action: confirm|reject, reason }` | updated relationship |
| GET | `/api/linaw/conflicts` | — | conflict list with evidence |
| POST | `/api/linaw/assemble` | `{ edition }` | code volume with TOC JSON |
| GET | `/api/linaw/code/:id` | — | code volume detail |
| POST | `/api/linaw/code/:id/export` (Should) | `{ format: pdf|docx }` | export download |
| POST | `/api/linaw/export-package` (Should, L1) | `{ ordinanceIds? }` | interchange JSON bundle per `docs/INTERCHANGE-SPEC.md` |

---

## 13. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | OCR ≤60s; library search ≤500ms; dashboard updates ≤2s |
| Security | All routes protected by `withUserAuth`; file hashes verified; no PII leakage |
| Compliance | Align with DILG MC 2026-041 and RA 12254; code export ready for submission |
| Modularity | Zero runtime imports from ELLA/OBRA/YALA; standalone SKU — zero reads of any other module's tables; interoperability via user-triggered file interchange only |
| Auditability | Every agent action and human decision logged |
| Accessibility | WCAG 2.1 AA contrast ratios; keyboard-navigable HITL forms |
| Maintainability | Module-owned prompts, agents, ingestion, exports; additive DB changes only |
| Disaster recovery | File hashes cached; library and code volumes exportable to L1 interchange package |

---

## 14. Success Metrics and KPIs

### Gov Domain KPIs (Aligned with GOV_KPIS)

| KPI | Formula | Target |
|-----|---------|--------|
| Relationship Confirmation Rate | `confirmed_relationships / detected_relationships * 100` | >80% |
| Code Completeness Score | `classified_ordinances / ready_library_ordinances * 100` (LINAW's own `linaw_ordinances`) | >90% |
| Library Readiness Rate | `ready_library_ordinances / total_ingested * 100` | >90% |

### Module-Specific KPIs

| KPI | Target |
|-----|--------|
| Cross-reference precision | ≥70% |
| Conflict detection precision | ≥60% |
| End-to-end code assembly time | <5 minutes per 50 ordinances |
| Bulk import throughput | ≤500 records per batch without timeout |

---

## 15. Completion Gate Evidence — ARCHITECT

- [x] Archetype resolved: `agentic` (Rule 24 — from flag, logged in session.archetype_context)
- [x] Domain pack applied: `gov` overlay composed without structural fork (Rule 26)
- [x] Module PRD split from combined edition (v2.1, 2026-08-09) — LINAW fully self-contained with own ingestion
- [x] All 9 LINAW MVP features have detailed requirements (§6.8, incl. N013/N014); N015 L1 interchange export as Should per INTERCHANGE-SPEC
- [x] Acceptance criteria specific and testable (§11)
- [x] Agent pipeline defined, 6 agents (within 3–6 bound per pipeline)
- [x] Input/output contracts specified (§6.5–6.7, WORKFLOW-LINAW.json)
- [x] Callback architecture defined incl. HITL extensions (§12.2)
- [x] Data model additive-only (§12.5); API contracts documented (§12.6)

---

*Prepared by QoderWork — PILLAR LINAW Module, PRIME v3.3 Engagement (pillar-likha-linaw-20260809)*
