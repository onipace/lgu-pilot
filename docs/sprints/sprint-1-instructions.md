# Sprint 1 Instruction Set — Shared Foundation (Schema + Agentic UI Kit)

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 1 of 7 — "Shared Foundation — schema + agentic UI kit" |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (SUPER PRIME v2.2, per `agents/super/instruct-agent-super.md`, incl. U1 per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith, React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3, lucide-react ^0.468, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils` |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 1 uses **shared sections only**:

- `docs/DESIGN.md` §2–§6 (kit visuals, palette, breakpoints, reduced-motion rule)
- The `Database` DDL blocks of `docs/PRP-LIKHA.md` and `docs/PRP-LINAW.md` — **identical where duplicated** (`agent_decisions` appears once here)
- The `CSS Animations` blocks (byte-identical in both PRPs)
- The shared `Types` shapes (AgentState / AgentOutput / ActivityItem / HitlItem), **module-neutralized**

**No module business behavior from either PRP enters this sprint.** `src/types/likha.ts` and `src/types/linaw.ts` are created in Sprints 2/5, not here.

## Sprint 1 Boundary Rules (apply to EVERY chunk)

1. **No module business logic anywhere.** No OCR, no LLM calls, no fetch/API calls, no pipeline runners, no domain rules. Kit components are prop-driven and module-neutral; the DB chunk is DDL only.
2. **Additive-only edits to existing files.** `src/lib/db.ts` (append inside `initSchema()` only), `src/app/globals.css` (append at end of file only), `src/app/page.tsx` (append nav links only). No existing table, CSS rule, import, or JSX element may be modified or deleted.
3. **Kit neutrality grep gate.** `grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification"` over `src/components/agent-pipeline.tsx`, `src/components/agent-card.tsx`, `src/components/activity-feed.tsx`, `src/types/agentic.ts` must return **zero hits**.
4. **Idempotent DDL.** Every statement is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`; re-running `initSchema()` on an existing DB must be a no-op.
5. **`prefers-reduced-motion` respected.** The pulse animation is disabled under `@media (prefers-reduced-motion: reduce)`; status remains visible via icons.
6. **Exact kit styling tokens.** `h-56` (224px) cards, number badge at `-top-3 -left-3`, `h-8` border-top output section, and the exact glow/pulse values from the PRP `CSS Animations` blocks (reproduced verbatim in S1-C2).
7. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs; a chunk is done only when its commands produce those outputs. Repo-level gates: `npx tsc --noEmit` and `npm run build` (Next.js 15.3.8).

### Decisions made by @instruct_agent (recorded per SPRINT_PLAN Sprint 1 DoD)

- **D1 — Nav approach: minimal placeholder pages + links.** Nav links alone would leave `/likha` and `/linaw` as 404s for the whole sprint and give the DoD "kit render smoke" no home. Decision: create `src/app/likha/page.tsx` and `src/app/linaw/page.tsx` as **foundation-guarded placeholder pages** that render the kit with static fixture props and contain **zero business logic** (no fetch, no DB, no LLM, no handlers beyond no-ops). Sprints 2/5 replace these pages wholesale. This is explicitly permitted by SPRINT_PLAN Sprint 1 DoD ("add minimal placeholder pages guarded as foundation, containing no business logic").
- **D2 — Nav anchor: footer module link cluster only.** Per SPRINT_PLAN §5 ("module link cluster, lines ~353–365"), the additive links go into the footer `<div className="flex items-center gap-4">` cluster in `src/app/page.tsx` (the E.L.L.A./O.B.R.A./Y.A.L.A. `<Link>` group), following that exact pattern. The `MODULES` card grid and `src/lib/workshop-config.ts` are NOT touched in Sprint 1 (they carry module metadata that belongs to the module pages' sprints).
- **D3 — Schema append point.** The 8-table DDL block is appended **inside** `initSchema()`'s existing `database.exec(\`…\`)` template literal, immediately after the last existing statement (`CREATE INDEX IF NOT EXISTS idx_deployments_province ON lgu_deployments(province);`), under a marked comment header. Table order is fixed for FK integrity (`users` and parent tables precede their dependents; `foreign_keys` pragma is ON in this repo).
- **D4 — TDD exempt for Sprint 1.** The repo has no unit-test runner installed (Playwright only, and SPRINT_PLAN §3.6 mandates "Integration tests every sprint **except Sprint 1** — Sprint 1 verified via build + schema assertions + kit render smoke"). All chunks carry `tdd_steps: []` and enforce completion through `verification_commands`.
- **D5 — Animations: `pulse-glow` only.** Per both PRPs: "No recording/voice animations — voice is not a requirement." No `recording-pulse` keyframes.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)          GROUP-B (parallel)      GROUP-C      GROUP-D      GROUP-E      GROUP-F
──────────────────          ──────────────────      ───────      ───────      ───────      ───────
S1-C1 db.ts schema ────────────────────────────────────────────────────────────────────────►┐
S1-C2 globals.css ──────────► S1-C4 agent-card.tsx ─► S1-C5 agent-pipeline.tsx ─► S1-C7 ──► S1-C8 ──► S1-C9
S1-C3 types/agentic.ts ─────► S1-C6 activity-feed.tsx ───────────────────────────► placeholders  nav   final
                              (C4 ∥ C6: disjoint files)                            (kit demo)   links  gate
```

| Chunk | Dependencies | File overlaps | Shared state | Parallel group |
|---|---|---|---|:---:|
| S1-C1 | none | none | none | **GROUP-A** |
| S1-C2 | none | none | none | **GROUP-A** |
| S1-C3 | none | none | none | **GROUP-A** |
| S1-C4 | S1-C2, S1-C3 | none | none | **GROUP-B** |
| S1-C6 | S1-C3 | none | none | **GROUP-B** |
| S1-C5 | S1-C4 (imports AgentCard) | none | none | **GROUP-C** |
| S1-C7 | S1-C2…S1-C6 | none | none | **GROUP-D** |
| S1-C8 | S1-C7 (link targets must exist) | none | none | **GROUP-E** |
| S1-C9 | all (S1-C1…S1-C8) | n/a | n/a | **GROUP-F** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`, zero shared state). When in doubt, execute sequentially (Super Rule 8).

---

## Chunks

---

### S1-C1 — Additive SQLite schema: all 8 foundation tables in `initSchema()`

```json
{
  "chunk_id": "S1-C1",
  "feature_id": "FOUNDATION (Sprint 1 delivers 0 of 19 features — SPRINT_PLAN §2)",
  "chunk_type": "setup",
  "name": "Shared foundation schema — 8 tables + 10 indexes (LIKHA-owned, LINAW-owned, shared audit)",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/lib/db.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Open `src/lib/db.ts` in the PILLAR-pilot repo (Next.js 15.3.8, better-sqlite3). The function `initSchema(database: Database.Database)` contains ONE `database.exec(\`…\`)` template literal whose last statement is:

```sql
    CREATE INDEX IF NOT EXISTS idx_deployments_province
      ON lgu_deployments(province);
```

Immediately AFTER that statement and BEFORE the closing backtick of the same template literal, APPEND the following block exactly as written (verbatim DDL from the PRP `Database` sections; order matters for foreign keys — `foreign_keys` pragma is ON). Do NOT modify, reformat, or remove anything above it. Do NOT add ALTER statements, seeds, or helper functions. This is the ONLY edit to this file in Sprint 1.

```sql
    -- ========== LIKHA + LINAW SHARED FOUNDATION (Sprint 1 — additive, idempotent) ==========
    -- LIKHA-owned tables
    CREATE TABLE IF NOT EXISTS archived_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'scan', original_filename TEXT, scan_file_path TEXT, file_hash TEXT, archive_status TEXT DEFAULT 'processing' CHECK(archive_status IN ('processing','pending_review','published','flagged')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, dilg_submitted INTEGER DEFAULT 0, dilg_submitted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_arch_ord_year ON archived_ordinances(series_year);
    CREATE INDEX IF NOT EXISTS idx_arch_ord_status ON archived_ordinances(status);
    CREATE INDEX IF NOT EXISTS idx_arch_ord_astat ON archived_ordinances(archive_status);

    CREATE TABLE IF NOT EXISTS classifications ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL, category TEXT NOT NULL, confidence REAL, assigned_by TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id) ON DELETE CASCADE );

    CREATE TABLE IF NOT EXISTS amendment_links ( id TEXT PRIMARY KEY, amending_id TEXT NOT NULL, amended_id TEXT NOT NULL, relationship_type TEXT NOT NULL, detected_by TEXT NOT NULL, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(amending_id) REFERENCES archived_ordinances(id), FOREIGN KEY(amended_id) REFERENCES archived_ordinances(id) );

    -- LINAW-owned tables
    CREATE TABLE IF NOT EXISTS linaw_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('scan','import','manual')), source_filename TEXT, file_hash TEXT, library_status TEXT DEFAULT 'pending_review' CHECK(library_status IN ('processing','pending_review','ready','rejected')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_linaw_ord_year ON linaw_ordinances(series_year);
    CREATE INDEX IF NOT EXISTS idx_linaw_ord_lstat ON linaw_ordinances(library_status);

    CREATE TABLE IF NOT EXISTS codification_records ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL UNIQUE, title_number INTEGER, chapter_number INTEGER, article_number INTEGER, section_in_code INTEGER, cod_status TEXT DEFAULT 'unclassified' CHECK(cod_status IN ('unclassified','classified','reviewed','approved','codified')), ai_suggestion TEXT, human_override TEXT, reviewed_by_id TEXT, approved_by_id TEXT, approved_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(reviewed_by_id) REFERENCES users(id), FOREIGN KEY(approved_by_id) REFERENCES users(id) );

    CREATE TABLE IF NOT EXISTS ordinance_relationships ( id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, relationship_type TEXT NOT NULL, section_ref TEXT, confidence REAL NOT NULL, confirmed INTEGER DEFAULT 0, confirmed_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(source_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(target_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(confirmed_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_ord_rel_source ON ordinance_relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_ord_rel_target ON ordinance_relationships(target_id);
    CREATE INDEX IF NOT EXISTS idx_ord_rel_type ON ordinance_relationships(relationship_type);

    CREATE TABLE IF NOT EXISTS code_volumes ( id TEXT PRIMARY KEY, title TEXT NOT NULL, edition TEXT NOT NULL, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','under_review','published')), structure TEXT NOT NULL, generated_at TEXT, published_at TEXT, generated_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(generated_by_id) REFERENCES users(id) );

    -- Shared audit table (module-scoped rows: module='likha'|'linaw'); IF NOT EXISTS makes it safe whichever module builds first
    CREATE TABLE IF NOT EXISTS agent_decisions ( id TEXT PRIMARY KEY, module TEXT NOT NULL, pipeline_id TEXT NOT NULL, agent_id INTEGER NOT NULL, agent_name TEXT NOT NULL, action TEXT NOT NULL, input_snapshot TEXT, output_snapshot TEXT, confidence REAL, user_id TEXT, reason TEXT, created_at TEXT DEFAULT (datetime('now')) );
    CREATE INDEX IF NOT EXISTS idx_agent_dec_pipeline ON agent_decisions(pipeline_id);
    CREATE INDEX IF NOT EXISTS idx_agent_dec_module ON agent_decisions(module, created_at);
```

Boundary rules for this chunk: additive-only edit inside `initSchema()`; idempotent DDL only; no business logic (no queries, inserts, seeds, or exports added); no existing table altered.

**acceptance_criteria:**

1. `src/lib/db.ts` contains all 8 `CREATE TABLE IF NOT EXISTS` statements: `archived_ordinances`, `classifications`, `amendment_links`, `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, `agent_decisions` — verbatim columns/constraints as above.
2. All 10 indexes present: `idx_arch_ord_year`, `idx_arch_ord_status`, `idx_arch_ord_astat`, `idx_linaw_ord_year`, `idx_linaw_ord_lstat`, `idx_ord_rel_source`, `idx_ord_rel_target`, `idx_ord_rel_type`, `idx_agent_dec_pipeline`, `idx_agent_dec_module`.
3. The diff of `src/lib/db.ts` shows ONLY added lines (no removed/modified existing lines).
4. Opening the dev DB twice in a row runs `initSchema()` twice without error (idempotency), and pre-existing tables (`workshop_sessions`, `users`, `admin_users`, `kb_documents`, `ecs_instances`, …) remain intact.
5. No query/insert/business logic introduced.

**verification_commands (run from repo root, POSIX shell / Git Bash):**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_arch_ord_year','idx_arch_ord_status','idx_arch_ord_astat','idx_linaw_ord_year','idx_linaw_ord_lstat','idx_ord_rel_source','idx_ord_rel_target','idx_ord_rel_type','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); const legacy=['workshop_sessions','participant_sessions','users','admin_users','kb_documents']; const lost=legacy.filter(n=>!names.includes(n)); if(missing.length||lost.length){console.error('FAIL missing:',missing,'lost:',lost); process.exit(1);} console.log('SCHEMA OK: 8 tables + 10 indexes present; legacy tables intact');"
# expected output: SCHEMA OK: 8 tables + 10 indexes present; legacy tables intact
# RUN THIS COMMAND TWICE — the second run proves idempotency (same output, exit 0)

git diff --unified=0 -- src/lib/db.ts | grep -c '^-[^-]'
# expected: 0  (zero removed lines — additive only)
```

---

### S1-C2 — `globals.css`: CSS variables + glow classes + pulse keyframes (append-only)

```json
{
  "chunk_id": "S1-C2",
  "feature_id": "FOUNDATION",
  "chunk_type": "setup",
  "name": "Agentic kit CSS tokens — :root variables, 7 glow classes, pulse-glow keyframes, reduced-motion guard",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/app/globals.css"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Open `src/app/globals.css`. The file ends with the closing `}` of the `@layer components` block. APPEND the following block at the END of the file, exactly as written (verbatim from the PRP `CSS Animations` sections — values must match to the pixel/alpha). Do NOT modify or reformat any existing rule; the existing `@layer base { :root { … } }` uses different token names (`--pillar-*`) and stays untouched. No recording/voice animations.

```css
/* ── LIKHA + LINAW shared agentic kit utilities (Sprint 1 — append-only) ─────────────── */

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
```

Boundary rules for this chunk: append-only (no edits above the appended block); exact values (the six `--` variables, seven `glow-*` classes with the exact rgba/blur values, `pulse-glow` = opacity 1 → 0.6 → 1 at 1.5s ease-in-out infinite); `prefers-reduced-motion` guard mandatory.

**acceptance_criteria:**

1. File ends with the appended block; all 6 CSS variables, 7 glow classes, `@keyframes pulse-glow`, `.animate-pulse-glow`, and the reduced-motion media query present with exact values.
2. No existing rule modified (diff shows additions only).
3. Tailwind/PostCSS still compile (`npm run build` passes).

**verification_commands:**

```bash
grep -c "glow-" src/app/globals.css
# expected: 7  (one line per glow class)

grep -c "prefers-reduced-motion" src/app/globals.css
# expected: >= 1  (the Sprint 1 guard; any pre-existing occurrences add to the count)

grep -n "pulse-glow 1.5s ease-in-out infinite" src/app/globals.css
# expected: 1 match on the .animate-pulse-glow line

git diff --unified=0 -- src/app/globals.css | grep -c '^-[^-]'
# expected: 0  (append-only)

npm run build
# expected: build completes successfully (PostCSS/Tailwind compile the appended block without errors)
```

---

### S1-C3 — `src/types/agentic.ts`: shared module-neutral kit interfaces

```json
{
  "chunk_id": "S1-C3",
  "feature_id": "FOUNDATION",
  "chunk_type": "setup",
  "name": "Shared agentic types — AgentState / AgentOutputBase / ActivityItem / HitlItem / AgentDecisionRecord",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/agentic.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW file `src/types/agentic.ts` containing the module-neutral shared interfaces for the agentic UI kit. These are the module-neutralized versions of the PRP `Types` sections: the PRPs fix `module: 'likha'` / `module: 'linaw'` and module-specific output/gate fields — here, generify them. Modules narrow these generics in `src/types/likha.ts` (Sprint 2) and `src/types/linaw.ts` (Sprint 5); do NOT create those files now. TypeScript strict mode must pass. The file must NOT contain the tokens `archived_ordinances`, `linaw_ordinances`, `ordinanceNumber`, or `codification` anywhere (kit-neutrality grep gate). Write exactly:

```ts
// src/types/agentic.ts
// Sprint 1 shared foundation — module-neutral types for the agentic UI kit
// (agent-pipeline.tsx / agent-card.tsx / activity-feed.tsx).
// Module-specific narrowings live in src/types/likha.ts (Sprint 2) and
// src/types/linaw.ts (Sprint 5). No domain entities here.

export type AgenticModuleName = 'likha' | 'linaw';

export type AgentStatus = 'idle' | 'processing' | 'completed' | 'error' | 'hitl';
export type ActivityType = 'success' | 'warning' | 'error' | 'hitl';
export type ActivityStatus = 'pending' | 'confirmed' | 'editing' | 'rejected';
export type HitlSuggestedAction = 'confirm' | 'reject' | 'edit';
export type HitlFieldType = 'text' | 'number' | 'select' | 'multiselect';

/** Base output every agent emits. Modules extend it with domain fields. */
export interface AgentOutputBase {
  /** Short preview line rendered in the agent card's h-8 output section on completion. */
  preview?: string;
  success?: boolean;
  hitlRequired?: boolean;
  exceptions?: string[];
  confidence?: number;
  [key: string]: unknown;
}

/** One pipeline agent card's state. Generic over module (M) and output shape (O). */
export interface AgentState<
  M extends AgenticModuleName = AgenticModuleName,
  O extends AgentOutputBase = AgentOutputBase,
> {
  id: number;
  name: string;
  module: M;
  description: string;
  status: AgentStatus;
  /** Agent hex color, e.g. '#F59E0B' (badge + bot icon tint). */
  color: string;
  /** Glow utility class from globals.css, e.g. 'glow-amber'. */
  glowClass: string;
  output?: O;
}

/** One activity-feed card. */
export interface ActivityItem<O extends AgentOutputBase = AgentOutputBase> {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  details: string;
  timestamp: string;
  data?: O;
  userId?: string;
  reason?: string;
}

/** One editable field inside a HITL inline-edit form. */
export interface HitlFieldSpec {
  type: HitlFieldType;
  label: string;
  value: unknown;
}

/** A paused-pipeline human decision request. `gate` stays string here; modules narrow it. */
export interface HitlItem<
  M extends AgenticModuleName = AgenticModuleName,
  O extends AgentOutputBase = AgentOutputBase,
> {
  id: string;
  activityId: string;
  agentId: number;
  module: M;
  gate: string;
  fieldSchema: Record<string, HitlFieldSpec>;
  suggestedAction: HitlSuggestedAction;
  context: O;
}

/** Row shape of the shared `agent_decisions` audit table (module-scoped by the module column). */
export interface AgentDecisionRecord {
  id: string;
  module: AgenticModuleName;
  pipelineId: string;
  agentId: number;
  agentName: string;
  action: 'start' | 'complete' | 'hitl' | 'confirm' | 'reject' | 'error';
  inputSnapshot?: string;
  outputSnapshot?: string;
  confidence?: number;
  userId?: string;
  reason?: string;
  createdAt: string;
}
```

Boundary rules for this chunk: no module business logic; no domain entity types (those belong to Sprint 2/5 module type files); no imports of other project files (pure type module); must not contain the four forbidden tokens.

**acceptance_criteria:**

1. File exists at `src/types/agentic.ts` and compiles under `strict: true`.
2. Exports: `AgenticModuleName`, `AgentStatus`, `ActivityType`, `ActivityStatus`, `HitlSuggestedAction`, `HitlFieldType`, `AgentOutputBase`, `AgentState`, `ActivityItem`, `HitlFieldSpec`, `HitlItem`, `AgentDecisionRecord`.
3. `AgentState`/`HitlItem` are generic over the module name; `ActivityItem` is generic over the output shape.
4. Neutrality grep returns zero hits on this file.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/types/agentic.ts
# expected: no output, exit code 1 (zero hits)

grep -c "export " src/types/agentic.ts
# expected: 12  (the 12 exported types/interfaces above)
```

---

### S1-C4 — `src/components/agent-card.tsx`: shared agent card (CRITICAL STYLING)

```json
{
  "chunk_id": "S1-C4",
  "feature_id": "FOUNDATION",
  "chunk_type": "frontend_component",
  "name": "AgentCard — h-56 uniform card, number badge, status icons, glow + pulse, h-8 output section",
  "parallel_group": "GROUP-B",
  "dependencies": ["S1-C2", "S1-C3"],
  "file_outputs": ["src/components/agent-card.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/agent-card.tsx` (`'use client';`) — the shared, module-neutral agent card used by both LIKHA and LINAW pipelines. It is strictly prop-driven: it receives one `AgentState` (from `@/types/agentic`) and renders it. NO business logic: no fetch, no timers, no DB, no module names in copy. Use `cn` from `@/lib/utils` and lucide-react icons (`Loader2`, `Check`, `AlertTriangle`, `Hand`, `Bot`). Exact styling contract (DESIGN.md §5 + PRP "Agent Card — CRITICAL STYLING"):

1. **Outer container:** `relative flex h-56 w-40 flex-col rounded-xl border bg-[#1E293B] p-3` — fixed height `h-56` (224px), uniform for all cards. Border color `border-[#283147]` normally; when `status === 'hitl'`, rose border `border-[#F43F5E]` plus class `glow-rose`. When `status === 'processing'`, apply `cn(agent.glowClass, 'animate-pulse-glow')` (color-matched glow + pulse). When `status === 'completed'`, apply `agent.glowClass` without pulse.
2. **Number badge:** circular (`h-7 w-7 rounded-full`), positioned `absolute -top-3 -left-3`, agent hex background (`style={{ backgroundColor: agent.color }}`), white bold number centered, `text-xs font-bold`, subtle dark ring (`ring-2 ring-[#0F1729]`).
3. **Status icon top-right** (`absolute right-2 top-2`): `Loader2` with `animate-spin` (processing) / `Check` in `#22C55E` (completed) / `AlertTriangle` in `#F87171` (error) / `Hand` in `#F43F5E` (hitl) / nothing when idle.
4. **Bot icon:** centered, inside a rounded square (`h-12 w-12 rounded-xl flex items-center justify-center`) whose background is the agent color at 20% opacity (`style={{ backgroundColor: agent.color + '33' }}`); icon color = `agent.color`.
5. **Name:** bold, centered, `text-sm font-bold text-white`. **Description:** centered, `flex-1 text-xs text-[#94A3B8]`, `line-clamp-3`.
6. **Output section:** ALWAYS rendered at the bottom: `mt-2 flex h-8 items-center justify-center border-t border-[#283147] px-1 text-[10px]` — shows `agent.output?.preview` (truncated) ONLY when `status === 'completed'`; otherwise a muted `—`.
7. **Reduced motion:** the pulse comes from `.animate-pulse-glow`, which globals.css disables under `prefers-reduced-motion`; status stays visible via icons. Do not add any other animation.

Export: `export default function AgentCard({ agent, className }: { agent: AgentState; className?: string })`. Props only — never import module config, never branch on `agent.module`. The file must not contain the tokens `archived_ordinances`, `linaw_ordinances`, `ordinanceNumber`, or `codification`.

**acceptance_criteria:**

1. `h-56` card height, `-top-3 -left-3` badge, `h-8` border-top output section, all four status icons, bot icon at 20%-opacity agent color — all present.
2. Processing state applies `agent.glowClass` + `animate-pulse-glow`; hitl state applies rose border + `glow-rose`; completed shows preview text only.
3. Zero business logic (no fetch/db/timeouts); prop-driven; neutrality grep zero hits.
4. Compiles clean under `strict: true`.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/components/agent-card.tsx
# expected: no output, exit code 1 (zero hits)

grep -c "h-56" src/components/agent-card.tsx && grep -c "\-top-3 \-left-3" src/components/agent-card.tsx && grep -c "h-8" src/components/agent-card.tsx && grep -c "animate-pulse-glow" src/components/agent-card.tsx
# expected: each count >= 1

grep -REn "fetch\(|getDb|setTimeout|from ['\"]@/lib/(db|ai)" src/components/agent-card.tsx
# expected: no output, exit code 1 (zero logic)
```

---

### S1-C5 — `src/components/agent-pipeline.tsx`: horizontal pipeline visualization

```json
{
  "chunk_id": "S1-C5",
  "feature_id": "FOUNDATION",
  "chunk_type": "frontend_component",
  "name": "AgentPipeline — Brain input bookend (cyan glow) → N AgentCards → Database output bookend (green glow), arrows, rose HITL marker",
  "parallel_group": "GROUP-C",
  "dependencies": ["S1-C4"],
  "file_outputs": ["src/components/agent-pipeline.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/agent-pipeline.tsx` (`'use client';`) — the shared horizontal pipeline visualization. It imports and renders `AgentCard` from `@/components/agent-card` and types from `@/types/agentic`. Props interface (all rendering is derived from props; NO business logic, no state):

```ts
interface AgentPipelineProps {
  agents: AgentState[];          // rendered in array order, numbered by position is the CARD's job (agent.id)
  isProcessing: boolean;         // pipeline run active → input bookend glows cyan + pulses
  pipelineComplete?: boolean;    // all work done → output bookend glows green
  className?: string;
}
```

Rendering contract (DESIGN.md §2.2/§5 + PRP "Agent Pipeline (shared kit)"):

1. Container: `flex flex-wrap items-center gap-3` — horizontal flow that wraps on mobile **maintaining order** (DESIGN.md §6).
2. **Input bookend:** `Brain` icon (lucide-react) in a `h-14 w-14 rounded-2xl border border-[#283147] bg-[#1E293B] flex items-center justify-center` box, icon color `#22D3EE`. While `isProcessing`, add classes `glow-cyan animate-pulse-glow`.
3. Between the input bookend, each card, and the output bookend: an `ArrowRight` icon (`h-4 w-4 text-[#94A3B8]`).
4. Each agent renders as `<AgentCard agent={agent} />`.
5. **HITL marker:** when an agent's `status === 'hitl'`, render a small rose `Hand` icon badge (`absolute -top-2 right-0 text-[#F43F5E]`) over the arrow immediately AFTER that agent's card (wrap that arrow in a `relative` span). This marks where the pipeline is paused.
6. **Output bookend:** `Database` icon in the same box style; icon color `#22C55E` with class `glow-emerald` when `pipelineComplete`, otherwise muted `#94A3B8` with no glow.
7. No timers, no callbacks, no module branching. The file must not contain the tokens `archived_ordinances`, `linaw_ordinances`, `ordinanceNumber`, or `codification`.

Export `export default function AgentPipeline(props: AgentPipelineProps)`.

**acceptance_criteria:**

1. Renders Brain → arrows → N AgentCards → arrows → Database, in order, wrapping responsively.
2. Cyan glow + pulse on the Brain while `isProcessing`; green glow on Database when `pipelineComplete`; rose Hand marker appears on the arrow after any hitl-status agent.
3. Prop-driven only; zero business logic; neutrality grep zero hits.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/components/agent-pipeline.tsx
# expected: no output, exit code 1 (zero hits)

grep -c "from '@/components/agent-card'" src/components/agent-pipeline.tsx || grep -c 'from "@/components/agent-card"' src/components/agent-pipeline.tsx
# expected: 1 (reuses the shared AgentCard; no duplicated card markup)

grep -REn "fetch\(|getDb|setTimeout|useState" src/components/agent-pipeline.tsx
# expected: no output, exit code 1 (presentational only)
```

---

### S1-C6 — `src/components/activity-feed.tsx`: shared activity feed with Confirm/Edit/Reject

```json
{
  "chunk_id": "S1-C6",
  "feature_id": "FOUNDATION",
  "chunk_type": "frontend_component",
  "name": "ActivityFeed — empty state, left-border type colors, Confirm/Edit inline form, confirmed badge, scrollable",
  "parallel_group": "GROUP-B",
  "dependencies": ["S1-C3"],
  "file_outputs": ["src/components/activity-feed.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/activity-feed.tsx` (`'use client';`) — the shared, module-neutral activity feed. It consumes `ActivityItem` from `@/types/agentic` and communicates exclusively through callbacks. Props:

```ts
interface ActivityFeedProps {
  activities: ActivityItem[];
  emptyMessage?: string;                 // default: 'No activities yet. Start a pipeline to see results.'
  onConfirm?: (activityId: string) => void;
  onEdit?: (activityId: string, data: Record<string, unknown>) => void;
  onReject?: (activityId: string, reason: string) => void;
  className?: string;
}
```

Rendering contract (PRP "Activity Feed (shared kit)" + DESIGN.md):

1. **Empty state:** when `activities.length === 0`, render `emptyMessage` in muted text (`text-sm text-[#94A3B8]`).
2. **Container:** scrollable `max-h-96 overflow-y-auto space-y-3`.
3. **Card:** dark panel (`rounded-lg border border-[#283147] bg-[#1E293B] p-3`) with a 4px LEFT border colored by `item.type`: success `#22C55E`, warning `#FACC15`, error `#F87171`, hitl `#F43F5E` (inline `borderLeft` style). Header row: type icon (lucide `CheckCircle2` success / `AlertTriangle` warning / `XCircle` error / `Hand` hitl, tinted with the same color) + `title` (`text-sm font-semibold text-white`) + right-aligned `timestamp` (`ml-auto text-[10px] text-[#94A3B8]`). Below: `details` (`text-xs text-[#94A3B8]`).
4. **Pending items** (`status === 'pending'`): show **Confirm** (green background `#22C55E`, dark text) and **Edit** (gray `#334155`, white text) buttons, plus a subtle **Reject** text button. Touch targets ≥44px tall on small screens (`min-h-11` on buttons per DESIGN.md §6).
5. **Edit flow:** clicking Edit switches that card to an inline form generated NEUTRALLY from the scalar fields of `item.data` (string/number values only): one labeled input per field, label derived from the key by inserting spaces before capitals (e.g. `seriesYear` → "Series Year"); number fields use `type="number"`. Save calls `onEdit(item.id, draft)`; Cancel restores. Do NOT hardcode any domain field names.
6. **Reject flow:** clicking Reject reveals an inline reason input + confirm button; confirming requires a non-empty reason and calls `onReject(item.id, reason)`.
7. **Confirmed:** green pill badge with checkmark (`inline-flex items-center gap-1 rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-[10px] text-[#22C55E]`, lucide `Check`). **Rejected:** shows `item.reason` in rose-tinted text.
8. Local `useState` is allowed ONLY for per-card edit drafts/reason inputs (UI state). No fetch, no DB, no module names in copy. The file must not contain the tokens `archived_ordinances`, `linaw_ordinances`, `ordinanceNumber`, or `codification`.

Export `export default function ActivityFeed(props: ActivityFeedProps)`.

**acceptance_criteria:**

1. Empty state renders the default message; cards show type-colored left borders, icons, right-aligned timestamps.
2. Pending cards expose Confirm/Edit/Reject; Edit builds the inline form generically from `item.data` scalars; Reject requires a reason; confirmed badge renders.
3. Zero hardcoded domain fields; neutrality grep zero hits; callbacks-only integration.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/components/activity-feed.tsx
# expected: no output, exit code 1 (zero hits)

grep -c "No activities yet. Start a pipeline to see results." src/components/activity-feed.tsx
# expected: 1  (default empty-state message)

grep -REn "fetch\(|getDb|from ['\"]@/lib/(db|ai)" src/components/activity-feed.tsx
# expected: no output, exit code 1 (zero logic)
```

---

### S1-C7 — Placeholder pages `/likha` and `/linaw` (kit render smoke targets, zero logic)

```json
{
  "chunk_id": "S1-C7",
  "feature_id": "FOUNDATION",
  "chunk_type": "frontend_page",
  "name": "Foundation placeholder pages rendering the kit demo (static fixtures, no-op handlers)",
  "parallel_group": "GROUP-D",
  "dependencies": ["S1-C2", "S1-C3", "S1-C4", "S1-C5", "S1-C6"],
  "file_outputs": ["src/app/likha/page.tsx", "src/app/linaw/page.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create TWO new pages, `src/app/likha/page.tsx` and `src/app/linaw/page.tsx` (decision D1: these are foundation-guarded placeholders so Sprint 1 nav links resolve and the DoD "kit render smoke" has a home; Sprints 2 and 5 replace them wholesale). Each is a `'use client';` page that renders the shared kit with STATIC fixtures and NO-OP handlers. Absolutely ZERO business logic: no `fetch`, no `getDb`, no imports from `@/lib/*` except `@/lib/utils`, no timers, no API calls.

Shared structure for both pages (differ only in `module`, title, and sprint note):

1. Import `AgentPipeline` from `@/components/agent-pipeline`, `ActivityFeed` from `@/components/activity-feed`, and `AgentState`, `ActivityItem` from `@/types/agentic`.
2. Static fixture — six module-neutral demo agents exercising every visual state (module is `'likha'` in the likha page, `'linaw'` in the linaw page):

```ts
const DEMO_AGENTS: AgentState[] = [
  { id: 1, name: 'Agent 1', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'completed',  color: '#F59E0B', glowClass: 'glow-amber',   output: { preview: 'Step complete', success: true } },
  { id: 2, name: 'Agent 2', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'completed',  color: '#10B981', glowClass: 'glow-emerald', output: { preview: 'Step complete', success: true } },
  { id: 3, name: 'Agent 3', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'processing', color: '#8B5CF6', glowClass: 'glow-violet' },
  { id: 4, name: 'Agent 4', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'idle',       color: '#0EA5E9', glowClass: 'glow-sky' },
  { id: 5, name: 'Agent 5', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'hitl',       color: '#F43F5E', glowClass: 'glow-rose' },
  { id: 6, name: 'Agent 6', module: 'likha', description: 'Foundation preview — wired in the module sprint', status: 'idle',       color: '#6366F1', glowClass: 'glow-indigo' },
];

const DEMO_ACTIVITIES: ActivityItem[] = [
  { id: 'demo-hitl',    type: 'hitl',    status: 'pending',   title: 'Human review required', details: 'Demo HITL card — the pipeline pauses here until a person acts.', timestamp: new Date().toISOString() },
  { id: 'demo-success', type: 'success', status: 'confirmed', title: 'Demo step finished',      details: 'Confirmed activity example.',                                 timestamp: new Date().toISOString() },
];
```

(Use `module: 'linaw'` in the linaw page.)

3. Page shell consistent with the PILLAR dark theme: `min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))] px-6 py-10` wrapper containing:
   - H1 title: `L.I.K.H.A.` / `L.I.N.A.W.` (`text-3xl font-black tracking-widest`).
   - A foundation notice pill: "Foundation preview — shared agentic kit (Sprint 1). This module lands in Sprint 2." (likha) / "…lands in Sprint 5." (linaw).
   - Section label "AGENT PIPELINE" (`text-xs font-semibold uppercase tracking-widest text-[hsl(var(--pillar-muted))]`) then `<AgentPipeline agents={DEMO_AGENTS} isProcessing={true} pipelineComplete={false} />`.
   - Section label "ACTIVITY FEED" then `<ActivityFeed activities={DEMO_ACTIVITIES} onConfirm={() => {}} onEdit={() => {}} onReject={() => {}} />`.
4. The pages must not contain the tokens `archived_ordinances`, `linaw_ordinances`, `ordinanceNumber`, or `codification`.

**acceptance_criteria:**

1. Both pages exist, compile, and render the kit with static fixtures (6 cards each: 2 completed, 1 processing, 2 idle, 1 hitl).
2. Zero business logic: no fetch/db/llm imports, no timers, no-op handlers only.
3. Each page states it is a Sprint-1 foundation preview and which sprint replaces it.
4. `npm run build` succeeds and lists `/likha` and `/linaw` routes.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run build
# expected: build succeeds; the route table includes /likha and /linaw

grep -REn "fetch\(|getDb|from ['\"]@/lib/(db|ai|logger)|setTimeout|setInterval" src/app/likha/page.tsx src/app/linaw/page.tsx
# expected: no output, exit code 1 (zero logic)

grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" src/app/likha/page.tsx src/app/linaw/page.tsx
# expected: no output, exit code 1 (zero hits)

grep -c "Foundation preview" src/app/likha/page.tsx && grep -c "Foundation preview" src/app/linaw/page.tsx
# expected: 1 and 1 (foundation guard present in both)
```

---

### S1-C8 — Additive portal nav links for `/likha` and `/linaw` on `src/app/page.tsx`

```json
{
  "chunk_id": "S1-C8",
  "feature_id": "FOUNDATION",
  "chunk_type": "integration",
  "name": "Landing footer module link cluster — add L.I.K.H.A. + L.I.N.A.W. links (ELLA/OBRA/YALA pattern)",
  "parallel_group": "GROUP-E",
  "dependencies": ["S1-C7"],
  "file_outputs": ["src/app/page.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Edit `src/app/page.tsx` (decision D2: footer module link cluster only — the existing ELLA/OBRA/YALA pattern). Locate the footer's link cluster:

```tsx
          <div className="flex items-center gap-4">
            <Link
              href="/ella"
              className="transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              E.L.L.A.
            </Link>
            <Link
              href="/obra"
              className="transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              O.B.R.A.
            </Link>
            <Link
              href="/yala"
              className="transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              Y.A.L.A.
            </Link>
          </div>
```

APPEND exactly two new `<Link>` elements AFTER the `Y.A.L.A.` link and BEFORE the closing `</div>`, following the identical pattern:

```tsx
            <Link
              href="/likha"
              className="transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              L.I.K.H.A.
            </Link>
            <Link
              href="/linaw"
              className="transition-colors hover:text-[hsl(var(--pillar-text))]"
            >
              L.I.N.A.W.
            </Link>
```

Boundary rules: this is the ONLY change to `page.tsx` in Sprint 1. Do NOT touch the `MODULES` array, `WORKSHOP_SESSION`, the "Workshop Tools" card grid, the "Suggested Workflow" section, or `src/lib/workshop-config.ts`. Existing E.L.L.A./O.B.R.A./Y.A.L.A. links stay byte-identical. The link targets `/likha` and `/linaw` already exist (S1-C7 placeholder pages), so no dead links. No new imports are needed (`Link` is already imported).

**acceptance_criteria:**

1. Footer cluster renders 5 module links in order: E.L.L.A., O.B.R.A., Y.A.L.A., L.I.K.H.A., L.I.N.A.W.
2. Diff of `src/app/page.tsx` shows additions only.
3. `/likha` and `/linaw` resolve (placeholder pages from S1-C7) — no 404s.
4. Build passes.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c 'href="/likha"' src/app/page.tsx && grep -c 'href="/linaw"' src/app/page.tsx
# expected: 1 and 1

grep -c 'href="/ella"' src/app/page.tsx && grep -c 'href="/obra"' src/app/page.tsx && grep -c 'href="/yala"' src/app/page.tsx
# expected: 2, 2, 2  (hero CTA + footer for each — pre-existing links untouched)

git diff --unified=0 -- src/app/page.tsx | grep -c '^-[^-]'
# expected: 0  (append-only)

npm run build
# expected: build succeeds
```

---

### S1-C9 — Sprint 1 final verification & boundary gate (no new files)

```json
{
  "chunk_id": "S1-C9",
  "feature_id": "FOUNDATION",
  "chunk_type": "testing",
  "name": "Sprint 1 boundary verification — build, schema assertions, kit neutrality grep, kit render smoke",
  "parallel_group": "GROUP-F (sequential gate)",
  "dependencies": ["S1-C1", "S1-C2", "S1-C3", "S1-C4", "S1-C5", "S1-C6", "S1-C7", "S1-C8"],
  "file_outputs": [],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint 1 boundary-verification battery exactly as listed below, from the repo root (POSIX shell / Git Bash). No code changes happen in this chunk; if any check fails, return to the responsible chunk (C1 schema · C2 css · C3 types · C4 card · C5 pipeline · C6 feed · C7 placeholders · C8 nav) and fix there. Record every output as SPRINT_REVIEW evidence. This sprint has NO integration tests by design (SPRINT_PLAN §3.6) — this battery IS the verification.

**verification_commands and expected outputs:**

```bash
# 1. Type check
npx tsc --noEmit
# expected: no output, exit code 0

# 2. Production build
npm run build
# expected: "Compiled successfully"; route table includes /, /likha, /linaw

# 3. Lint
npm run lint
# expected: no errors. (Pre-existing warnings in files NOT touched by Sprint 1 are tolerated;
# zero findings in src/components/agent-*.tsx, activity-feed.tsx, src/types/agentic.ts,
# src/app/likha/page.tsx, src/app/linaw/page.tsx is mandatory.)

# 4. Kit neutrality grep (SPRINT_PLAN Sprint 1 boundary check)
grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" \
  src/components/agent-pipeline.tsx src/components/agent-card.tsx \
  src/components/activity-feed.tsx src/types/agentic.ts
# expected: no output, exit code 1 (ZERO hits — kit is prop-driven, module-neutral)

# 5. Schema assertions + idempotency (run the tsx command TWICE; both must pass)
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_arch_ord_year','idx_arch_ord_status','idx_arch_ord_astat','idx_linaw_ord_year','idx_linaw_ord_lstat','idx_ord_rel_source','idx_ord_rel_target','idx_ord_rel_type','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); const legacy=['workshop_sessions','participant_sessions','users','admin_users','kb_documents','ecs_instances','lgu_deployments']; const lost=legacy.filter(n=>!names.includes(n)); if(missing.length||lost.length){console.error('FAIL missing:',missing,'lost:',lost); process.exit(1);} console.log('SCHEMA OK: 8 tables + 10 indexes present; legacy tables intact');"
# expected (both runs): SCHEMA OK: 8 tables + 10 indexes present; legacy tables intact

# 6. Additivity of all existing-file edits (diff shows additions only)
git diff --unified=0 -- src/lib/db.ts src/app/globals.css src/app/page.tsx | grep -c '^-[^-]'
# expected: 0  (no removed lines in any pre-existing file)

# 7. Kit render smoke (SPRINT_PLAN Sprint 1 verification method)
npm run dev &   # background; wait for "Ready" on http://localhost:3000
sleep 8
curl -s http://localhost:3000/likha | grep -o "Agent [1-6]" | sort -u | wc -l   # expected: 6
curl -s http://localhost:3000/linaw | grep -o "Agent [1-6]" | sort -u | wc -l   # expected: 6
curl -s http://localhost:3000/likha | grep -c "animate-pulse-glow"               # expected: >= 1 (processing card pulses)
curl -s http://localhost:3000/linaw | grep -c "No activities yet\|Human review required"  # expected: >= 1 (feed renders)
curl -s http://localhost:3000/ | grep -c 'href="/likha"\|href="/linaw"'          # expected: 2 (footer nav links)
kill %1

# 8. Directional boundary pre-check (module namespaces must not exist yet)
ls src/lib/likha src/lib/linaw src/app/api/likha src/app/api/linaw 2>/dev/null
# expected: every path "No such file or directory" (module code starts in Sprints 2/5)
```

**acceptance_criteria:**

1. Commands 1–4 and 6–8 all produce their expected outputs.
2. Command 5 passes twice (idempotent schema).
3. All evidence (command outputs) captured for SPRINT_REVIEW and the cumulative quality score.
4. After SPRINT_REVIEW passes: tag the sprint `v0.1.0-sprint-1` (SPRINT_PLAN §3.6 convention).

---

## Sprint 1 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 1)

- [ ] All 8 tables (`archived_ordinances`, `classifications`, `amendment_links`, `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, `agent_decisions`) + 10 indexes created idempotently in `src/lib/db.ts` `initSchema()`; dev DB opens cleanly twice in a row; existing tables/rows untouched (S1-C1, S1-C9.5)
- [ ] Kit renders a demo 6-agent pipeline (static fixture props) with correct `h-56` cards, `-top-3 -left-3` badges, `h-8` output sections, glow/pulse, HITL rose state (S1-C4…S1-C7, S1-C9.7)
- [ ] `next build` and `tsc --noEmit` pass; lint clean for all Sprint 1 files (S1-C9.1–3)
- [ ] Nav links to `/likha` and `/linaw` present on `src/app/page.tsx` footer cluster following the ELLA/OBRA/YALA pattern; decision D1 recorded — minimal foundation-guarded placeholder pages (zero business logic) back the links; pages are replaced wholesale in Sprints 2/5 (S1-C7, S1-C8)
- [ ] Kit neutrality grep returns zero hits across `agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx`, `agentic.ts` (S1-C9.4)
- [ ] `globals.css` carries the six `--` CSS variables, seven exact glow classes, `pulse-glow` keyframes + reduced-motion guard — appended only (S1-C2, S1-C9.6)
- [ ] `prefers-reduced-motion` disables pulse; status icons remain (S1-C2, S1-C4)
- [ ] Tag `v0.1.0-sprint-1` after SPRINT_REVIEW (cumulative quality score recorded) — SPRINT_PLAN §3.6
- [ ] No module business logic anywhere; no `src/lib/likha`, `src/lib/linaw`, `src/app/api/likha`, or `src/app/api/linaw` created (S1-C9.8)

**Handoff:** Sprint 2 (LIKHA Ingestion & Extraction — L001/L002/L003, PRP-LIKHA only) and Sprint 5 (LINAW standalone ingestion — N013/N014, PRP-LINAW only) may now build on this foundation; both depend on Sprint 1 and on nothing else.

---

*Prepared by @instruct_agent — SUPER PRIME Context Building Agent v2.2 (Expanded mode, per-sprint instruction sets per U1) · session pillar-likha-linaw-20260809 · Sprint 1 of 7*
