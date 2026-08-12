# Sprint 6 Instruction Set — LINAW Inventory, Classification & Relationship Detection

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 6 of 7 — "LINAW Inventory, Classification & Relationship Detection" — features **N001, N002, N003, N004** |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith (verified installed), React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^12, lucide-react ^0.468, openai ^6.35, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `node:test`), test runner `tsx --test` (scripts `test` / `test:integration`), git tag baseline `v0.5.0-sprint-5` |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 6 uses **`docs/PRP-LINAW.md` ONLY** — it is the sole module instruction source. Do NOT read or attach any module section of `docs/PRP-LIKHA.md`. Supporting inputs already consumed by this instruction set: `docs/PRD-LINAW.md` §6.6 (pipeline logic, data processing rules, exception flagging rules), §6.7 (agent definitions 1–6), §6.8 features 1–4 (N001–N004 acceptance), §12.4 (HITL gates), §12.5 (data model), §12.6 (API contract); `docs/WORKFLOW-LINAW.json` (agents 1–4: Inventory Analyst 1100ms / Code Classifier 1300ms / Cross-Reference Scanner 1600ms / Conflict Detector 1500ms; `hitl_gates` low_confidence_classification / detected_relationship / code_placement; `data_rules`; `exception_rules`); and the Sprint-1–5 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes").

**Pattern duplication is intentional.** The LIKHA implementation (Sprints 2–4) may be studied as PROVEN PRECEDENT — specifically `src/lib/likha/agents.ts` (server runner architecture: per-agent audit rows, eligibility/skip posture, gate functions, DI seams, never-crash-the-batch) and `src/lib/likha/search.ts` (BM25 namespace design: factory bound to an index path, lazy load, atomic write, rebuild from DB, env-path override singleton) — but every Sprint-6 LINAW artifact is independently owned: ZERO imports from `src/lib/likha` or any likha path, ZERO shared code. Separate SKUs — independence over DRY (Audit v2 §3, PRP-LINAW constraint 4).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 5 is complete and tagged `v0.5.0-sprint-5`.** LINAW ingestion is live: `src/lib/linaw/ocr.ts` (module-owned OpenRouter OCR, injectable `fetcher`), `src/lib/linaw/import-parser.ts` (pure JSON/CSV/DOCX parsing), `src/lib/linaw/prompts.ts` (`LINAW_METADATA_SYSTEM_PROMPT` + `buildLinawMetadataUserPrompt` + never-throws `parseLinawMetadataResponse`), `src/lib/linaw/ingest.ts` (DI seams `db`/`ocr`/`llm`; `recordIngestionDecision` audits with `module='linaw'`, `agent_id=0`, `agent_name='Ingestion'|'Library Verification'`; `rowToOrdinance`; `applyLibraryDecision` approve/reject/edit). Routes: `POST /api/linaw/upload`, `POST /api/linaw/import`, `GET|PUT /api/linaw/library`, `PUT /api/linaw/library/[id]`, `GET /api/linaw/library/[id]/scan`. Page `src/app/linaw/page.tsx` renders Library & Ingestion LIVE and Inventory/Classification/Relationships/Code Assembly as labeled `StubCard`s; the six agents render IDLE from `LINAW_AGENT_DEFS`; shared kit is wired props-only. **Sprint 6 replaces the stubs and the idle pipeline.**
2. **Schema is frozen Sprint-1 DDL and already contains every table Sprint 6 needs** (verified verbatim in `src/lib/db.ts` `initSchema()`): `codification_records ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL UNIQUE, title_number INTEGER, chapter_number INTEGER, article_number INTEGER, section_in_code INTEGER, cod_status TEXT DEFAULT 'unclassified' CHECK(cod_status IN ('unclassified','classified','reviewed','approved','codified')), ai_suggestion TEXT, human_override TEXT, reviewed_by_id TEXT, approved_by_id TEXT, approved_at TEXT, created_at, updated_at, FK ordinance_id → linaw_ordinances(id), FK reviewed_by_id/approved_by_id → users(id) )`; `ordinance_relationships ( id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, relationship_type TEXT NOT NULL, section_ref TEXT, confidence REAL NOT NULL, confirmed INTEGER DEFAULT 0, confirmed_by_id TEXT, created_at, FK source_id/target_id → linaw_ordinances(id) )` (+ idx source/target/type); shared `agent_decisions`. **CRITICAL: `ordinance_relationships.relationship_type` has NO CHECK constraint** — the `'conflict'` storage marker (decision D1) is legal SQL without any schema change. **Sprint 6 makes ZERO schema changes** (`src/lib/db.ts` must remain byte-identical; gate asserts this). `code_volumes` stays untouched this sprint (Sprint 7).
3. **`src/types/linaw.ts` exists (Sprint 5)** with `LINAW_AGENT_DEFS` (all 6 agents incl. delays 1100/1300/1600/1500/1100/1300 + colors + glow classes + output labels), `LinawOrdinance`, `LinawAgentOutput` (already carries `completenessScore`, `yearGaps`, `codePlacement`, `relationships`, `conflicts` fields), `LinawRelationshipType = 'amends' | 'repeals' | 'partial_repeal' | 'supersedes' | 'extends' | 'implements'`, `LinawHitlGate` (all four gates), `LinawHitlItem`, plus the Sprint-5 ingestion contracts. Sprint 6 APPENDS its contracts (S6-C1); existing content stays byte-compatible (Sprint-5 regression imports must keep compiling).
4. **`src/lib/ai/llm.ts` real API (inspected):** `chatCompletion(systemPrompt, userPrompt, options?: {maxTokens?, temperature?}) → Promise<string>` (text-only, model `LLM_MODEL` default `qwen/qwen3.7-plus`; throws `OPENROUTER_API_KEY not configured` when the key is absent). Suitable for classification, cross-reference refinement, and conflict judgement (all text-in/text-out).
5. **`src/lib/user-auth-middleware.ts` real signature (inspected):** `withUserAuth(handler)` where `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession }) => …`; acting user id = `user.user.id`, full name `user.user.full_name`. 401 body: `{ error: "Authentication required", code: "NO_SESSION" }`. Route precedent for dynamic params: `const { id } = await params;` (see `src/app/api/likha/classify/[id]/route.ts` and `src/app/api/linaw/library/[id]/route.ts`).
6. **`src/lib/logger.ts` real API (inspected):** `logModuleEvent({ module, interactionType, content?, ipAddress, participantName?, participantSessionId? })` — module-neutral; LINAW calls it with `module: 'linaw'` and `participantSessionId: 'linaw-' + userId`. **logger.ts is NOT edited this sprint.**
7. **LIKHA gate/runner mechanics to MIRROR as pattern (inspected in `src/lib/likha/agents.ts`):** `insertAgentDecision` writes one `agent_decisions` row (module-scoped) per agent start/complete/hitl/confirm/error with `pipeline_id` correlation; `classificationGate` returns true when suggestions are empty OR max confidence < 0.6 and the runner then writes an `action='hitl'` row with reason `'low_confidence_classification: …'` and sets `hitlRequired` + `gate` on the response item; `classifyLikhaRecords` eligibility posture = total batch, never crashes on one bad id (unknown → `skipped {reason:'not_found'}`, ineligible → `skipped {reason:'not_classifiable:<status>'}`); `applyClassificationOverride` returns an outcome union `{ok:true,response} | {ok:false, kind:'not_found'|'conflict'|'invalid', error}` mapped by the route to 404/409/400. LINAW Sprint 6 duplicates these mechanics with its own tables/thresholds — NEVER imports them.
8. **LIKHA BM25 namespace design to MIRROR as pattern (inspected in `src/lib/likha/search.ts`):** factory `createLikhaSearch({indexPath, db?})` returning `{indexRecord, removeRecord, search, rebuildIndex, stats}`; lazy in-memory load of the JSON index file (`{documents, idf, avgDocLength, totalDocs}`); `recomputeStatistics` standard BM25 idf `ln((N-df+0.5)/(df+0.5)+1)`; scorer k1=1.2, b=0.75 with title terms weighted x2; atomic write via `.tmp` + rename; singleton whose index path resolves lazily from an env override (`LIKHA_SEARCH_INDEX_PATH`) with default `src/lib/data/likha-search-index.json` (gitignored). LINAW builds its OWN namespace at `src/lib/linaw/search.ts` + `src/lib/data/linaw-search-index.json` (decision D2) — same architecture, independent code, zero imports.
9. **Test harness convention (inspected):** `tests/helpers/linaw-test-util.ts` exists with `BASE_URL` (`LINAW_TEST_BASE_URL`), `assertServerReachable`, `seedApprovedUser`, `tempDbPath`, `readLinawFixture`, `seedLinawPendingReviewRecord(db, userId, overrides?)` (NOTE: it hardcodes `subject_tags '[]'` — Sprint 6 extends it, S6-C2), `buildMinimalDocx`. Hermetic in-process tests set `process.env.DB_PATH = tempDbPath()` BEFORE dynamic-importing `../../src/lib/db` (pattern verbatim in `tests/integration/linaw-digitize.test.ts`); API-level tests run against a live `npm run dev` and seed users/rows directly into `data/workshop.db`. `package.json` scripts `test` / `test:integration` carry explicit file lists — the Sprint-6 gate (S6-C14) appends the new files.
10. **Shared kit props (inspected):** `AgentPipeline { agents: AgentState[]; isProcessing: boolean; pipelineComplete?: boolean }` (purely presentational); `ActivityFeed { activities: ActivityItem[]; emptyMessage?; onConfirm?; onEdit?; onReject? }` (Confirm/Edit/Reject callbacks; rose border for `type:'hitl'` comes from the kit's TYPE_META). The kit + `src/types/agentic.ts` are NOT edited this sprint (gate asserts byte-identical since `v0.5.0-sprint-5`).
11. **Client orchestration precedent (inspected in `src/app/likha/page.tsx`):** the CLIENT simulates per-agent delays (`sleep(delayMs)` from the agent defs) while calling real routes; server does the real work; HITL surfaces as rose feed cards built from response flags. Sprint 6 wires `/linaw` the same way (decision D3): the pipeline button drives agents 1–4 over the ready library via the Sprint-6 routes; delays 1100/1300/1600/1500ms are UI simulation.
12. **`GET /api/linaw/library?q=` is SQL LIKE today (Sprint-5 decision D5)** — the route comment explicitly says "the BM25 namespace is Sprint 6". Decision D2 below rules what Sprint 6 does with it (spoiler: the namespace lands, the route keeps LIKE).

## Sprint 6 Boundary Rules (apply to EVERY chunk — violation = build failure)

1. **LINAW-only code paths.** Every file created or edited for Sprint 6 lives in the `linaw/` namespace (`src/lib/linaw`, `src/app/api/linaw`, `src/components/linaw`, `src/app/linaw`, `src/types/linaw.ts`, `tests/**/linaw-*`) or is an explicitly listed additive shared edit (S6-C4: one `.gitignore` entry; S6-C14: package.json test-script file lists).
2. **HARD boundary — zero likha imports/reads.** No Sprint 6 file may import from `src/lib/likha`, `src/app/api/likha`, `src/components/likha`, `src/app/likha`, `@/app/api/{obra,chat}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, or any ELLA/OBRA/YALA code. Allowed imports ONLY: `@/lib/ai/llm`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed`), `@/types/agentic`, `@/types/linaw`, `@/lib/linaw/*` (within the module), Node built-ins, `lucide-react`, `next/server`, `better-sqlite3` (tests only). Test files additionally may import ONLY `../helpers/linaw-test-util` (never the likha helper) and relative `../../src/lib/linaw/*` / `../../src/lib/db` paths. Reading likha files to STUDY the pattern is allowed; importing, copying verbatim, or referencing them in Sprint 6 code/comments is not.
3. **Table whitelist: `linaw_ordinances`, `codification_records`, `ordinance_relationships`, plus `agent_decisions` (module='linaw' rows) — nothing else.** `grep -Rin "archived_ordinances" ` across ALL Sprint 6 files = **zero hits** (gate S6-C14.A runs this verbatim). Zero references to `amendment_links`, `classifications`, `code_volumes` as well; Sprint 6 never writes `code_volumes` (Sprint 7).
4. **Agents see ONLY `library_status='ready'` rows — test-proven.** Every engine query over `linaw_ordinances` filters `library_status = 'ready'` (inventory scope, classification scope + eligibility, cross-reference source scope AND target resolution, conflict candidates, BM25 rebuild). Each capability carries at least one test that seeds a `pending_review` row and asserts it is excluded (S6-C3/C5/C6/C8 + S6-C4 rebuild test + S6-C14.C integration).
5. **Auth + logging + audit on every route and every agent action.** Every LINAW API route handler is wrapped in `withUserAuth`; acting user = `user.user.id`. Every engine call writes `agent_decisions` rows (`module='linaw'`, real agent ids 1–4 per WORKFLOW-LINAW.json — NOT agent 0, which stays the Sprint-5 pre-pipeline convention) with start/complete rows always and `hitl` rows when a gate fires; every write path calls `logModuleEvent` with `module: 'linaw'`.
6. **Zero `likha|obra|ella|yala` tokens** (case-insensitive) in any Sprint 6 file, except this instructions document itself.
7. **No Sprint-7 features.** No `PUT /api/linaw/relationships/:id` (confirmation workflow N005), no `POST /api/linaw/assemble` / `GET /api/linaw/code/:id` (N006), no summaries (N007 — `linaw_ordinances.summary` stays untouched), no `POST /api/linaw/export-package` (N015), no `code_volumes` writes, no `code-assembly.tsx` component (the Code Assembly tab stays a labeled stub). Agents 5–6 are exported stubs that throw (S7 seam).
8. **No schema changes.** `src/lib/db.ts` byte-identical; no ALTER migrations. Everything persists through the existing Sprint-1 DDL columns (confidence/evidence ride on `ai_suggestion` / `human_override` / `section_ref` JSON — decisions D1/D6).
9. **Four feature commits (decision D11), exact messages:** `feat: implement N001 inventory dashboard with gap analysis pillar-likha-linaw-20260809`, `feat: implement N002 AI subject classification into Code Titles/Chapters pillar-likha-linaw-20260809`, `feat: implement N003 cross-reference scanner for amendments/repeals pillar-likha-linaw-20260809`, `feat: implement N004 conflict detection across ordinances pillar-likha-linaw-20260809`. Seam order chosen so each commit independently compiles and its staged tests pass (S6-C14.E).
10. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprints 1–5). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (all flagged for SPRINT_REVIEW — see end of file)

- **D1 — Conflict storage: `ordinance_relationships` with a `'conflict'` marker (NOT a separate table).** Sprint-6 boundary rule 3 restricts writes to the three existing LINAW tables + `agent_decisions`, and the frozen DDL's `relationship_type TEXT NOT NULL` carries NO CHECK constraint (verified in db.ts) — so conflicts persist as `ordinance_relationships` rows with `relationship_type = 'conflict'`, `source_id`/`target_id` = the conflicting pair, `confidence` = conflict confidence, `confirmed = 0`, and **evidence JSON in `section_ref`** shaped `{ "reason": string, "excerpts": [{ "ordinanceId": string, "passage": string }] }` (the only free-form TEXT column available without schema change). `GET /api/linaw/conflicts` reads `relationship_type='conflict'` rows and parses `section_ref` back into evidence; `GET /api/linaw/relationships` EXCLUDES them (the six `LinawRelationshipType` values only — the marker never leaks into the relationships API). The PRD's "conflicts list with evidence" is served by this view. Rejected alternative: a new `linaw_conflicts` table would require new DDL outside the allowed table set. If Sprint 7 needs richer conflict fields, an additive ALTER is its own decision.
- **D2 — LINAW BM25 namespace lands this sprint; library list `?q=` STAYS SQL LIKE.** `src/lib/linaw/search.ts` is created per the deferred Sprint-5 decision (own namespace, own gitignored file `src/lib/data/linaw-search-index.json`, lazy rebuild from `library_status='ready'` rows, temp-path DI for tests, `LINAW_SEARCH_INDEX_PATH` env override — LIKHA design mirrored, independently implemented). The library route is NOT switched to BM25: the index is ready-only by law (rule 4), but `GET /api/linaw/library?q=` must also find `pending_review` rows for the verification queue — switching would break Sprint-5 behavior and its regression suite. The namespace ships tested + idle for route consumers; the `?q=` upgrade is a future (likely Sprint-7) decision. Flagged.
- **D3 — Runner architecture: server engines + client-simulated delays (LIKHA D9 precedent mirrored).** `src/lib/linaw/agents.ts` exports the four agent engines (`analyzeInventory`, `classifyReadyOrdinances` + `applyClassificationOverride`, `scanCrossReferences`, `detectConflicts`), the shared `insertLinawAgentDecision` audit writer, gate logic, and `runLinawPipeline` (sequential 1→4 orchestrator — the Sprint-7 seam, unit-tested now); agents 5–6 are exported stubs throwing `'lands in Sprint 7'`. REST routes call the engines individually (inventory/classify/detect); the `/linaw` page orchestrates the VISUALIZATION: per-agent `sleep(delayMs)` + the matching route call, glow/pulse via the kit, HITL rose cards from response flags. No `POST /api/linaw/pipeline` route this sprint (not in SPRINT_PLAN's Sprint-6 file list).
- **D4 — Inventory semantics (N001).** Corpus range = `[min(series_year), max(series_year)]` computed over READY rows only. `yearGaps` entries (PRP shape `{year, missing: number[]}`): a range year with ZERO ready ordinances → `{year, missing: []}` (whole missing year); a year present but with numbering holes → `{year, missing: [absent ordinance numbers in 1..max(ordinance_number) for that year]}`; years with nothing to report are omitted. `completenessScore = round(100 × yearsWithReadyRows / totalYearsInRange, 1)` (0 when the ready library is empty). `totals = {ordinances, years, subjects}`; `byYear`, `byStatus` (legal status), `bySubject` (from `subject_tags` JSON); `tookMs` returned so the ≤2s SLA is assertable.
- **D5 — Classification gate thresholds (mutually exclusive, mirroring LIKHA mechanics).** Per placement confidence `c`: `c < 0.6` → gate `low_confidence_classification`; `0.6 ≤ c < 0.7` → gate `code_placement`; `c ≥ 0.7` → no gate. A fired gate writes an `agent_decisions` row `action='hitl'` (agent 2, reason `'<gate>: confidence <threshold>'`) and sets `hitlRequired: true` + `gate` on the response item; the page renders a rose feed card. Unparseable LLM output → `placement: null` + gate `low_confidence_classification` + an `exceptions` entry (nothing persisted for that record; batch continues).
- **D6 — `codification_records` semantics.** POST classify upserts per ordinance (`ON CONFLICT(ordinance_id) DO UPDATE`): sets `title_number/chapter_number/article_number` from the suggestion, `ai_suggestion = JSON {titleNumber, chapterNumber, articleNumber?, confidence, suggestedAt}`, `cod_status='classified'`; a re-classification never touches `human_override`/`reviewed_by_id` (override history survives re-runs). PUT `/api/linaw/classify/:id` (`:id` = ORDINANCE id, LIKHA-classify precedent): validates `titleNumber`/`chapterNumber` positive integers, optional `articleNumber`, REQUIRED non-empty `reason`; upserts the record (an override can create the first placement when no AI row exists), sets `human_override = JSON {titleNumber, chapterNumber, articleNumber?, reason, overriddenAt}`, `cod_status='reviewed'`, `reviewed_by_id = userId`, placement columns follow the override values; audited as agent 2 `action='confirm'`, `reason='override'`. Outcomes: unknown ordinance → `not_found` (404); ordinance not `library_status='ready'` → `conflict` (409); bad fields → `invalid` (400).
- **D7 — Cross-reference regex contract (N003).** Case-insensitive scan of each ready ordinance's `content` for the family `(amend|amending|amended|repeal|repealing|repealed|supersede|superseding|supersedes|superseded|extend|extending|extends|extended|implement|implementing|implements|implemented|pursuant to) … Ordinance (No.?|Number) X (,? (S.|Series of) YYYY)?` (up to ~80 chars of filler between verb and "Ordinance"). Type mapping: amend→`amends`; repeal→`repeals`, upgraded to `partial_repeal` when `partial|in part` appears within 60 chars before the match; supersede→`supersedes`; extend→`extends`; implement/pursuant→`implements`. `sectionRef` = the nearest preceding `Section N` within 200 chars (`'Section N'`) else undefined. Baseline confidence for a fully explicit reference (number + series year) = **0.85**; an LLM refinement seam (`refine` DI) may adjust type/confidence per candidate and is BEST-EFFORT — any LLM failure degrades to regex-only results (never crashes, never 500s the route). Self-references (target pair == source's own number/year) are skipped. A reference without a series year is an orphan too.
- **D8 — Detection scope + orphans (N003).** `POST /api/linaw/detect-relationships` body `{ ordinanceIds? }`: absent or empty → scan ALL ready ordinances; when given, `ordinanceIds` restricts the SOURCE set (targets still resolve across the whole ready library — rule 4: targets resolve to READY rows only; a target that exists but is not ready is an orphan). Unresolved target → orphan warning item `{sourceId, referencedNumber, referencedYear, rawQuote, warning: 'missing target'}` — an exception ROW in the response, never persisted, never a crash (PRP exception rule). Persistence is idempotent: an existing `(source_id, target_id, relationship_type)` row makes the detection `skippedExisting` (no duplicates across re-runs); persisted rows carry `confirmed=0`.
- **D9 — Conflict detection (N004).** Candidate pairs = ready-ordinance pairs sharing ≥1 subject tag within the detection scope (subject metadata is the deterministic prior; the LLM decides semantics). The LLM seam (`conflictLlm` DI, default `chatCompletion` temperature 0) judges each candidate pair and returns `{conflict, reason, confidence, excerptsA, excerptsB}`; evidence shaping caps passages at 300 chars and 2 excerpts per side. Confirmed contradictions persist per D1. LLM unavailable/failing → zero conflicts + `exceptions` entry `'conflict detection skipped (LLM unavailable)'` — the detect route still returns relationships (never crash the batch). Conflict precision targets (≥60% PRD KPI; cross-ref ≥70%) are pilot/SYSTEM_TEST scope per SPRINT_PLAN risk 7 — Sprint 6 asserts CONTRACT, not model accuracy.
- **D10 — HITL in Sprint 6 = raising, not resolving.** Gates fire as audit rows + response flags + rose feed cards: `code_placement` / `low_confidence_classification` (agent 2) and `detected_relationship` (agent 3 raises it once per run when any relationship OR conflict was detected — confirmation of each detection is Sprint 7's `PUT /api/linaw/relationships/:id`). Sprint-6 `relationship-review.tsx` renders the pending list + evidence shell + orphan warnings with confirm/reject controls visibly DISABLED and labeled "Confirmation lands in Sprint 7" (N005 scope guard).
- **D11 — Four-commit seam.** Commit 1 (N001): types + harness + agents.ts base + inventory engine + search.ts + .gitignore + inventory route + dashboard + their tests. Commit 2 (N002): prompts additions + classify engine/override + classify routes + classification panel + tests. Commit 3 (N003): crossref engine + detect-relationships route (returns `conflicts: []` placeholder until commit 4) + relationships GET route + relationship-review + crossref tests. Commit 4 (N004): conflict engine + runLinawPipeline + conflicts wiring in the detect route + conflicts GET route + conflict-panel + page wiring + package.json + remaining tests. Each commit compiles and its staged tests pass independently (verified in S6-C14.E).
- **D12 — LLM-unavailability contract (LIKHA D32 precedent mirrored).** Classification is LLM-PRIMARY: a transport failure propagates and the route returns structured 500 `{ error: 'Classification failed' }`; integration tests tolerate the 500 and still assert 401/400/404/override behaviors. Cross-referencing is REGEX-PRIMARY (LLM refine best-effort). Conflicts are LLM-PRIMARY but NON-FATAL (degrade to empty + exception). No automated suite REQUIRES a real OpenRouter key.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)              GROUP-B (parallel)              GROUP-C (parallel)                GROUP-D (parallel)            GROUP-E        GROUP-F        GROUP-G        GROUP-H
──────────────────              ──────────────────              ─────────────────────             ──────────────────            ───────        ───────        ───────        ───────
S6-C1 types additions ─────────► S6-C3 agents base+inventory ──► S6-C5 inventory route+test ─────┐
S6-C2 harness additions ───────► S6-C4 BM25 search.ts+test ────► S6-C6 classify prompts+engine ──┼─► S6-C7 classify routes ────┐
                                                                  S6-C11 inventory-dashboard ─────┤   S6-C8 crossref engine ────┼─► S6-C9 ────► S6-C10 ───► S6-C13 ───► S6-C14
                                                                                                  │   S6-C12 panels (3)         │   (conflicts     (detect+      (page        (gate,
                                                                                                  └─────────────────────────────┘    engine)      GET routes)     wiring)      regression,
                                                                                                                                                                                   commits)
```

| Chunk | Feature | Depends on | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S6-C1 | N001–N004 (module types additions) | Sprint 5 only | none | **GROUP-A** |
| S6-C2 | test harness additions | Sprint 5 only | none | **GROUP-A** |
| S6-C3 | **N001** agents.ts base + inventory engine + unit test | S6-C1, S6-C2 | agents.ts (first writer) | **GROUP-B** |
| S6-C4 | BM25 namespace (deferred from S5) + unit test + .gitignore | S6-C2 | none | **GROUP-B** |
| S6-C5 | **N001** inventory route + integration test | S6-C3 | none | **GROUP-C** |
| S6-C6 | **N002** classify prompts + engine + override + unit test | S6-C1, S6-C2, S6-C3 | agents.ts, prompts.ts | **GROUP-C** |
| S6-C11 | **N001** inventory-dashboard component | S6-C1 | none | **GROUP-C** |
| S6-C7 | **N002** classify routes (POST + PUT :id) + integration test | S6-C6 | none | **GROUP-D** |
| S6-C8 | **N003** cross-reference engine + unit test | S6-C6 | agents.ts | **GROUP-D** |
| S6-C12 | **N002/N003/N004** classification-panel + relationship-review + conflict-panel | S6-C1 | none | **GROUP-D** |
| S6-C9 | **N004** conflict engine + runLinawPipeline + unit test | S6-C8 | agents.ts | **GROUP-E** |
| S6-C10 | **N003/N004** detect-relationships + relationships GET + conflicts GET routes + integration test | S6-C8, S6-C9 | none | **GROUP-F** |
| S6-C13 | page wiring (Inventory + Classification + Relationships live; pipeline visualization) | S6-C5, S6-C7, S6-C10, S6-C11, S6-C12 | page.tsx | **GROUP-G** |
| S6-C14 | gate: boundary + build + regression + package.json + 4 commits | ALL | n/a | **GROUP-H** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F → GROUP-G → GROUP-H.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`); `agents.ts` is written sequentially C3 → C6 → C8 → C9 by design. Commit points are all in S6-C14 with explicit per-feature staging lists, so commits are correct even when groups executed in parallel. When in doubt, execute sequentially.

---

## Chunks

---

### S6-C1 — `src/types/linaw.ts`: Sprint 6 contract additions (N001–N004)

```json
{
  "chunk_id": "S6-C1",
  "feature_id": "N001+N002+N003+N004 (shared module types)",
  "chunk_type": "setup",
  "name": "Append Sprint-6 contracts to src/types/linaw.ts (inventory, classification, detection, conflicts)",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/linaw.ts"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT the EXISTING file `src/types/linaw.ts` (Sprint-5 content stays intact — Sprint-5 tests import from it and must keep compiling). APPEND the following block after the existing `LinawVerificationResponse` interface, keeping the file's existing comment style. Pure types only — NO new runtime imports, NO other edits. The file must still contain the tokens `likha`, `obra`, `ella`, `yala` ZERO times and compile under `strict: true`.

```ts
// ── Sprint 6: N001 inventory contracts ──

export interface LinawInventoryResponse {
  totals: { ordinances: number; years: number; subjects: number };
  byYear: Array<{ year: number; count: number }>;
  byStatus: Array<{ status: LinawOrdinance['status']; count: number }>;
  bySubject: Array<{ subject: string; count: number }>;
  /** Range years with zero ready ordinances → {year, missing: []}; years present with
   *  numbering holes → {year, missing: [absent ordinance numbers]}. Years clean → omitted. */
  yearGaps: Array<{ year: number; missing: number[] }>;
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
```

**acceptance_criteria:**

1. `npx tsc --noEmit` green (whole repo — Sprint-5 imports of this file still compile).
2. Existing Sprint-5 content unchanged except the appended block (no deletions/renames).
3. Zero runtime imports added; boundary grep clean.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                                          # expected: TSC-OK
grep -c "LinawInventoryResponse\|LinawClassifyResponse\|LinawDetectResponse" src/types/linaw.ts   # expected: 3
grep -inE "likha|obra|ella|yala" src/types/linaw.ts || echo BOUNDARY-CLEAN                        # expected: BOUNDARY-CLEAN
```

---

### S6-C2 — Test harness additions (Sprint-6 seeding helpers)

```json
{
  "chunk_id": "S6-C2",
  "feature_id": "N001+N002+N003+N004 (test scaffolding)",
  "chunk_type": "setup",
  "name": "Extend tests/helpers/linaw-test-util.ts — subjectTags override, seedLinawReadyRecord, seedLinawCodificationRecord",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["tests/helpers/linaw-test-util.ts"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT the EXISTING `tests/helpers/linaw-test-util.ts` (Sprint-5 helper; Node built-ins + `better-sqlite3` + relative imports only — keep that discipline, no `@/` alias, zero imports from any likha file). Make exactly three additive changes:

1. Extend `seedLinawPendingReviewRecord`'s `overrides` parameter with `subjectTags?: string[]` — when present, the INSERT binds `JSON.stringify(overrides.subjectTags)` instead of the hardcoded `'[]'` (all existing callers unaffected).
2. Add `seedLinawReadyRecord(db, userId, overrides?)` — identical signature/behavior to `seedLinawPendingReviewRecord` but default `libraryStatus: 'ready'`, default `sourceType: 'import'`, default `ordinanceNumber: 11`, default `seriesYear: 2022`, default title `'An ordinance regulating the municipal market fees'`, default content `'Section 1. Title. This ordinance regulates market fees.'`, default `subjectTags: ['Taxation & Revenue']`, `fileHash: null`, `sourceFilename: null`. Implementation may delegate to the existing seeder with merged defaults.
3. Add `seedLinawCodificationRecord(db, ordinanceId, overrides?: { titleNumber?, chapterNumber?, articleNumber?, codStatus?, aiSuggestion? })` — inserts one `codification_records` row (columns per the frozen Sprint-1 DDL: id, ordinance_id, title_number, chapter_number, article_number, cod_status, ai_suggestion, created_at/updated_at via defaults); defaults `titleNumber 3`, `chapterNumber 1`, `codStatus 'classified'`, `aiSuggestion JSON {"titleNumber":3,"chapterNumber":1,"confidence":0.9}`; returns the new row id.

The helper must still contain the tokens `likha`, `obra`, `ella`, `yala` ZERO times.

**acceptance_criteria:**

1. `npx tsc --noEmit` green.
2. Existing Sprint-5 suites importing the helper still pass unchanged (they are re-run in S6-C14.C; local spot-check: `npx tsx --test tests/unit/linaw-import-parser.test.ts`).
3. Boundary grep clean.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                                          # expected: TSC-OK
npx tsx --test tests/unit/linaw-import-parser.test.ts                    # expected: pass, 0 failures (helper edit is backward-compatible)
grep -inE "likha|obra|ella|yala" tests/helpers/linaw-test-util.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -c "seedLinawReadyRecord\|seedLinawCodificationRecord" tests/helpers/linaw-test-util.ts   # expected: >= 2
```

---

### S6-C3 — `src/lib/linaw/agents.ts` foundation + agent 1 (Inventory Analyst) + hermetic test

```json
{
  "chunk_id": "S6-C3",
  "feature_id": "N001",
  "chunk_type": "feature",
  "name": "agents.ts base (audit writer, agent names, S7 stubs) + analyzeInventory engine + tests/unit/linaw-inventory.test.ts",
  "parallel_group": "GROUP-B",
  "dependencies": ["S6-C1", "S6-C2"],
  "file_outputs": ["src/lib/linaw/agents.ts", "tests/unit/linaw-inventory.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-inventory.test.ts first (cases in acceptance_criteria) — run, watch fail (agents.ts missing)",
    "GREEN: implement src/lib/linaw/agents.ts until the suite passes",
    "REFACTOR: keep every DB read filtered by library_status='ready'; keep the audit writer the single agent_decisions write path"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/lib/linaw/agents.ts` — the LINAW pipeline runner module (server-only). You may STUDY `src/lib/likha/agents.ts` as pattern precedent (audit writer shape, eligibility posture, DI seams), then write LINAW's OWN implementation: ZERO imports from likha anywhere. Imports allowed: `node:crypto`, `@/lib/db`, `@/lib/logger`, `@/lib/ai/llm` (later chunks use it — this chunk may import it only if needed), `@/types/linaw`. `export const runtime` is NOT used here (this is a lib module). Every function accepts an injectable `db?: import('better-sqlite3').Database` defaulting to `getDb()` (hermetic-test seam, Sprint-5 `ingest.ts` precedent).

Export exactly (this chunk):

1. `export const LINAW_AGENT_NAMES: Record<number, string>` — `{1:'Inventory Analyst', 2:'Code Classifier', 3:'Cross-Reference Scanner', 4:'Conflict Detector', 5:'Relationship Reviewer', 6:'Code Assembler'}`.
2. `export interface LinawDecisionParams { agentId: number; action: 'start' | 'complete' | 'hitl' | 'confirm' | 'reject' | 'error'; inputSnapshot?: string; outputSnapshot?: string; confidence?: number; reason?: string }`
3. `export function insertLinawAgentDecision(db, pipelineId: string, userId: string, params: LinawDecisionParams): void` — one `INSERT INTO agent_decisions (id, module, pipeline_id, agent_id, agent_name, action, input_snapshot, output_snapshot, confidence, user_id, reason) VALUES (?, 'linaw', ?, ?, ?, ?, ?, ?, ?, ?, ?)` row; `agent_name = LINAW_AGENT_NAMES[params.agentId]`; id = `crypto.randomUUID()`; module ALWAYS `'linaw'`.
4. `export function analyzeInventory(params: { userId: string; db?; pipelineId? }): LinawInventoryResponse` — agent 1 (WORKFLOW-LINAW.json `analyzeInventory`, delay owned by the client). Behavior:
   - `startedAt = Date.now()`; default `pipelineId = 'inventory-' + crypto.randomUUID()`.
   - Audit: agent 1 `start` row (`inputSnapshot` `{"readyOnly":true}`), then work, then `complete` row (`outputSnapshot` = JSON of `{totals, completenessScore, yearGapCount}`, `confidence` null).
   - Single source query: `SELECT ordinance_number, series_year, status, subject_tags FROM linaw_ordinances WHERE library_status = 'ready'` — the ONLY `linaw_ordinances` read in this function. Non-ready rows must never enter any computation.
   - Compute per decision D4: `totals` (ordinances = row count; years = distinct series_year count; subjects = distinct subject-tag count after JSON-parsing `subject_tags` defensively — malformed JSON → no tags); `byYear` ascending; `byStatus` over the five legal statuses (omit zero counts); `bySubject` alphabetical, omit empties; `yearGaps` — over the inclusive range `[minYear, maxYear]`: a year with zero rows → `{year, missing: []}`; a year with rows → `missing` = the sorted absent integers in `1..max(ordinance_number)` for that year (omit the entry when `missing` is empty); `completenessScore = Math.round(1000 * yearsWithRows / totalYears) / 10`, or `0` when there are no ready rows; `tookMs = Date.now() - startedAt`.
   - Empty ready library → `{totals:{ordinances:0,years:0,subjects:0}, byYear:[], byStatus:[], bySubject:[], yearGaps:[], completenessScore:0, tookMs}` (still audited, still 200-eligible).
   - `logModuleEvent({ module: 'linaw', interactionType: 'linaw_inventory', content: JSON.stringify({pipelineId, ordinances: totals.ordinances}), ipAddress: '127.0.0.1', participantSessionId: 'linaw-' + userId })`.
5. Sprint-7 stubs (rule 7): `export function reviewRelationships(): never { throw new Error('LINAW agent 5 (Relationship Reviewer) lands in Sprint 7'); }` and `export function assembleCode(): never { throw new Error('LINAW agent 6 (Code Assembler) lands in Sprint 7'); }`.

Then create `tests/unit/linaw-inventory.test.ts` — hermetic, in-process (pattern of `tests/integration/linaw-digitize.test.ts`: `const DB_FILE = tempDbPath(); process.env.DB_PATH = DB_FILE;` at top level, `after()` cleanup of the temp DB files, dynamic `await import('../../src/lib/db')` + `await import('../../src/lib/linaw/agents')` INSIDE the test body, seed a `users` row directly for the FK). Import seeders from `../helpers/linaw-test-util`. Suite MUST cover:

- **Empty ready library** → totals all zero, score 0, all lists `[]`.
- **Ready-only proof (boundary rule 4):** seed via helper — two ready rows (years 2021/2022), one `pending_review` row, one `rejected` row, one `processing` row → `totals.ordinances === 2`; no byYear entry for the non-ready rows' years when distinct.
- **Gap-year detection:** ready rows years 2019 + 2021 only → `yearGaps` contains `{year: 2020, missing: []}`; completenessScore ≈ 66.7 (2 of 3 years).
- **Numbering holes:** year 2021 ready ordinances 1 and 3 → entry `{year: 2021, missing: [2]}`.
- **byStatus / bySubject:** one ready row `status 'amended'` + `subjectTags ['Taxation & Revenue','Permits']` (helper override) → counted in both; malformed `subject_tags` (seed raw `'not-json'`) → no crash, no phantom subject.
- **Audit:** after the call, `agent_decisions` has ≥2 rows `module='linaw'`, `agent_id=1`, `agent_name='Inventory Analyst'`, actions `start` + `complete`, same `pipeline_id`.
- **tookMs** is a number ≥ 0.

The module + test must contain `likha|obra|ella|yala` zero times.

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-inventory.test.ts` exit 0.
2. The ONLY `linaw_ordinances` SELECT in agents.ts this chunk carries `library_status = 'ready'`.
3. `npx tsc --noEmit` green; boundary grep clean; Sprint-5 suites still green (`npx tsx --test tests/integration/linaw-digitize.test.ts`).

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-inventory.test.ts                        # expected: pass, 0 failures
npx tsx --test tests/integration/linaw-digitize.test.ts                  # expected: pass, 0 failures (regression spot)
grep -c "library_status = 'ready'" src/lib/linaw/agents.ts               # expected: >= 1
grep -inE "likha|obra|ella|yala" src/lib/linaw/agents.ts tests/unit/linaw-inventory.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C4 — LINAW BM25 namespace (`src/lib/linaw/search.ts`) + hermetic test + .gitignore

```json
{
  "chunk_id": "S6-C4",
  "feature_id": "N001 (supporting — deferred Sprint-5 BM25 namespace)",
  "chunk_type": "feature",
  "name": "LINAW-owned BM25 namespace: search.ts (factory + lazy singleton + rebuild from ready rows) + unit test + gitignore entry",
  "parallel_group": "GROUP-B",
  "dependencies": ["S6-C2"],
  "file_outputs": ["src/lib/linaw/search.ts", "tests/unit/linaw-search.test.ts", ".gitignore"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-search.test.ts first with a temp index path + temp DB — run, watch fail",
    "GREEN: implement src/lib/linaw/search.ts until the suite passes",
    "REFACTOR: confirm zero likha imports and that rebuild reads ONLY library_status='ready' rows"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/lib/linaw/search.ts` — LINAW's OWN BM25 library namespace (deferred from Sprint 5 per its decision D5; mirrors the ARCHITECTURE of the sibling module's proven namespace but is an INDEPENDENT implementation — you may read `src/lib/likha/search.ts` as pattern precedent, then write LINAW's own; ZERO imports from it or any likha path). Imports: `node:fs`, `node:path`, `@/types/linaw` (types only). No logging, no network.

Contract:

1. Index file shape `{ documents: LinawIndexDoc[]; idf: Record<string, number>; avgDocLength: number; totalDocs: number }` where `LinawIndexDoc` carries `id, ordinanceNumber, seriesYear, title, status, subjectTags, libraryStatus, createdAt, terms: string[], titleTerms: string[], content` (content kept for snippets at pilot scale).
2. `export interface LinawSearchOptions { indexPath: string; db?: () => import('better-sqlite3').Database }` and `export interface LinawSearch { indexRecord(rec): void; removeRecord(id: string): void; search(q: string, filters?): LinawSearchResult; rebuildIndex(): Promise<void>; stats(): { totalDocs: number } }` with `LinawSearchFilters { yearFrom?, yearTo?, status?, subject?, page?, limit? }` and `LinawSearchResult { items, total, page, limit }` — items carry `id, ordinanceNumber, seriesYear, title, status, subjectTags, createdAt, snippet, score` (`snippet` = HTML-escaped window of content, escape-then-mark rule, ≤280 chars — implement LINAW's own tokenizer/escaper/snippet helpers with linaw-prefixed names).
3. `export function createLinawSearch(opts: LinawSearchOptions): LinawSearch` — factory bound to `opts.indexPath`; lazy in-memory load (missing/corrupt file → empty index, never throws); `indexRecord` upserts (same id replaces, never duplicates) + recomputes idf (`ln((N - df + 0.5)/(df + 0.5) + 1)`) + `avgDocLength` and persists atomically (`.tmp` + `rename`); `removeRecord` deletes + persists only when something changed; `search` — tokenize query (lowercase, strip non-alphanumerics, keep tokens ≥2 chars), empty query → `{items: [], total: 0}`; apply metadata filters first, then BM25 scoring (k1 = 1.2, b = 0.75; title terms weighted x2 by counting them twice in the scoring bag); sort score desc, then seriesYear desc, then ordinanceNumber desc; paginate (`limit` clamped 1..100, default 20); `rebuildIndex()` — clears in-memory state and reindexes from `SELECT id, ordinance_number, series_year, title, content, status, subject_tags, library_status, created_at FROM linaw_ordinances WHERE library_status = 'ready'` via `opts.db?.() ?? (await import('@/lib/db')).getDb()`, then persists; `stats()` returns `{totalDocs}`.
4. Default singleton: `export const linawSearch: LinawSearch` lazily bound to `process.env.LINAW_SEARCH_INDEX_PATH || path.join(process.cwd(), 'src', 'lib', 'data', 'linaw-search-index.json')` (path resolved lazily so tests can set the env var anytime) — same proxy-object pattern as the sibling namespace, independently written.
5. `.gitignore` — append (mirror the existing LIKHA entry's style, right after it):
   ```
   # LINAW BM25 index namespace (runtime artifact of src/lib/linaw/search.ts — rebuilt from ready rows)
   src/lib/data/linaw-search-index.json
   ```
   Do NOT add the index file itself to git; do NOT touch any other .gitignore line.

Then create `tests/unit/linaw-search.test.ts` — hermetic (temp DB via `tempDbPath()` set to `process.env.DB_PATH` before dynamic imports; temp index path in `os.tmpdir()` passed via `createLinawSearch({indexPath, db: () => dbHandle})` — the dev index file is NEVER touched). Suite MUST cover: indexRecord + search returns the doc with `score > 0` and a marked/escaped snippet; ranking — a doc mentioning the query term in the title outranks a content-only doc; removeRecord makes the doc disappear; **rebuildIndex pulls ONLY ready rows** (seed one ready + one `pending_review` row with a distinctive term → `stats().totalDocs === 1` and searching the distinctive pending-only term yields 0); filters (yearFrom/status/subject); empty query → empty; missing index file → `stats().totalDocs === 0` without throwing; persistence round-trip — after `indexRecord`, a SECOND factory instance over the same path sees the doc (atomic write worked).

Both files must contain `likha|obra|ella|yala` zero times (env var name is `LINAW_SEARCH_INDEX_PATH`).

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-search.test.ts` exit 0.
2. `rebuildIndex`'s only `linaw_ordinances` read filters `library_status = 'ready'`.
3. `.gitignore` gained exactly the two-line entry; `git check-ignore src/lib/data/linaw-search-index.json` matches after the change.
4. Boundary grep clean; `npx tsc --noEmit` green.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-search.test.ts                           # expected: pass, 0 failures
git check-ignore src/lib/data/linaw-search-index.json && echo IGNORED    # expected: IGNORED
grep -inE "likha|obra|ella|yala" src/lib/linaw/search.ts tests/unit/linaw-search.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -c "library_status = 'ready'" src/lib/linaw/search.ts               # expected: >= 1
```

---

### S6-C5 — N001 route `GET /api/linaw/inventory` + API-level test

```json
{
  "chunk_id": "S6-C5",
  "feature_id": "N001",
  "chunk_type": "feature",
  "name": "src/app/api/linaw/inventory/route.ts (withUserAuth, analyzeInventory) + tests/integration/linaw-inventory.test.ts",
  "parallel_group": "GROUP-C",
  "dependencies": ["S6-C3"],
  "file_outputs": ["src/app/api/linaw/inventory/route.ts", "tests/integration/linaw-inventory.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-inventory.test.ts first — run against the (not-yet-existing) route, watch 404s",
    "GREEN: implement the route until the suite passes",
    "REFACTOR: keep the route a thin auth + engine + envelope wrapper (zero business logic in the route)"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/app/api/linaw/inventory/route.ts` — `GET /api/linaw/inventory` (PRD §12.6; N001). Pattern precedent: `src/app/api/linaw/library/route.ts` (same repo, same conventions). Exact contract:

- `export const runtime = "nodejs";`
- `export const GET = withUserAuth(async (request) => { ... })` — imports ONLY `next/server`, `@/lib/user-auth-middleware`, `@/lib/linaw/agents` (`analyzeInventory`). Acting user = `user.user.id` (destructure the second arg as `{ user }`).
- Calls `analyzeInventory({ userId })` and returns `NextResponse.json(result, { status: 200 })`. Wrap in try/catch → structured 500 `{ error: 'Inventory computation failed' }`. No query parameters are read (the endpoint is parameterless).

Then create `tests/integration/linaw-inventory.test.ts` — API-level against the live dev server (pattern of `tests/integration/linaw-library.test.ts`: `assertServerReachable()` first; `seedApprovedUser()` for the cookie; rows seeded directly into `data/workshop.db` via better-sqlite3 with DISTINCTIVE ordinance numbers — `const base = 960_000 + crypto.randomInt(0, 30_000)` — so dev data never collides; full cleanup in `t.after` deleting seeded rows from `ordinance_relationships`/`codification_records` first if any, then `linaw_ordinances`, then `agent_decisions WHERE module='linaw' AND user_id = ?`, then the user via `cleanup()`). Suite MUST cover:

- **401 without cookie:** GET → status 401, body `{error:'Authentication required', code:'NO_SESSION'}`.
- **Ready-only math over HTTP (boundary rule 4):** seed ready rows `(base+1, 2020)`, `(base+2, 2022)` and one `pending_review` row `(base+3, 2021)`; GET with cookie → `totals.ordinances === 2`; `yearGaps` contains `{year: 2021, missing: []}` — the pending_review year counts as MISSING because agents see ready rows only; `completenessScore` ≈ 66.7; `byYear` has exactly 2020 and 2022.
- **≤2s SLA (PRD §6.8 feature 1):** assert `typeof body.tookMs === 'number' && body.tookMs <= 2000`, plus wall-clock `Date.now()` delta of the fetch < 2000ms.
- **Audit over HTTP:** after the call, `agent_decisions` contains ≥1 row `module='linaw' AND agent_id=1 AND user_id=<seeded user>` (the start/complete pair).

**acceptance_criteria:**

1. Suite passes with the dev server running: `npx tsx --test tests/integration/linaw-inventory.test.ts` exit 0.
2. Route file imports nothing beyond the allow-list; boundary grep clean.
3. 401 envelope is byte-identical to the middleware's (`NO_SESSION`).

**verification_commands:**

```bash
npx tsx --test tests/integration/linaw-inventory.test.ts                 # expected: pass, 0 failures (dev server up)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/linaw/inventory   # expected: 401 (no cookie)
grep -inE "likha|obra|ella|yala|archived_ordinances" src/app/api/linaw/inventory/route.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C6 — N002 classification prompts + agent 2 engine + override (hermetic test)

```json
{
  "chunk_id": "S6-C6",
  "feature_id": "N002",
  "chunk_type": "feature",
  "name": "prompts.ts classification additions + classifyReadyOrdinances + applyClassificationOverride in agents.ts + tests/unit/linaw-classify.test.ts",
  "parallel_group": "GROUP-C",
  "dependencies": ["S6-C1", "S6-C2", "S6-C3"],
  "file_outputs": ["src/lib/linaw/prompts.ts", "src/lib/linaw/agents.ts", "tests/unit/linaw-classify.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-classify.test.ts first (parser cases + engine cases with a stub classify seam) — watch fail",
    "GREEN: extend prompts.ts + agents.ts until the suite passes",
    "REFACTOR: verify gate thresholds (D5) and upsert SQL (D6) match the decisions exactly"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Extend TWO existing files (additive edits; keep all Sprint-5 exports intact and working).

**A. `src/lib/linaw/prompts.ts`** — append LINAW's classification prompt machinery (same discipline as the Sprint-5 metadata prompt: strict JSON, never-throws parser, LINAW's OWN wording — do not copy any LIKHA string):

1. `export const LINAW_CODE_TITLES: string[]` — exactly 13 entries, the municipal Code taxonomy priors shown to the model with their 1-based numbers: `1 General Provisions`, `2 Administration`, `3 Taxation and Revenue`, `4 Business Permits and Licensing`, `5 Public Health and Sanitation`, `6 Public Works and Infrastructure`, `7 Education and Culture`, `8 Social Welfare and Development`, `9 Agriculture and Environment`, `10 Public Order and Safety`, `11 Personnel and Civil Service`, `12 Finance and Budget`, `13 Miscellaneous and Transitory`.
2. `export const LINAW_CLASSIFY_SYSTEM_PROMPT: string` — instructs: classify one Philippine LGU ordinance into the Code; respond with ONLY one JSON object, no prose/fences, shaped exactly `{"titleNumber": number, "chapterNumber": number, "articleNumber": number | null, "confidence": number}`; `titleNumber` is 1–13 per the provided title list; `chapterNumber` a positive integer; `articleNumber` only when the text explicitly organizes articles; `confidence` the 0–1 self-estimate.
3. `export function buildLinawClassifyUserPrompt(input: { ordinanceNumber: number; seriesYear: number; title: string; content: string; subjectTags: string[] }, priors: { subjectFrequencies: Array<{ subject: string; count: number }> }): string` — includes the numbered `LINAW_CODE_TITLES` list, the library's OWN subject-tag frequency table (the priors per PRP data rule "Code Classifier uses the library's own subject metadata as priors"), the record's metadata + `subjectTags`, and its `content` truncated to 12,000 chars; ends with "Return ONLY the JSON object."
4. `export interface ParsedLinawPlacement { titleNumber: number; chapterNumber: number; articleNumber?: number; confidence: number }` and `export function parseLinawClassifyResponse(llmText: string): ParsedLinawPlacement` — NEVER throws (Sprint-5 parser precedent): strips ``` fences, locates the first `{…}` span, `JSON.parse`; `titleNumber`/`chapterNumber` must coerce to positive integers else 0; `articleNumber` positive integer or `undefined`; `confidence` clamped to [0,1] (non-finite → 0); any failure → `{titleNumber: 0, chapterNumber: 0, confidence: 0}` (zeros = invalid placement downstream).

**B. `src/lib/linaw/agents.ts`** — append agent 2 (Code Classifier). Imports: add `chatCompletion` from `@/lib/ai/llm` and the new prompt exports. Export:

1. `export interface LinawClassifyOptions { ordinanceIds?: string[]; userId: string; db?; pipelineId?; classify?: (input: { content: string; title: string; subjectTags: string[]; priors: { subjectFrequencies: Array<{ subject: string; count: number }> }; meta: { ordinanceNumber: number; seriesYear: number } }) => Promise<ParsedLinawPlacement> }` — `classify` is the DI seam; default = real `chatCompletion(LINAW_CLASSIFY_SYSTEM_PROMPT, buildLinawClassifyUserPrompt(...), { temperature: 0, maxTokens: 1024 })` + `parseLinawClassifyResponse`.
2. `export async function classifyReadyOrdinances(opts: LinawClassifyOptions): Promise<LinawClassifyResponse>`:
   - Default `pipelineId = 'classify-' + crypto.randomUUID()`. Subject priors computed ONCE from the whole ready library: `SELECT subject_tags FROM linaw_ordinances WHERE library_status = 'ready'` → frequency list sorted count desc.
   - Scope: `ordinanceIds` absent/empty → every ready row (`SELECT id, ordinance_number, series_year, title, content, subject_tags FROM linaw_ordinances WHERE library_status = 'ready'`); else per-id lookup — row missing → `skipped {reason:'not_found'}`; row present but `library_status !== 'ready'` → `skipped {reason:'not_classifiable:' + status}` (total-batch posture, never crashes — LIKHA precedent mirrored).
   - Per eligible record: agent-2 `start` audit row (`inputSnapshot` includes `{recordId, mode: opts.classify ? 'stub' : 'llm'}`); call the seam; `placement` valid iff `titleNumber > 0 && chapterNumber > 0`.
   - Valid placement → upsert `codification_records` (decision D6 SQL exactly): `INSERT INTO codification_records (id, ordinance_id, title_number, chapter_number, article_number, cod_status, ai_suggestion, updated_at) VALUES (?, ?, ?, ?, ?, 'classified', ?, datetime('now')) ON CONFLICT(ordinance_id) DO UPDATE SET title_number = excluded.title_number, chapter_number = excluded.chapter_number, article_number = excluded.article_number, cod_status = 'classified', ai_suggestion = excluded.ai_suggestion, updated_at = datetime('now')` with `ai_suggestion = JSON.stringify({...placement, suggestedAt: new Date().toISOString()})` (`human_override`/`reviewed_by_id` untouched by design).
   - Gates (decision D5, mutually exclusive): `c < 0.6` → gate `low_confidence_classification`; `0.6 ≤ c < 0.7` → `code_placement`; else none. Fired gate → agent-2 `hitl` audit row (reason `'<gate>: confidence <threshold>'`) and the result item carries `hitlRequired: true, gate`. Invalid placement (zeros/parse failure) → `placement: null`, gate `low_confidence_classification`, an `exceptions` entry `'record <id>: unparseable classification output'`, NOTHING persisted; batch continues.
   - Agent-2 `complete` audit row per record (`outputSnapshot` = placement JSON, `confidence` = placement confidence); `classified` counts eligible records processed (incl. gated); `logModuleEvent` `linaw_classify` summary at the end.
3. `export function applyClassificationOverride(params: { ordinanceId: string; userId: string; body: LinawClassifyOverrideRequest; db?; pipelineId? }): { ok: true; response: LinawClassifyOverrideResponse } | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string }` (decision D6): default `pipelineId = 'override-' + ordinanceId`; look up the ordinance — missing → `not_found`; `library_status !== 'ready'` → `conflict` (`'Ordinance is not in the ready library'`); validate `titleNumber`/`chapterNumber` positive integers and `reason` non-empty string → else `invalid` (`articleNumber` optional positive integer); upsert the codification record setting the placement columns to the override values, `human_override = JSON.stringify({titleNumber, chapterNumber, articleNumber?, reason, overriddenAt})`, `cod_status='reviewed'`, `reviewed_by_id = userId`, `updated_at`; agent-2 `confirm` audit row with `reason='override'` + `outputSnapshot` of the override; `logModuleEvent` `linaw_classification_override`; respond `{recordId: ordinanceId, codStatus:'reviewed', titleNumber, chapterNumber, articleNumber?, reviewedBy: userId}`.

Then create `tests/unit/linaw-classify.test.ts` — hermetic (temp DB before dynamic imports; users row seeded; seeders from the helper). Stub the `classify` seam everywhere (NO real LLM in this suite). Suite MUST cover:

- **Parser:** valid object; fenced ```json block; prose-wrapped JSON; garbage → zeros; confidence clamp (1.4 → 1, -0.2 → 0, 'high' → 0); negative titleNumber → 0.
- **Gate thresholds (D5):** stub confidences 0.55 / 0.65 / 0.85 → gates `low_confidence_classification` / `code_placement` / none (assert audit `hitl` row exists only for the gated ones, reason prefix correct).
- **Persistence (D6):** after classifying a ready record — `codification_records` row exists with `cod_status='classified'`, `ai_suggestion` parses back to the placement + `suggestedAt`, placement columns set; re-classifying with a NEW stub placement updates the AI fields but PRESERVES a pre-seeded `human_override` value (seed via `seedLinawCodificationRecord` then mutate `human_override` directly before re-run).
- **Eligibility (rule 4):** `pending_review` id → `skipped not_classifiable:pending_review`; unknown id → `skipped not_found`; `ordinanceIds` omitted → every seeded READY row classified and the seeded pending_review row untouched (no codification row for it).
- **Unparseable output:** stub returns zeros → `placement: null`, gate fired, no codification row, `exceptions` non-empty, batch continues to next record.
- **Override:** happy path (cod_status `reviewed`, `reviewed_by_id` = user, `human_override` JSON carries the reason, placement columns follow override, audit `confirm`/`override` row); override creating the FIRST placement for a ready ordinance with no AI row (upsert); missing reason → `invalid`; unknown ordinance → `not_found`; non-ready ordinance → `conflict`.

Both edited files keep `likha|obra|ella|yala` at zero occurrences.

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-classify.test.ts` exit 0.
2. Sprint-5 prompt exports still pass their suite: `npx tsx --test tests/integration/linaw-digitize.test.ts` green.
3. All engine `linaw_ordinances` reads filter `library_status = 'ready'` (eligibility lookup may read any row BY ID but never acts on non-ready).
4. Boundary grep clean; `npx tsc --noEmit` green.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-classify.test.ts                         # expected: pass, 0 failures
npx tsx --test tests/integration/linaw-digitize.test.ts                  # expected: pass, 0 failures (Sprint-5 regression spot)
grep -inE "likha|obra|ella|yala" src/lib/linaw/prompts.ts src/lib/linaw/agents.ts tests/unit/linaw-classify.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C7 — N002 routes `POST /api/linaw/classify` + `PUT /api/linaw/classify/[id]` + API-level test

```json
{
  "chunk_id": "S6-C7",
  "feature_id": "N002",
  "chunk_type": "feature",
  "name": "classify routes (batch + override) + tests/integration/linaw-classify-api.test.ts (D32-style contract posture)",
  "parallel_group": "GROUP-D",
  "dependencies": ["S6-C6"],
  "file_outputs": ["src/app/api/linaw/classify/route.ts", "src/app/api/linaw/classify/[id]/route.ts", "tests/integration/linaw-classify-api.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-classify-api.test.ts first — watch 404s",
    "GREEN: implement both routes until the suite passes",
    "REFACTOR: routes stay thin — validation + engine call + envelope mapping only"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create the two N002 routes. Pattern precedent (study, then write LINAW's own): `src/app/api/likha/classify/route.ts` + `[id]/route.ts` — same envelope/gate mechanics, ZERO likha imports.

1. `src/app/api/linaw/classify/route.ts` — `export const runtime = "nodejs";` + `export const POST = withUserAuth(...)`. Body contract (decision: `ordinanceIds` OPTIONAL per PRD §12.6's `{ ordinanceIds? }`): invalid JSON → 400 `{error:'Invalid JSON body', code:'INVALID_BODY'}`; body `ordinanceIds` present but not an array of strings → 400 `INVALID_BODY` (`'ordinanceIds must be an array of strings'`); absent or `[]` → classify the whole ready library. Calls `classifyReadyOrdinances({ ordinanceIds, userId: user.user.id })`, returns its response 200. try/catch → 500 `{ error: 'Classification failed' }` (LIKHA mirror — classification is LLM-primary, decision D12).
2. `src/app/api/linaw/classify/[id]/route.ts` — `export const PUT = withUserAuth(...)`; `const { id } = await params;`. Body: invalid JSON → 400 `INVALID_BODY`; shape checks at route level (`titleNumber`/`chapterChapter`… correct field names: `titleNumber`, `chapterNumber` numbers; `reason` string; `articleNumber` optional number — wrong TYPES → 400 `INVALID_BODY`). Calls `applyClassificationOverride({ ordinanceId: id, userId: user.user.id, body })`; outcome mapping: `not_found` → 404 `{code:'NOT_FOUND'}`, `invalid` → 400 `{code:'VALIDATION'}`, `conflict` → 409 `{code:'CONFLICT'}`; ok → 200 with the response.

Then create `tests/integration/linaw-classify-api.test.ts` — API-level, mirroring the repo's established LLM-tolerant contract posture (see `tests/integration/likha-classify-api.test.ts` for the SHAPE of this pattern — write LINAW's own file, helper = `../helpers/linaw-test-util`, tables = LINAW's): distinctive numbers `const base = 950_000 + crypto.randomInt(0, 40_000)`; seed ready rows `(base+1, 2021)`, `(base+2, 2022)` (second one pre-seeded with a `codification_records` AI row via direct SQL), one `pending_review` row `(base+3, 2023)`, one `processing` row `(base+4, 2024)`; cleanup deletes `ordinance_relationships` (by source/target ids), `codification_records`, `linaw_ordinances`, `agent_decisions WHERE module='linaw' AND user_id=?`, then the user. Suite MUST cover:

- **401 on BOTH routes** (exact `NO_SESSION` envelope).
- **400 INVALID_BODY:** `{ordinanceIds: 'x'}`, `{ordinanceIds: [1]}` on POST; non-numeric titleNumber / missing reason on PUT.
- **Classify happy path (contract-level, D12):** POST with `{ordinanceIds: [readyId1, pendingId, processingId, 'missing-id']}` — if 500 → assert structured error envelope, log `[D12 fallback]`, continue (no key in env); else 200: `classified === 1`, skipped reasons `not_classifiable:pending_review` / `not_classifiable:processing` / `not_found`; results item carries `placement` (or null + gate) + `hitlRequired` boolean; codification row persisted for the ready record with `cod_status='classified'`; `agent_decisions` has agent-2 rows (`agent_name='Code Classifier'`, `user_id` = seeded user).
- **Override round-trip over HTTP:** PUT `/api/linaw/classify/<readyId2>` `{titleNumber: 5, chapterNumber: 2, reason: 'Market fees fit Public Health'}` → 200 `{recordId, codStatus:'reviewed', reviewedBy: userId}`; DB row now `cod_status='reviewed'`, `reviewed_by_id` = user, `human_override` JSON contains the reason, placement columns 5/2; the pre-seeded AI `ai_suggestion` still present (history preserved); audit row `action='confirm' reason='override' pipeline_id='override-'+readyId2`.
- **Override errors:** unknown id → 404 `NOT_FOUND`; PUT on the pending_review record id → 409 `CONFLICT`.

**acceptance_criteria:**

1. Suite passes with the dev server up (with OR without an OpenRouter key — the fallback branch covers keyless envs).
2. Both routes import ONLY from the allow-list; boundary grep clean (incl. `archived_ordinances` zero).
3. `npx tsc --noEmit` green.

**verification_commands:**

```bash
npx tsx --test tests/integration/linaw-classify-api.test.ts              # expected: pass, 0 failures
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/linaw/classify   # expected: 401
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/linaw/classify/x  # expected: 401
grep -RinE "likha|archived_ordinances" src/app/api/linaw/classify/ || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C11 — N001 component `src/components/linaw/inventory-dashboard.tsx`

```json
{
  "chunk_id": "S6-C11",
  "feature_id": "N001",
  "chunk_type": "feature",
  "name": "Inventory dashboard — completeness bar, counts, year-gap list, per-year SVG bar chart (no chart lib)",
  "parallel_group": "GROUP-C",
  "dependencies": ["S6-C1"],
  "file_outputs": ["src/components/linaw/inventory-dashboard.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/components/linaw/inventory-dashboard.tsx` — the N001 dashboard (PRP-LINAW "LINAW screens" bullet 1 + PRD §6.8 feature 1). `'use client'`. Imports: `react`, `lucide-react` (e.g. `Boxes`, `RefreshCw`, `AlertTriangle`), `@/lib/utils` (`cn`), `@/types/linaw` (`LinawInventoryResponse`) — NO chart library (repo `recharts` is NOT used here by design), NO kit imports, zero likha tokens.

Behavior:

- On mount AND on a Refresh button click, `fetch('/api/linaw/inventory', { credentials: 'same-origin' })`; render loading state, error state (message + retry), and the data view. Show `tookMs` ("computed in Nms") and keep total interaction ≤2s (plain fetch, no artificial delays).
- **Completeness bar:** the `completenessScore` as a horizontal progress bar (rounded track `#1E293B` border `#283147`; fill `#22C55E` at ≥90, `#FACC15` at ≥60, `#F87171` below) with the numeric % label.
- **Counts:** stat cards for `totals.ordinances` / `totals.years` / `totals.subjects`, plus the `byStatus` list (status → count, color dot per semantic: active `#22C55E`, amended `#FACC15`, repealed/superseded/expired `#F87171`/`#94A3B8`) and `bySubject` list (subject → count).
- **Year-gap list:** each `yearGaps` entry — `missing.length === 0` renders "YYYY — no ordinances recorded" with `AlertTriangle`; else "YYYY — missing No. X, Y, Z". Empty gaps → green "Series continuity looks complete."
- **Per-year SVG bar chart (hand-built):** one `<svg viewBox="0 0 W H">` where W scales with the year count (bar width 28, gap 12, left padding 8, bottom axis 24); bar height ∝ `count / maxCount × (H − 40)`; each bar a `<rect>` fill `#0038A8` with a `<title>` tooltip "YYYY · N ordinances"; year labels `<text>` (fill `#94A3B8`, font-size 10) under each bar; count labels above bars (fill `#FFFFFF`, font-size 10). Gap years from `yearGaps` (missing: []) render as hollow dashed-outline bars (`fill='none' stroke='#F87171' strokeDasharray='4 3'`) so the gap is visible in the chart too. Wrap in `overflow-x-auto` for mobile.
- Styling per the module palette: cards `rounded-2xl border border-[#283147] bg-[#1E293B] p-6`, page background inherited `#0F1729`, headings `text-xs font-semibold uppercase tracking-widest text-[#94A3B8]`; responsive stack at 360px (single column), 2-col grid ≥768px; touch targets ≥44px (Refresh button `min-h-11`).

**acceptance_criteria:**

1. `npx tsc --noEmit` green; `npm run lint` clean for the file.
2. No chart-library import; only `react`, `lucide-react`, `@/lib/utils`, `@/types/linaw`.
3. Boundary grep clean.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                                          # expected: TSC-OK
grep -cE "from ['\"]recharts" src/components/linaw/inventory-dashboard.tsx   # expected: 0
grep -inE "likha|obra|ella|yala" src/components/linaw/inventory-dashboard.tsx || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C12 — Sprint-6 panels: classification-panel + relationship-review + conflict-panel

```json
{
  "chunk_id": "S6-C12",
  "feature_id": "N002+N003+N004 (UI)",
  "chunk_type": "feature",
  "name": "src/components/linaw/classification-panel.tsx + relationship-review.tsx + conflict-panel.tsx",
  "parallel_group": "GROUP-D",
  "dependencies": ["S6-C1"],
  "file_outputs": ["src/components/linaw/classification-panel.tsx", "src/components/linaw/relationship-review.tsx", "src/components/linaw/conflict-panel.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Create THREE `'use client'` components under `src/components/linaw/`. Palette + card styling identical to S6-C11 (`#1E293B` cards, `#283147` borders, `#94A3B8` secondary, semantic colors, responsive 360/768/1280). Allowed imports: `react`, `lucide-react`, `@/lib/utils`, `@/types/linaw`. NO likha tokens; NO confirm/reject persistence (that is Sprint 7 — decision D10). `classification-panel.tsx` is an ADDITIVE file (PRP-LINAW's file list has no classification editor — the LIKHA module has one; LINAW gets its own; flagged for SPRINT_REVIEW).

1. **`classification-panel.tsx`** — props `{ classifyRun: () => Promise<void>; running: boolean; results: LinawClassifyResultItem[]; exceptions: string[] }` (the page owns the fetch; the panel renders + overrides). Renders: a "Run Code Classifier" trigger button (delegates to `classifyRun`, disabled while `running`, `min-h-11`); the results table — per item: `Ordinance No. X, S. YYYY`, placement "Title T · Chapter C [· Article A]" or "—", confidence pill (green ≥0.7 / yellow 0.6–0.7 / rose <0.6), gate badge when present (`code_placement` / `low_confidence_classification` in rose); an inline OVERRIDE form per row (number inputs Title/Chapter/Article + required reason textarea + "Save override" button) that `PUT`s `/api/linaw/classify/<recordId>` with `credentials:'same-origin'`, shows success (row badge switches to "reviewed") or the server error; `exceptions` rendered as yellow warning rows.
2. **`relationship-review.tsx`** — props `{ items: LinawRelationshipRecord[]; orphans: LinawOrphanWarning[]; loading: boolean }`. Renders the pending-relationships list: each card "Ord No. X, S. YYYY —<type>→ Ord No. A, S. B" with type chip (color per type: amends `#FACC15`, repeals/partial_repeal `#F87171`, supersedes `#F43F5E`, extends `#22C55E`, implements `#22D3EE`), `sectionRef`, confidence, `confirmed` badge; Confirm/Reject buttons rendered DISABLED with tooltip text "Confirmation lands in Sprint 7" (decision D10 — N005 owns the actions); orphan warnings as yellow cards "`missing target` — reference to Ordinance No. X, S. YYYY not found in the ready library" with the `rawQuote`; empty state "No relationships detected yet — run the pipeline.".
3. **`conflict-panel.tsx`** — props `{ items: LinawConflictListItem[]; loading: boolean }`. Side-by-side evidence view per PRP §6.8 feature 4: each conflict card = header "Ord No. X, S. YYYY ↔ Ord No. A, S. B" + confidence pill + `reason`; below, a 2-column grid (stacks at <768px) — each column shows one ordinance's title + its excerpt passages in `<blockquote>`-style boxes with rose left border (flagged-passage styling); empty state "No conflicts flagged.".

All three: keyboard-operable controls, no console errors, compile standalone.

**acceptance_criteria:**

1. `npx tsc --noEmit` green; lint clean.
2. No fetch in relationship-review/conflict-panel (page feeds them); classification-panel's only fetch is `PUT /api/linaw/classify/:id`.
3. Boundary grep clean on all three files.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                                          # expected: TSC-OK
grep -inE "likha|obra|ella|yala" src/components/linaw/classification-panel.tsx src/components/linaw/relationship-review.tsx src/components/linaw/conflict-panel.tsx || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -c "/api/linaw/classify/" src/components/linaw/classification-panel.tsx   # expected: >= 1
```

---

### S6-C8 — N003 Cross-Reference Scanner (agent 3) engine + hermetic test

```json
{
  "chunk_id": "S6-C8",
  "feature_id": "N003",
  "chunk_type": "feature",
  "name": "Regex+LLM cross-reference scan in agents.ts (extractCrossReferences + scanCrossReferences) + tests/unit/linaw-crossref.test.ts",
  "parallel_group": "GROUP-D",
  "dependencies": ["S6-C6"],
  "file_outputs": ["src/lib/linaw/agents.ts", "src/lib/linaw/prompts.ts", "tests/unit/linaw-crossref.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-crossref.test.ts first (regex battery + resolution + orphans + dedupe) — watch fail",
    "GREEN: extend prompts.ts (refinement prompt/parser) + agents.ts until the suite passes",
    "REFACTOR: confirm regex never throws on pathological input and orphans never persist"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Extend `src/lib/linaw/agents.ts` (append; earlier exports untouched) and `src/lib/linaw/prompts.ts` (append) with agent 3 (Cross-Reference Scanner, WORKFLOW function `scanCrossReferences`).

**A. prompts.ts additions:** `LINAW_CROSSREF_SYSTEM_PROMPT` (refine a list of candidate cross-references; respond ONLY with a JSON array of `{"refIndex": number, "type": one of amends|repeals|partial_repeal|supersedes|extends|implements, "confidence": 0-1}` — omit entries to keep the baseline verdict), `buildLinawCrossRefUserPrompt(content: string, candidates: Array<{ index: number; quote: string; type: string; number: number; year: number }>)` (content truncated to 12,000 chars), `parseLinawCrossRefResponse(llmText: string): Array<{ refIndex: number; type?: LinawRelationshipType; confidence?: number }>` — never throws; non-array/malformed → `[]`; `refIndex` coerced to integer ≥ 0; `type` accepted only if it is one of the six union values; confidence clamped [0,1].

**B. agents.ts additions:**

1. `export const LINAW_BASELINE_CROSSREF_CONFIDENCE = 0.85;`
2. `export interface RawCrossRef { type: LinawRelationshipType; ordinanceNumber: number; seriesYear: number; sectionRef?: string; rawQuote: string; index: number }` and `export function extractCrossReferences(content: string): RawCrossRef[]` — pure, exported for tests (decision D7): one global case-insensitive regex pass for `(amend(?:ing|ed|s)?|repeal(?:ing|ed|s)?(?:\s+(?:in\s+part|partially))?|supersed(?:e|es|ed|ing)|extend(?:s|ed|ing)?|implement(?:s|ed|ing)?|pursuant\s+to)[^.]{0,80}?ordinance\s+(?:no\.?|number)\s*\.?\s*(\d+)(?:\s*,?\s*(?:s\.|series\s+of)\s*(\d{4}))?` — capture group 1 = verb, 2 = number, 3 = series year (may be absent). Verb → type mapping per D7 (repeal + `partial|in part` within the 60 chars preceding the match start → `partial_repeal`; `pursuant to`/implement → `implements`). `rawQuote` = the matched substring trimmed to 160 chars; `index` = the match's position in scan order (0-based, used by the refinement seam); `sectionRef` = look back up to 200 chars before the match start for `/section\s+(\d+)/i` → `'Section ' + n`, else `undefined`; a missing series year is emitted with `seriesYear: 0` (the scanner treats it as an orphan — decision D8). The function never throws on any input.
3. `export interface LinawScanOptions { ordinanceIds?: string[]; userId: string; db?; pipelineId?; refine?: (content: string, candidates: Array<{ index: number; quote: string; type: string; number: number; year: number }>) => Promise<Array<{ refIndex: number; type?: LinawRelationshipType; confidence?: number }>> | null }` and `export async function scanCrossReferences(opts: LinawScanOptions): Promise<{ pipelineId: string; scanned: number; detected: number; persisted: number; skippedExisting: number; orphans: LinawOrphanWarning[]; relationships: LinawRelationshipRecord[] }>`:
   - Default `pipelineId = 'detect-' + crypto.randomUUID()`. Source scope: `ordinanceIds` absent/empty → every `library_status='ready'` row; else per-id lookup — unknown or non-ready ids are skipped silently (they can never be sources; rule 4). Audit: agent-3 `start` row (`inputSnapshot {sources: n, readyOnly: true}`) and `complete` row at the end (`outputSnapshot {detected, persisted, skippedExisting, orphans: orphans.length}`).
   - Target resolution map built ONCE from the whole ready library: `SELECT id, ordinance_number, series_year FROM linaw_ordinances WHERE library_status = 'ready'` keyed by `'number:year'` — targets resolve READY rows only (a target that exists but is not ready is an orphan; test-proven).
   - Per source ordinance: `extractCrossReferences(content)`; skip self-references (resolved pair == the source's own `(ordinance_number, series_year)`); then the refinement seam (default = BEST-EFFORT LLM: `chatCompletion(LINAW_CROSSREF_SYSTEM_PROMPT, buildLinawCrossRefUserPrompt(...), {temperature: 0, maxTokens: 1024})` + `parseLinawCrossRefResponse`; ANY failure/timeout → treat as `null` = keep baseline verdicts; decision D7/D12 — the regex pass is authoritative and the route never 500s on LLM trouble). A refinement entry may override `type` and/or `confidence` for its `refIndex`.
   - Per candidate: series year 0 OR no key in the resolution map → push orphan `{sourceId, referencedNumber, referencedYear, rawQuote, warning: 'missing target'}` (never persisted, never crashes — PRP exception rule); resolved target with an existing `(source_id, target_id, relationship_type)` row (any confirmed value) → `skippedExisting += 1`; else `INSERT INTO ordinance_relationships (id, source_id, target_id, relationship_type, section_ref, confidence, confirmed) VALUES (?, ?, ?, ?, ?, ?, 0)` with confidence = refined value ?? `LINAW_BASELINE_CROSSREF_CONFIDENCE`, and return the persisted record (fetch the inserted row for `createdAt`).
   - `detected` = all non-self candidates; `logModuleEvent` `linaw_crossref_scan` summary; `relationships` ordered by source `series_year`/`ordinance_number` then target.

**C.** Create `tests/unit/linaw-crossref.test.ts` — hermetic (temp DB before dynamic imports; user row seeded; helper seeders; the `refine` seam injected everywhere — NO real LLM). Suite MUST cover:

- **Regex battery:** `'...amending Ordinance No. 4, S. 2019...'` → amends (4, 2019); `'repealing Ordinance No. 5, Series of 2018'` → repeals; `'repealing in part Ordinance No. 6, S. 2017'` → partial_repeal; `'pursuant to Ordinance No. 7, S. 2016'` → implements; `'superseding Ordinance No. 8, S. 2015'` → supersedes; `'extending Ordinance No. 9, S. 2014'` → extends; case-insensitivity (`AMENDING ORDINANCE NO. 4, S. 2019`); `Ordinance Number 4` variant; a reference with NO series year → `seriesYear: 0`; text with zero references → `[]`; pathological input (empty string, 10k-char wall of 'a') never throws.
- **sectionRef capture:** content with `'Section 12. ... amending Ordinance No. 4, S. 2019'` → `sectionRef === 'Section 12'`; none nearby → `undefined`.
- **Resolution + persistence:** seed ready source (content with one explicit amending reference) + ready target matching (number, year) → run `scanCrossReferences` with `refine: async () => null` → `persisted === 1`; DB row exists with `confirmed = 0`, `confidence === 0.85`, correct `relationship_type`, source/target ids; audit agent-3 start+complete rows present.
- **Orphans (D8):** reference to a number/year NOT in the library → `orphans` contains the item with `warning: 'missing target'`, nothing persisted, no crash; reference whose target row exists but is `pending_review` → orphan too (ready-only proof, rule 4); reference with `seriesYear: 0` → orphan.
- **Self-reference:** source content referencing its OWN number/year → neither persisted nor orphaned.
- **Idempotency:** second identical run → `persisted === 0`, `skippedExisting === 1`, row count unchanged.
- **Refinement seam:** stub returning `[{refIndex: 0, type: 'repeals', confidence: 0.95}]` overrides type + confidence on the persisted row; stub THROWING → baseline verdict persists anyway (no exception escapes).

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-crossref.test.ts` exit 0.
2. Both `linaw_ordinances` reads (sources + resolution map) filter `library_status = 'ready'`.
3. `npx tsc --noEmit` green; earlier Sprint-6 + Sprint-5 suites still green (`linaw-classify`, `linaw-digitize` spot-checks).
4. Boundary grep clean on all three files.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-crossref.test.ts                         # expected: pass, 0 failures
npx tsx --test tests/unit/linaw-classify.test.ts                         # expected: pass, 0 failures (agents.ts edit regression)
grep -c "library_status = 'ready'" src/lib/linaw/agents.ts               # expected: >= 3
grep -inE "likha|obra|ella|yala" src/lib/linaw/agents.ts src/lib/linaw/prompts.ts tests/unit/linaw-crossref.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---
### S6-C9 — N004 Conflict Detector (agent 4) + `runLinawPipeline` orchestrator + hermetic test

```json
{
  "chunk_id": "S6-C9",
  "feature_id": "N004",
  "chunk_type": "feature",
  "name": "detectConflicts engine (subject-pair candidates, LLM seam, evidence shaping, conflict-marker persistence) + runLinawPipeline (agents 1-4) + tests/unit/linaw-conflicts.test.ts",
  "parallel_group": "GROUP-E",
  "dependencies": ["S6-C8"],
  "file_outputs": ["src/lib/linaw/agents.ts", "src/lib/linaw/prompts.ts", "tests/unit/linaw-conflicts.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-conflicts.test.ts first (candidate pairing, evidence shaping, marker persistence, orchestrator) — watch fail",
    "GREEN: extend prompts.ts + agents.ts until the suite passes",
    "REFACTOR: verify the conflict marker never leaks into relationship-typed reads and LLM failure degrades to empty + exception"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Extend `src/lib/linaw/agents.ts` (append) and `src/lib/linaw/prompts.ts` (append) with agent 4 (Conflict Detector, WORKFLOW function `detectConflicts`) and the Sprint-6 orchestrator.

**A. prompts.ts additions:** `LINAW_CONFLICT_SYSTEM_PROMPT` (compare two ordinances on the SAME subject; respond ONLY with JSON `{"conflict": boolean, "reason": string, "confidence": 0-1, "excerptsA": string[], "excerptsB": string[]}` — reason cites the contradictory provisions; excerpts are verbatim passages from each text; empty arrays when no conflict), `buildLinawConflictUserPrompt(a: {ordinanceNumber, seriesYear, title, content}, b: same, sharedSubjects: string[])` (each content truncated to 8,000 chars), `parseLinawConflictResponse(llmText: string): { conflict: boolean; reason: string; confidence: number; excerptsA: string[]; excerptsB: string[] }` — never throws; any failure → `{conflict: false, reason: '', confidence: 0, excerptsA: [], excerptsB: []}`; confidence clamped to [0,1]; excerpts coerced to strings.

**B. agents.ts additions:**

1. `export const LINAW_CONFLICT_RELATIONSHIP_TYPE = 'conflict';` — the storage marker (decision D1; it is NOT a member of `LinawRelationshipType` and must never be returned by the relationships list).
2. `export interface LinawConflictJudgement { conflict: boolean; reason: string; confidence: number; excerptsA: string[]; excerptsB: string[] }` and `export interface LinawConflictOptions { ordinanceIds?: string[]; userId: string; db?; pipelineId?; conflictLlm?: (a: {id, ordinanceNumber, seriesYear, title, content, subjectTags}, b: same, sharedSubjects: string[]) => Promise<LinawConflictJudgement | null> }`.
3. `export function shapeConflictEvidence(j: LinawConflictJudgement, aId: string, bId: string): { reason: string; excerpts: LinawConflictExcerpt[] }` — pure, exported for tests: `reason` trimmed to 500 chars (empty → the literal string `Unspecified contradiction`); excerpts = up to 2 from `excerptsA` tagged with `aId` then up to 2 from `excerptsB` tagged with `bId`, each passage trimmed to 300 chars, empty/whitespace-only passages dropped (decision D9 caps).
4. `export async function detectConflicts(opts: LinawConflictOptions): Promise<{ pipelineId: string; candidates: number; detected: number; persisted: number; conflicts: LinawConflictRecord[]; exceptions: string[] }>`:
   - Default `pipelineId` accepted from the caller (routes share ONE pipelineId across agents 3+4) else `'detect-' + crypto.randomUUID()`. Scope = `ordinanceIds` restricted-to-ready or all ready (same posture as agent 3). Audit: agent-4 `start` row, `complete` row at the end.
   - Candidate pairs (decision D9): all unordered pairs within scope sharing at least one subject tag (parse `subject_tags` JSON defensively); pairs already represented by an existing `ordinance_relationships` row with `relationship_type = 'conflict'` for that pair are skipped (idempotency).
   - Per pair: call the seam (default = `chatCompletion(LINAW_CONFLICT_SYSTEM_PROMPT, buildLinawConflictUserPrompt(...), {temperature: 0, maxTokens: 1024})` + `parseLinawConflictResponse`; ANY error → treat as `null`). Verdict `null` → skip the pair AND record the exception `conflict detection degraded (LLM unavailable)` ONCE; verdict `conflict: false` → nothing; verdict `conflict: true` → `shapeConflictEvidence`, then `INSERT INTO ordinance_relationships (id, source_id, target_id, relationship_type, section_ref, confidence, confirmed) VALUES (?, ?, ?, 'conflict', ?, ?, 0)` with `section_ref = JSON.stringify({reason, excerpts})` (decision D1 evidence encoding) and confidence from the verdict. `detected` = conflict-true verdicts; `persisted` = rows inserted; return the records (re-read for `createdAt`; `excerpts`/`reason` parsed back from `section_ref`).
   - `logModuleEvent` `linaw_conflict_scan` summary. NEVER throws on LLM trouble (decision D12).
5. `export async function runLinawPipeline(params: { ordinanceIds?: string[]; userId: string; db?; pipelineId?; classify?: LinawClassifyOptions['classify']; refine?: LinawScanOptions['refine']; conflictLlm?: LinawConflictOptions['conflictLlm'] }): Promise<{ pipelineId: string; inventory: LinawInventoryResponse; classification: LinawClassifyResponse; detection: LinawDetectResponse; hitlRequired: boolean }>` — the sequential 1→4 orchestrator (Sprint-7 seam; agents 5–6 stay throwing stubs): ONE shared `pipelineId` (`'pipeline-' + randomUUID()` default); runs `analyzeInventory` → `classifyReadyOrdinances` → `scanCrossReferences` → `detectConflicts` in order, composing `LinawDetectResponse` from the two detection engines (`hitlRequired` = any relationship/conflict detected); any classification gate OR detection sets the top-level `hitlRequired`. Errors propagate (the orchestrator is exercised by tests with seams — production route callers invoke the engines individually).

Then create `tests/unit/linaw-conflicts.test.ts` — hermetic (temp DB; user row; helper seeders; `conflictLlm`/`classify`/`refine` seams injected — NO real LLM). Suite MUST cover:

- **Candidate pairing:** three ready rows — A and B share the tag `Taxation & Revenue`, C has only `Permits` → exactly one candidate pair (A,B); no shared tags anywhere → `candidates === 0` and zero seam invocations (count them).
- **Evidence shaping (pure):** passages longer than 300 chars truncated; more than 2 excerpts per side capped at 2; blank passages dropped; empty reason becomes `Unspecified contradiction`.
- **Persistence (D1):** seam returns conflict-true with reason + excerpts → DB row with `relationship_type='conflict'`, `confirmed=0`, `confidence` = the verdict's, `section_ref` JSON parsing back to `{reason, excerpts}` with correct ordinanceId tags; the returned record carries parsed evidence; audit agent-4 start+complete rows present.
- **Non-fatal LLM failure (D12):** seam throwing → `detected === 0`, `exceptions` contains the degradation message, NO throw escapes.
- **Idempotency:** re-run over the same pair → no second row (`persisted === 0`).
- **Ready-only (rule 4):** a `pending_review` row sharing tags with A is never a candidate.
- **Orchestrator:** seed a small ready corpus with one planted explicit amending reference + one conflict pair; run `runLinawPipeline` with all stubs → audit rows for agent ids 1,2,3,4 all exist under ONE `pipeline_id`; `inventory.totals.ordinances` correct; `classification.classified` correct; `detection.relationshipsPersisted >= 1`; `detection.conflicts` correct; `hitlRequired === true`; `reviewRelationships()` and `assembleCode()` still throw their Sprint-7 errors.

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-conflicts.test.ts` exit 0.
2. The conflict marker is written ONLY via `LINAW_CONFLICT_RELATIONSHIP_TYPE` (single source of truth).
3. `npx tsc --noEmit` green; S6-C3/C6/C8 suites still green.
4. Boundary grep clean.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-conflicts.test.ts                        # expected: pass, 0 failures
npx tsx --test tests/unit/linaw-inventory.test.ts tests/unit/linaw-classify.test.ts tests/unit/linaw-crossref.test.ts   # expected: pass, 0 failures
grep -inE "likha|obra|ella|yala" src/lib/linaw/agents.ts src/lib/linaw/prompts.ts tests/unit/linaw-conflicts.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C10 — N003/N004 routes: detect-relationships + relationships GET + conflicts GET + API-level test

```json
{
  "chunk_id": "S6-C10",
  "feature_id": "N003+N004",
  "chunk_type": "feature",
  "name": "detect-relationships POST (agents 3+4 same run), relationships GET (list portion; PUT is S7), conflicts GET (evidence) + tests/integration/linaw-relationships-api.test.ts",
  "parallel_group": "GROUP-F",
  "dependencies": ["S6-C8", "S6-C9"],
  "file_outputs": ["src/app/api/linaw/detect-relationships/route.ts", "src/app/api/linaw/relationships/route.ts", "src/app/api/linaw/conflicts/route.ts", "tests/integration/linaw-relationships-api.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-relationships-api.test.ts first — watch 404s",
    "GREEN: implement the three routes until the suite passes",
    "REFACTOR: confirm the conflict marker is excluded from the relationships list and parsed back into evidence on the conflicts list"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create THREE routes (thin auth + engine + envelope wrappers; conventions per `src/app/api/linaw/library/route.ts`). All: `export const runtime = "nodejs";` + `withUserAuth`; imports ONLY from the allow-list (`next/server`, `@/lib/user-auth-middleware`, `@/lib/db` where direct reads are needed, `@/lib/linaw/agents`, `@/types/linaw`).

1. **`src/app/api/linaw/detect-relationships/route.ts`** — `POST /api/linaw/detect-relationships` (PRD §12.6: one run returns relationships + conflicts). Body: invalid JSON → 400 `INVALID_BODY`; `ordinanceIds` present but not an array of strings → 400 `INVALID_BODY`; absent/`[]` → whole ready library. Implementation: ONE shared `pipelineId` (`'detect-' + crypto.randomUUID()`); call `scanCrossReferences({ordinanceIds, userId, pipelineId})` then `detectConflicts({ordinanceIds, userId, pipelineId})`; compose `LinawDetectResponse` (`scanned` from the scan result, `hitlRequired = relationshipsDetected > 0 || conflictsDetected > 0`, `exceptions` merged from both engines). Return 200 with the response. try/catch → structured 500 `{ error: 'Relationship detection failed' }` (rare — both engines degrade internally per D7/D9/D12).
2. **`src/app/api/linaw/relationships/route.ts`** — `GET /api/linaw/relationships` (GET list portion ONLY — `PUT :id` is Sprint 7 / N005; do NOT create `[id]/route.ts`). Query params: `type` (optional; must be one of the six `LinawRelationshipType` values else 400 `VALIDATION`), `confirmed` (optional `0` or `1` else 400), `page` (int >= 1), `limit` (int, clamped 1..100, default 20). SQL over `ordinance_relationships` with `relationship_type != 'conflict'` ALWAYS applied (the D1 marker never leaks), plus the optional filters; JOIN `linaw_ordinances` twice for source/target metadata (`id, ordinance_number, series_year, title`); order `created_at DESC`; `COUNT(*)` for `total`. Response `LinawRelationshipsListResponse` (items carry `source`/`target` endpoint objects).
3. **`src/app/api/linaw/conflicts/route.ts`** — `GET /api/linaw/conflicts` (evidence view per PRD §6.8 feature 4). Reads `ordinance_relationships WHERE relationship_type = 'conflict'` ordered `created_at DESC` with `page`/`limit` (same pagination contract); JOINs both endpoints; parses `section_ref` JSON defensively (corrupt JSON → `{reason: 'Unspecified contradiction', excerpts: []}`) into `LinawConflictListItem` (`ordinanceA`/`ordinanceB` endpoints, `reason`, `confidence`, `excerpts`, `confirmed`, `createdAt`). Response `LinawConflictsListResponse`.

Then create `tests/integration/linaw-relationships-api.test.ts` — API-level (dev server running; helper user + cookie; distinctive numbers `const base = 970_000 + crypto.randomInt(0, 20_000)`). Seed: ready TARGET `(base+1, 2019)`; ready SOURCE `(base+2, 2021)` whose content contains the sentence `Section 3. This ordinance amends Ordinance No. <base+1>, S. 2019.` followed by an orphan reference `This ordinance also repeals Ordinance No. <base+99>, S. 1999.` (that number is never seeded); a plain ready row `(base+3, 2020)`; and one `pending_review` row whose content ALSO contains an amending reference to the TARGET (ready-only proof). Cleanup: delete seeded `ordinance_relationships` rows (source_id or target_id among seeded ids), then `linaw_ordinances`, then `agent_decisions WHERE module='linaw' AND user_id = ?`, then the user via `cleanup()`. Suite MUST cover:

- **401 on all three routes** (exact `NO_SESSION` envelope: POST detect + GET relationships + GET conflicts, no cookie).
- **Detect happy path (contract — works WITHOUT an OpenRouter key because the regex pass is authoritative):** POST detect with body `{}` → 200; `relationshipsPersisted >= 1`; DB row exists: source = SOURCE id, target = TARGET id, `relationship_type='amends'`, `confidence` within 0.01 of 0.85, `confirmed = 0`, `section_ref === 'Section 3'`; `orphans` contains the `(base+99, 1999)` item with `warning: 'missing target'`; the pending_review row produced NO relationship row (rule 4 — assert no row references its id); `hitlRequired === true`; audit rows exist for agent 3 AND agent 4 (`module='linaw'`).
- **Body validation:** `{ordinanceIds: 'x'}` → 400 `INVALID_BODY`.
- **Idempotency:** second POST → `relationshipsPersisted === 0`, `skippedExisting >= 1`, row count unchanged.
- **GET relationships:** returns the persisted amends row with `source`/`target` metadata (`ordinanceNumber`/`seriesYear`/`title`); NO item carries `type === 'conflict'`; filter `?type=repeals` → `total === 0`; `?type=bogus` → 400 `VALIDATION`; pagination keys present.
- **GET conflicts:** 200 with `items` array (MAY be empty without an LLM key — assert shape only: when an item is present it carries `ordinanceA`, `ordinanceB`, `reason`, `confidence`, `excerpts` array) and `total`/`page`/`limit` numbers.

**acceptance_criteria:**

1. Suite passes with the dev server up, WITH OR WITHOUT an OpenRouter key.
2. `src/app/api/linaw/relationships/[id]/route.ts` does NOT exist (rule 7 — S7 scope).
3. Boundary grep clean incl. `archived_ordinances` zero across the four files.
4. `npx tsc --noEmit` green.

**verification_commands:**

```bash
npx tsx --test tests/integration/linaw-relationships-api.test.ts         # expected: pass, 0 failures
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/linaw/detect-relationships   # expected: 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/linaw/relationships   # expected: 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/linaw/conflicts       # expected: 401
ls src/app/api/linaw/relationships/ && test ! -d "src/app/api/linaw/relationships/[id]" && echo NO-S7-ROUTE   # expected: route.ts only, NO-S7-ROUTE
grep -RinE "likha|archived_ordinances" src/app/api/linaw/detect-relationships src/app/api/linaw/relationships src/app/api/linaw/conflicts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C13 — `/linaw` page wiring: Inventory + Classification + Relationships live, pipeline visualization over the ready library

```json
{
  "chunk_id": "S6-C13",
  "feature_id": "N001+N002+N003+N004 (UI wiring)",
  "chunk_type": "feature",
  "name": "Rewrite src/app/linaw/page.tsx — three live tabs, Run Codification Pipeline (agents 1-4 with 1100/1300/1600/1500ms UI delays + HITL rose cards), Code Assembly stays a Sprint-7 stub",
  "parallel_group": "GROUP-G",
  "dependencies": ["S6-C5", "S6-C7", "S6-C10", "S6-C11", "S6-C12"],
  "file_outputs": ["src/app/linaw/page.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

REWRITE `src/app/linaw/page.tsx` (the Sprint-5 page — keep Library & Ingestion + Library Verification LIVE exactly as they are wired today: same imports `LibraryIngestion`, `LibraryVerification`, same tab structure). Study `src/app/likha/page.tsx` as the CLIENT-ORCHESTRATION pattern precedent (delays are UI simulation, routes do real work, HITL surfaces as feed cards), then write LINAW's own page. Imports allowed: `react`, `lucide-react`, `@/lib/utils`, the shared kit (`@/components/agent-pipeline`, `@/components/activity-feed`), `@/components/linaw/*` (the five existing components), `@/types/linaw`, `@/types/agentic` (types). Zero likha tokens.

Requirements:

1. **State:** `agents: LinawAgentState[]` (initialized idle from `LINAW_AGENT_DEFS`), `activities: Array<ActivityItem<LinawAgentOutput>>`, `isProcessing: boolean`, `pipelineComplete: boolean`, plus tab-local state for classification results/exceptions and relationship/conflict/orphan lists.
2. **Tabs:** the five existing tab ids. `inventory` tab renders `<InventoryDashboard />` (S6-C11 — it fetches on its own). `classification` tab renders `<ClassificationPanel classifyRun={...} running={isProcessing} results={...} exceptions={...} />` where `classifyRun` POSTs `/api/linaw/classify` with body `{}` (whole ready library) and stores `results`/`exceptions`. `relationships` tab renders `<RelationshipReview items={relationships} orphans={orphans} loading={...} />` + `<ConflictPanel items={conflicts} loading={...} />` fed by GETs of `/api/linaw/relationships?limit=100` and `/api/linaw/conflicts?limit=100` (fetch when the tab opens); also a "Scan now" button that POSTs `/api/linaw/detect-relationships` `{}` then refreshes both lists. `code-assembly` tab keeps the Sprint-5 `StubCard` with the label "Lands in Sprint 7" (rule 7).
3. **Pipeline visualization (decision D3/D11):** a "Run Codification Pipeline" button in the pipeline section (disabled while `isProcessing`; labeled hint "Runs over the ready library"). On click, reset agents/activities, `setIsProcessing(true)`, then SEQUENTIALLY for agents 1–4: `onAgentStart` — set status `processing` (glow + pulse come from the kit); `await sleep(LINAW_AGENT_DEFS[id-1].delayMs)` (1100/1300/1600/1500 — UI simulation); then the REAL route call: agent 1 → `GET /api/linaw/inventory`; agent 2 → `POST /api/linaw/classify` `{}`; agent 3 → `POST /api/linaw/detect-relationships` `{}` (this ONE call serves agents 3 AND 4 — agent 4's step reuses the stored response, its route work already done); agent 4 → no new fetch, consume the detect response's `conflicts`. On each success: `onAgentComplete` — status `completed`, `output` set to the agent's slice (`{completenessScore, yearGaps}` / `{codePlacement}` placeholder from results[0] / `{relationships}` / `{conflicts}`), success activity card with the def's `outputLabel` ("Inventory analyzed" / "Code placement assigned" / "Relationships detected" / "Conflicts flagged"). On HTTP error: status `error`, red error activity card with the server error string, stop the run.
4. **HITL surfacing (D10):** from the classify response — every result with `hitlRequired` adds a rose `type:'hitl'` activity card (title `Review required — code placement`, details include ordinance number + gate + confidence); from the detect response — when `hitlRequired`, one rose card `Review required — detected relationships` summarizing counts + orphans as yellow `warning` cards (`missing target` text). Agents 5–6 remain `idle` (cards render with a small caption "Sprint 7"). After agent 4: `setIsProcessing(false)`, `pipelineComplete = true` (output bookend glows green via the kit), final success activity "Pipeline complete".
5. Feed Confirm/Edit/Reject handlers: Sprint-6 HITL items are acknowledged locally only — Confirm marks the card `confirmed` (green badge via the kit); Edit opens the kit's inline form and saving marks confirmed; Reject requires a reason and marks rejected (no S7 persistence yet — detection confirmations land with N005; the cards say so in their details). Keep the handlers wired so the kit is fully exercised.
6. The Sprint-5 paragraph "Pipeline agents activate once the library holds ready records (Sprint 6)..." is REPLACED by the live pipeline section; the "Meanwhile, ingestion & verification stay live..." note may stay on non-library tabs.
7. Responsive + palette discipline unchanged from Sprint 5 (`#0F1729` page, cards per component, buttons `min-h-11`, tab buttons keep their current classes).

**acceptance_criteria:**

1. `npx tsc --noEmit` + `npm run lint` green.
2. Page renders all six agent names + five tabs (SSR smoke in S6-C14.D); the string "Lands in Sprint 6" occurs ZERO times; "Lands in Sprint 7" occurs exactly once (Code Assembly stub).
3. No new fetch targets beyond the five Sprint-6 routes + the Sprint-5 library routes already used by the ingestion/verification components.
4. Boundary grep clean.

**verification_commands:**

```bash
npx tsc --noEmit && npm run lint && echo BUILD-LINT-OK                   # expected: BUILD-LINT-OK
grep -c "Lands in Sprint 6" src/app/linaw/page.tsx                       # expected: 0
grep -c "Lands in Sprint 7" src/app/linaw/page.tsx                       # expected: 1
grep -inE "likha|obra|ella|yala" src/app/linaw/page.tsx || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S6-C14 — Final gate: boundary verification, build, FULL regression, package.json wiring, four feature commits

```json
{
  "chunk_id": "S6-C14",
  "feature_id": "N001+N002+N003+N004 (gate)",
  "chunk_type": "gate",
  "name": "Boundary greps (both directions + archived_ordinances=0), tsc/lint/build, test-script wiring, FULL Sprint 1-5 regression, render smoke, 4 commits",
  "parallel_group": "GROUP-H",
  "dependencies": ["S6-C1", "S6-C2", "S6-C3", "S6-C4", "S6-C5", "S6-C6", "S6-C7", "S6-C8", "S6-C9", "S6-C10", "S6-C11", "S6-C12", "S6-C13"],
  "file_outputs": ["package.json"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint-6 closing gate IN ORDER (Git Bash / POSIX shell). Every section must produce its expected output before the next starts; any failure blocks the commits.

**0. package.json wiring (additive, same precedent as Sprint 5):** append the five hermetic suites to the `test` script's file list (`tests/unit/linaw-inventory.test.ts tests/unit/linaw-search.test.ts tests/unit/linaw-classify.test.ts tests/unit/linaw-crossref.test.ts tests/unit/linaw-conflicts.test.ts`) and the three API-level suites to `test:integration` (`tests/integration/linaw-inventory.test.ts tests/integration/linaw-classify-api.test.ts tests/integration/linaw-relationships-api.test.ts`). Touch nothing else in package.json.

**A. Boundary verification (violation = build failure):**

```bash
# A1 — zero forbidden imports in every LINAW path (both sprint surfaces):
grep -RinE "from ['\"]@/(app/api/(obra|chat|likha)|lib/(ai/(prompts|obra-export)|likha)|components/(ella|obra|yala|likha))" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts || echo IMPORTS-CLEAN
# expected: IMPORTS-CLEAN

# A2 — HARD constraint: archived_ordinances across ALL Sprint 6 files = zero:
grep -Rin "archived_ordinances" src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts \
  tests/unit/linaw-inventory.test.ts tests/unit/linaw-search.test.ts tests/unit/linaw-classify.test.ts \
  tests/unit/linaw-crossref.test.ts tests/unit/linaw-conflicts.test.ts tests/integration/linaw-inventory.test.ts \
  tests/integration/linaw-classify-api.test.ts tests/integration/linaw-relationships-api.test.ts || echo NO-ARCHIVED-ORDINANCES
# expected: NO-ARCHIVED-ORDINANCES

# A3 — no reads/writes of any other module's tables from LINAW code:
grep -RinE "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(archived_ordinances|amendment_links)\b|(FROM|INTO|UPDATE|TABLE)[[:space:]]+classifications\b" \
  src/lib/linaw src/app/api/linaw || echo TABLES-CLEAN
# expected: TABLES-CLEAN

# A4 — zero sibling-module tokens in Sprint 6 files:
grep -RinE "likha|obra|ella|yala" src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts \
  tests/unit/linaw-*.test.ts tests/integration/linaw-inventory.test.ts tests/integration/linaw-classify-api.test.ts \
  tests/integration/linaw-relationships-api.test.ts tests/helpers/linaw-test-util.ts || echo TOKENS-CLEAN
# expected: TOKENS-CLEAN

# A5 — LIKHA direction unchanged (regression: LIKHA stays free of linaw references):
grep -Rin "linaw" src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts || echo LIKHA-DIRECTION-CLEAN
# expected: LIKHA-DIRECTION-CLEAN
```

**B. Static + build gates:**

```bash
npx tsc --noEmit && echo TSC-OK          # expected: TSC-OK
npm run lint && echo LINT-OK             # expected: LINT-OK
npm run build && echo BUILD-OK           # expected: BUILD-OK
```

**C. Tests — new Sprint-6 suites + FULL Sprint 1–5 regression (the dev server must be running for `test:integration`; a LIKHA failure here is boundary-violation evidence and blocks the tag):**

```bash
npm run test                             # expected: ALL suites pass — hermetic LIKHA (S2-S4) + LINAW S5 + LINAW S6 (inventory, search, classify, crossref, conflicts)
npm run test:integration                 # expected: ALL suites pass — LIKHA API (S2-S4) + LINAW S5 (import/upload/library) + LINAW S6 (inventory, classify-api, relationships-api)
```

**D. Regression extras + render smoke:**

```bash
# D1 — shared kit + agentic types + Sprint-5 surfaces untouched since v0.5.0-sprint-5:
git --no-pager diff --stat v0.5.0-sprint-5..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts | grep -c . || echo KIT-UNTOUCHED
# expected: KIT-UNTOUCHED

# D2 — frozen shared primitives: db.ts / logger.ts / llm.ts / middleware byte-identical (Sprint 6 edits no shared code):
git --no-pager diff --stat v0.5.0-sprint-5..HEAD -- src/lib/db.ts src/lib/logger.ts src/lib/ai/llm.ts src/middleware.ts | grep -c . || echo SHARED-UNTOUCHED
# expected: SHARED-UNTOUCHED

# D3 — schema intact + idempotent (run TWICE):
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_ord_rel_source','idx_ord_rel_target','idx_ord_rel_type','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); if(missing.length){console.error('FAIL missing:',missing); process.exit(1);} console.log('SCHEMA OK');"
# expected (both runs): SCHEMA OK

# D4 — Sprint-5 ingestion routes still gated + LINAW page render smoke:
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/linaw/import && echo " (import 401)"      # expected: 401 (import 401)
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/linaw/library && echo " (library 401)"     # expected: 401 (library 401)
npm run dev & sleep 8
curl -s http://localhost:3000/linaw | grep -oE "Inventory Analyst|Code Classifier|Cross-Reference Scanner|Conflict Detector|Relationship Reviewer|Code Assembler" | sort -u | wc -l
# expected: 6
curl -s http://localhost:3000/linaw | grep -c "Run Codification Pipeline"
# expected: >= 1
curl -s http://localhost:3000/linaw | grep -c "Lands in Sprint 6"
# expected: 0 (all Sprint-6 stubs replaced)
curl -s http://localhost:3000/linaw | grep -c "Lands in Sprint 7"
# expected: 1 (Code Assembly stub only)
kill %1
```

**E. Feature commits (exact messages, explicit staging — decision D11; verify each staging set compiles by running B between commits):**

```bash
git add src/types/linaw.ts tests/helpers/linaw-test-util.ts \
        src/lib/linaw/agents.ts src/lib/linaw/search.ts .gitignore \
        src/app/api/linaw/inventory/route.ts src/components/linaw/inventory-dashboard.tsx \
        tests/unit/linaw-inventory.test.ts tests/unit/linaw-search.test.ts \
        tests/integration/linaw-inventory.test.ts
git commit -m "feat: implement N001 inventory dashboard with gap analysis pillar-likha-linaw-20260809"

git add src/lib/linaw/prompts.ts src/lib/linaw/agents.ts \
        src/app/api/linaw/classify/route.ts "src/app/api/linaw/classify/[id]/route.ts" \
        src/components/linaw/classification-panel.tsx \
        tests/unit/linaw-classify.test.ts tests/integration/linaw-classify-api.test.ts
git commit -m "feat: implement N002 AI subject classification into Code Titles/Chapters pillar-likha-linaw-20260809"

git add src/lib/linaw/agents.ts src/lib/linaw/prompts.ts \
        src/app/api/linaw/detect-relationships/route.ts src/app/api/linaw/relationships/route.ts \
        src/components/linaw/relationship-review.tsx \
        tests/unit/linaw-crossref.test.ts
git commit -m "feat: implement N003 cross-reference scanner for amendments/repeals pillar-likha-linaw-20260809"

git add src/lib/linaw/agents.ts \
        src/app/api/linaw/detect-relationships/route.ts src/app/api/linaw/conflicts/route.ts \
        src/components/linaw/conflict-panel.tsx src/app/linaw/page.tsx package.json \
        tests/unit/linaw-conflicts.test.ts tests/integration/linaw-relationships-api.test.ts
git commit -m "feat: implement N004 conflict detection across ordinances pillar-likha-linaw-20260809"

git log --oneline -4
# expected: exactly these 4 commits, in this order, with these exact messages
git status --porcelain -- src tests package.json .gitignore
# expected: empty (only this instructions doc may remain untracked under docs/)
```

Commit-seam semantics (decision D11): the N003 commit's `detect-relationships` route temporarily returns `conflicts: []` (agent 4 wired by the N004 commit's staged edit of the same file); `src/lib/linaw/agents.ts` and `prompts.ts` appear in multiple commits because each feature appends its engine — `git add -p` is NOT required since each commit stages the WHOLE current file state and every intermediate state compiles with its staged tests. Tag `v0.6.0-sprint-6` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do not tag in this chunk.

**acceptance_criteria:**

1. Sections A–D all produce their expected outputs; C's results are captured as the Sprint-6 regression baseline (FULL Sprint 1–5 suites green).
2. Exactly 4 commits with the exact `feat: implement [Feature] pillar-likha-linaw-20260809` messages; working tree (module files) clean afterward.
3. All evidence (command outputs, test counts, commit SHAs) recorded for SPRINT_REVIEW and the cumulative quality score.

**verification_commands:** the gate body itself (sections A–E above).

---

## Sprint 6 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 6)

**This sprint delivers LINAW's analysis agents over the ready library — inventory with gap analysis, Code classification, cross-reference scanning, conflict detection — with real routes, dashboards, and evidence panels. Dependency map: Sprint 5 (`library_status='ready'` records are the agents' ONLY input) + Sprint 1 kit. Instruction source: PRP-LINAW only.**

- [ ] **N001 acceptance (PRD-LINAW §6.8 feature 1):** `GET /api/linaw/inventory` returns totals, counts by year/status/subject, missing year gaps (range continuity over the ingested ready corpus: whole missing years `{year, missing: []}` + per-year numbering holes), completeness score; reads `linaw_ordinances WHERE library_status='ready'` ONLY — test-proven with seeded non-ready rows excluded (unit + API-level); dashboard refresh ≤2s asserted (`tookMs` + wall clock); `inventory-dashboard.tsx` renders completeness bar, counts, year-gap list, per-year SVG bar chart with NO chart library (S6-C3, S6-C5, S6-C11)
- [ ] **N002 acceptance (PRD-LINAW §6.8 feature 2 + §12.4):** `POST /api/linaw/classify` (`{ordinanceIds?}` — absent/empty = whole ready library) produces LLM placements `{titleNumber, chapterNumber, articleNumber?, confidence}` using the library's OWN subject-tag frequencies as priors; persisted to `codification_records` (`ai_suggestion` JSON, `cod_status='classified'`, upsert-safe re-runs that preserve override history); `PUT /api/linaw/classify/:id` override persists `human_override` JSON + required reason, `cod_status='reviewed'`, `reviewed_by_id`, audited as agent 2 `confirm`/`override`; confidence <0.7 → `code_placement` HITL gate, <0.6 → `low_confidence_classification` gate (mutually exclusive, LIKHA mechanics mirrored: audit `hitl` rows + response flags + rose feed cards) (S6-C6, S6-C7, S6-C12)
- [ ] **N003 acceptance (PRD-LINAW §6.8 feature 3 + exception rules):** `POST /api/linaw/detect-relationships` (`{ordinanceIds?}`) regex+LLM pass finds "amending/repealing/pursuant to Ordinance No. X, S. YYYY" variants, resolves them to READY `linaw_ordinances` ids, persists to `ordinance_relationships` (`confirmed=0`, confidence — baseline 0.85 or refined, `section_ref` captured); `relationship_type` ∈ amends/repeals/partial_repeal/supersedes/extends/implements; unresolved/non-ready targets → orphan warning `missing target` as an exception ROW (never crash, never persist); idempotent re-runs (`skippedExisting`); ≥70% precision target is pilot/SYSTEM_TEST scope (contract asserted now per SPRINT_PLAN risk 7); `GET /api/linaw/relationships` lists persisted rows with source/target metadata and NEVER the conflict marker (S6-C8, S6-C10, S6-C12)
- [ ] **N004 acceptance (PRD-LINAW §6.8 feature 4):** same detect run flags semantic contradictions between same-subject ordinances with confidence + evidence excerpts; stored per decision D1 (`ordinance_relationships` rows `relationship_type='conflict'`, evidence JSON in `section_ref`); `GET /api/linaw/conflicts` returns the conflict list with parsed evidence; `conflict-panel.tsx` renders side-by-side excerpts with flagged-passage styling; LLM-unavailable degradation is graceful (relationships still returned) (S6-C9, S6-C10, S6-C12)
- [ ] **LINAW BM25 namespace (deferred from Sprint 5):** `src/lib/linaw/search.ts` — OWN namespace, `src/lib/data/linaw-search-index.json` (gitignored), lazy rebuild from READY rows only, temp-path DI for tests, `LINAW_SEARCH_INDEX_PATH` env override; library list `?q=` stays SQL LIKE this sprint (decision D2 — flagged) (S6-C4)
- [ ] **Pipeline runner:** `src/lib/linaw/agents.ts` implements agents 1–4 of 6 (1100/1300/1600/1500ms slots defined for the client; DI seams `db`/`classify`/`refine`/`conflictLlm`; audit rows `module='linaw'` with real agent ids 1–4; HITL raising per D5/D10); agents 5–6 are throwing stubs; `runLinawPipeline` orchestrator unit-tested as the S7 seam; `/linaw` page Inventory + Classification + Relationships tabs live with pipeline visualization running over the ready library; Code Assembly tab stays a Sprint-7 stub (S6-C3, S6-C6, S6-C8, S6-C9, S6-C13)
- [ ] **HITL gates pause the pipeline with rose cards** (`low_confidence_classification`, `code_placement`, `detected_relationship` raised; confirmations are Sprint-7 scope — D10)
- [ ] **Auth + logging + audit:** every route wrapped in `withUserAuth` (401 proven on inventory/classify/classify-[id]/detect-relationships/relationships/conflicts); all engine runs logged via `logModuleEvent` `module='linaw'`; every agent action audited to `agent_decisions` (`module='linaw'`)
- [ ] **Boundary grep clean, both directions:** A1 forbidden imports zero, A2 `archived_ordinances` zero across ALL Sprint-6 files, A3 table whitelist clean, A4 sibling tokens zero, A5 LIKHA direction clean (S6-C14.A)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S6-C14.B)
- [ ] **New tests green:** hermetic — inventory computation (gaps + completeness + ready-only), BM25 namespace (rebuild ready-only, ranking, temp-path DI), classifier prompt parsing + gates + override persistence, cross-ref regex resolution incl. orphans/self-refs/idempotency, conflict evidence shaping + marker persistence + orchestrator; API-level — inventory math + ≤2s + 401, classify contract + override round-trip + 401/400/404/409, detect relationships persistence + orphans + idempotency + conflicts list + 401s (S6-C14.C)
- [ ] **Regression:** FULL re-run of Sprint 1 (kit/agentic byte-identical, schema assertions, shared primitives untouched) + Sprints 2–5 suites (LIKHA hermetic + API-level, LINAW ingestion) — all green; a LIKHA failure is boundary-violation evidence and blocks the tag (S6-C14.C/D)
- [ ] **No Sprint-7 features present:** no relationships PUT/[id], no assemble/code/export-package routes, no summaries, no `code_volumes` writes (S6-C10 verification + A greps)
- [ ] **Per-feature commits:** exactly 4 — `feat: implement N001 inventory dashboard with gap analysis pillar-likha-linaw-20260809`, `feat: implement N002 AI subject classification into Code Titles/Chapters pillar-likha-linaw-20260809`, `feat: implement N003 cross-reference scanner for amendments/repeals pillar-likha-linaw-20260809`, `feat: implement N004 conflict detection across ordinances pillar-likha-linaw-20260809` (S6-C14.E)
- [ ] Tag `v0.6.0-sprint-6` cut ONLY after SPRINT_REVIEW passes; cumulative quality score recorded

**Integration/Regression notes (SPRINT_PLAN):** new tests = inventory math on seeded fixture; classify + override; detect-relationships precision fixture (planted "amending Ordinance No. X, S. YYYY" references); conflicts evidence shape. Regression = re-run Sprints 2–5 suites. Accuracy targets (cross-reference ≥70%, conflict ≥60%) are verified on the pilot batch at SYSTEM_TEST, not per-sprint gates (SPRINT_PLAN risk 7).

---

## Flagged for SPRINT_REVIEW

1. **D1 — Conflict storage on `ordinance_relationships` with a `'conflict'` marker + evidence JSON in `section_ref`.** Chosen because boundary rule 3 restricts Sprint 6 to the three existing LINAW tables + `agent_decisions` (a separate `linaw_conflicts` table would require new DDL outside the allowed set) and the frozen DDL's `relationship_type` has no CHECK constraint (verified). The marker is storage-only: the relationships API excludes it, and `LinawRelationshipType` does not include it. If Sprint 7's confirmation workflow wants first-class conflict columns (e.g. a dedicated evidence column or conflict-specific statuses), an additive ALTER is its own decision.
2. **D2 — BM25 namespace shipped, `?q=` NOT switched.** The LINAW namespace lands per the Sprint-5 deferral (own file, gitignored, lazy rebuild from ready rows, temp-path DI), but `GET /api/linaw/library?q=` stays SQL LIKE this sprint: the index is ready-only by law while the library list must also search `pending_review` rows for the verification queue — switching would break Sprint-5 behavior/regression. The route upgrade is deferred (candidate: Sprint 7 with a ready-only scope or a dual-index design).
3. **D4 — Completeness score = year coverage.** `completenessScore` measures series continuity (years with ready rows / years in the corpus range), NOT classification coverage (the PRD KPI `classified/ready` belongs to Sprint 7's assembly view). Confirm this matches pilot expectations for the inventory dashboard headline number.
4. **D5/D10 — HITL gates are RAISED, not resolved, in Sprint 6.** Confirmation/rejection of detected relationships (`detected_relationship` gate) lands with N005 in Sprint 7; Sprint-6 relationship cards show disabled actions labeled accordingly. Classification gates surface as rose cards + audit rows; their human resolution path IS the override PUT (N002 complete this sprint).
5. **D6 — Override upserts.** A human override can create the FIRST codification record for a ready ordinance (no prior AI classification needed); re-classification resets `cod_status='classified'` but preserves `human_override` + `reviewed_by_id` history (assembly should prefer the override — Sprint 7 wiring detail).
6. **D7/D12 — Regex-primary cross-referencing + LLM degradation contract.** Baseline confidence 0.85 for explicit references; the LLM refine is best-effort; classification 500s structurally without a key (LIKHA D32 posture) while detect never 500s on LLM trouble. Pilot precision (≥70%) is SYSTEM_TEST scope.
7. **D9 — Conflict candidates need shared subject tags.** Ordinances without `subject_tags` can never be conflict candidates this sprint (subject metadata is the deterministic prior per WORKFLOW data rules). Corpus tagging completeness therefore bounds conflict recall; a title/content-similarity candidate generator is a future enhancement.
8. **D11 — Four-commit seam with shared files.** `agents.ts`/`prompts.ts` appear in commits 2–4 (each feature appends its engine); the N003 commit's detect route returns `conflicts: []` until the N004 commit. Every intermediate state compiles and its staged tests pass; staging lists are explicit in S6-C14.E.
9. **`classification-panel.tsx` is additive** (PRP-LINAW's file list names inventory-dashboard/relationship-review/conflict-panel/code-assembly but no classification editor — LIKHA's Sprint 4 needed one too; LINAW gets its own independently).
10. **`runLinawPipeline` is exported + unit-tested but not route-consumed this sprint** (the page drives per-agent routes; the orchestrator is the Sprint-7 full-pipeline seam). No dead code — covered by the conflicts suite.
11. **Middleware matcher finding carries over from Sprint 5** (`/linaw` in PROTECTED_PATHS but absent from `config.matcher`; API routes stay hard-gated by `withUserAuth`). Sprint 6 did not touch the matcher.

**Handoff:** Sprint 7 (LINAW Confirmation, Code Assembly & L1 Interchange — N005, N007, N006, N015; PRP-LINAW only + INTERCHANGE-SPEC as frozen contract reference) consumes Sprint 6's detected relationships/classifications/conflicts: it adds `PUT /api/linaw/relationships/:id` (confirm/reject + status propagation into `linaw_ordinances`), summaries, `assemble`/`code` routes + `code_volumes`, `export-package`, completes agents 5–6 (1100/1300ms) for the full 6/6 pipeline (7900ms), and re-runs the combined Sprint 2–6 suites as the FULL regression for the 19-feature acceptance pass feeding Phase 4 SYSTEM_TEST.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 6 of 7*
