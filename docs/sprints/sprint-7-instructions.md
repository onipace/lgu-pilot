# Sprint 7 Instruction Set — LINAW Confirmation, Code Assembly & L1 Interchange (FINAL SPRINT)

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 7 of 7 — "LINAW Confirmation, Code Assembly & L1 Interchange" — features **N005, N007, N006, N015** (confirm → summarize → assemble → export chain) |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith (verified installed), React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^12, lucide-react ^0.468, openai ^6.35, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `node:test`), test runner `tsx --test` (scripts `test` / `test:integration`), git tag baseline `v0.6.0-sprint-6` |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 7 uses **`docs/PRP-LINAW.md` ONLY** — it is the sole module instruction source. Do NOT read or attach any module section of `docs/PRP-LIKHA.md`. The ONLY cross-cutting document is **`docs/INTERCHANGE-SPEC.md` v1.0.0** (canonical contract reference for N015 — contract-shaped, not code-shaped): §2 package shape, §3 manifest, §4 record mapping (LINAW rows), §5 relationships array format (**CRITICAL: relationships reference ordinances by `{ordinanceNumber, seriesYear}` — NEVER internal ids**), §6 `packageHash` = `'sha256:' + SHA-256(canonical JSON of {records, relationships}, keys sorted lexicographically at every depth, no insignificant whitespace)`, §7 route contract. Supporting inputs already consumed by this instruction set: `docs/PRD-LINAW.md` §6.8 features 5/6/7 + Should-have N015 (acceptance), §7.1 flow steps 7–10, §12.4 HITL gate rows (`detected_relationship`, `final_code_export`), §12.5 data model, §12.6 API contract; `docs/WORKFLOW-LINAW.json` (agents 5–6: Relationship Reviewer 1100ms / Code Assembler 1300ms; `hitl_gates`; `data_rules`; `exception_rules`); and the Sprint-1–6 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes").

**Pattern duplication is intentional.** The LIKHA implementation may be studied as PROVEN PATTERN PRECEDENT ONLY — specifically `src/lib/likha/export.ts` (L1 builder: shared eligibility loader, `canonicalJson` recursive sorted-key serializer, manifest construction, `'sha256:' + hash` round-trip posture) and `tests/unit/likha-export-l1.test.ts` / `tests/integration/likha-exports.test.ts` (hash round-trip test shape, hermetic + over-HTTP). **LINAW builds its OWN `src/lib/linaw/export.ts` independently: ZERO imports from `src/lib/likha` or any likha path, ZERO shared code.** Separate SKUs — independence over DRY (Audit v2 §3, PRP-LINAW constraint 4).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 6 is complete and tagged `v0.6.0-sprint-6`.** `src/lib/linaw/agents.ts` implements agents 1–4 (`analyzeInventory`, `classifyReadyOrdinances` + `applyClassificationOverride`, `scanCrossReferences`, `detectConflicts`), the shared audit writer `insertLinawAgentDecision(db, pipelineId, userId, params)` (single `agent_decisions` write path, `module='linaw'`), the export constant `LINAW_AGENT_NAMES` (all six names already present), the conflict storage marker `LINAW_CONFLICT_RELATIONSHIP_TYPE = 'conflict'` (decision D1: conflicts persist as `ordinance_relationships` rows with evidence JSON in `section_ref`; the marker never leaks into the relationships API), the baseline `LINAW_BASELINE_CROSSREF_CONFIDENCE = 0.85`, and the `runLinawPipeline` sequential 1→4 orchestrator. **Agents 5–6 are exported throwing stubs: `reviewRelationships(): never` and `assembleCode(): never` ('lands in Sprint 7') — this sprint replaces both.** Detection direction is FIXED by Sprint 6 (D7/D8): `source_id` = the ordinance whose CONTENT carries the reference (the amending/repealing instrument — typically newer); `target_id` = the referenced ordinance (the one acted upon — typically older). Persisted rows carry `confirmed = 0`.
2. **Schema state (verified verbatim in `src/lib/db.ts` `initSchema()`):** `linaw_ordinances` HAS the `summary TEXT` column (N007 storage exists — no schema work needed for summaries). `code_volumes` DDL is present and untouched since Sprint 1: `( id TEXT PRIMARY KEY, title TEXT NOT NULL, edition TEXT NOT NULL, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','under_review','published')), structure TEXT NOT NULL, generated_at TEXT, published_at TEXT, generated_by_id TEXT, created_at, updated_at, FK generated_by_id → users(id) )` — N006 writes it for the FIRST time this sprint. `ordinance_relationships` has `confirmed INTEGER DEFAULT 0` + `confirmed_by_id TEXT` but NO rejection marker — Sprint 7 adds ONE additive column (decision D1). `codification_records` carries `section_in_code INTEGER` + `cod_status … 'codified'` — both consumed by the assembler for the first time this sprint.
3. **`src/app/api/linaw/relationships/route.ts` is GET-only today** (Sprint 6 S6-C10; header comment says "PUT :id is Sprint 7 / N005"). It validates `?type=` against the six `LinawRelationshipType` values, always excludes the conflict marker, joins source/target metadata, paginates. The PUT lands as a NEW dynamic-segment file `src/app/api/linaw/relationships/[id]/route.ts` (App Router cannot bind `:id` on the collection route — `library/[id]` and `classify/[id]` are the in-repo precedents).
4. **`src/components/linaw/relationship-review.tsx` (Sprint 6 S6-C12)** renders the pending list with confidence + orphan warnings; Confirm/Reject buttons are visibly DISABLED with `title="Confirmation lands in Sprint 7"` and a "Confirmation lands in Sprint 7" caption — Sprint 7 enables them (N005). `conflict-panel.tsx` has NO action buttons today — decision D3 adds confirm/reject there too (conflict rows are decided through the same PUT).
5. **`src/app/linaw/page.tsx` (Sprint 6 S6-C13)** drives agents 1–4 over the ready library with client-simulated delays (`sleep(LINAW_AGENT_DEFS[i].delayMs)` + real route calls; decision D3 of Sprint 6), renders the Code Assembly tab as a `StubCard` "Lands in Sprint 7", and carries feed handlers that are LOCAL-ONLY acknowledgments (`handleConfirm`/`handleEdit`/`handleReject` just flip feed state — D10). Sprint 7 extends `runPipeline` with agents 5–6 slots, replaces the stub with `code-assembly.tsx`, and makes the relationship confirm/reject handlers real PUT calls.
6. **`src/types/linaw.ts` exists** with `LINAW_AGENT_DEFS` (all six agents incl. 1100ms/1300ms slots for 5–6), `LinawRelationshipType` (six values), `LinawHitlGate` (all four gates incl. `detected_relationship` + `final_code_export`), `LinawRelationshipRecord` (has `confirmed: 0|1`, NO `rejected` yet), `LinawAgentOutput` with `toc?: unknown[]` (Sprint 7 replaces `unknown[]` with the concrete `CodeTocNode[]`). Sprint 7 APPENDS its contracts (S7-C1); existing content stays byte-compatible (Sprint 5–6 regression imports must keep compiling).
7. **`src/lib/linaw/prompts.ts` real shape (inspected):** system-prompt constants + `build*UserPrompt` + never-throws `parse*Response` triples (`LINAW_METADATA_SYSTEM_PROMPT`, `LINAW_CLASSIFY_SYSTEM_PROMPT` + `LINAW_CODE_TITLES` 13-title taxonomy, `LINAW_CROSSREF_SYSTEM_PROMPT`, `LINAW_CONFLICT_SYSTEM_PROMPT`). N007 appends the summary triple (S7-C6). Note: summaries are PLAIN TEXT (not JSON) — the parser contract differs from the JSON parsers.
8. **`src/lib/ai/llm.ts` real API:** `chatCompletion(systemPrompt, userPrompt, options?: {maxTokens?, temperature?}) → Promise<string>` (throws `OPENROUTER_API_KEY not configured` when the key is absent). No automated suite may REQUIRE a real key (Sprint 6 D12 posture carries over — decision D12).
9. **`src/lib/user-auth-middleware.ts` real signature:** `withUserAuth(handler)` where `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession })`; acting user id = `user.user.id`. 401 body: `{ error: "Authentication required", code: "NO_SESSION" }`. Dynamic-param precedent: `const { id } = await params;` (`src/app/api/linaw/library/[id]/route.ts`, `src/app/api/linaw/classify/[id]/route.ts`).
10. **`src/lib/logger.ts` real API:** `logModuleEvent({ module, interactionType, content?, ipAddress, participantName?, participantSessionId? })` — LINAW calls it with `module: 'linaw'`, `participantSessionId: 'linaw-' + userId`. logger.ts is NOT edited this sprint.
11. **LIKHA L1 builder PATTERN precedent (inspected in `src/lib/likha/export.ts` — study only, never import):** `LikhaExportOutcome<T> = {ok:true,payload} | {ok:false,kind:'ineligible',ineligibleIds,error}`; tolerant `recordIds` posture (omitted → all eligible; `[]` → valid empty package; any ineligible id → refuse WHOLE request, route maps to 409 CONFLICT); `canonicalJson(value)` — recursive, object keys sorted lexicographically at EVERY depth, arrays preserve order, `undefined` members dropped, no insignificant whitespace; `readAppVersion()` from package.json; manifest per INTERCHANGE-SPEC §3; hash computed over the payload object literal ONLY (never the manifest); route returns `new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=…' } })` and logs the export with module + exporter user id. LINAW duplicates all of this independently and ADDS the §5 relationships array (LIKHA omitted it) — the hashed payload literal for LINAW is `{ records, relationships }`.
12. **Test harness convention (inspected):** `tests/helpers/linaw-test-util.ts` has `BASE_URL`, `assertServerReachable`, `seedApprovedUser(dbFile?)` (seeds user + session into `data/workshop.db`, returns cookie + cleanup — the handle is NOT exposed, so integration tests open their OWN `Database(path.join(process.cwd(),'data','workshop.db'))` for row seeding), `tempDbPath()`, `seedLinawPendingReviewRecord`, `seedLinawReadyRecord` (defaults: No. 11 S. 2022, ready, tags `['Taxation & Revenue']`), `seedLinawCodificationRecord` (defaults Title 3 / Chapter 1, `cod_status='classified'`), `buildMinimalDocx`. Hermetic tests set `process.env.DB_PATH = tempDbPath()` BEFORE dynamic-importing `../../src/lib/db`; API-level tests run against a live `npm run dev`. `package.json` scripts carry explicit file lists — the gate chunk (S7-C15) appends the Sprint-7 files.
13. **Shared kit + page precedent (inspected):** `AgentPipeline { agents, isProcessing, pipelineComplete? }`; `ActivityFeed { activities, emptyMessage?, onConfirm?, onEdit?, onReject? }` (rose border for `type:'hitl'` comes from the kit). The kit + `src/types/agentic.ts` are NOT edited this sprint (gate asserts byte-identical since `v0.6.0-sprint-6`).

## Sprint 7 Boundary Rules (apply to EVERY chunk — violation = build failure)

1. **LINAW-only code paths.** Every file created or edited for Sprint 7 lives in the `linaw/` namespace (`src/lib/linaw`, `src/app/api/linaw`, `src/components/linaw`, `src/app/linaw`, `src/types/linaw.ts`, `tests/**/linaw-*`) or is an explicitly listed additive shared edit (S7-C3: the idempotent `rejected` column guard in `src/lib/db.ts`; S7-C15: `package.json` test-script file lists).
2. **HARD boundary — zero likha imports/reads.** No Sprint 7 file may import from `src/lib/likha`, `src/app/api/likha`, `src/components/likha`, `src/app/likha`, `@/app/api/{obra,chat}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, or any ELLA/OBRA/YALA code. Allowed imports ONLY: `@/lib/ai/llm`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed`), `@/types/agentic`, `@/types/linaw`, `@/lib/linaw/*` (within the module), Node built-ins (`node:crypto` for SHA-256, `node:fs`/`node:path` for appVersion), `lucide-react`, `next/server`, `better-sqlite3` (tests only). Test files additionally may import ONLY `../helpers/linaw-test-util` (never the likha helper) and relative `../../src/lib/linaw/*` / `../../src/lib/db` paths. Reading likha files to STUDY the pattern is allowed; importing, copying verbatim, or referencing them in Sprint 7 code/comments is not.
3. **Table whitelist: `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, plus `agent_decisions` (module='linaw' rows) — nothing else.** `grep -Rin "archived_ordinances"` across ALL Sprint 7 files = **zero hits** (gate S7-C15.A runs this verbatim). Zero references to `amendment_links` or `classifications`. The N015 builder (`src/lib/linaw/export.ts`) reads ONLY `linaw_ordinances` + `ordinance_relationships` (it does NOT read `code_volumes` — the L1 package is a library snapshot, not a code volume; gate asserts).
4. **Agents see ONLY `library_status='ready'` rows — test-proven.** Every Sprint-7 engine query over `linaw_ordinances` filters `library_status = 'ready'` (decision scope, summary scope, assembly scope, export scope). Each capability carries at least one test seeding a non-ready row and asserting exclusion (S7-C3/C7/C9/C13 + S7-C15.C integration).
5. **Auth + logging + audit on every route and every agent action.** Every LINAW API route handler is wrapped in `withUserAuth`; acting user = `user.user.id`. Every engine call writes `agent_decisions` rows (`module='linaw'`: agent 5 review/decisions, agent 6 assembly + `final_code_export` hitl row, agent 0 for the pre-pipeline summary convention — decision D4) with start/complete rows always and `hitl` rows when a gate fires; every write path calls `logModuleEvent` with `module: 'linaw'`.
6. **Zero `likha|obra|ella|yala` tokens** (case-insensitive) in any Sprint 7 file, except this instructions document.
7. **INTERCHANGE-SPEC v1.0.0 is FROZEN.** N015 implements §2–§7 exactly; `schemaVersion` is stamped `'1.0.0'`. Any spec ambiguity is resolved by decision D8 below, never by editing the spec.
8. **Schema: ONE additive column only (decision D1).** `src/lib/db.ts` gains the idempotent `rejected` guard and nothing else. No other DDL changes, no ALTERs beyond it, no edits to existing columns/constraints.
9. **Four feature commits in CHAIN ORDER N005 → N007 → N006 → N015 (decision D9), exact messages:** `feat: implement N005 relationship confirmation workflow pillar-likha-linaw-20260809`, `feat: implement N007 AI-generated plain-language summaries pillar-likha-linaw-20260809`, `feat: implement N006 code volume assembly with TOC pillar-likha-linaw-20260809`, `feat: implement N015 codification interchange export package pillar-likha-linaw-20260809`. Each seam compiles and its staged tests pass before the next feature starts.
10. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprints 1–6). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (all flagged for SPRINT_REVIEW — see end of file)

- **D1 — Rejection storage: ONE additive column `ordinance_relationships.rejected INTEGER DEFAULT 0` (idempotent ALTER guard in `initSchema()`); rejection REASON lives in `agent_decisions`.** The N006 assembly gate must distinguish three row states — confirmed (`confirmed=1`), rejected (human acted, refused), pending (no human action) — and the frozen DDL has no column for "rejected": `confirmed=0` alone means BOTH "pending" and "rejected", which would let a single rejection block assembly forever (or, worse, force a workaround that sets `confirmed=1` on rejected rows and leaks them into the N015 confirmed-only export). Therefore Sprint 7 makes its ONE justified additive schema change (SPRINT_PLAN constraint: schema frozen UNLESS additive): after the `ordinance_relationships` indexes in `initSchema()`, run `PRAGMA table_info(ordinance_relationships)` and, only when the column is absent, `ALTER TABLE ordinance_relationships ADD COLUMN rejected INTEGER DEFAULT 0`. Idempotent, existing rows untouched (NULL→0 semantics via DEFAULT), no existing table modified in place. Reject semantics: `confirmed` STAYS 0, `rejected=1`, `confirmed_by_id` stays NULL; the required non-empty reason persists to `agent_decisions.reason` (audit is the system of record for WHY — no reason column added). Decisions are FINAL: any PUT on a row with `confirmed=1` OR `rejected=1` → 409. First `db.ts` edit since Sprint 1 — flagged.
- **D2 — Status propagation direction: the confirmed relationship flips the TARGET ordinance's status (the referenced ordinance — the one that loses force).** Mapping exactly per the sprint mandate: `repeals → 'repealed'`, `partial_repeal → 'amended'`, `supersedes → 'superseded'`; `amends`/`extends`/`implements` → no status change. PRP-LINAW Key Behavior 6 / PRD §6.8 / SPRINT_PLAN literally say "SOURCE ordinance status" — that wording PREDATES Sprint 6's D7/D8 direction fix, which made `source_id` the REFERENCING (amending/repealing) instrument and `target_id` the referenced one (verified in code + Sprint-6 tests: `sourceId` = the row whose content says "amending Ordinance No. X"). Flipping the actor would mark the NEW repealing ordinance as repealed — legally inverted demo data. The mandate's own status list (amended/repealed/superseded) only composes with the AFFECTED ordinance. The logic is isolated in ONE pure function `ordinanceStatusAfterConfirmedRelationship(type)` + one UPDATE on `target_id` so a SPRINT_REVIEW ruling for the literal wording is a one-line swap. Flip applies ONLY when the target's current status ∈ ('active','amended'); terminal statuses ('repealed','superseded','expired') are never overwritten (PRP exception rule "Conflicting statuses on one ordinance → human resolution" — the response reports `statusUpdate` only when applied). Test-proven both ways. **Flagged prominently.**
- **D3 — Conflict rows are decided through the SAME PUT endpoint; the assembly gate counts ALL undecided rows incl. conflicts.** Conflicts are `ordinance_relationships` rows (`relationship_type='conflict'`, Sprint 6 D1); PRD gate row `detected_relationship` triggers on "cross-reference OR conflict found" with output "Confirm, edit, or reject". So `PUT /api/linaw/relationships/:id` accepts any row id (six-type rows AND conflict-marker rows): confirm → `confirmed=1` + `confirmed_by_id`; reject → `rejected=1` + reason audited. The pending count = rows with `confirmed=0 AND rejected=0` across ALL types. Confirmed conflicts NEVER leak into N015 (export whitelist = the six `LinawRelationshipType` values only). `conflict-panel.tsx` gains Confirm/Reject buttons mirroring `relationship-review.tsx`.
- **D4 — Summary trigger (N007): on-demand classify-style POST + human-edit PUT; assembly NEVER calls the LLM.** `POST /api/linaw/summarize` `{ordinanceIds?}` (absent/[] → every ready ordinance WITHOUT an existing summary; explicit ids regenerate even when a summary exists) generates 2–3 sentence plain-language summaries via `chatCompletion` (temperature 0) into `linaw_ordinances.summary`. Per-record failures are caught → `failed[]` entries; the batch NEVER 500s on LLM trouble (more testable than classify's 500 posture; keyless environments yield `summarized: 0` + failed list). `PUT /api/linaw/summarize/:id` `{summary}` persists human edits (non-empty required; ready rows only; 404/409/400 outcomes). Summaries are audited with `agent_id=0`, `agent_name='Summary Generation' | 'Summary Edit'` (Sprint 5's pre-pipeline convention for work outside the six pipeline agents). Assembly consumes STORED summaries only (WORKFLOW: summaries are an INPUT to agent 6, not its output) — deterministic, hermetically testable, and consistent with PRP "Human editable; included in code export".
- **D5 — Assembly gate semantics (N006 + `final_code_export`): the assembler REFUSES while pending rows exist (409), then RAISES `final_code_export` after a successful build.** `POST /api/linaw/assemble {edition}` runs agent 5 (`reviewRelationships`) as its precondition: pending rows (`confirmed=0 AND rejected=0`, any type incl. conflicts) > 0 → **409 `{ error, code: 'PENDING_RELATIONSHIPS', pending: N }`** + an agent-5 `hitl` audit row (`detected_relationship: N detections await human decision`) — rejected rows do NOT block (human action was taken); confirmed rows obviously do not. Zero classified ready ordinances → 409 `NOTHING_TO_ASSEMBLE`. On success the volume persists `status='draft'` and agent 6 RAISES the `final_code_export` gate: an `agent_decisions` `hitl` row (`final_code_export: code volume awaiting approval before export`) + response `hitlRequired: true, gate: 'final_code_export'`. The UI gates the Export JSON action behind acknowledging that rose card (PRD gate row: "before PDF/DOCX export" — JSON export is the MVP export surface; PDF/DOCX is the post-MVP toggle, rendered disabled). N015's `export-package` is a LIBRARY snapshot (INTERCHANGE-SPEC §4) and is NOT gated by `final_code_export`.
- **D6 — Assembly inputs, hierarchy, and numbering.** Input = `codification_records` joined to READY ordinances; placement columns (`title_number/chapter_number/article_number`) are authoritative (Sprint 6 D6 already copies override values into the columns). Eligible statuses: ONLY `('active','amended')` — repealed/superseded/expired ordinances are EXCLUDED and reported (`excluded[]`), which is exactly what gives N005's status flips visible codification effect. Ready ordinances with no placement → `unclassified[]` (non-blocking exception). Hierarchy: Titles (named from `LINAW_CODE_TITLES`; out-of-range numbers → `'Title N'`) → Chapters (`Chapter N`) → Articles (`Article N`, only when `article_number` present) → Sections; ordinances without an article become CHAPTER-level sections (additive `CodeTocChapter.sections?` — decision D11). Auto-numbering: sections number SEQUENTIALLY PER CHAPTER (article sections continue the chapter's sequence, articles ordered by number); ordinance order = `(series_year ASC, ordinance_number ASC)`; label `'Section N'`. Side effects: `section_in_code` persisted + `cod_status='codified'` on included records; one NEW `code_volumes` row per assemble (`title='Municipal Code of Ordinances'`, edition from body, `status='draft'`, `structure = JSON.stringify(toc)`, `generated_at`, `generated_by_id`) — re-assembly creates a new draft volume (history preserved).
- **D7 — Agent 5 becomes real inside the assemble precondition; the orchestrator completes to 6/6.** `reviewRelationships({userId, db?, pipelineId?})` replaces the throwing stub: counts pending/confirmed/rejected (all types), writes agent-5 start/complete audit rows, raises the `detected_relationship` hitl row when pending > 0, returns `{pending, confirmed, rejected, hitlRequired}`. It is consumed by `assembleCode`'s precondition (one request serves agents 5+6 — mirroring detect-relationships serving agents 3+4); the page's agent-5 slot presents the queue via the existing GET relationships route with the 1100ms client delay. `runLinawPipeline` is extended to the FULL sequential 1→6 (agents 5–6 appended after the Sprint-6 detection block; agent 6 gated by agent 5 exactly like the route) and unit-tested — the 7900ms demo pipeline is complete.
- **D8 — N015 package contract (INTERCHANGE-SPEC v1.0.0, verbatim).** Records = `linaw_ordinances WHERE library_status='ready'` (§4 LINAW mapping: `sourceType` from the row, `summary` from the row, `subjectTags` from `subject_tags` JSON, `fileHash` nullable, `sourceRecordId` = own-table id), ordered `(series_year ASC, ordinance_number ASC)` for determinism. `ordinanceIds` filter is ALL-OR-NOTHING (LIKHA D23 posture mirrored independently): omitted → all ready; `[]` → valid empty package; any id missing-or-not-ready refuses the WHOLE request with 409 + ineligible list. Relationships = `confirmed=1` AND `relationship_type` ∈ the six values (conflict marker NEVER) AND **both endpoints present in the exported records set** (package self-consistency under filtering); each entry keyed by `{ordinanceNumber, seriesYear}` ONLY — never internal ids (§5): `{sourceOrdinance, targetOrdinance, type, sectionRef: string|null, confidence, confirmedById}`. `packageHash` = `'sha256:' + SHA-256(canonicalJson({records, relationships}))` — the LINAW payload literal ALWAYS includes the `relationships` key (empty `[]` when none); the manifest is never hashed (§6). `canonicalJson` is re-implemented INDEPENDENTLY in `src/lib/linaw/export.ts` (sorted keys at every depth, arrays preserve order, `undefined` dropped, no insignificant whitespace). Manifest per §3: `schemaVersion:'1.0.0', module:'linaw', interchangeLevel:'L1', exportedAt, exportedById, source:{table:'linaw_ordinances', recordCount == records.length, yearRange:[min,max] (or [] when empty)}, exporter:{platform:'pillar-pilot', appVersion from package.json}`. Response: `Content-Disposition: attachment` JSON; export logged via `logModuleEvent` with module + exporter user id.
- **D9 — Four-commit chain seam (N005 → N007 → N006 → N015) with sequential execution STRONGLY recommended.** The chain is a true dependency chain (assembly consumes confirmations + summaries; export consumes confirmed relationships), so execute feature-by-feature and commit at each seam: each commit stages the current state of the append-only files (`src/types/linaw.ts`, `tests/helpers/linaw-test-util.ts`, `src/lib/linaw/agents.ts`, `src/lib/linaw/prompts.ts`) — with sequential execution each staged state contains exactly that feature's additions. `src/app/linaw/page.tsx` is staged in TWO commits: the N005 commit wires the Relationships-tab confirm/reject handlers; the N006 commit wires the Code Assembly tab + pipeline agents 5–6. `package.json` (test lists) stages with the N015 commit. Every intermediate state compiles (`npx tsc --noEmit`) and its staged tests pass.
- **D10 — Code Assembly UI scope: structure tree + TOC preview + summaries review queue + Export JSON.** `code-assembly.tsx` replaces the stub: rendered structure tree (Titles→Chapters→Articles→Sections), a flat numbered TOC preview pane, the summaries review queue (ready ordinances with inline-editable summary + save + "Generate missing summaries" button), and Export JSON (downloads the assembled volume JSON after the `final_code_export` acknowledgment). PDF/DOCX export renders as a DISABLED toggle labeled post-MVP. Drag-to-reorder (PRP mention) is NOT implemented this sprint — structure order is deterministic from placements; reorder is a MAINTAIN-phase candidate. Flagged.
- **D11 — Additive type extensions beyond the PRP shapes.** PRP `CodeTocNode` places sections ONLY under articles, but `articleNumber` is optional in placements — so `CodeTocChapter` gains an additive `sections?: CodeSectionRef[]` (chapter-level sections), and `CodeSectionRef` (= PRP `{id, ordinanceId, label}`) gains additive OPTIONAL display fields `ordinanceNumber?`, `seriesYear?`, `title?`, `summary?` (assembly output carries summaries — PRP "included in code export"). `LinawAgentOutput.toc` retypes from `unknown[]` to `CodeTocNode[]`.
- **D12 — LLM-unavailability contract (Sprint 6 D12 posture).** Summary generation is best-effort PER RECORD (never 500s; keyless runs return `summarized: 0` + failed list — integration tests assert exactly that). Assembly + confirmation + export are LLM-FREE (fully hermetic). No automated suite requires a real OpenRouter key.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)         GROUP-B (parallel)            GROUP-C (parallel)              GROUP-D (parallel)                 GROUP-E (parallel)                  GROUP-F (parallel)      GROUP-G
──────────────────         ───────────────────           ─────────────────────           ─────────────────────              ───────────────────────             ──────────────────      ───────
S7-C1 types additions ────► S7-C3 N005 engine+db ───────► S7-C4 N005 PUT route+integ ───► S7-C5 N005 UI + page wiring ──┐
S7-C2 harness additions ──► S7-C6 N007 prompts+parser ──► S7-C7 N007 summary engine ────► S7-C8 N007 routes+integ ──────┼─► S7-C10 N006 routes+integ ──────► S7-C12 page Code ──────► S7-C15
                                                         (agents.ts sequential C3→C7→C9)  S7-C9 N006 assemble engine ───┤   S7-C11 code-assembly.tsx            Assembly+pipeline      GATE
                                                                                          (components parallel-safe)     │   S7-C13 N015 builder+unit ─────────► S7-C14 N015 route
                                                                                                                         └──────────────────────────────────────────(6/6 page wiring)+integ
```

| Chunk | Feature | Depends on | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S7-C1 | N005+N007+N006+N015 (module types additions) | Sprint 6 only | none | **GROUP-A** |
| S7-C2 | test harness additions | Sprint 6 only | none | **GROUP-A** |
| S7-C3 | **N005** agents.ts engines (decide + review) + db.ts `rejected` guard + unit test | S7-C1, S7-C2 | agents.ts (first writer), db.ts | **GROUP-B** |
| S7-C6 | **N007** prompts.ts summary triple + unit test (parser) | S7-C1 | prompts.ts | **GROUP-B** |
| S7-C4 | **N005** PUT [id] route + GET `rejected` surfacing + integration test | S7-C3 | none | **GROUP-C** |
| S7-C7 | **N007** summary engine (agents.ts append) + unit test | S7-C3, S7-C6 | agents.ts | **GROUP-C** |
| S7-C5 | **N005** relationship-review + conflict-panel buttons + page Relationships wiring | S7-C4 | page.tsx (first edit) | **GROUP-D** |
| S7-C8 | **N007** summarize POST + PUT [id] routes + integration test | S7-C7 | none | **GROUP-D** |
| S7-C9 | **N006** assemble engine (agents.ts append; agents 5–6 complete; orchestrator 1→6) + unit test | S7-C7 | agents.ts | **GROUP-D** |
| S7-C10 | **N006** assemble + code list + code [id] routes + integration test | S7-C9 | none | **GROUP-E** |
| S7-C11 | **N006** code-assembly.tsx component (props-only) | S7-C1 | none | **GROUP-E** |
| S7-C13 | **N015** export.ts builder (canonicalJson + package) + unit test | S7-C1 | export.ts | **GROUP-E** |
| S7-C12 | **N006/N007** page wiring: Code Assembly tab live + pipeline agents 5–6 + summaries queue | S7-C5, S7-C8, S7-C10, S7-C11 | page.tsx (second edit) | **GROUP-F** |
| S7-C14 | **N015** export-package route + integration test (round-trip incl. relationships) | S7-C13 | none | **GROUP-F** |
| S7-C15 | GATE: FINAL dual-direction boundary grep + build + FULL regression + package.json + 4 commits | ALL | n/a | **GROUP-G** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F → GROUP-G.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`); `agents.ts` is written sequentially C3 → C7 → C9 by design. **Commit points are in S7-C15 with explicit per-feature staging lists; because the append-only files are shared, SEQUENTIAL chain execution (N005 → N007 → N006 → N015, commit at each seam) is the recommended mode so each feature commit contains exactly its own additions. When in doubt, execute sequentially.**

---

## Chunks

---

### S7-C1 — `src/types/linaw.ts`: Sprint 7 contract additions (N005/N007/N006/N015)

```json
{
  "chunk_id": "S7-C1",
  "feature_id": "N005+N007+N006+N015 (shared module types)",
  "chunk_type": "setup",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/linaw.ts"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT the EXISTING file `src/types/linaw.ts` (Sprint 5–6 content stays intact — Sprint 5–6 tests import from it and must keep compiling). Make these changes, keeping the file's existing comment style. Pure types only — NO new runtime imports. The file must contain the tokens `likha`, `obra`, `ella`, `yala` ZERO times and compile under `strict: true`.

1. In `LinawRelationshipRecord`, add after `confirmed: 0 | 1;` the field `/** Sprint 7 (D1): 1 when a human rejected the detection; confirmed stays 0. */ rejected?: 0 | 1;`. Add the same optional field to `LinawConflictRecord`.
2. Replace `toc?: unknown[];` in `LinawAgentOutput` with `toc?: CodeTocNode[];` (type defined below).
3. APPEND this block at the end of the file:

```ts
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
  exporter: { platform: 'pillar-pilot'; appVersion: string };
}

export interface LinawInterchangePackage {
  manifest: LinawInterchangeManifest;
  records: LinawInterchangeRecord[];
  /** ALWAYS present for LINAW packages (may be []); hashed alongside records (D8). */
  relationships: LinawInterchangeRelationship[];
  packageHash: string;
}
```

**acceptance_criteria:** (1) File compiles under `strict: true`; (2) all Sprint 5–6 exports unchanged (Sprint 5–6 suites still compile); (3) `rejected?` present on both record types; (4) `toc` retyped to `CodeTocNode[]`; (5) appended block verbatim in shape; (6) zero sibling-module tokens.

**verification_commands:**

```bash
npx tsc --noEmit   # expected: exit 0
grep -c "likha\|obra\|ella\|yala" src/types/linaw.ts   # expected: 0
```

---

### S7-C2 — `tests/helpers/linaw-test-util.ts`: Sprint 7 harness additions

```json
{
  "chunk_id": "S7-C2",
  "feature_id": "test harness (N005/N006/N015 seeding)",
  "chunk_type": "setup",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["tests/helpers/linaw-test-util.ts"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT the EXISTING file `tests/helpers/linaw-test-util.ts` (Sprint 5–6 helpers stay byte-compatible). Node built-ins + `better-sqlite3` ONLY (the file's existing import posture; never the `@/` alias, never another module's helper). Make these changes:

1. In `seedLinawPendingReviewRecord`, add `summary?: string` to the overrides type; when provided, include the `summary` column in the INSERT (add the column + value unconditionally to the prepared statement: `summary` = `overrides?.summary ?? null`). The base seeder's column list grows by exactly one column.
2. APPEND this helper after `seedLinawCodificationRecord`:

```ts
/**
 * Sprint 7 (S7-C2) — seeds one ordinance_relationships row (frozen Sprint-1
 * DDL columns + the Sprint-7 additive `rejected` column). Defaults: type
 * 'amends', confidence 0.85, confirmed 0, rejected 0. Returns the new row id.
 */
export function seedLinawRelationship(
  db: import('better-sqlite3').Database,
  sourceId: string,
  targetId: string,
  overrides?: {
    type?: string;
    sectionRef?: string | null;
    confidence?: number;
    confirmed?: 0 | 1;
    confirmedById?: string | null;
    rejected?: 0 | 1;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO ordinance_relationships
       (id, source_id, target_id, relationship_type, section_ref, confidence,
        confirmed, confirmed_by_id, rejected)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sourceId,
    targetId,
    overrides?.type ?? 'amends',
    overrides?.sectionRef ?? null,
    overrides?.confidence ?? 0.85,
    overrides?.confirmed ?? 0,
    overrides?.confirmedById ?? null,
    overrides?.rejected ?? 0
  );
  return id;
}
```

**acceptance_criteria:** Existing helper signatures unchanged (Sprint 5–6 suites keep passing); `summary` override lands in `linaw_ordinances.summary`; `seedLinawRelationship` inserts with defaults and overrides.

**tdd_steps:** (1) Write a throwaway hermetic check ONLY if desired — the harness itself is exercised by the Sprint-7 suite (C3 onward); no dedicated test file.

**verification_commands:**

```bash
npx tsc --noEmit   # expected: exit 0
```

---

### S7-C3 — N005 engine: `decideRelationship` + real `reviewRelationships` + the `rejected` column (agents.ts + db.ts)

```json
{
  "chunk_id": "S7-C3",
  "feature_id": "N005",
  "chunk_type": "feature-engine",
  "parallel_group": "GROUP-B",
  "dependencies": ["S7-C1", "S7-C2"],
  "file_outputs": ["src/lib/linaw/agents.ts", "src/lib/db.ts", "tests/unit/linaw-confirmation.test.ts"],
  "tdd_steps": [
    "RED: create tests/unit/linaw-confirmation.test.ts with the suite below; run it — decideRelationship/reviewRelationships do not exist yet (agents.ts exports throwing stubs) → failures",
    "GREEN: add the rejected-column guard to db.ts initSchema(); replace the Sprint-6 stubs in agents.ts with the real engines + helpers per the prompt",
    "REFACTOR: keep decideRelationship a pure outcome union; keep the status mapping in ordinanceStatusAfterConfirmedRelationship; re-run suite + tsc"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

You are implementing the N005 engine layer inside LINAW's existing server module. Context you need: `src/lib/linaw/agents.ts` (Sprint 6) already exports `insertLinawAgentDecision(db, pipelineId, userId, params)` (the single `agent_decisions` writer, `module='linaw'`), `LINAW_AGENT_NAMES`, `LINAW_CONFLICT_RELATIONSHIP_TYPE = 'conflict'`, agents 1–4, `runLinawPipeline` (1→4), and TWO throwing stubs at the bottom: `reviewRelationships(): never` and `assembleCode(): never`. Relationship rows: `source_id` = the ordinance whose CONTENT carries the cross-reference (the amending/repealing instrument); `target_id` = the referenced ordinance (the one acted upon). Allowed imports only: `node:crypto`, `@/lib/db`, `@/lib/logger`, `@/lib/ai/llm`, `@/lib/linaw/prompts`, `@/types/linaw`. Zero sibling-module tokens anywhere.

**PART 1 — `src/lib/db.ts` (the ONE additive schema change, decision D1).** Inside `initSchema()`, immediately after the existing `ordinance_relationships` index statements, append an idempotent column guard:

```ts
    // Sprint 7 (decision D1): rejection marker for the N005 workflow — additive,
    // idempotent; existing rows keep DEFAULT 0 semantics. First db.ts edit since
    // Sprint 1; justified because N006's assembly gate must distinguish
    // pending (no action) from rejected (human refused) without polluting
    // `confirmed`, which N015 exports (confirmed-only).
    const ordRelCols = db.prepare(`PRAGMA table_info(ordinance_relationships)`).all() as Array<{ name: string }>;
    if (!ordRelCols.some((c) => c.name === 'rejected')) {
      db.prepare(`ALTER TABLE ordinance_relationships ADD COLUMN rejected INTEGER DEFAULT 0`).run();
    }
```

No other db.ts change. Opening a fresh DB and an existing DB must both work, twice in a row (idempotent).

**PART 2 — `src/lib/linaw/agents.ts`: status mapping + `decideRelationship`.** Replace NOTHING above the stubs; append a new section `// ── Agent 5: Relationship Reviewer (N005 — Sprint 7) ──` and implement:

```ts
/** Decision D2 — the confirmed-relationship status mapping, ISOLATED for review.
 *  Only these three types flip a status; amends/extends/implements never do. */
export function ordinanceStatusAfterConfirmedRelationship(
  type: LinawRelationshipType
): 'amended' | 'repealed' | 'superseded' | undefined {
  if (type === 'repeals') return 'repealed';
  if (type === 'partial_repeal') return 'amended';
  if (type === 'supersedes') return 'superseded';
  return undefined;
}
```

Then `decideRelationship(params: { relationshipId: string; userId: string; body: LinawRelationshipDecisionRequest; db?; pipelineId? })` returning the outcome union:

```ts
export type LinawDecisionOutcome =
  | { ok: true; response: LinawRelationshipDecisionResponse }
  | { ok: false; kind: 'not_found' | 'invalid' | 'already_decided'; error: string };
```

Semantics (each clause test-proven):
- Load the row: `SELECT r.*, t.status AS t_status, t.ordinance_number AS t_number, t.series_year AS t_year FROM ordinance_relationships r JOIN linaw_ordinances t ON t.id = r.target_id WHERE r.id = ?`. Missing → `not_found`.
- Validate: `body.action` must be `'confirm' | 'reject'` else `invalid` (`'action must be confirm or reject'`). For `reject`, `body.reason` must be a non-empty trimmed string else `invalid` (`'reason is required when rejecting'`).
- Finality: row `confirmed = 1` OR `rejected = 1` (treat NULL rejected as 0) → `already_decided` (`'Relationship already decided'`).
- **Confirm:** in ONE `db.transaction`: `UPDATE ordinance_relationships SET confirmed = 1, confirmed_by_id = ? WHERE id = ?`. Then decision D2 status propagation on the TARGET: compute `to = ordinanceStatusAfterConfirmedRelationship(type)` (conflict-marker rows and the three non-flipping types yield `undefined`); when `to` is defined AND the target's current status ∈ `('active','amended')`, `UPDATE linaw_ordinances SET status = ?, updated_at = datetime('now') WHERE id = ?` and include `statusUpdate` (with `from`/`to`) in the response. Terminal targets ('repealed'/'superseded'/'expired') are NEVER overwritten — `statusUpdate` simply absent. Response: `{ id, action: 'confirm', confirmed: 1, rejected: 0, statusUpdate? }`.
- **Reject:** `UPDATE ordinance_relationships SET rejected = 1 WHERE id = ?` — `confirmed` stays 0, `confirmed_by_id` stays NULL. Response `{ id, action: 'reject', confirmed: 0, rejected: 1 }` (reason lives in the audit row).
- Audit BOTH actions via `insertLinawAgentDecision` (agent 5, `pipelineId ?? 'review-' + relationshipId`): `action: 'confirm' | 'reject'`, `inputSnapshot = JSON.stringify({ relationshipId, type })`, `outputSnapshot = JSON.stringify(response)`, `reason = body.reason?.trim()` for rejects (omitted for confirms). Then `logModuleEvent({ module: 'linaw', interactionType: 'linaw_relationship_decision', content: JSON.stringify({ relationshipId, action, statusChanged: !!statusUpdate }), ipAddress: '127.0.0.1', participantSessionId: 'linaw-' + userId })`.

**PART 3 — real `reviewRelationships` (agent 5) replacing the throwing stub.** Delete the stub body and implement:

```ts
export interface LinawReviewResult {
  pipelineId: string;
  pending: number;   // confirmed=0 AND (rejected IS NULL OR rejected=0), ALL types incl. 'conflict'
  confirmed: number;
  rejected: number;
  hitlRequired: boolean; // pending > 0
}

export function reviewRelationships(params: {
  userId: string;
  db?: import('better-sqlite3').Database;
  pipelineId?: string;
}): LinawReviewResult
```

Semantics: count the three states over ALL `ordinance_relationships` rows (the conflict marker INCLUDED — decision D3); write agent-5 `start` + `complete` audit rows (`outputSnapshot` = the counts); when `pending > 0` write an agent-5 `hitl` row with `reason: 'detected_relationship: ' + pending + ' detections await human decision'`; log `linaw_relationship_review`. Pure DB — no LLM.

**PART 4 — hermetic unit test `tests/unit/linaw-confirmation.test.ts`** (node:test + assert; pattern: `process.env.DB_PATH = tempDbPath()` BEFORE `await import('../../src/lib/db')`; seed via harness). Tests:
1. **Confirm status propagation (D2):** seed ready source + ready target; `seedLinawRelationship(source, target, {type:'repeals'})` → confirm → target row `status='repealed'`, source UNCHANGED `'active'`; response `statusUpdate.to === 'repealed'`, `from === 'active'`; row `confirmed=1`, `confirmed_by_id=userId`. Repeat for `partial_repeal → 'amended'` and `supersedes → 'superseded'`.
2. **Non-flipping types:** confirm an `amends` row → both statuses unchanged, `statusUpdate` absent. Same for a `conflict`-marker row (confirm works, no flip).
3. **Terminal target protection:** pre-set target status `'repealed'` (direct UPDATE), confirm a `supersedes` row → target stays `'repealed'`, `statusUpdate` absent.
4. **Reject:** reject with reason → `rejected=1`, `confirmed=0`, `confirmed_by_id IS NULL`; an `agent_decisions` row exists with `module='linaw'`, `agent_id=5`, `action='reject'`, `reason` = the reason.
5. **Finality:** confirm-then-confirm → `{ok:false, kind:'already_decided'}`; reject-then-confirm → same; confirm-then-reject → same.
6. **Validation:** missing reason on reject → `invalid`; bogus action → `invalid`; unknown id → `not_found`.
7. **reviewRelationships:** seed 1 pending + 1 confirmed + 1 rejected (mix of normal and conflict rows) → counts `{pending:1, confirmed:1, rejected:1, hitlRequired:true}`; an agent-5 `hitl` audit row exists with reason containing `'detected_relationship'`; empty table → `hitlRequired:false`.
8. **rejected column idempotency:** call the db module's init twice (re-import/getDb twice) — no error, column present exactly once.

**acceptance_criteria:** All PART-4 tests green hermetically; db.ts change is exactly the guarded ALTER; agents.ts grows only by the new section + stub replacement; audit rows carry `module='linaw'` + agent 5; zero sibling tokens; `runLinawPipeline` still throws nothing (agents 6 stub remains until S7-C9).

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-confirmation.test.ts   # expected: pass (all subtests), 0 fail
npx tsc --noEmit                                       # expected: exit 0
grep -c "likha\|obra\|ella\|yala" src/lib/linaw/agents.ts src/lib/db.ts tests/unit/linaw-confirmation.test.ts   # expected: 0 per file
```

---

### S7-C6 — N007 prompts: summary system prompt + builder + never-throws parser

```json
{
  "chunk_id": "S7-C6",
  "feature_id": "N007",
  "chunk_type": "feature-engine",
  "parallel_group": "GROUP-B",
  "dependencies": ["S7-C1"],
  "file_outputs": ["src/lib/linaw/prompts.ts", "tests/unit/linaw-summaries.test.ts"],
  "tdd_steps": [
    "RED: create tests/unit/linaw-summaries.test.ts covering the parser contract below; run — parseLinawSummaryResponse absent → failures",
    "GREEN: append the summary triple to src/lib/linaw/prompts.ts",
    "REFACTOR: parser stays pure + never-throws; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

APPEND to the EXISTING `src/lib/linaw/prompts.ts` a new section `// ── Sprint 7 (S7-C6): N007 plain-language summary prompts ──`. Follow the file's existing posture (system-prompt constant + user-prompt builder + never-throws parser), but summaries are PLAIN TEXT — not JSON. Zero sibling-module tokens.

```ts
export const LINAW_SUMMARY_SYSTEM_PROMPT: string = [
  'You summarize Philippine local government ordinances in plain language for non-lawyers.',
  'Write exactly 2-3 sentences capturing what the ordinance does, whom it affects, and any key rule or penalty.',
  'Respond with the summary text ONLY — no preamble, no labels, no markdown, no quotation marks around the whole text.',
].join(' ');

/** Builds the summary user prompt (content truncated to 12,000 chars). */
export function buildLinawSummaryUserPrompt(input: {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
}): string
```

The builder formats: `'Summarize this ordinance in plain language.\n\nOrdinance No. N, Series of YYYY\nTitle: …\n\nText:\n<content sliced to 12000>'`.

```ts
/**
 * Parses the LLM summary response. NEVER throws: strips ``` fences, drops
 * common leading labels ('Summary:', 'Plain-language summary:' etc. — any
 * leading token sequence ending with ':'), trims surrounding quotes,
 * collapses internal whitespace runs to single spaces, caps at 600 chars
 * (never mid-word: cut at the last space before 600, trailing '…' added when
 * truncated), and returns '' for empty/whitespace-only results.
 */
export function parseLinawSummaryResponse(llmText: string): string
```

Unit test `tests/unit/linaw-summaries.test.ts` (pure functions — no DB): plain passthrough; fenced ```` ```summary``` ```` stripping; `'Summary: …'` label drop; surrounding double-quote strip; whitespace collapse; 600-char cap with ellipsis; empty/undefined/garbage → `''`; builder truncates content to 12,000 chars and includes number/year/title.

**acceptance_criteria:** Parser never throws on any input (fuzz cases in test); builder deterministic; existing Sprint 5–6 prompt exports untouched.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-summaries.test.ts   # expected: pass, 0 fail
npx tsc --noEmit                                    # expected: exit 0
```

---

### S7-C4 — N005 routes: `PUT /api/linaw/relationships/[id]` + `rejected` surfaced on GET

```json
{
  "chunk_id": "S7-C4",
  "feature_id": "N005",
  "chunk_type": "feature-route",
  "parallel_group": "GROUP-C",
  "dependencies": ["S7-C3"],
  "file_outputs": ["src/app/api/linaw/relationships/[id]/route.ts", "src/app/api/linaw/relationships/route.ts", "tests/integration/linaw-relationship-decisions.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-relationship-decisions.test.ts (below); run against dev server — PUT route absent → 404 failures",
    "GREEN: create the [id] PUT route; edit the GET route to surface rejected",
    "REFACTOR: route stays a thin auth+validation+outcome-mapping layer over decideRelationship; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/app/api/linaw/relationships/[id]/route.ts` — the N005 decision endpoint. Pattern precedent in-repo: `src/app/api/linaw/library/[id]/route.ts` (dynamic params + withUserAuth). Requirements:
- `export const runtime = "nodejs";` + `PUT = withUserAuth(async (request, { params, user }) => { const { id } = await params; … })`.
- Body parse: tolerant `request.json()` inside try/catch → failure → 400 `{ error: 'Invalid JSON body', code: 'INVALID_BODY' }`. Body must be an object with `action`; delegate ALL semantic validation to `decideRelationship({ relationshipId: id, userId: user.user.id, body })` from `@/lib/linaw/agents`.
- Outcome mapping: `not_found → 404 { error, code: 'NOT_FOUND' }`; `invalid → 400 { error, code: 'VALIDATION' }`; `already_decided → 409 { error, code: 'CONFLICT' }`; `ok → 200` with the response object.
- Update the header comment of the collection route `src/app/api/linaw/relationships/route.ts` (Sprint-6 note "PUT :id is Sprint 7" → now lives at `[id]`), and EDIT its SELECT + mapping to surface the new column: add `r.rejected` to the selected columns and `rejected: (Number(row.rejected) === 1 ? 1 : 0) as 0 | 1` to each mapped item (treat NULL as 0). GET behavior otherwise unchanged (conflict marker still excluded).

Integration test `tests/integration/linaw-relationship-decisions.test.ts` (live dev server; `assertServerReachable()`; `seedApprovedUser()` for the cookie; open `data/workshop.db` directly with better-sqlite3 and use harness seeders `seedLinawReadyRecord` ×2 + `seedLinawRelationship`; cleanup rows + user in `after`):
1. 401 envelope without cookie (PUT).
2. Confirm `repeals`: response 200 `confirmed:1` + `statusUpdate.to==='repealed'`; DB asserts — TARGET row `status='repealed'`, SOURCE row still `'active'`, `confirmed_by_id` = seeded userId (D2 test-proven over HTTP).
3. Reject with reason: 200 `rejected:1 confirmed:0`; DB `confirmed_by_id IS NULL`; `agent_decisions` row (`module='linaw'`, `agent_id=5`, `action='reject'`, `reason` matches).
4. 409 double-confirm; 409 confirm-after-reject; 400 reject without reason; 400 invalid action; 404 unknown id.
5. Conflict-marker row (`seedLinawRelationship(..., {type:'conflict'})`) confirms fine (200, no statusUpdate) — D3 over HTTP.
6. GET `/api/linaw/relationships` items now carry `rejected` (assert the rejected row shows `rejected: 1`).

**acceptance_criteria:** Route is thin (no SQL outside the engine); every status code test-proven; GET diff is ONLY the rejected surfacing + comment.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-relationship-decisions.test.ts   # expected: pass, 0 fail
kill %1
npx tsc --noEmit   # expected: exit 0
```

---

### S7-C7 — N007 engine: `summarizeReadyOrdinances` + `applySummaryEdit` (agents.ts append)

```json
{
  "chunk_id": "S7-C7",
  "feature_id": "N007",
  "chunk_type": "feature-engine",
  "parallel_group": "GROUP-C",
  "dependencies": ["S7-C3", "S7-C6"],
  "file_outputs": ["src/lib/linaw/agents.ts", "tests/unit/linaw-summaries.test.ts"],
  "tdd_steps": [
    "RED: extend tests/unit/linaw-summaries.test.ts with engine subtests using a DI summarize seam; run — engine absent → failures",
    "GREEN: append the engines to agents.ts",
    "REFACTOR: eligibility/skip posture mirrors classifyReadyOrdinances; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

APPEND to `src/lib/linaw/agents.ts` a section `// ── N007 plain-language summaries (Sprint 7) ──`. Import the new prompt triple from `@/lib/linaw/prompts`. Decision D4/D12 semantics:

```ts
export interface LinawSummarizeOptions {
  ordinanceIds?: string[];
  userId: string;
  db?: import('better-sqlite3').Database;
  pipelineId?: string; // default 'summarize-' + randomUUID()
  /** DI seam; default = real chatCompletion at temperature 0. */
  summarize?: (input: { ordinanceNumber: number; seriesYear: number; title: string; content: string }) => Promise<string>;
}

export async function summarizeReadyOrdinances(opts: LinawSummarizeOptions): Promise<LinawSummarizeResponse>
```

Semantics (each test-proven):
- Scope posture identical to `classifyReadyOrdinances`: absent/[] → every row `WHERE library_status = 'ready'` (additionally skip rows whose `summary` is non-empty — reported in `skipped` as `reason: 'has_summary'`; explicit ids NEVER skip on `has_summary`); per explicit id: unknown → `skipped {reason:'not_found'}`, non-ready → `skipped {reason:'not_summarizable:' + status}`. Non-ready rows are NEVER summarized (rule 4).
- Real seam: `parseLinawSummaryResponse(await chatCompletion(LINAW_SUMMARY_SYSTEM_PROMPT, buildLinawSummaryUserPrompt(...), { temperature: 0, maxTokens: 512 }))`. Per record: wrap in try/catch — ANY failure (transport, empty parse result) → `failed.push({recordId, reason})` and CONTINUE (the batch never throws/500s — D12).
- Success path: `UPDATE linaw_ordinances SET summary = ?, updated_at = datetime('now') WHERE id = ?`; push `{recordId, ordinanceNumber, seriesYear, summary}` to `results`.
- Audit: ONE agent-decision pair for the batch — `insertLinawAgentDecision` with `agentId: 0`, but `LINAW_AGENT_NAMES` has no 0 — pass the name explicitly by calling the writer with `agentId: 0` and ADD `0: 'Summary Generation'` to `LINAW_AGENT_NAMES` (Sprint 5's pre-pipeline convention; the Record is `Record<number, string>` so this is additive). `start` row (`inputSnapshot` = scope size) + `complete` row (`outputSnapshot` = `{summarized, skipped, failed}`).
- `logModuleEvent` `interactionType: 'linaw_summarize'`.

Then `applySummaryEdit(params: { ordinanceId: string; summary: string; userId: string; db?; pipelineId? })` returning `{ ok: true; response: LinawSummaryEditResponse } | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string }`: trimmed non-empty `summary` else `invalid`; row missing → `not_found`; `library_status !== 'ready'` → `conflict`; success = UPDATE summary + updated_at, audit `agentId: 0` name `'Summary Edit'` action `'confirm'` (`outputSnapshot` = the summary), log `linaw_summary_edit`. Response `{ recordId, summary, editedById: userId }`.

Extend `tests/unit/linaw-summaries.test.ts` (hermetic DB block): DI seam success writes summary + returns result; DI seam THROWING → `failed` entry, batch continues, no throw; implicit batch skips `has_summary` rows while explicit ids regenerate; non-ready excluded (seed pending_review → skipped `not_summarizable`); `applySummaryEdit` round-trip + `invalid`/`not_found`/`conflict` outcomes; audit rows present with `agent_id=0`.

**acceptance_criteria:** Batch NEVER throws regardless of seam behavior; ready-only enforced; `LINAW_AGENT_NAMES[0]` additive; Sprint-6 engines untouched.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-summaries.test.ts   # expected: pass (parser + engine subtests), 0 fail
npx tsc --noEmit                                    # expected: exit 0
```

---

### S7-C5 — N005 UI: enable confirm/reject in relationship-review + conflict-panel; wire page Relationships tab

```json
{
  "chunk_id": "S7-C5",
  "feature_id": "N005",
  "chunk_type": "feature-ui",
  "parallel_group": "GROUP-D",
  "dependencies": ["S7-C4"],
  "file_outputs": ["src/components/linaw/relationship-review.tsx", "src/components/linaw/conflict-panel.tsx", "src/app/linaw/page.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Enable the Sprint-6-disabled confirmation UI. Components stay PROPS-ONLY (no fetch inside — the page feeds them), keep the existing visual language (#1E293B cards, #283147 borders, chips), min-h-11 touch targets, keyboard-operable buttons. Zero sibling-module tokens.

1. `relationship-review.tsx`: extend props with `onConfirm: (item: LinawRelationshipRecord) => void; onReject: (item: LinawRelationshipItem, reason: string) => void; busy?: boolean;`. For each PENDING item (`confirmed===0 && (item.rejected ?? 0)===0`): enable the Confirm button (green, calls `onConfirm`) and the Reject button (rose → opens a small inline reason input + "Reject" submit; empty reason disables submit). Remove `disabled`, the `cursor-not-allowed` styling, both `title="Confirmation lands in Sprint 7"` attributes, and the caption text. CONFIRMED items keep the green chip + show buttons replaced by a "confirmed" note; REJECTED items show a rose chip `rejected` (no buttons).
2. `conflict-panel.tsx`: add the same `onConfirm`/`onReject`/`busy` props over `LinawConflictListItem` (ids are the same `ordinance_relationships` rows — decision D3): pending conflicts get Confirm/Reject (same inline-reason pattern + `rejected` chip when `item.rejected===1`; `confirmed` chip when confirmed).
3. `src/app/linaw/page.tsx` (FIRST of two Sprint-7 edits): wire the Relationships tab for real decisions. Add `decideRelationshipAction(id: string, action: 'confirm'|'reject', reason?: string)` — `PUT /api/linaw/relationships/` + id with JSON body; on 200 call `refreshRelationshipLists()` and push a feed activity (success `'Relationship confirmed'` / `'Relationship rejected'`, or hitl-styled error with the server message on non-2xx). Pass `onConfirm={(item) => void decideRelationshipAction(item.id, 'confirm')}` and `onReject={(item, reason) => void decideRelationshipAction(item.id, 'reject', reason)}` to BOTH panels. Replace the two local-only acknowledgments in the DETECTION feed path only where they reference relationships — keep Sprint-6 classification feed handling as-is. Remove the "confirmation of each detection lands in Sprint 7" wording from the detection HITL card (now: "Review each detection in the Relationships tab.").

**acceptance_criteria:** Buttons enabled + wired; reject requires non-empty reason client-side; rejected/confirmed chips render; conflict panel decisions use the SAME endpoint; page still renders all five tabs; no fetch inside components.

**verification_commands:**

```bash
npx tsc --noEmit   # expected: exit 0
npm run dev & sleep 8
curl -s http://localhost:3000/linaw | grep -c "Confirmation lands in Sprint 7"   # expected: 0
kill %1
```

---

### S7-C8 — N007 routes: `POST /api/linaw/summarize` + `PUT /api/linaw/summarize/[id]`

```json
{
  "chunk_id": "S7-C8",
  "feature_id": "N007",
  "chunk_type": "feature-route",
  "parallel_group": "GROUP-D",
  "dependencies": ["S7-C7"],
  "file_outputs": ["src/app/api/linaw/summarize/route.ts", "src/app/api/linaw/summarize/[id]/route.ts", "tests/integration/linaw-summaries.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-summaries.test.ts; run — routes absent → failures",
    "GREEN: create both routes as thin wrappers",
    "REFACTOR: verify graceful keyless behavior (200 + failed list) over HTTP"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create the two N007 routes (pattern: `detect-relationships/route.ts` for tolerant body handling; `library/[id]/route.ts` for dynamic params). Both `withUserAuth`, `runtime = "nodejs"`, acting user `user.user.id`.
- `POST src/app/api/linaw/summarize/route.ts`: body `{ordinanceIds?: string[]}` — validate array-of-strings when present (400 `INVALID_BODY` otherwise; empty/missing body `{}` = whole ready library without summaries). Call `summarizeReadyOrdinances({ordinanceIds, userId})`; return 200 with the response. The engine never throws on LLM trouble (D12) — a 500 here is a structured `catch` fallback `{ error: 'Summarization failed' }` for unexpected DB errors only.
- `PUT src/app/api/linaw/summarize/[id]/route.ts`: body `{summary: string}` → `applySummaryEdit({ordinanceId: id, summary: body?.summary ?? '', userId})`; map `not_found→404 NOT_FOUND`, `conflict→409 CONFLICT`, `invalid→400 VALIDATION`, `ok→200`.

Integration test `tests/integration/linaw-summaries.test.ts` (live server; seeded approved user; 2 ready rows — one with `summary` pre-set via harness override, one without; 1 pending_review row):
1. 401 on both routes without cookie.
2. POST `{}` → 200; response shape `{pipelineId, summarized, skipped, results, failed}`; WITHOUT an OpenRouter key in the dev environment assert `summarized === 0` AND `failed.length + skipped.length >= 1` (graceful degradation — the suite never requires a key); WITH a key, tolerate either but require shape + 200. The pre-summarized row appears in `skipped` as `has_summary`; the pending_review row is never in `results`.
3. POST `{ordinanceIds: ['<missing>']}` → 200 with `skipped` containing `not_found` (eligibility posture, never 404 for batch items).
4. PUT edit round-trip: `{summary: 'Plain-language summary written by a human.'}` → 200; DB row `summary` updated; `editedById` = userId in response.
5. PUT empty summary → 400; PUT unknown id → 404; PUT on the pending_review row → 409.

**acceptance_criteria:** Keyless run is graceful and deterministic in contract; ready-only enforced over HTTP; human edit persists.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-summaries.test.ts   # expected: pass, 0 fail
kill %1
```

---

### S7-C9 — N006 engine: real `assembleCode` (agents 5–6 complete, orchestrator 1→6)

```json
{
  "chunk_id": "S7-C9",
  "feature_id": "N006",
  "chunk_type": "feature-engine",
  "parallel_group": "GROUP-D",
  "dependencies": ["S7-C7"],
  "file_outputs": ["src/lib/linaw/agents.ts", "tests/unit/linaw-assemble.test.ts"],
  "tdd_steps": [
    "RED: create tests/unit/linaw-assemble.test.ts (suite below); run — assembleCode stub throws → failures",
    "GREEN: replace the assembleCode stub with the real engine; extend runLinawPipeline",
    "REFACTOR: hierarchy builder as a pure function buildCodeToc(placements) for testability; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Complete agents 5–6 in `src/lib/linaw/agents.ts`. `reviewRelationships` already exists (S7-C3). Replace the `assembleCode(): never` stub with the real engine. Import `LINAW_CODE_TITLES` from `@/lib/linaw/prompts`. Decision D5/D6/D7 semantics — implement exactly:

```ts
export type LinawAssembleOutcome =
  | { ok: true; response: LinawAssembleResponse }
  | { ok: false; kind: 'pending_relationships' | 'nothing_to_assemble'; pending?: number; error: string };

export function assembleCode(params: {
  edition: string;
  userId: string;
  db?: import('better-sqlite3').Database;
  pipelineId?: string; // default 'assemble-' + randomUUID()
}): LinawAssembleOutcome
```

Steps (each clause test-proven):
1. **Agent 5 precondition (D5):** call `reviewRelationships({userId, db, pipelineId})`. When `pending > 0` → return `{ok:false, kind:'pending_relationships', pending, error: pending + ' detected relationships/conflicts await human decision'}`. Rejected rows DO NOT block; confirmed rows do not block.
2. **Agent 6 start:** audit row (agent 6, `action:'start'`, `inputSnapshot = JSON.stringify({edition})`).
3. **Load placements:** `SELECT c.ordinance_id, c.title_number, c.chapter_number, c.article_number, o.ordinance_number, o.series_year, o.title, o.summary, o.status FROM codification_records c JOIN linaw_ordinances o ON o.id = c.ordinance_id WHERE o.library_status = 'ready'` (rule 4 — ready ONLY). Classify each row: placement missing (title_number/chapter_number NULL) → `unclassified[]`; `status` ∈ ('repealed','superseded','expired') → `excluded[]` (with status); otherwise ELIGIBLE (statuses 'active'/'amended' — D6).
4. **Hierarchy (pure `buildCodeToc`):** group eligible rows by `title_number` ascending; title name = `LINAW_CODE_TITLES[t-1]` when 1≤t≤13 prefixed `'Title t — '` (the list entries already start with the number — use `'Title ' + t + ' — ' + name-without-leading-number`, or `'Title ' + t` for out-of-range). Within a title, group by `chapter_number` ascending → `name: 'Chapter ' + n`. Within a chapter: rows WITH `article_number` group into `articles` (ascending, `name: 'Article ' + n`, sections inside); rows WITHOUT become chapter-level `sections`. Ordinance order inside every section list: `(series_year ASC, ordinance_number ASC)`. **Auto-numbering: one counter PER CHAPTER starting at 1** — iterate the chapter's content in article order (article 1 sections, article 2 sections, …) THEN chapter-level sections? NO — deterministic rule: chapter-level sections FIRST in ordinance order, then articles ascending with their sections; every emitted section takes the next counter value. `label = 'Section ' + counter`. Section ref: `{ id: crypto.randomUUID(), ordinanceId, label, ordinanceNumber, seriesYear, title, summary: row.summary ?? undefined }`.
5. **Persist (one transaction):** for every included record `UPDATE codification_records SET section_in_code = ?, cod_status = 'codified', updated_at = datetime('now') WHERE ordinance_id = ?`; INSERT the volume `INSERT INTO code_volumes (id, title, edition, status, structure, generated_at, generated_by_id) VALUES (?, 'Municipal Code of Ordinances', ?, 'draft', ?, datetime('now'), ?)` with `structure = JSON.stringify(toc)`.
6. **Agent 6 complete + `final_code_export` gate (D5):** audit `complete` row (`outputSnapshot = JSON.stringify({codeVolumeId, counts})`), then audit `hitl` row `reason: 'final_code_export: code volume awaiting approval before export'`. Log `linaw_assemble`.
7. Response: `{pipelineId, codeVolumeId, title: 'Municipal Code of Ordinances', edition, toc, counts: {titles, chapters, sections}, hitlRequired: true, gate: 'final_code_export', unclassified, excluded, exceptions}` — `exceptions` gains one entry per category when non-empty (e.g. `'3 ready ordinances unclassified — run classification'`, `'1 ready ordinance excluded (repealed/superseded/expired)'`).
8. Zero eligible rows (everything unclassified/excluded or empty library) → `{ok:false, kind:'nothing_to_assemble', error:'No classified ready ordinances to assemble'}` (NO volume row written; agent-6 `complete` row still audited with `outputSnapshot` noting the refusal).

**Extend `runLinawPipeline`** (the Sprint-6 seam) to the full chain: after the Sprint-6 detection block, add optional `edition?: string` (default `'Pipeline Edition ' + new Date().getUTCFullYear()`) to `RunLinawPipelineParams`, then run `const review = reviewRelationships({userId, db, pipelineId})` and, when review is clear, `const assembly = assembleCode({edition, userId, db, pipelineId})`; extend `LinawPipelineResult` with `review: LinawReviewResult` and `assembly?: LinawAssembleOutcome` (omitted when blocked). `hitlRequired` now includes `review.hitlRequired`.

Unit test `tests/unit/linaw-assemble.test.ts` (hermetic): seed ready ordinances + `seedLinawCodificationRecord` placements (mix: two titles, shared chapter, one article-placed, one chapter-level; one repealed target after a confirmed repeal; one unplaced ready row). Subtests: (a) pending relationship → `pending_relationships` with exact count and NO code_volumes row; (b) reject it → assembles (rejected doesn't block); (c) hierarchy validity — titles/chapters/articles/sections shapes, names, chapter-scoped sequential numbering, ordinance order; (d) repealed ordinance excluded + reported; (e) unclassified reported, not blocking; (f) `section_in_code` + `cod_status='codified'` persisted; volume row `status='draft'`, `structure` parses back to the toc; (g) `final_code_export` hitl audit row present (agent 6); (h) empty eligible set → `nothing_to_assemble`, no volume; (i) out-of-range title number → `'Title N'` fallback; (j) orchestrator 1→6 runs end-to-end with DI seams (classify/refine/conflictLlm stubs) and returns review + assembly.

**acceptance_criteria:** Both stubs gone (agent 5 since C3, agent 6 now); hierarchy deterministic; numbering test-proven; gate semantics exact; orchestrator 6/6 unit-tested.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-assemble.test.ts   # expected: pass, 0 fail
grep -c "lands in Sprint 7" src/lib/linaw/agents.ts   # expected: 0
npx tsc --noEmit                                      # expected: exit 0
```

---

### S7-C10 — N006 routes: `POST /api/linaw/assemble` + `GET /api/linaw/code` + `GET /api/linaw/code/[id]`

```json
{
  "chunk_id": "S7-C10",
  "feature_id": "N006",
  "chunk_type": "feature-route",
  "parallel_group": "GROUP-E",
  "dependencies": ["S7-C9"],
  "file_outputs": ["src/app/api/linaw/assemble/route.ts", "src/app/api/linaw/code/route.ts", "src/app/api/linaw/code/[id]/route.ts", "tests/integration/linaw-assemble.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-assemble.test.ts; run — routes absent → failures",
    "GREEN: create the three routes",
    "REFACTOR: routes stay thin over assembleCode + direct reads; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create the N006 routes (`withUserAuth`, `runtime = "nodejs"`, acting user `user.user.id`):
- `POST src/app/api/linaw/assemble/route.ts`: tolerant JSON parse; body must carry `edition` — non-empty string else 400 `{error: 'edition must be a non-empty string', code: 'VALIDATION'}`. Call `assembleCode({edition, userId})`; map `pending_relationships → 409 { error, code: 'PENDING_RELATIONSHIPS', pending }`; `nothing_to_assemble → 409 { error, code: 'NOTHING_TO_ASSEMBLE' }`; `ok → 200` response.
- `GET src/app/api/linaw/code/route.ts`: list volumes `SELECT id, title, edition, status, created_at FROM code_volumes ORDER BY created_at DESC, rowid DESC` → `{items: LinawCodeVolumeSummary[], total}` (no pagination params needed this sprint; cap 100).
- `GET src/app/api/linaw/code/[id]/route.ts`: load by id; missing → 404 `NOT_FOUND`; success → `LinawCodeVolumeDetail` with `toc = JSON.parse(structure)` wrapped in try/catch (corrupt → `toc: []`).

Integration test `tests/integration/linaw-assemble.test.ts` (live server; seeded user; seed 2 ready ordinances + codification placements via harness; seed one PENDING relationship between them):
1. 401 on all three routes without cookie.
2. Assemble while pending → 409 with `code:'PENDING_RELATIONSHIPS'` and `pending >= 1`; no code_volumes row created.
3. Confirm the relationship via PUT → assemble `{edition: 'Test Edition 2026'}` → 200 with `codeVolumeId`, `gate:'final_code_export'`, `toc` non-empty, counts consistent.
4. Repeat with a REJECTED relationship instead of confirmed → assembles fine (rejected doesn't block).
5. Assemble with missing/empty edition → 400.
6. GET code list → contains the new volume (`edition:'Test Edition 2026'`, `status:'draft'`); GET code/[id] → detail `toc` matches assembly response toc; GET unknown id → 404.
7. Empty-library user (fresh seeded user, no rows) → assemble 409 `NOTHING_TO_ASSEMBLE`.

**acceptance_criteria:** All statuses test-proven over HTTP; detail parses structure back into toc; list ordered newest-first.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-assemble.test.ts   # expected: pass, 0 fail
kill %1
```

---

### S7-C11 — `src/components/linaw/code-assembly.tsx` (replaces the Sprint-6 stub shell)

```json
{
  "chunk_id": "S7-C11",
  "feature_id": "N006+N007",
  "chunk_type": "feature-ui",
  "parallel_group": "GROUP-E",
  "dependencies": ["S7-C1"],
  "file_outputs": ["src/components/linaw/code-assembly.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

CREATE `src/components/linaw/code-assembly.tsx` — a PROPS-ONLY component (no fetch; the page feeds it). Visual language matches the other linaw panels (#0F1729 page, #1E293B cards, #283147 borders, #94A3B8 secondary text, min-h-11 controls, responsive wrap at 360px). Props:

```ts
interface CodeAssemblyProps {
  volumes: LinawCodeVolumeSummary[];          // newest first
  volume: LinawCodeVolumeDetail | null;       // selected/latest volume detail
  summariesQueue: Array<{ recordId: string; ordinanceNumber: number; seriesYear: number; title: string; summary: string }>;
  edition: string;
  busy: boolean;
  exportApproved: boolean;                    // user acknowledged the final_code_export gate
  onEditionChange: (edition: string) => void;
  onAssemble: () => void;
  onGenerateSummaries: () => void;
  onSaveSummary: (recordId: string, summary: string) => void;
  onApproveExport: () => void;                // acknowledges the final_code_export HITL card
  onExportJson: () => void;
}
```

Render four sections:
1. **Assembly controls:** edition text input (bound), "Assemble Code Volume" button (disabled while `busy`), volume selector list (radio-style rows: title + edition + status chip + createdAt) highlighting `volume?.id`.
2. **Structure tree:** render `volume.toc` hierarchically — title headings, chapter subheadings, article sub-subheadings, sections as rows (`label` + ordinance `Ord No. X, S. YYYY` + ordinance title + summary snippet when present). Empty state: "No code volume yet — assemble one."
3. **TOC preview pane:** a flat numbered preview (per title → chapter → `label: ordinance title`) in a bordered scrollable box — the PRP "TOC preview".
4. **Summaries review queue (N007):** one row per queue item — ordinance label + inline editable textarea (local state per row) + Save (disabled when unchanged/empty) + a "Generate missing summaries" button calling `onGenerateSummaries`.
5. **Export bar:** when `volume` exists and `volume.status === 'draft'`: a rose HITL note "final_code_export — review required before export" with an "Approve for export" button (`onApproveExport`) until `exportApproved`, then "Export JSON" enabled (`onExportJson`); a DISABLED "PDF / DOCX" toggle with tooltip/label "post-MVP" (decision D10).

**acceptance_criteria:** Component compiles standalone; no fetch/`'use server'`; all five sections present; touch targets ≥44px; keyboard-operable inputs/buttons.

**verification_commands:**

```bash
npx tsc --noEmit   # expected: exit 0
```

---

### S7-C13 — N015 builder: `src/lib/linaw/export.ts` (canonical JSON + L1 package)

```json
{
  "chunk_id": "S7-C13",
  "feature_id": "N015",
  "chunk_type": "feature-engine",
  "parallel_group": "GROUP-E",
  "dependencies": ["S7-C1"],
  "file_outputs": ["src/lib/linaw/export.ts", "tests/unit/linaw-export-l1.test.ts"],
  "tdd_steps": [
    "RED: create tests/unit/linaw-export-l1.test.ts (suite below); run — export.ts absent → failures",
    "GREEN: implement the builder module",
    "REFACTOR: canonicalJson pure + recursive; loader eligibility layer isolated; re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

CREATE `src/lib/linaw/export.ts` — LINAW's OWN L1 interchange builder implementing `docs/INTERCHANGE-SPEC.md` v1.0.0 §2–§6 for the `linaw` module. This is an INDEPENDENT implementation: ZERO imports from any likha path (the sibling module has its own builder — pattern duplication is intentional; do not even mirror its identifiers verbatim where a LINAW-native name reads better). Allowed imports: `node:crypto`, `node:fs`, `node:path`, `@/lib/db`, `@/types/linaw`. The builder is pure of logging/auth (the route owns those). Table surface: `linaw_ordinances` + `ordinance_relationships` ONLY — NEVER `code_volumes`, NEVER any other module's tables.

Implement:

1. `export function linawCanonicalJson(value: unknown): string` — INTERCHANGE-SPEC §6 canonical JSON: recursive; object keys sorted lexicographically at EVERY depth; arrays preserve order; `undefined` object members dropped (JSON semantics); no insignificant whitespace; primitives via `JSON.stringify`. Pure — no I/O.
2. `export type LinawExportOutcome = { ok: true; payload: LinawInterchangePackage } | { ok: false; kind: 'ineligible'; ineligibleIds: string[]; error: string };`
3. `export function buildLinawInterchangePackage(params: { userId: string; recordIds?: string[]; db?; now?: () => string }): LinawExportOutcome` — decision D8 EXACTLY:
   - **Records loader:** `recordIds === undefined` → every row `WHERE library_status = 'ready'` ordered `(series_year ASC, ordinance_number ASC)`; `recordIds.length === 0` → zero rows (valid empty package); otherwise each id must exist AND be ready — collect ALL failures into `ineligibleIds` and refuse the WHOLE build (no partials) with `error: 'Records not eligible for export (ready only): ' + ids.join(', ')`.
   - **Record mapping (§4 LINAW):** `{ordinanceNumber, seriesYear, title, content, summary: row.summary /* NULL → null */, subjectTags: defensive-parse of subject_tags JSON (garbage → []), status, sourceType: row.source_type, fileHash: row.file_hash ?? null, sourceRecordId: row.id}`.
   - **Relationships (§5):** `SELECT r.relationship_type, r.section_ref, r.confidence, r.confirmed_by_id, s.ordinance_number AS s_no, s.series_year AS s_yr, t.ordinance_number AS t_no, t.series_year AS t_yr FROM ordinance_relationships r JOIN linaw_ordinances s ON s.id = r.source_id JOIN linaw_ordinances t ON t.id = r.target_id WHERE r.confirmed = 1` — then filter in JS: `relationship_type` must be one of the SIX `LinawRelationshipType` values (the 'conflict' marker NEVER), and BOTH endpoints' ids must be within the exported records set (self-consistency under filtering — load the endpoint ids alongside). Map each to `{sourceOrdinance: {ordinanceNumber: s_no, seriesYear: s_yr}, targetOrdinance: {ordinanceNumber: t_no, seriesYear: t_yr}, type, sectionRef: section_ref ?? null, confidence, confirmedById: confirmed_by_id}` ordered `(s_yr ASC, s_no ASC, t_yr ASC, t_no ASC)` for determinism. NEVER an internal id anywhere in a relationship entry.
   - **Manifest (§3):** `{schemaVersion: '1.0.0', module: 'linaw', interchangeLevel: 'L1', exportedAt: now, exportedById: userId, source: {table: 'linaw_ordinances', recordCount: records.length, yearRange: records.length ? [min, max] : []}, exporter: {platform: 'pillar-pilot', appVersion: <read package.json version, '0.0.0' fallback>}}`.
   - **Hash (§6):** `packageHash = 'sha256:' + crypto.createHash('sha256').update(linawCanonicalJson({ records, relationships })).digest('hex')` — the payload literal is EXACTLY `{ records, relationships }` (relationships ALWAYS present for LINAW, even `[]`); the manifest is never hashed.
4. Hermetic unit test `tests/unit/linaw-export-l1.test.ts` (temp DB; harness seeders):
   - canonicalJson contract: sorted keys at every depth (nested objects), arrays preserve order, `undefined` dropped, no whitespace — assert exact strings for a fixture.
   - Record mapping: ready rows map per §4 incl. `summary` passthrough (value + null), malformed `subject_tags` → `[]`, chronological order.
   - Relationships: seed confirmed `amends` + confirmed `repeals` + UNCONFIRMED + `conflict`-marker-confirmed; only the two confirmed six-type rows appear; keyed by number/year ONLY (assert no internal-id substrings); `sectionRef` null passthrough; `confirmedById` present.
   - Filtering self-consistency: export with `recordIds` covering only ONE endpoint of a confirmed relationship → that relationship is OMITTED.
   - Eligibility: unknown id / non-ready id → `{ok:false, kind:'ineligible'}` listing both; `[]` → valid empty package (`records: []`, `relationships: []`, `recordCount: 0`, `yearRange: []`).
   - Hash ROUND-TRIP (hermetic): recompute `'sha256:' + sha256(linawCanonicalJson({records: payload.records, relationships: payload.relationships}))` from the RETURNED payload → equals `packageHash`; tamper one record field → recomputed hash differs; manifest mutation does NOT change the hash (manifest independence).
   - Verbatim package shape: `Object.keys(payload).sort()` deep-equals `['manifest','packageHash','records','relationships']`; manifest key set per §3; `recordCount === records.length`.

**acceptance_criteria:** All subtests green; builder reads exactly the two whitelisted tables; zero likha tokens; independent serializer (no shared code with any sibling module).

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-export-l1.test.ts   # expected: pass, 0 fail
grep -c "likha\|code_volumes" src/lib/linaw/export.ts   # expected: 0
npx tsc --noEmit                                        # expected: exit 0
```

---

### S7-C12 — Page wiring: Code Assembly tab LIVE + pipeline agents 5–6 (full 6/6)

```json
{
  "chunk_id": "S7-C12",
  "feature_id": "N006+N007 (+full pipeline)",
  "chunk_type": "feature-ui",
  "parallel_group": "GROUP-F",
  "dependencies": ["S7-C5", "S7-C8", "S7-C10", "S7-C11"],
  "file_outputs": ["src/app/linaw/page.tsx"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

SECOND and final Sprint-7 edit of `src/app/linaw/page.tsx` (the N005 relationship wiring from S7-C5 stays). Client-simulated delays + real routes posture (Sprint 6 D3) — delays for agents 5–6 come from `LINAW_AGENT_DEFS` (1100ms / 1300ms). Zero sibling-module tokens.

1. **Replace the Code Assembly stub:** delete the `StubCard` usage for Code Assembly (and the "Meanwhile, ingestion…" note) and render `<CodeAssembly … />` when `activeTab === 'code-assembly'`. State: `volumes`, `volumeDetail`, `edition` (default `'Edition ' + new Date().getUTCFullYear()`), `exportApproved`, `summariesQueue`. On tab open: `GET /api/linaw/code` → select newest → `GET /api/linaw/code/:id`; summaries queue = `GET /api/linaw/library?libraryStatus=ready&limit=100` items mapped to `{recordId, ordinanceNumber, seriesYear, title, summary}` (extend the library item consumption — `summary` may be absent on list items; when absent use `''`).
2. **Wire the component callbacks:** `onAssemble` → `POST /api/linaw/assemble {edition}` (200 → set volume + rose `final_code_export` feed card `hitlRequired` "Review required — final code export" with details from the response; 409 `PENDING_RELATIONSHIPS` → error feed card "Assembler blocked — N detections await human decision (Relationships tab)"; 409 `NOTHING_TO_ASSEMBLE` → error card); `onGenerateSummaries` → `POST /api/linaw/summarize {}` (success card `summarized N · failed M`); `onSaveSummary` → `PUT /api/linaw/summarize/:id`; `onApproveExport` → set `exportApproved` + mark the feed card confirmed; `onExportJson` → `GET /api/linaw/code/:id` then trigger a client download (`Blob` + anchor, filename `pillar-linaw-code-<edition-slug>.json`).
3. **Extend `runPipeline` to 6/6:** after the Sprint-6 agent-4 block — Agent 5 slot: processing + `sleep(LINAW_AGENT_DEFS[4].delayMs)` + `GET /api/linaw/relationships?limit=100`; completed output label `'Awaiting human review'`; when pending items exist (any `confirmed===0 && (rejected ?? 0)===0`) add a rose hitl card "N detections await human confirmation (Relationships tab)" and set agent 5 status `'hitl'` instead of completed — but DO NOT abort (agent 6 attempts and surfaces the block). Agent 6 slot: processing + `sleep(LINAW_AGENT_DEFS[5].delayMs)` + `POST /api/linaw/assemble {edition}`; 200 → completed "Code assembled" + `final_code_export` rose card + refresh volumes; 409 → error card with the server message (status `'error'`). Update the pipeline-complete activity text to "All 6 agents finished over the ready library." and delete the "Agents 5–6 run in Sprint 7" caption under the pipeline.
4. Keep all Sprint-5/6 tab behavior intact (Library, Inventory, Classification, Relationships incl. the S7-C5 decision wiring).

**acceptance_criteria:** Page renders five live tabs (zero stub cards); pipeline runs agents 1–6 with correct delays/glow/hitl states; assemble block path surfaces the pending count; export flow gated behind approval; `grep -c "Sprint 7" src/app/linaw/page.tsx` = 0.

**verification_commands:**

```bash
npx tsc --noEmit   # expected: exit 0
npm run dev & sleep 8
curl -s http://localhost:3000/linaw | grep -c "Lands in Sprint 7"   # expected: 0
curl -s http://localhost:3000/linaw | grep -oE "Inventory Analyst|Code Classifier|Cross-Reference Scanner|Conflict Detector|Relationship Reviewer|Code Assembler" | sort -u | wc -l   # expected: 6
kill %1
```

---

### S7-C14 — N015 route: `POST /api/linaw/export-package` + HTTP round-trip tests

```json
{
  "chunk_id": "S7-C14",
  "feature_id": "N015",
  "chunk_type": "feature-route",
  "parallel_group": "GROUP-F",
  "dependencies": ["S7-C13"],
  "file_outputs": ["src/app/api/linaw/export-package/route.ts", "tests/integration/linaw-export-package.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-export-package.test.ts; run — route absent → failures",
    "GREEN: create the route",
    "REFACTOR: route stays thin (auth + tolerant body + outcome mapping + logging + attachment headers); re-run"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

CREATE `src/app/api/linaw/export-package/route.ts` — the INTERCHANGE-SPEC §7 route contract for LINAW. `withUserAuth`, `runtime = "nodejs"`, acting user `user.user.id`.
- Tolerant body: read text; empty/`{}` → `recordIds = undefined` (all ready); JSON parse failure or non-object → 400 `{error: 'ordinanceIds must be an array of strings', code: 'INVALID_BODY'}`; `ordinanceIds` present but not an array of strings → same 400.
- `const outcome = buildLinawInterchangePackage({ userId, recordIds })`; `!ok` → 409 `{ error: outcome.error, code: 'CONFLICT' }`.
- Success: `logModuleEvent({ module: 'linaw', interactionType: 'linaw_export_package', content: JSON.stringify({ recordCount, packageHash }), ipAddress: '127.0.0.1', participantSessionId: 'linaw-' + userId })`, then `new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="pillar-linaw-l1-package-' + exportedAt.replace(/[:.]/g, '-') + '.json"' } })`.

Integration test `tests/integration/linaw-export-package.test.ts` (live server; seeded user; seed ≥2 ready rows with summaries, one CONFIRMED relationship between them (`confirmed:1, confirmedById: userId` via harness), one unconfirmed relationship, one pending_review row):
1. 401 without cookie.
2. Full export: 200 + `Content-Disposition: attachment` header containing `pillar-linaw-l1-package`; body key set EXACTLY `['manifest','packageHash','records','relationships']`; `manifest.module==='linaw'`, `schemaVersion==='1.0.0'`, `interchangeLevel==='L1'`, `source.table==='linaw_ordinances'`, `recordCount === records.length`; pending_review row ABSENT.
3. Relationships array: contains EXACTLY the confirmed one; shape per §5 — `sourceOrdinance`/`targetOrdinance` are `{ordinanceNumber, seriesYear}` objects (assert NO internal-id-looking fields), `type` valid, `confidence` number, `confirmedById === userId`; unconfirmed row absent; JSON.stringify of `relationships` contains neither the source nor target row UUIDs.
4. **Hash ROUND-TRIP over HTTP:** the test implements its OWN canonical serializer + `crypto.createHash('sha256')` (never imports module code), recomputes `'sha256:' + hash(canonical({records: body.records, relationships: body.relationships}))` → equals `body.packageHash`; assert `/^sha256:[0-9a-f]{64}$/`.
5. Filter: `{ordinanceIds: [oneId]}` → one record; its confirmed relationship OMITTED (other endpoint filtered out — self-consistency); hash still round-trips. Ineligible id (pending_review row id) → 409 CONFLICT listing it. `[]` → valid empty package (`records:[]`, `relationships:[]`, deterministic hash round-trips).

**acceptance_criteria:** INTERCHANGE-SPEC §11 LINAW row fully satisfied over HTTP (manifest, mapping, relationships-by-number/year, hash round-trip, filter, auth, logging); route thin.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-export-package.test.ts   # expected: pass, 0 fail
kill %1
```

---

### S7-C15 — GATE: FINAL dual-direction boundary grep + build + FULL regression + commits

```json
{
  "chunk_id": "S7-C15",
  "feature_id": "ALL (N005+N007+N006+N015) — sprint gate",
  "chunk_type": "gate",
  "parallel_group": "GROUP-G",
  "dependencies": ["S7-C1","S7-C2","S7-C3","S7-C4","S7-C5","S7-C6","S7-C7","S7-C8","S7-C9","S7-C10","S7-C11","S7-C12","S7-C13","S7-C14"],
  "file_outputs": ["package.json"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Run the sprint gate IN ORDER. Any failure blocks the sprint (and — this being the FINAL sprint — blocks engagement completion). Commands are Git Bash / POSIX shell on Windows.

**A. FINAL boundary gate of the engagement — FULL dual-direction grep, both modules, all paths (SPRINT_PLAN Sprint 7). Every command must yield ZERO hits:**

```bash
# A1 — LINAW direction: no forbidden imports in any linaw path
grep -REin "from ['\"]@/(app/api/(obra|chat|likha)|lib/(ai/(prompts|obra-export)|likha)|components/(ella|obra|yala|likha))" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts
# expected: zero hits

# A2 — archived_ordinances across ALL Sprint-7 files = zero (hard constraint)
grep -Rin "archived_ordinances" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts \
  tests/unit/linaw-confirmation.test.ts tests/unit/linaw-summaries.test.ts tests/unit/linaw-assemble.test.ts tests/unit/linaw-export-l1.test.ts \
  tests/integration/linaw-relationship-decisions.test.ts tests/integration/linaw-summaries.test.ts tests/integration/linaw-assemble.test.ts tests/integration/linaw-export-package.test.ts \
  tests/helpers/linaw-test-util.ts
# expected: zero hits

# A3 — LINAW table whitelist: no LIKHA-owned tables in linaw code
grep -REin "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(archived_ordinances|amendment_links)\b|(FROM|INTO|UPDATE|TABLE)[[:space:]]+classifications\b" \
  src/lib/linaw src/app/api/linaw
# expected: zero hits

# A4 — sibling-module tokens across Sprint-7 files
grep -REin "likha|obra|ella|yala" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts \
  tests/unit/linaw-confirmation.test.ts tests/unit/linaw-summaries.test.ts tests/unit/linaw-assemble.test.ts tests/unit/linaw-export-l1.test.ts \
  tests/integration/linaw-relationship-decisions.test.ts tests/integration/linaw-summaries.test.ts tests/integration/linaw-assemble.test.ts tests/integration/linaw-export-package.test.ts \
  tests/helpers/linaw-test-util.ts
# expected: zero hits

# A5 — LIKHA direction regression: likha paths remain free of linaw imports
grep -REin "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: zero hits

# A6 — LIKHA direction regression: no LINAW table reads in likha code
grep -REin "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha
# expected: zero hits

# A7 — L1 builder surface: the N015 builder reads ONLY linaw_ordinances + ordinance_relationships
grep -in "code_volumes" src/lib/linaw/export.ts
# expected: zero hits
```

**B. Static + build:**

```bash
npx tsc --noEmit   # expected: exit 0
npm run lint       # expected: no errors
npm run build      # expected: success
```

**C. Tests — new Sprint-7 suites + FULL Sprint 1–6 regression = the complete 19-feature acceptance baseline feeding Phase 4 SYSTEM_TEST.** First EDIT `package.json`: append to the `test` script's file list `tests/unit/linaw-confirmation.test.ts tests/unit/linaw-summaries.test.ts tests/unit/linaw-assemble.test.ts tests/unit/linaw-export-l1.test.ts`, and to `test:integration` `tests/integration/linaw-relationship-decisions.test.ts tests/integration/linaw-summaries.test.ts tests/integration/linaw-assemble.test.ts tests/integration/linaw-export-package.test.ts`. Then (dev server running for integration):

```bash
npm run test              # expected: ALL suites pass — LIKHA hermetic (S2–S4) + LINAW S5–S7 unit
npm run test:integration  # expected: ALL suites pass — LIKHA API (S2–S4) + LINAW S5–S7 API
```

A LIKHA failure during this LINAW sprint is boundary-violation evidence and blocks the tag (SPRINT_PLAN risk 8).

**D. Regression extras + render smoke:**

```bash
# D1 — shared kit + agentic types untouched since v0.6.0-sprint-6:
git --no-pager diff --stat v0.6.0-sprint-6..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts | grep -c . || echo KIT-UNTOUCHED
# expected: KIT-UNTOUCHED

# D2 — frozen shared primitives: logger/llm/middleware byte-identical; db.ts diff is EXACTLY the rejected-column guard:
git --no-pager diff --stat v0.6.0-sprint-6..HEAD -- src/lib/logger.ts src/lib/ai/llm.ts src/middleware.ts | grep -c . || echo SHARED-UNTOUCHED
# expected: SHARED-UNTOUCHED
git --no-pager diff v0.6.0-sprint-6..HEAD -- src/lib/db.ts | grep -c "ALTER TABLE ordinance_relationships ADD COLUMN rejected"
# expected: 1

# D3 — schema intact + idempotent (run TWICE):
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions']; const missing=need.filter(n=>!names.includes(n)); const cols=db.prepare('PRAGMA table_info(ordinance_relationships)').all().map(c=>c.name); if(missing.length||!cols.includes('rejected')){console.error('FAIL',missing,cols); process.exit(1);} console.log('SCHEMA OK');"
# expected (both runs): SCHEMA OK

# D4 — auth gate + render smoke:
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/linaw/assemble && echo " (assemble 401)"          # expected: 401 (assemble 401)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/linaw/export-package && echo " (export 401)"      # expected: 401 (export 401)
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/linaw/relationships/xxx && echo " (decision 401)"  # expected: 401 (decision 401)
npm run dev & sleep 8
curl -s http://localhost:3000/linaw | grep -c "Lands in Sprint 7"          # expected: 0 (all stubs replaced)
curl -s http://localhost:3000/linaw | grep -c "Run Codification Pipeline"  # expected: >= 1
kill %1
```

**E. Feature commits — chain order N005 → N007 → N006 → N015 (decision D9; verify each staging set compiles by running B between commits; with sequential execution each staged state contains exactly that feature's additions):**

```bash
git add src/types/linaw.ts tests/helpers/linaw-test-util.ts src/lib/db.ts src/lib/linaw/agents.ts \
        src/app/api/linaw/relationships/route.ts "src/app/api/linaw/relationships/[id]/route.ts" \
        src/components/linaw/relationship-review.tsx src/components/linaw/conflict-panel.tsx src/app/linaw/page.tsx \
        tests/unit/linaw-confirmation.test.ts tests/integration/linaw-relationship-decisions.test.ts
git commit -m "feat: implement N005 relationship confirmation workflow pillar-likha-linaw-20260809"

git add src/lib/linaw/prompts.ts src/lib/linaw/agents.ts src/types/linaw.ts \
        src/app/api/linaw/summarize/route.ts "src/app/api/linaw/summarize/[id]/route.ts" \
        tests/unit/linaw-summaries.test.ts tests/integration/linaw-summaries.test.ts
git commit -m "feat: implement N007 AI-generated plain-language summaries pillar-likha-linaw-20260809"

git add src/lib/linaw/agents.ts src/types/linaw.ts \
        src/app/api/linaw/assemble/route.ts src/app/api/linaw/code/route.ts "src/app/api/linaw/code/[id]/route.ts" \
        src/components/linaw/code-assembly.tsx src/app/linaw/page.tsx \
        tests/unit/linaw-assemble.test.ts tests/integration/linaw-assemble.test.ts
git commit -m "feat: implement N006 code volume assembly with TOC pillar-likha-linaw-20260809"

git add src/lib/linaw/export.ts src/app/api/linaw/export-package/route.ts src/types/linaw.ts package.json \
        tests/unit/linaw-export-l1.test.ts tests/integration/linaw-export-package.test.ts
git commit -m "feat: implement N015 codification interchange export package pillar-likha-linaw-20260809"

git log --oneline -4
# expected: exactly these 4 commits, in this order, with these exact messages
git status --porcelain -- src tests package.json
# expected: empty (only this instructions doc may remain untracked under docs/)
```

Commit-seam semantics: if any group was executed in parallel, the FIRST commit that stages an append-only file carries its whole current state — sequential execution avoids this entirely and is the recommended mode (boundary rule 9). Tag `v0.7.0-sprint-7` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do NOT tag in this chunk.

**acceptance_criteria:** (1) A–D produce their expected outputs; C's results are the engagement's FULL regression baseline (19/19 features) feeding SYSTEM_TEST; (2) exactly 4 commits with exact messages; working tree (module files) clean; (3) all evidence (outputs, test counts, commit SHAs) recorded for the FINAL SPRINT_REVIEW and cumulative quality score.

**verification_commands:** the gate body itself (sections A–E above).

---

## Sprint 7 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 7; FINAL sprint)

**This sprint delivers LINAW feature-complete — relationship confirmation workflow (N005), AI-generated plain-language summaries (N007), Code of Ordinances assembly with TOC (N006), L1 interchange export (N015) — and with it the ENTIRE engagement is demo-ready: 19/19 planned features across LIKHA + LINAW. Dependency map: Sprint 6 (detected relationships/classifications to confirm and assemble). Instruction source: PRP-LINAW only + INTERCHANGE-SPEC v1.0.0 as frozen contract reference.**

- [ ] **N005 acceptance (PRD-LINAW §6.8 feature 5):** `PUT /api/linaw/relationships/:id` confirms (`confirmed=1` + `confirmed_by_id`) or rejects (additive `rejected=1`, reason REQUIRED and audited to `agent_decisions`); decisions final (second action → 409); confirmed `repeals`/`partial_repeal`/`supersedes` flip the AFFECTED (target — decision D2, flagged) ordinance status in `linaw_ordinances` to `repealed`/`amended`/`superseded` — test-proven hermetic + HTTP, incl. terminal-status protection; conflict-marker rows are decided through the same endpoint (D3); EVERY detected relationship/conflict requires a human action before assembly proceeds — assembler 409 `PENDING_RELATIONSHIPS` while pending rows exist (D5); `relationship-review.tsx` + `conflict-panel.tsx` confirm/reject ENABLED and wired; Relationship Reviewer agent 5 real (1100ms slot, presents queue, raises `detected_relationship` gates) (S7-C3, S7-C4, S7-C5)
- [ ] **N007 acceptance (PRD-LINAW §6.8 feature 7):** 2–3 sentence plain-language summaries per ready ordinance via LINAW's OWN prompts (`llm.ts`, temperature 0, per-record graceful failure — never 500s); stored in the EXISTING `linaw_ordinances.summary` column; human-editable via `PUT /api/linaw/summarize/:id` (ready rows only; non-empty required); summaries included in assembly output sections AND in the L1 export record `summary` field (S7-C6, S7-C7, S7-C8)
- [ ] **N006 acceptance (PRD-LINAW §6.8 feature 6):** `POST /api/linaw/assemble {edition}` → Code Assembler agent 6 (1300ms) builds hierarchical Titles → Chapters → Articles → Sections from `codification_records` over READY ordinances (`active`/`amended` only — repealed/superseded/expired excluded and reported); auto-numbering sequential per chapter persisted to `section_in_code` + `cod_status='codified'`; structure JSON + TOC persisted to `code_volumes` (`status='draft'`, one row per assemble); `GET /api/linaw/code/:id` detail + list; assembler REFUSES while pending unconfirmed relationships exist (409) and RAISES the `final_code_export` HITL gate after every successful build (D5); `code-assembly.tsx` replaces the stub (structure tree, TOC preview pane, summaries review queue, Export JSON; PDF/DOCX post-MVP toggle noted) (S7-C9, S7-C10, S7-C11, S7-C12)
- [ ] **N015 acceptance (INTERCHANGE-SPEC §11 LINAW row):** `POST /api/linaw/export-package` returns the bundle matching §2–§6 EXACTLY — manifest `module='linaw'`/`schemaVersion='1.0.0'`/`recordCount == records.length`; records from ready rows per §4 mapping; relationships CONFIRMED-only, six-type-only, keyed by `{ordinanceNumber, seriesYear}` NEVER internal ids, incl. `type`/`sectionRef`/`confidence`/`confirmedById`; `packageHash = 'sha256:' + SHA-256(canonical JSON of {records, relationships})`; hash round-trip tests hermetic + over-HTTP, INCLUDING a package WITH confirmed relationships; `ordinanceIds` filter + all-or-nothing 409 + valid empty package; `Content-Disposition: attachment`; auth required; export logged with module + user id (S7-C13, S7-C14)
- [ ] **Full 6-agent LINAW pipeline demo runs end-to-end** with delays 1100/1300/1600/1500/1100/1300ms (= 7900ms total) per WORKFLOW-LINAW.json — agents 5–6 no longer stubs; `runLinawPipeline` orchestrates 1→6 (unit-tested); page pipeline visualization + HITL rose cards across all gates (`detected_relationship`, `final_code_export`) (S7-C9, S7-C12)
- [ ] **Auth + logging + audit:** every route wrapped in `withUserAuth` (401 proven on relationships PUT / summarize POST+PUT / assemble / code list+detail / export-package); all engine runs logged via `logModuleEvent` `module='linaw'`; every agent action + every human decision audited to `agent_decisions` (`module='linaw'` — agent 5 decisions, agent 6 assembly + gate, agent 0 summaries)
- [ ] **Boundary grep clean, BOTH directions — the engagement's FINAL boundary gate:** A1–A7 all zero (LINAW forbidden imports zero; `archived_ordinances` zero across ALL Sprint-7 files; table whitelist clean both ways; sibling tokens zero; LIKHA direction still clean; L1 builder reads only its two tables) (S7-C15.A)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S7-C15.B)
- [ ] **New tests green:** hermetic — confirmation status propagation + finality + rejection storage, summary parsing + engine graceful degradation, assembly hierarchy validity + auto-numbering + gate blocking, L1 builder incl. relationships + canonical JSON + hash round-trip; integration — relationships PUT confirm/reject + 409s + 404s + 401s, summaries generate/edit + 401/400/404/409, assemble + gate blocking + code detail + 401s, export-package round-trip WITH confirmed relationships + filter + 409 + 401 (S7-C15.C)
- [ ] **Regression: FULL Sprint 1–6 suite re-run — the complete 19-feature acceptance baseline — green** (LIKHA hermetic + API S2–S4; LINAW ingestion S5; LINAW analysis S6; shared kit/schema byte checks); a LIKHA failure blocks the tag (S7-C15.C/D)
- [ ] **No scope leakage:** no PDF/DOCX generation, no import-package endpoints (post-MVP/LINYA), no voice features, no drag-reorder (flagged deferral)
- [ ] **Per-feature commits in chain order:** exactly 4 — `feat: implement N005 relationship confirmation workflow pillar-likha-linaw-20260809`, `feat: implement N007 AI-generated plain-language summaries pillar-likha-linaw-20260809`, `feat: implement N006 code volume assembly with TOC pillar-likha-linaw-20260809`, `feat: implement N015 codification interchange export package pillar-likha-linaw-20260809` (S7-C15.E)
- [ ] Tag `v0.7.0-sprint-7` cut ONLY after the FINAL SPRINT_REVIEW passes; cumulative quality score recorded; **engagement declared feature-complete (19/19) — handoff to Phase 4 SYSTEM_TEST**

**Integration/Regression notes (SPRINT_PLAN):** new tests = relationship confirm/reject + status propagation; summaries editable; assemble TOC validity on seeded library; export-package round-trip incl. confirmed-relationship payload. Regression = FULL re-run of ALL Sprint 2–6 suites (LIKHA + LINAW) — the complete 19-feature acceptance pass feeding Phase 4 SYSTEM_TEST. Accuracy targets (cross-reference ≥70%, conflict ≥60%, confirmation-rate KPI >80%) are verified on the pilot batch at SYSTEM_TEST, not per-sprint gates (SPRINT_PLAN risk 7).

---

## Flagged for SPRINT_REVIEW

1. **D1 — ONE additive schema change: `ordinance_relationships.rejected INTEGER DEFAULT 0`** (idempotent `PRAGMA table_info` guard + `ALTER TABLE … ADD COLUMN` in `initSchema()` — first `db.ts` edit since Sprint 1). Justified: the N006 gate must distinguish pending from rejected, and no existing column can carry it (`confirmed=1` on rejected rows would leak them into the N015 confirmed-only export). Rejection REASON lives in `agent_decisions.reason` (no reason column added). Confirm acceptability of the ALTER for the pilot DB (existing dev DBs gain the column lazily on next init — idempotent and non-destructive).
2. **D2 — Status propagation flips the TARGET ordinance, not the literal PRP/PRD/SPRINT_PLAN "source".** The docs' wording predates Sprint 6's D7/D8 direction fix (source = the referencing/amending instrument; verified in Sprint-6 code + tests). Flipping the actor would mark the NEW repealing ordinance as repealed — legally inverted. The mandate's own status list (amended/repealed/superseded) only composes on the affected ordinance. Logic isolated in `ordinanceStatusAfterConfirmedRelationship` + one UPDATE for a one-line swap if the reviewer rules literal. ALSO: `amends` deliberately does NOT flip (the sprint mandate enumerates only repeal/partial_repeal/supersedes) — confirm whether confirmed `amends` should set the target `'amended'` at SYSTEM_TEST.
3. **D3 — Conflicts share the confirmation endpoint + gate.** Conflict-marker rows are decided via the same PUT and count toward the assembly pending gate (PRD gate row: "cross-reference or conflict found"). Confirmed conflicts never export (six-type whitelist).
4. **D4/D12 — Summaries are on-demand + human-editable; LLM best-effort per record.** No summary generation inside assembly (deterministic assembler); keyless environments degrade to `summarized: 0` + failed list (never 500s). Audit under `agent_id=0` ('Summary Generation'/'Summary Edit') per the Sprint-5 pre-pipeline convention.
5. **D5 — Gate semantics: assembler REFUSES (409 `PENDING_RELATIONSHIPS`) while pending rows exist, then RAISES `final_code_export` after success.** Rejected rows do not block (human action taken). `final_code_export` gates the UI's Export JSON acknowledgment (JSON is the MVP export surface; PDF/DOCX = post-MVP toggle). N015 export-package is NOT gated by it (library snapshot per INTERCHANGE-SPEC §4).
6. **D6 — Assembly scope choices:** only `active`/`amended` ordinances enter the code (repealed/superseded/expired excluded + reported — this is what makes N005 flips visibly matter in the TOC); placements read from codification columns (Sprint-6 D6 already mirrors overrides into them); section numbering per chapter; each assemble creates a NEW draft volume; volume title fixed `'Municipal Code of Ordinances'`.
7. **D8 — N015 filtering self-consistency:** confirmed relationships are omitted when either endpoint is filtered out of the records set (spec is silent; keeps packages internally consistent for LINYA). `relationships` key ALWAYS present for LINAW (hashed alongside records).
8. **D10 — UI deferrals:** drag-to-reorder Title/Chapter tree NOT implemented (deterministic order from placements); PDF/DOCX toggle rendered disabled/post-MVP; PRD `POST /api/linaw/code/:id/export {format: pdf|docx}` deliberately not built (Should-have, post-MVP per sprint scope).
9. **D11 — Additive type extensions** beyond PRP shapes: `CodeTocChapter.sections?` (chapter-level sections — required because `articleNumber` is optional) + optional display fields on `CodeSectionRef`; `LinawAgentOutput.toc` retyped `unknown[] → CodeTocNode[]`.
10. **Carried from Sprint 6 (still open):** (a) `GET /api/linaw/library?q=` remains SQL LIKE — the BM25 namespace ships ready-only while the library list must also search `pending_review`; candidate for MAINTAIN phase. (b) Middleware matcher: `/linaw` in PROTECTED_PATHS but absent from `config.matcher`; API routes stay hard-gated by `withUserAuth` (unchanged this sprint). (c) Multiple-amendment-chain visualization (PRP exception rule) remains a future enhancement — chains are fully reviewable via the relationships list. (d) `runLinawPipeline` is now route-consumed via the assemble precondition and unit-tested end-to-end 1→6.
11. **Engagement closure:** this is the FINAL sprint — after SPRINT_REVIEW passes, cut `v0.7.0-sprint-7`, record the final cumulative quality score, and hand the FULL regression evidence (S7-C15.C) to Phase 4 SYSTEM_TEST as the 19-feature acceptance baseline.

**Handoff:** none further — Sprint 7 completes LINAW and the entire MVP (19/19 features: LIKHA L001–L007 + L010 + L013; LINAW N013/N014 + N001–N007 + N015). Phase 4 SYSTEM_TEST consumes the tagged `v0.7.0-sprint-7` state, the pilot-batch accuracy targets (metadata ≥80%, cross-reference ≥70%, conflict ≥60%, confirmation rate >80%), and the INTERCHANGE-SPEC §11 acceptance for both module packages.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 7 of 7 (FINAL)*
