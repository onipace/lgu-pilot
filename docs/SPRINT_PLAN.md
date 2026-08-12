# SPRINT_PLAN — PILLAR LIKHA + LINAW (BUILD Phase 0)

**Session:** `pillar-likha-linaw-20260809`
**Framework:** Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded quality mode**
**Archetype:** agentic · **Domain:** gov (Philippine LGU, gov-pack overlay)
**Target repo:** `PILLAR-pilot` — Next.js 15.3.8 App Router monolith (better-sqlite3, Tailwind, shadcn/ui-style primitives, OpenRouter via `src/lib/ai/llm.ts`)
**Total sprints:** 7 (`session.total_sprints = 7`)
**Planner:** @sprint-planner (Phase 0) · **Consumed by:** @instruct_agent (slicing) → @make_agent (execution)
**Date:** August 9, 2026

---

## 1. Inputs (Authoritative)

| Document | Role in this plan |
|---|---|
| `docs/PRD-LIKHA.md` (v2.1) | Authoritative LIKHA feature set (§6.7), data model (§12.5), API contract (§12.6), acceptance criteria (§11) |
| `docs/PRD-LINAW.md` (v2.1) | Authoritative LINAW feature set (§6.8 incl. N013/N014), ingestion rules (§6.5), data model (§12.5), API contract (§12.6) |
| `docs/PRP-LIKHA.md` | Authoritative LIKHA file list, DDL, behaviors — instruction source for all LIKHA sprints |
| `docs/PRP-LINAW.md` | Authoritative LINAW file list, DDL, behaviors — instruction source for all LINAW sprints |
| `docs/INTERCHANGE-SPEC.md` (v1.0.0) | Canonical L1 file-interchange contract for L013 / N015 (export-only in MVP) |
| `docs/WORKFLOW-LIKHA.json` / `docs/WORKFLOW-LINAW.json` | Pipeline definitions (agents, delays, callbacks, HITL gates, UI specs) |
| `docs/DESIGN.md` | Canonical visual spec for the shared agentic UI kit, palette (WCAG-validated), breakpoints |
| `docs/LIKHA-LINAW-Modular-Independence-Audit.md` (v2) | Bidirectional no-dependency rule — PASS verdict is a build gate |
| `docs/IDEA-REPORT.md` | Feature ID registry (L0xx/N0xx) and MoSCoW classification used in the traceability matrix |

### Repo reality check (inspected at Phase 0)

- Monolith modules today: `src/app/ella|obra|yala/page.tsx` (top-level routes — **no `(portal)` route group exists**), `src/app/api/{admin,auth,chat,documents,health,obra}`, landing page `src/app/page.tsx` with module nav links.
- Shared primitives confirmed present: `src/lib/db.ts` (`initSchema()` with idempotent `CREATE TABLE IF NOT EXISTS`), `src/lib/ai/llm.ts`, `src/lib/logger.ts`, `src/lib/user-auth-middleware.ts`, `src/lib/ai/lightrag.ts`, `src/components/ui/*`, `src/lib/data/search-index.json` (BM25 sibling pattern).
- Not yet present (to be created): `src/components/agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx`; everything under `likha/` and `linaw/` namespaces.
- **Path mapping decision:** PRPs reference `src/app/(portal)/likha|linaw/page.tsx`. The actual monolith has no `(portal)` group and places module pages top-level (`src/app/ella/page.tsx`). Build maps `(portal)/likha` → **`src/app/likha/page.tsx`** and `(portal)/linaw` → **`src/app/linaw/page.tsx`** to match existing routing precedent. All other PRP paths are taken literally.

---

## 2. Scope

**16 Must-have MVP features:** LIKHA **L001–L007** · LINAW **N001–N007 + N013/N014**.
**Should-haves IN SCOPE (3):** **L013** (`POST /api/likha/export-package`), **N015** (`POST /api/linaw/export-package`), **LIKHA export-dilg = L010** (`POST /api/likha/export-dilg`).
**Total planned: 19 features** across Sprints 2–7. Sprint 1 delivers foundation only (0 features).

Explicitly OUT of scope: L008/L009/L011/L012, N008/N009/N010/N011/N012, all interchange **import** endpoints (post-MVP, LINYA engagement), voice/audio features, public citizen portal.

---

## 3. Non-Negotiable Constraints (apply to EVERY sprint)

1. **Bidirectional module independence.** Zero cross-module imports AND zero cross-module table reads, in both directions (LIKHA ⟂ LINAW) and toward ELLA/OBRA/YALA. Every sprint ends with a **boundary-verification step** running grep checks both directions per the PRP verification checklists (§8 below). A violation is a build failure.
2. **Sprint 1 = shared foundation ONLY.** Additive `db.ts` tables (all **8 tables**: `archived_ordinances`, `classifications`, `amendment_links`, `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, `agent_decisions` — idempotent `CREATE TABLE IF NOT EXISTS` + indexes), the shared agentic UI kit (`agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx` per DESIGN.md), `globals.css` glow/pulse utilities, portal nav links, shared type files — **NO module business logic**. All later sprints assume the kit + schema exist.
3. **Entity-first vertical slicing.** Each sprint delivers a working, testable increment ending in **real API routes + real UI** — never horizontal layers (no "DB-only" or "UI-only" sprints after Sprint 1).
4. **LINAW ingestion-first sequencing.** LINAW's OWN ingestion chain — **N013** bulk import, **N014** scan upload with `src/lib/linaw/ocr.ts`, manual entry, and LINAW's own verification panel — must be complete before any LINAW pipeline sprint (N001–N007), because pipeline agents only see `linaw_ordinances` rows with `library_status='ready'`.
5. **Instruction isolation.** @instruct_agent slices **PRP-LIKHA** for LIKHA sprints and **PRP-LINAW** for LINAW sprints. No sprint may mix both PRPs' module code context. Sprint 1 uses only the explicitly shared sections (kit spec in DESIGN.md; identical DDL blocks present in both PRPs; globals.css utilities; INTERCHANGE-SPEC as reference only).
6. **Conventions.**
   - Git tag per sprint: **`v0.N.0-sprint-N`** (N = sprint number), cut after the sprint's SPRINT_REVIEW passes.
   - **Integration tests every sprint except Sprint 1** (Sprint 1 verified via build + schema assertions + kit render smoke).
   - **Regression re-run of ALL prior sprints' tests** in every sprint (S2 onward).
   - **Cumulative quality score** recorded at each SPRINT_REVIEW (Expanded mode scoring).
   - Per-feature commits: **`feat: implement [Feature] pillar-likha-linaw-20260809`** (one commit per feature ID; lint runs per feature).

### Permitted shared primitives (the ONLY allowed reuse, per Audit v2 §3)

`src/lib/ai/llm.ts` · `src/lib/db.ts` · `src/lib/logger.ts` · `src/lib/user-auth-middleware.ts` · `src/lib/ai/lightrag.ts` (soft) · `src/components/ui/*` · shared agentic kit from Sprint 1 (`agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx`). Each module owns its own OCR wrapper, prompts, export logic, verification panel, and BM25 namespace — **pattern duplication between modules is intentional (independence over DRY).**

---

## 4. Sprint Overview

| # | Sprint Title (Goal) | Module Scope | Features | PRP Source | Depends On |
|---|---|---|---|---|---|
| 1 | Shared Foundation — schema + agentic UI kit | Shared (no module logic) | — (0) | Shared sections of both PRPs + DESIGN.md | Existing monolith primitives |
| 2 | LIKHA Ingestion & Extraction (Upload → OCR → Metadata) | LIKHA | L001, L002, L003 (3) | PRP-LIKHA | Sprint 1 |
| 3 | LIKHA Verification, Archive Publish & Search | LIKHA | L004, L005, L006 (3) | PRP-LIKHA | Sprint 2 |
| 4 | LIKHA Classification & Exports (DILG + L1 Interchange) | LIKHA | L007, L010*, L013* (3) | PRP-LIKHA + INTERCHANGE-SPEC (ref) | Sprint 3 |
| 5 | LINAW Standalone Ingestion & Library Verification | LINAW | N013, N014 (2) | PRP-LINAW | Sprint 1 **only** (not Sprints 2–4) |
| 6 | LINAW Inventory, Classification & Relationship Detection | LINAW | N001, N002, N003, N004 (4) | PRP-LINAW | Sprint 5 (ready records) |
| 7 | LINAW Confirmation, Code Assembly & L1 Interchange | LINAW | N005, N007, N006, N015* (4) | PRP-LINAW + INTERCHANGE-SPEC (ref) | Sprint 6 |

\* Should-have in scope. Feature counts: 0 / 3 / 3 / 3 / 2 / 4 / 4 = **19 features**.

---

## 5. Sprint Details

### Sprint 1 — Shared Foundation: Schema + Agentic UI Kit

**Goal:** Land the complete additive schema (all 8 tables) and the module-neutral agentic UI kit so every later sprint starts from a stable, shared base. Zero module business logic.

**Feature assignments:** none (foundation).

**Instruction source:** shared sections only — DESIGN.md §2–§6 (kit visuals, palette, breakpoints), the `Database` DDL blocks (identical in PRP-LIKHA and PRP-LINAW; `agent_decisions` included once), the `CSS Animations` blocks, and the shared `Types` shapes (AgentState/AgentOutput/ActivityItem/HitlItem, module-neutralized).

**Dependency map:** existing monolith only (`src/lib/db.ts` init pattern, `src/components/ui/*`, Tailwind). No module dependency.

**Files expected:**
- `src/lib/db.ts` — additive block in `initSchema()`: 8 tables + indexes, all `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`:
  - LIKHA-owned: `archived_ordinances` (+3 idx), `classifications`, `amendment_links`
  - LINAW-owned: `linaw_ordinances` (+2 idx), `codification_records`, `ordinance_relationships` (+3 idx), `code_volumes`
  - Shared audit: `agent_decisions` (+2 idx) — module-scoped rows (`module='likha'|'linaw'`); idempotent DDL makes it safe whichever module builds first
  - DDL text is taken verbatim from the PRP `Database` sections; no existing table is altered
- `src/components/agent-pipeline.tsx` — horizontal flow (Brain input icon w/ cyan glow → N agent cards → Database output icon w/ green glow; arrows; rose Hand HITL marker; responsive wrap)
- `src/components/agent-card.tsx` — h-56 uniform card, number badge (-top-3 -left-3), status icons (Loader2/Check/AlertTriangle/Hand), bot icon on 20%-opacity agent color, h-8 border-top output section, color-matched glow + `animate-pulse-glow` when processing, `prefers-reduced-motion` respected
- `src/components/activity-feed.tsx` — empty state, left-border type colors, Confirm/Edit actions, inline edit form, confirmed badge, scrollable container
- `src/types/agentic.ts` — module-neutral shared kit interfaces (generic `AgentState<M>`, `ActivityItem`, `HitlItem<M>`, `AgentOutput` base); module-specific type files (`src/types/likha.ts`, `src/types/linaw.ts`) are created in each module's first sprint since they carry domain entities
- `src/app/globals.css` — append CSS variables (`--bg-primary` … `--accent-ai`), glow classes (`glow-amber/emerald/violet/sky/rose/indigo/cyan`), `pulse-glow` keyframes + reduced-motion guard
- Portal nav links — additive LIKHA + LINAW entries on the landing nav (`src/app/page.tsx` module link cluster, lines ~353–365) following the existing ELLA/OBRA/YALA pattern; existing entries untouched

**Boundary verification (Sprint 1 variant):**
- Kit contains no module business logic: `grep -RE "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts` → zero hits (kit is prop-driven, module-neutral).
- Schema additivity: diff of `src/lib/db.ts` shows only appended `CREATE TABLE/INDEX IF NOT EXISTS` statements; `next build` + a node script opening the DB asserts all 8 tables exist and pre-existing tables are intact.

**Definition of Done:**
- [ ] All 8 tables + indexes created idempotently; dev DB opens cleanly; existing tables/rows untouched
- [ ] Kit renders a demo 6-agent pipeline (static fixture props) with correct h-56 cards, glow/pulse, HITL rose state
- [ ] `next build` and `tsc --noEmit` pass; lint clean
- [ ] Nav links to `/likha` and `/linaw` present (pages themselves are created in Sprints 2/5 — links may point at stub-free routes only after those sprints; if lint/CI fails on dead links, add minimal placeholder pages guarded as foundation, containing no business logic)
- [ ] Tag `v0.1.0-sprint-1` after SPRINT_REVIEW (cumulative quality score recorded)

**Integration/Regression notes:** No integration tests this sprint by design (foundation-only). Verification = build + schema assertions + kit render smoke. Regression baseline starts at Sprint 2.

---

### Sprint 2 — LIKHA Ingestion & Extraction (Upload → OCR → Metadata)

**Goal:** First vertical slice: Maria drags scans into `/likha`, real routes ingest, hash, OCR, and parse metadata into `archived_ordinances`, with agents 1–3 live in the pipeline UI.

**Feature assignments:**
| ID | Feature | Notes |
|---|---|---|
| L001 | Batch upload of scanned ordinance PDFs/images | `POST /api/likha/upload` (≤10 files, ≤20 MB, PDF/JPG/PNG), per-file progress, duplicate-hash warning |
| L002 | Module-owned OCR wrapper | `src/lib/likha/ocr.ts` — OpenRouter direct; `google/gemini-2.5-flash` (PDF) / `qwen/qwen3.7-plus` (image), temp 0, 60s timeout, one retry |
| L003 | Auto-parse ordinance metadata | LLM extraction of ordinance number/series year/title/section count with per-field confidence → `archived_ordinances` (`archive_status='processing'→'pending_review'`) |

**Instruction source:** PRP-LIKHA only.

**Dependency map:** Sprint 1 (tables, kit, glow CSS, nav). Uses shared primitives: `llm.ts`, `db.ts`, `logger.ts` (`module='likha'`), `withUserAuth`.

**Files expected (from PRP-LIKHA):**
- `src/app/likha/page.tsx` — LIKHA portal page skeleton (tabs: Archive Browser / Upload & Digitize / Classification), pipeline + activity feed wired from shared kit
- `src/app/api/likha/upload/route.ts`
- `src/components/likha/upload-dropzone.tsx`
- `src/lib/likha/ocr.ts`
- `src/lib/likha/agents.ts` — pipeline runner (callbacks per WORKFLOW-LIKHA.json) with agents 1–3 (Ingestor 1000ms / OCR Extractor 1600ms / Metadata Parser 1400ms) fully wired; agents 4–6 completed incrementally in Sprints 3–4
- `src/lib/likha/prompts.ts` — metadata-extraction prompt template
- `src/types/likha.ts` — module interfaces (AgentState module:'likha', AgentOutput, ArchivedOrdinance, AgentDecision, …)

**Boundary verification:**
```
grep -RE "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha            # → zero hits
grep -RE "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha                                                # → zero hits
```
Allowed imports only: shared primitives listed in §3.

**Definition of Done:**
- [ ] L001–L003 acceptance per PRD-LIKHA §11 (upload limits, OCR ≤60s, metadata persisted with confidence)
- [ ] Pipeline UI shows agents 1–3 processing with delays/glow/pulse; batch completes end-to-end to `pending_review`
- [ ] All writes logged via `logger.ts` with `module='likha'`; agent starts/completes logged to `agent_decisions` (`module='likha'`)
- [ ] Boundary grep clean (both directions); lint + `tsc` clean
- [ ] Per-feature commits; tag `v0.2.0-sprint-2`; SPRINT_REVIEW cumulative score recorded

**Integration/Regression notes:** New integration suite (API-level against dev server): upload happy path + limit violations (11th file, >20 MB, bad MIME) + duplicate-hash warning. This suite becomes the regression baseline. Sprint 1 smoke re-checked.

---

### Sprint 3 — LIKHA Verification, Archive Publish & Search

**Goal:** Complete the digitization loop: HITL side-by-side verification, Archiver publish with BM25 index entry, and a searchable archive browser.

**Feature assignments:**
| ID | Feature | Notes |
|---|---|---|
| L004 | Human verification side-by-side view | Verification panel (scan ↔ extracted text, per-field confidence, rose <0.7); Approve/Edit/Reject with reason; decisions logged (`agent_decisions`, user ID + timestamp); Legal Validator agent (5) raises gates `low_confidence_metadata` |
| L005 | Publish to archive with BM25 index entry | Archiver agent (6) runs only after human confirmation; `archive_status='published'`, hash cached; LIKHA-owned BM25 namespace (`src/lib/likha/search.ts`, sibling index file) |
| L006 | Full-text archive browser with filters | `GET /api/likha/archive?q=&yearFrom=&yearTo=&status=&subject=` + `GET /api/likha/stats`; search <500ms, highlighted snippets; filter UI |

**Instruction source:** PRP-LIKHA only.

**Dependency map:** Sprint 2 (records in `pending_review`, agents 1–3, runner). Completes `agents.ts` agents 4–6 (Subject Classifier completes its pipeline pass in Sprint 4's classification work; its sequential slot is wired here) and the full HITL callback chain (`onHitlRequired`, `onHumanDecision`).

**Files expected:**
- `src/components/likha/verification-panel.tsx`
- `src/components/likha/archive-browser.tsx`
- `src/app/api/likha/archive/route.ts` — GET list/search; PUT `:id` verify/update (approve/edit/reject; 409 on conflict)
- `src/app/api/likha/stats/route.ts`
- `src/lib/likha/search.ts`
- `src/lib/likha/agents.ts` — agents 5–6 + HITL pause/resume; `src/lib/likha/prompts.ts` extended as needed

**Boundary verification:** same dual-direction grep as Sprint 2 (LIKHA direction + confirm no `likha` references have leaked into any linaw-prefixed path — none exist yet).

**Definition of Done:**
- [ ] L004–L006 acceptance per PRD-LIKHA §11 (side-by-side, audit logging, publish + BM25 entry, search <500ms with highlights, filters)
- [ ] HITL gate pauses pipeline; rose-bordered feed card; Confirm/Edit/Reject all persist to `agent_decisions`; rejected items never publish
- [ ] Boundary grep clean; lint + `tsc` clean
- [ ] Per-feature commits; tag `v0.3.0-sprint-3`; SPRINT_REVIEW cumulative score recorded

**Integration/Regression notes:** New tests: archive list/search/filter; PUT approve/edit/reject incl. 409 conflict; HITL decision rows present in `agent_decisions`; BM25 latency assertion (<500ms on seeded set). **Regression:** re-run Sprint 2 suite — all prior tests green.

---

### Sprint 4 — LIKHA Classification & Exports (DILG + L1 Interchange)

**Goal:** LIKHA feature-complete: AI subject classification with admin override, DILG submission export (L010), and the L1 interchange export package (L013).

**Feature assignments:**
| ID | Feature | Notes |
|---|---|---|
| L007 | AI-assisted subject classification | `POST /api/likha/classify`; Subject Classifier agent (4) full pass; ≥1 category + confidence; HITL override gate when confidence <0.6; stored in `classifications` with `assigned_by` |
| L010 (Should) | DILG MC 2026-041 submission package export | `POST /api/likha/export-dilg`; sets `dilg_submitted` markers |
| L013 (Should) | Archive interchange export (L1) | `POST /api/likha/export-package` — manifest + records + packageHash exactly per INTERCHANGE-SPEC §2–§4, §6 (published records; attachment download; hash round-trip) |

**Instruction source:** PRP-LIKHA only (INTERCHANGE-SPEC consulted as a frozen contract reference — no LINAW code context enters this sprint).

**Dependency map:** Sprint 3 (published records to classify/export).

**Files expected:**
- `src/app/api/likha/classify/route.ts`
- `src/app/api/likha/export-dilg/route.ts`
- `src/app/api/likha/export-package/route.ts`
- `src/components/likha/classification-editor.tsx`
- `src/lib/likha/export.ts` — DILG builder + L1 package builder (canonical JSON, sorted keys, SHA-256 payload hash)
- `src/lib/likha/prompts.ts` — classification prompt; `agents.ts` agent 4 completion + override gate

**Boundary verification:** dual-direction grep again; additionally verify export builders read only `archived_ordinances`/`classifications` (no `linaw_*` table anywhere in `src/lib/likha/export.ts`).

**Definition of Done:**
- [ ] L007 acceptance (confidence scores, override persisted with `assigned_by`, HITL gate <0.6)
- [ ] L010 produces DILG package download; export actions logged
- [ ] L013 package validates against INTERCHANGE-SPEC §11 (manifest `module='likha'`, `schemaVersion='1.0.0'`, `recordCount == records.length`, recomputed `packageHash` matches; `ordinanceIds` filter works; auth required)
- [ ] Boundary grep clean; lint + `tsc` clean; LIKHA module declared complete
- [ ] Per-feature commits; tag `v0.4.0-sprint-4`; SPRINT_REVIEW cumulative score recorded

**Integration/Regression notes:** New tests: classify batch + override; export-dilg download; export-package manifest/hash round-trip (recompute from downloaded payload). **Regression:** re-run Sprint 2–3 suites.

---

### Sprint 5 — LINAW Standalone Ingestion & Library Verification

**Goal:** LINAW's entire ingestion chain into its OWN library — bulk import (N013), scan upload with module-owned OCR (N014), manual entry — plus LINAW's own verification panel reaching `library_status='ready'`. This is the prerequisite for every LINAW pipeline sprint.

**Feature assignments:**
| ID | Feature | Notes |
|---|---|---|
| N013 | Bulk text import into LINAW's own library | `POST /api/linaw/import` — JSON/CSV/DOCX ≤500 records → `linaw_ordinances` `source_type='import'`, `library_status='pending_review'`; duplicates rejected on `(ordinance_number, series_year)`; preview table |
| N014 | Scan upload + module-owned OCR + own verification | `POST /api/linaw/upload` (≤10 files ≤20 MB); OCR via `src/lib/linaw/ocr.ts` (own wrapper — zero imports from likha/obra/ella/yala); `processing → pending_review`; own verification panel approves → `library_status='ready'` |
| — | (supporting, not separately scored) | Manual entry via `PUT /api/linaw/library` (`source_type='manual'`); `GET /api/linaw/library` list/search in LINAW's own BM25 namespace |

**Instruction source:** PRP-LINAW only. **This sprint depends on Sprint 1's shared foundation ONLY — it must not import, reference, or test against any LIKHA code** (proves standalone SKU: LINAW works with no other module installed).

**Dependency map:** Sprint 1. Not Sprints 2–4.

**Files expected:**
- `src/app/linaw/page.tsx` — LINAW portal page skeleton (tabs: Library & Ingestion / Inventory / Classification / Relationships / Code Assembly)
- `src/app/api/linaw/upload/route.ts` · `src/app/api/linaw/import/route.ts` · `src/app/api/linaw/library/route.ts` (GET list; PUT create/verify/`:id` actions)
- `src/components/linaw/library-ingestion.tsx` (three input modes)
- `src/components/linaw/library-verification.tsx` (own panel: scan vs text where source exists; Approve → `ready`; Reject with reason; decisions logged)
- `src/lib/linaw/ocr.ts` · `src/lib/linaw/search.ts`
- `src/types/linaw.ts`

**Boundary verification:**
```
grep -RE "from ['\"]@/(app/api/(obra|chat|likha)|lib/(ai/(prompts|obra-export)|likha)|components/(ella|obra|yala|likha))" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw             # → zero hits
grep -RE "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(archived_ordinances|amendment_links)\b|(FROM|INTO|UPDATE|TABLE)[[:space:]]+classifications\b" \
  src/lib/linaw src/app/api/linaw                                                # → zero hits
```
Plus the LIKHA-direction grep from Sprint 2 re-run (regression: LIKHA remains clean).

**Definition of Done:**
- [ ] N013 acceptance: ≤500-record batch imports without timeout; duplicates rejected with count in response (`{ imported, skippedDuplicates, records }`)
- [ ] N014 acceptance: OCR ≤60s via own wrapper; verification approve/reject transitions correct; rejected records never become `ready`
- [ ] Manual entry creates `source_type='manual'` records
- [ ] All ingestion decisions logged (`logger.ts` `module='linaw'` + `agent_decisions` where agent-involved)
- [ ] Boundary grep clean both directions; lint + `tsc` clean
- [ ] Per-feature commits; tag `v0.5.0-sprint-5`; SPRINT_REVIEW cumulative score recorded

**Integration/Regression notes:** New tests: import (valid batch, 501st record rejected, duplicate `(ordinance_number, series_year)` rejected), upload (limits + OCR fixture + status transitions), manual entry, verify approve/reject, 409 on duplicate manual create. **Regression:** full re-run of Sprints 2–4 LIKHA suites — green (cross-module non-interference evidence).

---

### Sprint 6 — LINAW Inventory, Classification & Relationship Detection

**Goal:** LINAW analysis agents over the ready library: inventory with gap analysis, Code classification, cross-reference scanning, conflict detection — with real routes, dashboards, and evidence panels.

**Feature assignments:**
| ID | Feature | Notes |
|---|---|---|
| N001 | Inventory dashboard with gap analysis | `GET /api/linaw/inventory` — totals, year/status/subject counts, year gaps, completeness score; reads `linaw_ordinances` (ready) ONLY; dashboard updates ≤2s |
| N002 | AI subject classification into Code Titles/Chapters | `POST /api/linaw/classify` + `PUT /api/linaw/classify/:id` override; Code Classifier agent (2); placements in `codification_records`; HITL gate when confidence <0.7 (`code_placement`) / <0.6 (`low_confidence_classification`) |
| N003 | Cross-reference scanner for amendments/repeals | `POST /api/linaw/detect-relationships`; Cross-Reference Scanner agent (3); ≥70% precision target; results in `ordinance_relationships`; orphan refs → "missing target" warning |
| N004 | Conflict detection across ordinances | Same detect pass / Conflict Detector agent (4); `GET /api/linaw/conflicts` with evidence; side-by-side panel with flagged passages |

**Instruction source:** PRP-LINAW only.

**Dependency map:** Sprint 5 (`library_status='ready'` records are the agents' only input) + Sprint 1 kit.

**Files expected:**
- `src/app/api/linaw/inventory/route.ts` · `classify/route.ts` · `detect-relationships/route.ts` · `conflicts/route.ts` · `relationships/route.ts` (GET list portion; PUT lands in Sprint 7)
- `src/components/linaw/inventory-dashboard.tsx` (SVG bar chart, no chart lib) · `relationship-review.tsx` (list + evidence shell) · `conflict-panel.tsx`
- `src/lib/linaw/agents.ts` — agents 1–4 (1100/1300/1600/1500ms) with pipeline runner + callbacks
- `src/lib/linaw/prompts.ts` — classification / cross-reference / conflict prompts

**Boundary verification:** same dual-direction grep as Sprint 5.

**Definition of Done:**
- [ ] N001 acceptance: numbers verifiable against seeded ready library; refresh ≤2s; no non-ready rows counted
- [ ] N002 acceptance: placements with confidence; human override persists to `codification_records` (`human_override`, reviewer IDs)
- [ ] N003 acceptance: explicit references detected into `ordinance_relationships`; orphan warning rendered
- [ ] N004 acceptance: conflicts listed with confidence + side-by-side evidence
- [ ] HITL gates (low-confidence placement/classification) pause pipeline with rose cards
- [ ] Boundary grep clean; lint + `tsc` clean
- [ ] Per-feature commits; tag `v0.6.0-sprint-6`; SPRINT_REVIEW cumulative score recorded

**Integration/Regression notes:** New tests: inventory math on seeded fixture; classify + override; detect-relationships precision fixture (planted "amending Ordinance No. X, S. YYYY" references); conflicts evidence shape. **Regression:** re-run Sprints 2–5 suites.

---

### Sprint 7 — LINAW Confirmation, Code Assembly & L1 Interchange

**Goal:** LINAW feature-complete and the whole engagement demo-ready: relationship confirmation workflow, plain-language summaries, Code of Ordinances assembly with TOC, and the L1 interchange export (N015).

**Feature assignments (build order):**
| ID | Feature | Notes |
|---|---|---|
| N005 | Relationship confirmation workflow | `PUT /api/linaw/relationships/:id` — confirm/reject with reason (Relationship Reviewer agent 5 raises `detected_relationship` gates for every detection); confirmed repeals/amendments update source ordinance `status` in `linaw_ordinances`; decisions in `agent_decisions` |
| N007 | AI-generated plain-language summaries | 2–3 sentence summaries per ordinance via `llm.ts`; human-editable; stored on `linaw_ordinances.summary`; feeds Code Assembler input and exports |
| N006 | Code volume assembly with TOC | `POST /api/linaw/assemble` + `GET /api/linaw/code/:id`; Code Assembler agent (6) runs only after pending HITL items resolved; Titles → Chapters → Articles → Sections JSON + TOC preview; `code_volumes` rows; `final_code_export` HITL gate before export |
| N015 (Should) | Codification interchange export (L1) | `POST /api/linaw/export-package` — manifest + records + **confirmed relationships** + packageHash per INTERCHANGE-SPEC §2–§6; relationships keyed by `(ordinanceNumber, seriesYear)`, never internal ids |

**Instruction source:** PRP-LINAW only (INTERCHANGE-SPEC as frozen contract reference).

**Dependency map:** Sprint 6 (detected relationships/classifications to confirm and assemble).

**Files expected:**
- `src/app/api/linaw/relationships/route.ts` (PUT `:id` portion) · `assemble/route.ts` · `code/route.ts` · `export-package/route.ts`
- `src/components/linaw/code-assembly.tsx` (structure tree, TOC preview, summaries review queue, Export JSON)
- `src/lib/linaw/export.ts` — code JSON/TOC export + L1 package builder (canonical JSON, sorted keys, SHA-256)
- `src/lib/linaw/agents.ts` — agents 5–6 completion; full 6/6 pipeline (1100/1300/1600/1500/1100/1300ms = 7900ms)

**Boundary verification:** full dual-direction grep (both modules, all paths) — final boundary gate of the engagement.

**Definition of Done:**
- [ ] N005 acceptance: confirm/reject with reason persisted; confirmed repeal flips source status; every detection required human action
- [ ] N007 acceptance: summaries generated, editable, included in assembly/export
- [ ] N006 acceptance: valid hierarchy JSON + TOC; assembler blocked until HITL cleared
- [ ] N015 package validates against INTERCHANGE-SPEC §11 incl. relationships array and hash round-trip
- [ ] Full 6-agent LINAW pipeline demo runs end-to-end with delays/glow/HITL per WORKFLOW-LINAW.json
- [ ] Boundary grep clean both directions; lint + `tsc` clean
- [ ] Per-feature commits; tag `v0.7.0-sprint-7`; final SPRINT_REVIEW with cumulative quality score

**Integration/Regression notes:** New tests: relationship confirm/reject + status propagation; assemble TOC validity on seeded library; summaries editable; export-package round-trip incl. confirmed-relationship payload. **Regression:** FULL re-run of all Sprint 2–6 suites (LIKHA + LINAW) — the complete 19-feature acceptance pass feeding Phase 4 SYSTEM_TEST.

---

## 6. Feature → Sprint Traceability Matrix

### Must-have features (16)

| ID | Feature | Module | Sprint | Key routes/files |
|---|---|---|---|---|
| L001 | Batch upload of scanned ordinance PDFs/images | LIKHA | **S2** | `POST /api/likha/upload`, `upload-dropzone.tsx` |
| L002 | Module-owned OCR wrapper | LIKHA | **S2** | `src/lib/likha/ocr.ts` |
| L003 | Auto-parse ordinance metadata | LIKHA | **S2** | `agents.ts` (Metadata Parser), `prompts.ts`, `archived_ordinances` |
| L004 | Human verification side-by-side view | LIKHA | **S3** | `verification-panel.tsx`, `PUT /api/likha/archive/:id` |
| L005 | Publish to archive with BM25 index entry | LIKHA | **S3** | Archiver agent, `src/lib/likha/search.ts` |
| L006 | Full-text archive browser with filters | LIKHA | **S3** | `GET /api/likha/archive`, `stats`, `archive-browser.tsx` |
| L007 | AI-assisted subject classification | LIKHA | **S4** | `POST /api/likha/classify`, `classification-editor.tsx`, `classifications` |
| N001 | Inventory dashboard with gap analysis | LINAW | **S6** | `GET /api/linaw/inventory`, `inventory-dashboard.tsx` |
| N002 | AI subject classification into Code Titles/Chapters | LINAW | **S6** | `POST/PUT /api/linaw/classify`, `codification_records` |
| N003 | Cross-reference scanner for amendments/repeals | LINAW | **S6** | `POST /api/linaw/detect-relationships`, `ordinance_relationships` |
| N004 | Conflict detection across ordinances | LINAW | **S6** | `GET /api/linaw/conflicts`, `conflict-panel.tsx` |
| N005 | Relationship confirmation workflow | LINAW | **S7** | `PUT /api/linaw/relationships/:id`, `relationship-review.tsx` |
| N006 | Code volume assembly with TOC | LINAW | **S7** | `POST /api/linaw/assemble`, `GET /api/linaw/code/:id`, `code-assembly.tsx`, `code_volumes` |
| N007 | AI-generated plain-language summaries | LINAW | **S7** | summaries in `linaw_ordinances.summary`, review queue in `code-assembly.tsx` |
| N013 | Bulk text import into LINAW's own library | LINAW | **S5** | `POST /api/linaw/import`, `library-ingestion.tsx` |
| N014 | Scan upload + module-owned OCR + own verification | LINAW | **S5** | `POST /api/linaw/upload`, `src/lib/linaw/ocr.ts`, `library-verification.tsx` |

### Should-haves in scope (3)

| ID | Feature | Module | Sprint | Key routes/files |
|---|---|---|---|---|
| L010 | DILG MC 2026-041 submission package export (export-dilg) | LIKHA | **S4** | `POST /api/likha/export-dilg`, `src/lib/likha/export.ts` |
| L013 | Archive interchange export package (L1) | LIKHA | **S4** | `POST /api/likha/export-package` per INTERCHANGE-SPEC |
| N015 | Codification interchange export package (L1) | LINAW | **S7** | `POST /api/linaw/export-package` per INTERCHANGE-SPEC (incl. relationships) |

Coverage: 16/16 Must + 3/3 in-scope Should = **19/19 features assigned**. No feature appears in more than one sprint.

---

## 7. Risks & Sequencing Rationale

1. **Why Sprint 1 is schema + kit only (Constraint 2).** Both PRPs mandate additive idempotent DDL and the same shared kit; landing all 8 tables up front removes every later `db.ts` merge point and makes module build order irrelevant (`agent_decisions` is shared, module-scoped by column — `CREATE TABLE IF NOT EXISTS` keeps it safe whichever module writes first). Building the kit before either module forces it to stay module-neutral (prop-driven), which is what makes the bidirectional independence grep-true.
2. **Why LIKHA (S2–S4) before LINAW (S5–S7).** LIKHA is the simpler single-input pipeline (file upload only) and establishes the shared-kit usage patterns, HITL conventions, and integration-test harness that LINAW then mirrors at higher complexity. The order is commercially and technically neutral: Sprint 5 depends only on Sprint 1, so either block could have gone first without rework.
3. **Why LINAW ingestion (S5) strictly precedes its pipeline (S6–S7) (Constraint 4).** LINAW agents legally see only `library_status='ready'` rows in `linaw_ordinances`. Building classification/detection first would leave integration tests with no valid input and would tempt shortcuts (seeding ready rows by hand, or worse, reading another module's archive) that violate the audit. Ingestion-first makes every later LINAW test run against genuinely ingested data.
4. **Why Sprints 6 and 7 carry 4 features each.** N001–N004 are parallel detection/analysis capabilities sharing one runner and one prompt library; N005/N007/N006/N015 form the confirm→summarize→assemble→export chain. Splitting them further would create horizontal-layer sprints (Constraint 3 violation). Risk is mitigated by precedent: identical route/UI patterns were already proven in LIKHA S2–S4 and by the Sprint 5 ingestion base.
5. **Instruction isolation risk (Constraint 5).** Mixed PRP context is the most likely cause of accidental cross-module imports. Each sprint section names exactly one PRP source; @instruct_agent must not attach the other PRP even "for reference" (INTERCHANGE-SPEC is the only cross-cutting document, and it is contract-shaped, not code-shaped).
6. **`(portal)` path mismatch.** PRPs assume a `(portal)` route group that does not exist in the monolith; resolved in §1 by mapping to top-level `src/app/likha` / `src/app/linaw` per ella/obra/yala precedent. Any deviation must be flagged at Sprint 2/5 SPRINT_REVIEW, not improvised silently.
7. **External API dependence in tests.** OCR/LLM calls go through OpenRouter; integration tests use small fixture files and tolerate model latency, asserting contract (status codes, shapes, timeouts, table effects) rather than model output quality. Accuracy targets (≥80% metadata, ≥70% cross-reference precision) are verified on the pilot batch at SYSTEM_TEST, not per-sprint gates.
8. **Regression growth.** The suite grows monotonically S2→S7 (LIKHA suites keep running through LINAW sprints). This is deliberate: a LIKHA test failing during a LINAW sprint is the strongest possible evidence of a boundary violation and must block the tag.

---

*Prepared by @sprint-planner — BUILD Phase 0, Super PRIME v3.3 (Expanded, agentic, gov) · session pillar-likha-linaw-20260809*
