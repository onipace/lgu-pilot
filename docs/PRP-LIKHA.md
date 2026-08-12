# Product Requirements Prompt (PRP) — LIKHA
## PILLAR LIKHA — Code Generation Prompt

Feed this PRP to @make_agent during BUILD for LIKHA-scoped sprints (or paste into any AI code editor opened on the pillar-pilot repo). This document is module-scoped: it intentionally contains no other module's internals.

**Archetype:** agentic (AGENTIC.md PRP sections merged) · **Domain:** gov (LGU terminology applied) · **Session:** pillar-likha-linaw-20260809
**Inputs:** docs/PRD-LIKHA.md · docs/DESIGN.md · docs/WORKFLOW-LIKHA.json · docs/LIKHA-LINAW-Modular-Independence-Audit.md (v2) · docs/INTERCHANGE-SPEC.md (L1 contract reference only)
**v2.1 split edition (2026-08-09):** Module-isolated PRP. LIKHA is standalone in both directions — zero cross-module imports and zero cross-module table reads. L1 interchange export-package route included as Should-have per INTERCHANGE-SPEC.

---

## PROMPT

```
You are extending an EXISTING Next.js 15.3.8 monolith (pillar-pilot) with ONE NEW standalone module:
LIKHA (legislative archive digitization). Target repo: PILLAR-pilot.
App Router, TypeScript 5, Tailwind CSS, shadcn/ui, better-sqlite3, OpenRouter LLM client at src/lib/ai/llm.ts.

NON-NEGOTIABLE CONSTRAINTS (from the Modular Independence Audit v2 — violation = build failure):
1. ZERO imports from src/app/api/obra/*, src/app/api/chat/*, src/lib/ai/prompts.ts, src/lib/ai/obra-export.ts, or any ELLA/OBRA/YALA component.
2. Reuse ONLY these shared primitives: src/lib/ai/llm.ts, src/lib/db.ts, src/lib/logger.ts, src/lib/user-auth-middleware.ts, src/lib/ai/lightrag.ts (soft), shared UI primitives in src/components/ui/*, and the shared agentic UI kit (src/components/agent-pipeline.tsx, agent-card.tsx, activity-feed.tsx — created in Sprint 1 if absent; spec canonical in DESIGN.md).
3. All LIKHA SQLite tables are ADDITIVE via idempotent CREATE TABLE IF NOT EXISTS in src/lib/db.ts init. Never modify existing tables.
4. MODULE INDEPENDENCE: LIKHA never imports from and never reads tables of any other PILLAR module. All data lives in LIKHA-owned tables. Interoperability is ONLY via the explicit L1 export package (docs/INTERCHANGE-SPEC.md). Do not reference, read, or join any sibling module's tables, routes, or services anywhere in likha code.
5. Every AI legal decision pauses for human confirmation (HITL) and every agent action + human decision is logged to agent_decisions.

## Overview
Add a /likha portal page with agentic pipeline UI (6 glowing agent cards, sequential processing with delays, activity feed with Confirm/Edit) backed by real API routes: LIKHA uploads scanned ordinance PDFs/images, OCRs them via a module-owned OpenRouter wrapper, parses metadata with LLM, verifies with a human side-by-side panel, publishes to a BM25-searchable archive, classifies subjects with AI assistance, and exports DILG + L1 interchange packages. LIKHA is a standalone SKU: it works with no other module installed.

## Tech Stack
- Next.js 15.3.8 (App Router) + TypeScript 5
- React 19 + shadcn/ui components + lucide-react icons
- Tailwind CSS (design tokens from DESIGN.md)
- better-sqlite3 (additive tables)
- OpenRouter via existing src/lib/ai/llm.ts; OCR models google/gemini-2.5-flash (PDF) and qwen/qwen3.7-plus (image), temperature 0, 60s timeout
- BM25 search via LIKHA-owned index namespace (sibling of src/lib/data/search-index.json); LightRAG optional soft-dependency with BM25 fallback

## Color Palette
- Background: #0F1729 (dark navy) | Background Secondary: #1E293B (slate)
- Accent Primary: #0038A8 (Philippine Blue; white text only, 9.9:1) | Accent AI: #22D3EE (cyan)
- Text: #FFFFFF, #94A3B8 (text-safe on both backgrounds)
- LIKHA agents: 1 Ingestor #F59E0B · 2 OCR Extractor #10B981 · 3 Metadata Parser #8B5CF6 (text uses #A78BFA) · 4 Subject Classifier #0EA5E9 · 5 Legal Validator #F43F5E · 6 Archiver #6366F1 (text uses #A5B4FC)
- Semantic: success #22C55E · warning #FACC15 · error #F87171 · hitl #F43F5E

## Project Structure
Create these files (all paths relative to repo root):
- src/app/(portal)/likha/page.tsx - LIKHA module page (tabs: Archive Browser / Upload & Digitize / Classification)
- src/app/api/likha/upload/route.ts - POST multipart upload (≤10 files, 20 MB each)
- src/app/api/likha/archive/route.ts - GET list/search, PUT :id verify/update
- src/app/api/likha/classify/route.ts - POST AI subject classification
- src/app/api/likha/stats/route.ts - GET archive statistics
- src/app/api/likha/export-dilg/route.ts - POST DILG package (Should)
- src/app/api/likha/export-package/route.ts - POST L1 interchange bundle (Should): manifest + records + package hash per docs/INTERCHANGE-SPEC.md
- src/components/agent-pipeline.tsx - Shared horizontal pipeline visualization (shared kit; create if absent)
- src/components/agent-card.tsx - Shared agent card with glow/pulse (shared kit; create if absent)
- src/components/activity-feed.tsx - Shared activity feed with Confirm/Edit/HITL (shared kit; create if absent)
- src/components/likha/upload-dropzone.tsx - Drag-drop multi-file upload
- src/components/likha/verification-panel.tsx - Side-by-side HITL verification dialog
- src/components/likha/archive-browser.tsx - Search + filters + result cards
- src/components/likha/classification-editor.tsx - Subject classification UI
- src/lib/likha/ocr.ts - Module-owned OpenRouter multimodal OCR wrapper
- src/lib/likha/agents.ts - LIKHA 6-agent pipeline runner
- src/lib/likha/prompts.ts - LIKHA-owned prompt templates
- src/lib/likha/search.ts - BM25 index namespace management
- src/lib/likha/export.ts - DILG export + L1 interchange package builder per INTERCHANGE-SPEC
- src/types/likha.ts - Module interfaces
Additional edits (additive only): src/lib/db.ts (LIKHA tables), portal header nav (add LIKHA link), src/app/globals.css (glow/pulse utilities).
Do NOT create voice-input.tsx, use-voice.ts, or any audio/speech features — not required.

## Components

### Upload Dropzone (LIKHA input method: file upload)
- Drag-drop + browse; accept application/pdf, image/jpeg, image/png; max 10 files, 20 MB each
- Per-file progress rows with status: queued | ingesting | ocr | parsing | verifying | published | error
- Disabled while a pipeline run is active; MIME validation before upload; shows duplicate-hash warning inline

### Agent Pipeline (shared kit)
- Horizontal flow: Brain icon (cyan glow while processing) -> 6 agent cards -> Database icon (green glow on completion); arrows between elements; rose Hand pause icon over the arrow where HITL fires; wraps on mobile maintaining order

### Agent Card (shared kit — CRITICAL STYLING)
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

### Activity Feed (shared kit)
- Empty state: "No activities yet. Start a pipeline to see results."
- Cards with left border: success=green, warning=yellow, error=red, hitl=rose; icon + title + right-aligned timestamp
- Pending/HITL items show Confirm (green) + Edit (gray) buttons; Edit opens inline form with editable fields: ordinanceNumber, seriesYear, title, sectionCount, subject, status
- Confirmed badge: green pill with checkmark; rejected items show reason; scrollable max-h container

### Verification Panel (LIKHA HITL dialog)
- Side-by-side: original scan (zoom/rotate) | extracted text with editable fields (ordinanceNumber, seriesYear, title, sectionCount, subjects multi-select)
- Per-field confidence display; any field <0.7 renders rose with agent note
- Actions: Reject / Edit & Save / Approve & Publish; reason required on reject; focus-trapped, Esc closes, keyboard operable

## Interactive Behaviors (Agent Pipeline Logic)

LIKHA pipeline is triggered per uploaded batch. It runs sequentially per agent: onAgentStart -> delay (UI simulation) -> real async work (OCR/LLM may exceed delay; UI shows spinner on the active agent while work continues) -> onAgentComplete.

Data processing rules:
- File hash (SHA-256) computed before OCR; duplicate hash -> warning + link to existing record, skip OCR
- OCR: PDF -> google/gemini-2.5-flash, image -> qwen/qwen3.7-plus, temperature 0, 60s timeout, one retry
- Metadata extraction returns JSON {ordinanceNumber, seriesYear, title, sectionCount, confidence per field}
- Classification maps to the 13 Code Titles taxonomy + subject categories; returns [{label, confidence}]
- Archiver executes ONLY after human confirmation of pending HITL items

Exception flagging rules:
- OCR timeout after retry -> error card + HITL manual entry
- Missing ordinance number or confidence <0.7 -> HITL gate (verification panel)
- Classification confidence <0.6 -> HITL override dropdown

Callbacks:
- onAgentStart(agentId): status 'processing', glow + pulse
- onAgentComplete(agentId, output): status 'completed' with preview; if output.hitlRequired -> status 'hitl', pause
- onHitlRequired(agentId, hitlItem): rose HITL card in feed; pipeline paused
- onHumanDecision(hitlId, decision, data, reason): persist to agent_decisions; confirm/edit resumes, reject terminates branch
- onPipelineComplete(result): isProcessing=false, output icon glows green, success activity added
- onError(agentId, error): error card, one retry, then HITL escalation

## State Management

// LIKHA page state
agents: AgentState[]          // 6 agents, statuses idle|processing|completed|error|hitl
activities: ActivityItem[]    // feed items pending|confirmed|editing|rejected
hitlQueue: HitlItem[]         // open human decisions
isProcessing: boolean         // pipeline lock

Functions: runLikhaPipeline(batchId), handleConfirm(activityId), handleEdit(activityId, data), handleReject(activityId, reason), resetAgents()

## Types

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

interface AgentOutput {
  fileHash?: string;
  rawText?: string;
  ordinanceNumber?: string;
  seriesYear?: number;
  title?: string;
  sectionCount?: number;
  subjects?: Array<{ label: string; confidence: number }>;
  confidence?: number;
  success?: boolean;
  hitlRequired?: boolean;
  exceptions?: string[];
}

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
  module: 'likha';
  gate: 'low_confidence_metadata' | 'low_confidence_classification';
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

interface AgentDecision {
  id: string; module: 'likha'; pipelineId: string; agentId: number; agentName: string;
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
2. When an agent card is 'completed', show its output preview: 1 "Files validated & hashed" / 2 "Text extracted" / 3 "Metadata parsed" / 4 "Subjects suggested" / 5 "Validation complete" / 6 "Published to archive".
3. When the user clicks Confirm on a HITL activity: mark confirmed, persist decision (agent_decisions + domain table), resume pipeline, reset upstream agents to idle after completion.
4. When the user clicks Edit: inline form pre-filled with extraction; save updates data, marks confirmed, resumes.
5. When the user clicks Reject: require reason, log it, terminate that branch; nothing publishes without approval.
6. Search (archive browser): GET /api/likha/archive?q= with BM25 (LIKHA's own namespace), <500ms, highlighted snippets, filters yearFrom/yearTo/status/subject.
7. All writes log via src/lib/logger.ts with module='likha'.
8. L1 interchange (Should): POST /api/likha/export-package emits the JSON bundle {manifest, records, packageHash} exactly per docs/INTERCHANGE-SPEC.md for future user-triggered interchange; import endpoints are post-MVP.
9. Boundary check: code under src/lib/likha/ and src/app/api/likha/ contains no imports from and no table reads of any other PILLAR module.

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
-- agent_decisions is the shared audit table; CREATE TABLE IF NOT EXISTS makes it safe whichever module builds first.

## Run Configuration
- Development: npm run dev (existing pillar-pilot dev server)
- Route path: /likha under the existing portal auth
- Production target: Hostinger VPS, container pillar-pilot (existing compose; additive only)

Generate all files with complete, working code. Use 'use client' for interactive components. Keep all module code inside the likha/ namespace. Ensure consistent styling per DESIGN.md and proper layout at 360px / 768px / 1280px.
```

---

## Usage Instructions (BUILD phase)

1. @instruct_agent slices this PRP into sprint-sized instruction chunks per docs/SPRINT_PLAN.md (created in Phase 0 of BUILD).
2. @make_agent executes chunks with TDD; one git commit per feature (`feat: implement [Feature] pillar-likha-linaw-20260809`).
3. Linter runs per feature (Rule 20); modular-independence boundary is verified per sprint by grepping for forbidden import paths AND for any reference to another PILLAR module inside likha code.

---

## Verification Checklist

After generation, verify:

- [ ] LIKHA upload accepts 1–10 PDF/JPG/PNG files ≤20 MB with per-file progress; batch completes without timeout
- [ ] OCR wrapper lives at src/lib/likha/ocr.ts, calls OpenRouter directly (gemini-2.5-flash PDF / qwen-3.7-plus image), ≤60s, zero obra/ imports
- [ ] Metadata extraction persists to archived_ordinances; ≥80% accuracy on clear first pages (pilot batch)
- [ ] Verification panel shows scan vs text side-by-side; Approve/Edit/Reject logged with user + timestamp
- [ ] Approval publishes record + BM25 index entry (LIKHA namespace); search <500ms with highlighted snippets; filters work
- [ ] LIKHA pipeline: 6 agents, h-56 cards, glow+pulse on processing, delays 1000/1600/1400/1200/1200/1000ms
- [ ] Agent cards uniform h-56 with number badges, status icons, border-top output section
- [ ] HITL gates pause pipeline; rose styling; decisions persisted to agent_decisions
- [ ] Confirm/Edit/Reject flows work in activity feed; confirmed badge renders
- [ ] Zero forbidden imports (grep: src/app/api/obra, src/app/api/chat, src/lib/ai/prompts, obra-export)
- [ ] Module independence (grep): no imports of or reads from any other PILLAR module inside src/lib/likha/ and src/app/api/likha/
- [ ] L1 interchange (Should): /api/likha/export-package returns the JSON bundle with manifest + package hash per INTERCHANGE-SPEC
- [ ] LIKHA tables created idempotently; existing tables untouched
- [ ] Responsive at 360px / 768px / 1280px; touch targets ≥44px below 1024px; keyboard-operable HITL dialogs
- [ ] No TypeScript errors; lint passes; only required features present (no voice, no payments, no public portal)
<!-- ARCHETYPE:QUALITY_CHECKLIST merged above; domain: gov terminology applied (constituents, SB, DILG) -->

---

*Prepared by QoderWork (@prp_generator procedure) — PILLAR LIKHA Module, Super PRIME v3.3 (Expanded, agentic, gov)*
