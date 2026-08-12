# Sprint 4 Instruction Set — LIKHA Classification & Exports (DILG + L1 Interchange)

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 4 of 7 — "LIKHA Classification & Exports (DILG + L1 Interchange)" — features **L007, L010 (Should), L013 (Should)** |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith, React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^12, lucide-react ^0.468, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `node:test`, `node:crypto`), tsx ^4.19 test harness from Sprints 2–3. `package.json` `name = "pillar"`, `version = "1.0.0"` (L013 manifest `exporter.appVersion` reads this) |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 4 uses **`docs/PRP-LIKHA.md` ONLY** for module instructions. Do NOT read or reference any module section of `docs/PRP-LINAW.md` (or any LINAW code — none exists yet). **`docs/INTERCHANGE-SPEC.md` (v1.0.0) is consulted as the frozen L1 contract reference** — it is the ONLY cross-cutting document allowed into this sprint, and its shapes (§2 package, §3 manifest, §4 record, §6 packageHash, §7 route contracts) are implemented **verbatim** — do not invent, rename, or reorder fields. Supporting inputs already consumed by this instruction set: `docs/WORKFLOW-LIKHA.json` (agent 4 Subject Classifier — 1200ms slot, input `rawText`+`title`, output `subjects`, output_label "Subjects suggested"; HITL gate `low_confidence_classification` — trigger "classification confidence < 0.6", role SB Secretary / Legal Officer; exception rule "Classification confidence <0.6 → HITL gate with override dropdown"; data rule "Classifier maps subjects to Code Titles/Chapters taxonomy"), `docs/DESIGN.md` (§2.1 LIKHA header actions `[ Upload New ] [ Run Classification ] [ Export DILG Package ]`, §3 palette, §6 breakpoints/keyboard), `docs/PRD-LIKHA.md` (§6.7 feature 7 — suggest ≥1 category with confidence + admin override stored with `assigned_by`; §12.4 gate row 2; §12.5 `classifications` table provenance `assigned_by('ai' or user id)`; §12.6 API contract rows for `classify`, `export-dilg`, `export-package`), and the Sprint-1/2/3 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes" below).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 3 is committed and tagged** (`v0.3.0-sprint-3`; commits `feat: implement L004/L005/L006 … pillar-likha-linaw-20260809`; module working tree clean). Real Sprint-3 surface this sprint builds on:
   - `src/lib/likha/agents.ts` — SERVER runner `runLikhaPipeline(opts: RunLikhaPipelineOptions)` executing agents 2–5 per file; DI seams `ocr?`, `extractMetadata?`, **`classify?` (agent 4 seam — current default is the Sprint-3 pass-through `opts.classify ?? (async () => [])`)**, `validate?`; `AGENT_NAMES` already `{2:'OCR Extractor', 3:'Metadata Parser', 4:'Subject Classifier', 5:'Legal Validator', 6:'Archiver'}`; local `recordDecision()` audit helper bound to `pipelineId`; per-file try/catch flags rows and never crashes the batch; `logModuleEvent({module:'likha', interactionType:'likha_pipeline', …})` per run. Agent 4 today records `start` (`input_snapshot` `{"recordId":…,"mode":"s3-passthrough"}`) + `complete` (`output_snapshot` `{"mode":"s3-passthrough","subjects":[…]}`) audit rows and calls the no-op seam — **this sprint replaces the default with the real LLM classifier (decision D24)**. The file also exports `validateLikhaExtraction` (agent 5, metadata-only — NOT extended for classification; decision D24) and `applyVerificationDecision` (Sprint-3 human approve/edit/reject with `db?` DI).
   - `src/lib/likha/prompts.ts` — `METADATA_SYSTEM_PROMPT`, `buildMetadataUserPrompt` (12,000-char truncation), `parseMetadataResponse` (strips ``` fences, finds first `{…}` span, clamps confidence to [0,1], **never throws** — zeroed defaults on garbage). The classification prompt + parser follow this exact precedent (S4-C3).
   - `src/lib/likha/archiver.ts` — agent 6 `publishApprovedRecord` (hard-gated on `archive_status='pending_review'`). Unchanged this sprint.
   - `src/lib/likha/search.ts` — BM25 namespace `createLikhaSearch({indexPath, db?})` + singleton `likhaSearch` (env `LIKHA_SEARCH_INDEX_PATH`). Unchanged this sprint.
   - `src/app/api/likha/*` — real routes: `upload`, `pipeline`, `archive` (GET list/search), `archive/[id]` (GET detail + PUT decision; approve branch runs the Archiver), `archive/[id]/scan`, `stats`. All wrapped in `withUserAuth`. This sprint ADDS `classify/route.ts`, `classify/[id]/route.ts`, `export-dilg/route.ts`, `export-package/route.ts`, and extends the `archive/[id]` GET response with classifications (decision D26).
   - `src/app/likha/page.tsx` — client page, tabs `archive` (live) / `upload` (live, DEFAULT active) / `classification` (**stub — renders exactly** `<p>AI subject classification lands in Sprint 4 (L007).</p>`). Agent 4 visualization completes with `output = { preview: 'Subjects suggested', subjects: [], success: true }` (S3 pass-through). HITL wiring exists for agent 5's `low_confidence_metadata` gate (rose card + `LikhaHitlItem` queue + `awaitingDecision`). This sprint: agent 4 becomes real (subjects from the pipeline response), the `low_confidence_classification` gate fires from agent 4's result, the stub is replaced by `<ClassificationEditor />`, and an `[ Export DILG Package ]` toolbar button lands (decisions D24/D30).
2. **`src/types/likha.ts` (real):** `LIKHA_AGENT_DEFS` (agent 4 = Subject Classifier, `#0EA5E9`, `glow-sky`, **1200ms**, outputLabel "Subjects suggested"); `LikhaAgentOutput.subjects?: Array<{label, confidence}>` already declared; `LikhaHitlItem` gate union **already includes `'low_confidence_classification'`** (declared in Sprint 3, trigger lands THIS sprint); `LikhaPipelineFileResult` (additive `classification?` field this sprint); `LikhaValidationResult.gate` stays `'low_confidence_metadata'` only (decision D24); `LIKHA_SUBJECTS: readonly string[]` — **12** subject categories (Taxation & Revenue, Business Regulation, Health & Sanitation, Zoning & Land Use, Public Safety & Order, Education, Social Services, Infrastructure & Public Works, Environment & Natural Resources, Budget & Appropriations, Personnel & Administration, General Provisions) with the comment "Sprint 4's L007 taxonomy supersedes (agent 4 suggests from it; humans keep final say)"; `ArchivedOrdinanceRow` already carries `dilg_submitted: number` + `dilg_submitted_at: string | null`. `LikhaRecordDetailResponse` gains an additive `classifications?` field this sprint (decision D26).
3. **DB schema reality (`src/lib/db.ts`):** `classifications ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL, category TEXT NOT NULL, confidence REAL, assigned_by TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id) ON DELETE CASCADE )` — exists since Sprint 1 and is still **empty**; this sprint is its first writer. `amendment_links` exists but stays UNTOUCHED (no amendment detection in LIKHA MVP scope). `archived_ordinances` has `dilg_submitted INTEGER DEFAULT 0, dilg_submitted_at TEXT` (L010 sets them), `summary TEXT` (L013 maps it), `subject_tags TEXT DEFAULT '[]'`. **No schema changes this sprint** — Sprint 4 writes only to existing tables (`classifications`, `archived_ordinances` markers, `agent_decisions`, `interaction_logs`).
4. **`withUserAuth` real signature (inspected):** `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession }) => …`; acting user id = `user.user.id`; 401 envelope `{ error: 'Authentication required', code: 'NO_SESSION' }`. Dynamic-route precedent: `src/app/api/likha/archive/[id]/route.ts` (`const { id } = await params;`).
5. **LLM client (inspected):** `chatCompletion(systemPrompt: string, userPrompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string>` from `@/lib/ai/llm` — metadata parsing uses `{temperature: 0, maxTokens: 1024}`; classification uses the same settings.
6. **Logger real API (inspected):** `logModuleEvent({module, interactionType, content?, ipAddress, participantName?, participantSessionId?})` — LIKHA precedent: `ipAddress: '127.0.0.1'`, `participantSessionId: 'likha-' + userId`, `module: 'likha'`.
7. **INTERCHANGE-SPEC v1.0.0 frozen shapes (authoritative for L013):** package = `{ manifest, records, packageHash }` (relationships omitted for LIKHA per §2 — "omitted or `[]` for LIKHA packages"); manifest = `{ schemaVersion: '1.0.0', module: 'likha', interchangeLevel: 'L1', exportedAt: ISO-8601 UTC, exportedById, source: { table: 'archived_ordinances', recordCount, yearRange: [min, max] }, exporter: { platform: 'pillar-pilot', appVersion } }` with `recordCount == records.length`; record = `{ ordinanceNumber, seriesYear, title, content, summary: string|null, subjectTags: string[], status, sourceType, fileHash: string|null, sourceRecordId }` — LIKHA mapping: `archive_status='published'` rows; `sourceType` from the row's `source_type` (default `'scan'`); `summary` from the row; `subjectTags` = `subject_tags` JSON **plus** `classifications` rows (union). `packageHash = 'sha256:' + SHA-256(canonicalPayload)`; canonicalPayload = canonical JSON of `{ records }` for LIKHA (relationships absent) with **object keys sorted lexicographically and no insignificant whitespace**; the hash covers the payload only, never the manifest. Both export routes: `withUserAuth`, body `{ "ordinanceIds"?: string[] }` — when omitted, ALL eligible records; errors `{ error: string, code?: string }`; `Content-Disposition: attachment`; export logged via logger with module + exporter user id.
8. **Test harness reality (Sprints 2–3):** scripts `"test": "tsx --test tests/unit/likha-ocr.test.ts tests/unit/likha-search.test.ts tests/integration/likha-metadata.test.ts tests/integration/likha-verification.test.ts tests/integration/likha-publish.test.ts"` (hermetic) and `"test:integration": "tsx --test tests/integration/likha-upload.test.ts tests/integration/likha-archive.test.ts"` (API-level vs `npm run dev`). `tests/helpers/likha-test-util.ts` exports `BASE_URL`, `assertServerReachable()`, `seedApprovedUser(dbFile?)`, `readFixture(name)`, `tempDbPath()`, `tempIndexPath()`, `seedPendingReviewRecord(db, userId, overrides?)` (override supports `archiveStatus: 'published'`). Hermetic pattern: set `process.env.DB_PATH = tempDbPath()` BEFORE `await import('../../src/lib/db')` (dynamic import REQUIRED — db.ts reads `DB_PATH` at module load); relative imports only (no `@/` alias in tests). API-level pattern (likha-archive.test.ts): `assertServerReachable()` → `seedApprovedUser()` → seed rows directly into `data/workshop.db` via better-sqlite3 → fetch with `Cookie: pillar_user_session=<sessionId>` → clean up seeded rows + related `agent_decisions` rows in `t.after`.
9. **No archive ZIP/compression dependency exists** in `package.json` (dependencies: better-sqlite3, lucide-react, next, openai, react, react-dom, …). L010 therefore ships a **single JSON submission document** (decision D27) — consistent with L1's single-JSON package precedent (INTERCHANGE-SPEC §2) and zero new dependencies.
10. **PRP taxonomy wording:** PRP-LIKHA says "Classification maps to the 13 Code Titles taxonomy + subject categories; returns `[{label, confidence}]`". The repo's existing label set is `LIKHA_SUBJECTS` (12 categories). Sprint 4 introduces `LIKHA_CODE_TITLES` — the 13-title municipal Code of Ordinances template (decision D21) — and the classifier's legal label space is the UNION `LIKHA_CODE_TITLES ∪ LIKHA_SUBJECTS`; the parser filters any label outside the union.

## Sprint 4 Boundary Rules (apply to EVERY chunk)

1. **LIKHA-only code paths.** Every file created or edited lives in the `likha/` namespace or is an explicitly listed additive shared edit (`package.json` scripts + `tests/helpers/likha-test-util.ts` in S4-C2). No edits to `src/lib/db.ts` are needed or allowed (all Sprint-4 tables already exist).
2. **Zero cross-module imports.** No Sprint-4 file may import from `@/app/api/{obra,chat,ella,yala,linaw}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, `@/lib/linaw`, `@/components/{ella,obra,yala,linaw}`, or any ELLA/OBRA/YALA/LINAW code. Allowed imports ONLY: `@/lib/ai/llm` (classification call), `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed` — props only), `@/types/agentic`, `@/types/likha`, LIKHA-owned modules (`@/lib/likha/*`), Node built-ins (`node:crypto`, `node:fs`, `node:path`), `lucide-react`, `next/server`, `react`.
3. **Zero LINAW table references / tokens.** No Sprint-4 file may contain `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, or the token `linaw` (case-insensitive) anywhere in LIKHA code or tests. INTERCHANGE-SPEC is referenced in comments as the contract name only (`docs/INTERCHANGE-SPEC.md` / "INTERCHANGE-SPEC") — never any LINAW mapping from it.
4. **INTERCHANGE-SPEC verbatim.** The L1 package shape, manifest fields, record fields, and hash algorithm are implemented EXACTLY per §2–§4 + §6 (decision D28). No invented fields, no field renames, no relationships key in LIKHA packages.
5. **Auth on every route.** All THREE new routes (`POST /api/likha/classify`, `PUT /api/likha/classify/[id]`, `POST /api/likha/export-dilg`, `POST /api/likha/export-package`) are wrapped in `withUserAuth`; acting user = `user.user.id`.
6. **Logging + audit.** Every LIKHA write path calls `logModuleEvent` with `module: 'likha'` (classify run, override, DILG export, L1 export). ALL classification decisions are audited to `agent_decisions` with `module='likha'`: agent-4 `start`/`complete` rows per classified record (pipeline + standalone classify route), `action='hitl'` rows when `low_confidence_classification` fires, and override rows `action='confirm'`, `reason='override'`, `user_id` = the acting admin (decisions D24/D25).
7. **Published-only exports (decision D23).** Both export routes include ONLY `archive_status='published'` rows. If the caller supplies `ordinanceIds` and ANY id is missing or not published, the WHOLE request is rejected with **409** `{ error, code: 'CONFLICT' }` (all-or-nothing; no partial packages). `ordinanceIds` omitted → all published rows; `ordinanceIds: []` → a valid package with zero records. `POST /api/likha/classify` eligibility is separate (decision D22): `pending_review` + `published` rows are classifiable; `processing`/`flagged`/unknown ids are reported as `skipped` in a 200 response.
8. **No out-of-scope features.** NO import endpoints, NO amendment detection (`amendment_links` stays empty), NO voice/audio, NO changes to the Sprint-1 kit, NO LINAW anything. The verification panel, archive browser, upload, archiver, and BM25 search are untouched except the additive `classifications` field on `GET /api/likha/archive/[id]` (decision D26).
9. **One commit per feature**, exact format: `feat: implement L007 AI-assisted subject classification pillar-likha-linaw-20260809` · `feat: implement L010 DILG MC 2026-041 submission package export pillar-likha-linaw-20260809` · `feat: implement L013 L1 interchange export package pillar-likha-linaw-20260809` (staging lists in S4-C10, decision D30).
10. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprints 1–3). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (flagged for SPRINT_REVIEW — see end of file)

(Numbering continues Sprint 3's D1–D20.)

- **D21 — Classification taxonomy.** New exported constant `LIKHA_CODE_TITLES` (13 titles — the municipal Code of Ordinances template: General Principles; Local Government Structure & Administration; Taxation & Fiscal Affairs; Public Services & Utilities; Markets, Trade & Business; Health, Sanitation & Welfare; Public Safety & Order; Buildings & Construction; Zoning, Land Use & Housing; Agriculture, Fisheries & Livelihood; Environment & Natural Resources; Education, Culture & Social Development; General & Miscellaneous Provisions). The classifier's LEGAL label space = union of `LIKHA_CODE_TITLES` and the existing `LIKHA_SUBJECTS` (12); the prompt names the union explicitly and the parser drops any label outside it. PRP says "13 Code Titles taxonomy + subject categories" — the union is the literal reading.
- **D22 — Classify eligibility.** `POST /api/likha/classify` accepts `{ ordinanceIds: string[] }` (required, non-empty — else 400 `INVALID_BODY`). Rows at `pending_review` or `published` are classified (they have `content`); rows at `processing`/`flagged` and unknown ids are NOT classified — they land in the response `skipped` array with `reason` (`'not_found'` / `'not_classifiable:<archive_status>'`). Response 200: `{ classified, skipped, results }` with one result entry per classified record carrying the persisted suggestions + provenance. This keeps the batch route total (never crashes on one bad id) — same posture as the pipeline runner.
- **D23 — Published-only exports, all-or-nothing 409.** Both export routes: `ordinanceIds` omitted → every published row; `ordinanceIds: []` → valid empty package (0 records; L1 hash = SHA-256 of canonical `{"records":[]}`); any supplied id missing or not `archive_status='published'` → the WHOLE request fails **409** `{ error: 'Records not eligible for export (published only): <ids>', code: 'CONFLICT' }`. 409 matches the repo's established conflict semantics for state-eligibility refusals (Sprint-3 D17 precedent); no partial exports.
- **D24 — Agent 4 becomes real and owns its own gate.** The runner's `classify` default is replaced with the real LLM call (prompts.ts S4-C3) at temperature 0. After classification the runner persists every suggestion to `classifications` (`assigned_by='ai'`, confidence stored) and attaches `classification: { subjects, hitlRequired, gate? }` to the file result. Gate: suggestions empty OR max confidence `< 0.6` → `hitlRequired: true, gate: 'low_confidence_classification'` + an agent-4 `action='hitl'` audit row (WORKFLOW exception rule "Classification confidence <0.6 → HITL gate with override dropdown"). Agent 5 (`validateLikhaExtraction`) is NOT modified — it keeps validating metadata only; the two PRD §12.4 gates therefore have distinct owners (row 1 = agent 5, row 2 = agent 4). The 1200ms slot stays the client's UI simulation (decision D9 precedent). Audit snapshots change `mode: 's3-passthrough'` → `mode: 's4-llm'` (or `'s4-stub'` when the DI seam is injected).
- **D25 — Admin override route.** New `PUT /api/likha/classify/[id]` (`id` = archived_ordinances record id; the PRD route table lists only `POST /api/likha/classify` — this additive route is the override's persistence path, same precedent as S3's D15 scan route). Body `{ categories: string[] }` (non-empty, every category in the D21 union — else 400). Semantics: REPLACE — delete the record's existing `classifications` rows, insert one row per category with `assigned_by = <acting user id>`, `confidence = NULL` (human decisions carry no model confidence). Audit: `agent_decisions` row `module='likha'`, `agent_id=4`, `agent_name='Subject Classifier'`, `action='confirm'`, `reason='override'`, `user_id`, `output_snapshot` = the categories. 404 if the record does not exist; any `archive_status` may be overridden EXCEPT `processing` (nothing to classify yet → 409). Overrides are logged (`likha_classification_override`).
- **D26 — `GET /api/likha/archive/[id]` gains `classifications`.** PRD §12.6 row: "ordinance detail + classifications". Additive optional field on the existing response: `classifications: Array<{ id, category, confidence: number | null, assignedBy: string, createdAt: string }>` ordered newest-first. Existing fields byte-compatible (Sprint-3 tests unaffected).
- **D27 — L010 DILG package = single JSON attachment.** No zip dependency exists in the repo (Reality Note 9); INTERCHANGE-SPEC sets the single-JSON precedent. `POST /api/likha/export-dilg` responds `Content-Type: application/json`, `Content-Disposition: attachment; filename="likha-dilg-mc-2026-041-<YYYY-MM-DD>.json"` with `{ manifest: { submission: 'DILG MC 2026-041', module: 'likha', platform: 'pillar-pilot', exportedAt, exportedById, recordCount }, records: [{ ordinanceNumber, seriesYear, title, status, subjectTags, fileHash, sourceRecordId, dilgSubmittedAt }] }`. On success the included rows get `dilg_submitted = 1`, `dilg_submitted_at = datetime('now')` (SPRINT_PLAN: "sets `dilg_submitted` markers") and the export is logged (`likha_export_dilg`). NOTE: the manifest carries `exportedById` only — no users-table join for LGU metadata (keeps the builder DB-surface at the two LIKHA tables; boundary-safe).
- **D28 — L1 package hash payload = `{ records }` only.** INTERCHANGE-SPEC §6 canonicalPayload is `{ records, relationships? }`; LIKHA omits relationships (§2), so the LIKHA canonical payload is exactly the canonical JSON of `{ records }`: object keys sorted lexicographically, no insignificant whitespace, implemented in one recursive `canonicalJson(value)` function. `packageHash = 'sha256:' + sha256Hex(canonicalPayload)`. Tests MUST recompute the hash from the emitted payload (round-trip) — never trust the emitted hash string alone.
- **D29 — Manifest constants.** `exporter.platform = 'pillar-pilot'`, `exporter.appVersion` read from `package.json` `version` at build time (currently `'1.0.0'`), `schemaVersion = '1.0.0'`, `interchangeLevel = 'L1'`, `module = 'likha'`, `source.table = 'archived_ordinances'`. `exportedAt = new Date().toISOString()` (ISO-8601 UTC). Empty export `yearRange`: `[]` (no records → no years; flagged for SPRINT_REVIEW).
- **D30 — Commit seam.** Three commits, each compiling and tests-green: the L007 commit carries types + harness + prompt/parser + agent-4 wiring + classify routes + `archive/[id]` classifications + classification-editor + page wiring (editor tab, real agent 4, classification gate) + all L007 tests. The L010 commit carries `src/lib/likha/export.ts` **complete** (DILG builder + L1 builder + canonical JSON — the shared builder module lands whole with its first consumer, same as Sprint-1 kit precedent), the `export-dilg` route, its unit test, and the additive `[ Export DILG Package ]` toolbar edit to `page.tsx`. The L013 commit carries the `export-package` route + L1 unit tests + the API-level export suite (covers BOTH export routes). `page.tsx` therefore appears in the L007 AND L010 commits (additive second edit). Test scripts in `package.json` reference every new test file and are staged in the L007 commit (all referenced files exist by gate time — S3 D20 precedent).
- **D31 — Test script extension.** `"test"` gains `tests/unit/likha-classify.test.ts tests/unit/likha-export-dilg.test.ts tests/unit/likha-export-l1.test.ts tests/integration/likha-classification.test.ts` (all hermetic); `"test:integration"` gains `tests/integration/likha-classify-api.test.ts tests/integration/likha-exports.test.ts` (API-level vs the dev server). All Sprint-2/3 entries stay byte-identical.
- **D32 — No real OpenRouter calls asserted in automated tests.** Same posture as Sprints 2–3: hermetic tests inject the `classify` DI seam and unit-test the parser; model output content is NEVER asserted. The DI seam cannot be injected over HTTP, so the API-level classify tests assert contract only (status codes, envelopes, persistence shape, audit rows) against the dev server. If the dev environment has no usable OpenRouter key, the classify happy-path subtest follows the documented fallback in S4-C8 (assert the 401/400/404/override behaviors plus a structured non-crashing response for the happy path); pilot classification accuracy stays a SYSTEM_TEST concern (SPRINT_PLAN risk 7).

---

## Chunk Dependency Graph

```
GROUP-A (parallel)                 GROUP-B (parallel)                    GROUP-C (parallel)              GROUP-D        GROUP-E        GROUP-F
──────────────────                 ─────────────────────────────         ──────────────────────────      ───────        ───────        ───────
S4-C1 types extension ────────────► S4-C3 classify prompt + parser ────► S4-C6 L007 server wiring ─────►┐
S4-C2 harness extension ──────────►   + unit tests (hermetic)              (agents.ts real agent 4,      ├► S4-C8 ────► S4-C9 ───────► S4-C10
                                   S4-C4 export.ts DILG builder ────────►    classify routes, [id] GET   │  (export      (page wiring:  (gate,
                                   S4-C5 classification-editor.tsx          ext., hermetic tests)        │   routes +    agent 4 real,  regression,
                                     (contract pinned by C1)             S4-C7 L013 builder (export.ts    │   API-level   editor tab,    commits)
                                                                            canonical JSON + hash + unit   │   tests, all  export DILG
                                                                            tests) ───────────────────────►┘   3 routes)   button)
```

| Chunk | Feature | Dependencies | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S4-C1 | L007+L010+L013 (shared types) | Sprint 3 only | none | **GROUP-A** |
| S4-C2 | test harness extension (scripts + helpers) | Sprint 3 only | none | **GROUP-A** |
| S4-C3 | **L007** classification prompt + parser + hermetic unit tests | S4-C1 | prompts.ts only | **GROUP-B** |
| S4-C4 | **L010** export.ts DILG builder + hermetic unit tests | S4-C1 | export.ts (created) | **GROUP-B** |
| S4-C5 | **L007** classification-editor.tsx (contract pinned by C1) | S4-C1 | none | **GROUP-B** |
| S4-C6 | **L007** server: real agent 4 in runner, classify POST + override PUT routes, `[id]` GET classifications, hermetic tests | S4-C3 | agents.ts, archive/[id]/route.ts | **GROUP-C** |
| S4-C7 | **L013** export.ts L1 builder (canonical JSON + SHA-256 + manifest/record mapping) + hermetic unit tests incl. hash round-trip | S4-C4 | export.ts (extends) | **GROUP-C** |
| S4-C8 | **L010+L013** export routes + API-level suites for ALL three routes (auth 401, empty selection, 409, hash round-trip over HTTP) | S4-C6, S4-C7 | none new | **GROUP-D** |
| S4-C9 | page wiring: real agent 4, classification HITL gate, editor tab, Export DILG button | S4-C5, S4-C6, S4-C8 | page.tsx only | **GROUP-E** |
| S4-C10 | gate | ALL | n/a | **GROUP-F** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`, zero shared state). Commits are taken in the final gate (S4-C10) with explicit per-feature staging lists (decision D30). When in doubt, execute sequentially.

---

## Chunks

---

### S4-C1 — `src/types/likha.ts`: Sprint-4 contract extensions (additive)

```json
{
  "chunk_id": "S4-C1",
  "feature_id": "L007+L010+L013 (shared module types)",
  "chunk_type": "setup",
  "name": "Classification taxonomy + suggestion/entry/route contracts, DILG package shape, L1 interchange shapes verbatim per INTERCHANGE-SPEC, additive fields on LikhaPipelineFileResult + LikhaRecordDetailResponse",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/likha.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT `src/types/likha.ts` ADDITIVELY — every existing line stays byte-identical except exactly TWO inline additive fields (listed in (a) and (b)). Do not modify or delete anything else; append the block in (c) at the end of the file. The file must keep compiling under `strict: true`, keep zero runtime imports besides the existing `LIKHA_AGENT_DEFS` const + the new consts, and contain the token `linaw` ZERO times.

**(a) Inside the EXISTING `LikhaPipelineFileResult` interface, add one optional field** (after `validation?`):

```ts
  /** Agent 4 (Subject Classifier) result — Sprint 4. Present once classification ran. */
  classification?: LikhaClassificationResult;
```

**(b) Inside the EXISTING `LikhaRecordDetailResponse` interface, add one optional field:**

```ts
  /** Classifications with provenance (Sprint 4, L007 — PRD §12.6 'ordinance detail + classifications'). */
  classifications?: LikhaClassificationEntry[];
```

**(c) APPEND this block at the end of the file:**

```ts
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
    platform: 'pillar-pilot';
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
    platform: 'pillar-pilot';
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
```

**acceptance_criteria:**

1. File compiles under `strict: true`; all existing Sprint-2/3 exports byte-identical; new exports present: `LIKHA_CODE_TITLES` (13 entries), `LIKHA_CLASSIFICATION_LABELS` (25 entries), `LikhaClassificationSuggestion`, `LikhaClassificationResult`, `LikhaClassificationEntry`, `LikhaClassifyRequest/Response/ResultItem`, `LikhaClassificationOverrideRequest/Response`, `LikhaInterchangeRecord/Manifest/Package`, `LikhaExportRequest`, `LikhaDilgPackage`.
2. `LikhaPipelineFileResult` and `LikhaRecordDetailResponse` gain ONLY the optional fields above (Sprint-2/3 tests stay green).
3. INTERCHANGE-SPEC shapes verbatim (field names + nullability exactly per §3/§4); no `relationships` key anywhere; zero `linaw` tokens; no new runtime imports.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "LIKHA_CODE_TITLES" src/types/likha.ts && grep -c "LikhaInterchangePackage" src/types/likha.ts && grep -c "LikhaDilgPackage" src/types/likha.ts
# expected: >= 2, >= 1, >= 1

grep -c "Title XIII" src/types/likha.ts
# expected: 1  (13th Code Title present)

git diff --unified=0 -- src/types/likha.ts | grep -c '^-[^-]'
# expected: 0  (append-only + the two additive interface fields; no removed lines)

grep -ic "linaw\|relationships" src/types/likha.ts
# expected: 0  (no LINAW, no relationships key)
```

---

### S4-C2 — Harness extension: test scripts + helper additions

```json
{
  "chunk_id": "S4-C2",
  "feature_id": "test harness (supports L007, L010, L013)",
  "chunk_type": "setup",
  "name": "package.json script extension (decision D31) + helper: seedPublishedRecord (published-row seeder for classification + export tests)",
  "file_outputs": ["package.json", "tests/helpers/likha-test-util.ts"],
  "tdd_steps": [],
  "dependencies": [],
  "parallel_group": "GROUP-A",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Two additive edits (decision D31). No existing line modified or removed except the two script values (replaced wholesale, keeping every Sprint-2/3 test file in the lists).

**(a) `package.json`** — replace ONLY the two test scripts with:

```json
"test": "tsx --test tests/unit/likha-ocr.test.ts tests/unit/likha-search.test.ts tests/unit/likha-classify.test.ts tests/unit/likha-export-dilg.test.ts tests/unit/likha-export-l1.test.ts tests/integration/likha-metadata.test.ts tests/integration/likha-verification.test.ts tests/integration/likha-publish.test.ts tests/integration/likha-classification.test.ts",
"test:integration": "tsx --test tests/integration/likha-upload.test.ts tests/integration/likha-archive.test.ts tests/integration/likha-classify-api.test.ts tests/integration/likha-exports.test.ts"
```

(The new files land in S4-C3/C4/C6/C7/C8 — until then run the individual existing files directly. All other scripts byte-identical.)

**(b) `tests/helpers/likha-test-util.ts`** — APPEND one export (existing code untouched; keep relative/Node-built-in imports only):

```ts
/**
 * Inserts one archived_ordinances row in archive_status='published' with
 * realistic Sprint-3-shaped fields (subject_tags JSON, summary, file_hash,
 * verified_by_id) directly into the DB handle the CALLER passes. Returns the
 * new record id. Sprint 4 exports (L010/L013) and classification tests seed
 * published rows with this.
 */
export function seedPublishedRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    summary?: string | null;
    subjectTags?: string[];
    status?: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
    sourceType?: string;
    fileHash?: string | null;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO archived_ordinances
       (id, ordinance_number, series_year, title, content, summary, section_count,
        subject_tags, status, source_type, original_filename, scan_file_path, file_hash,
        archive_status, extraction_confidence, uploaded_by_id, verified_by_id)
     VALUES (?, ?, ?, ?, ?, ?, 8, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`
  ).run(
    id,
    overrides?.ordinanceNumber ?? 12,
    overrides?.seriesYear ?? 2019,
    overrides?.title ?? 'An ordinance regulating the operation of tricycles for hire',
    overrides?.content ?? 'Section 1. Title. This ordinance regulates tricycle franchises and fares.',
    overrides?.summary === undefined ? 'Regulates tricycle franchises and fares.' : overrides.summary,
    JSON.stringify(overrides?.subjectTags ?? []),
    overrides?.status ?? 'active',
    overrides?.sourceType ?? 'scan',
    'ord-12-s2019.pdf',
    'data/uploads/likha/' + id + '__ord-12-s2019.pdf',
    overrides?.fileHash === undefined ? 'cafebabe'.repeat(8) : overrides.fileHash,
    JSON.stringify({ ordinanceNumber: 0.95, seriesYear: 0.95, title: 0.9, sectionCount: 0.9 }),
    userId,
    userId
  );
  return id;
}
```

**acceptance_criteria:**

1. Both scripts valid; every Sprint-2/3 test file still listed; new entries exactly per (a).
2. Helper compiles under `strict: true`, relative imports only, zero `linaw` tokens; `seedPublishedRecord` matches the REAL `archived_ordinances` schema (columns verified against `src/lib/db.ts`).

**verification_commands:**

```bash
node -e "const p=require('./package.json'); const ok=p.scripts.test.includes('likha-classify.test.ts')&&p.scripts.test.includes('likha-export-dilg')&&p.scripts.test.includes('likha-export-l1')&&p.scripts.test.includes('likha-classification.test.ts')&&p.scripts.test.includes('likha-ocr')&&p.scripts.test.includes('likha-search')&&p.scripts.test.includes('likha-metadata')&&p.scripts.test.includes('likha-verification')&&p.scripts.test.includes('likha-publish')&&p.scripts['test:integration'].includes('likha-upload')&&p.scripts['test:integration'].includes('likha-archive')&&p.scripts['test:integration'].includes('likha-classify-api')&&p.scripts['test:integration'].includes('likha-exports'); console.log(ok?'SCRIPTS OK':'SCRIPTS BAD')"
# expected: SCRIPTS OK

npx tsc --noEmit
# expected: no output, exit code 0

grep -c "seedPublishedRecord" tests/helpers/likha-test-util.ts
# expected: >= 1

grep -ic "linaw" tests/helpers/likha-test-util.ts
# expected: 0
```

---

### S4-C3 — L007 classification prompt + parser in `src/lib/likha/prompts.ts` + hermetic unit tests (TDD)

```json
{
  "chunk_id": "S4-C3",
  "feature_id": "L007",
  "chunk_type": "library",
  "name": "Classification prompt (Code Titles/Chapters taxonomy + LIKHA subjects union) + never-throws parser (clamp, taxonomy filter, dedupe, cap-5) + hermetic unit suite",
  "file_outputs": ["src/lib/likha/prompts.ts", "tests/unit/likha-classify.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "dependencies": ["S4-C1"],
  "parallel_group": "GROUP-B",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Extend `src/lib/likha/prompts.ts` with the L007 classification prompt + parser, following the EXACT precedent of the metadata prompt/parser already in that file (strict-JSON system prompt, 12,000-char truncating user prompt builder, a parser that NEVER throws). TDD.

**RED — write the failing test FIRST:** `tests/unit/likha-classify.test.ts` (`node:test`, `node:assert/strict`, relative import `../../src/lib/likha/prompts` + `../../src/types/likha` — NO `@/` alias, NO DB, fully hermetic). Subtests:

1. **parses a clean strict-JSON response:** input `[{"label":"Title III - Taxation & Fiscal Affairs","confidence":0.88},{"label":"Taxation & Revenue","confidence":0.73}]` (bare array, no fences) → both suggestions returned with labels intact and confidences as given.
2. **strips markdown fences + prose:** input `Here you go:\n\`\`\`json\n[…same array…]\n\`\`\`\nHope that helps` → parses the array inside the fences.
3. **clamps confidence to [0,1]:** entries with confidence `1.7`, `-0.4`, `"0.5"` (string), `null` → clamped to `1`, `0`, `0.5`, `0` respectively.
4. **filters labels outside the legal space (decision D21):** an entry `{"label":"Aerospace & Orbital Mechanics","confidence":0.9}` is dropped; entries whose labels are in `LIKHA_CODE_TITLES` OR `LIKHA_SUBJECTS` are kept; label match is exact (case-sensitive).
5. **never throws on garbage:** each of `''`, `'no json here'`, `'{not an array}'`, `'null'`, `'[{"label": 5}]'` → returns `[]` (empty array), no exception.
6. **deduplicates:** two entries with the same label → keep the FIRST occurrence only.
7. **caps the result set:** 40 valid entries → returns at most 5 (the top-5 by confidence, original confidence order stable for ties).
8. **prompt builder contract:** `buildClassificationUserPrompt(rawText, title)` truncates `rawText` to 12,000 chars, includes the title, and mentions the strict-JSON-array requirement; `CLASSIFICATION_SYSTEM_PROMPT` names at least 3 Code Titles and 3 LIKHA subjects (so the taxonomy is visible to the model) and demands ONLY a JSON array of `{label, confidence}`.

**GREEN — implement** in `src/lib/likha/prompts.ts` (append; existing metadata prompt code byte-identical):

```ts
export const CLASSIFICATION_SYSTEM_PROMPT: string;
export function buildClassificationUserPrompt(rawText: string, title: string): string;
export function parseClassificationResponse(llmText: string): Array<{ label: string; confidence: number }>;
```

Rules: system prompt — "You are a legislative classification engine for Philippine LGU ordinances. Classify the ordinance against the Code Titles/Chapters taxonomy and LIKHA subject categories. Return ONLY a JSON array — no prose, no markdown fences — of 1–5 objects shaped {\"label\": string, \"confidence\": number} sorted by confidence descending. Labels MUST be chosen exactly from: <list every LIKHA_CODE_TITLES entry, then every LIKHA_SUBJECTS entry, pipe-separated>. Confidence values are 0–1 self-estimates." (Embed the union by importing `LIKHA_CODE_TITLES`/`LIKHA_SUBJECTS` from `@/types/likha` — types-only import stays valid since these are consts.) User prompt — `'Ordinance title: ' + title + '\n\nTranscribed ordinance text:\n\n' + rawText.slice(0, 12_000) + '\n\nReturn ONLY the JSON array described in the system instructions — no prose, no markdown fences.'`. Parser — strip fences, find first `[` and last `]` (return `[]` if absent/malformed), `JSON.parse`, keep only array entries that are objects with a string `label` ∈ `LIKHA_CLASSIFICATION_LABELS` and numeric-coercible confidence, clamp to [0,1], dedupe by label (first wins), sort by confidence desc, slice to 5. NEVER throw.

**REFACTOR:** shared clamp/dedupe helpers local to the file; zero `linaw` tokens; the metadata parser remains untouched and its tests green.

**acceptance_criteria:**

1. All 8 subtests pass: `npx tsx --test tests/unit/likha-classify.test.ts` exit 0.
2. Parser output labels are always ∈ `LIKHA_CLASSIFICATION_LABELS`; result length ≤ 5; parser never throws (test 5 proves it).
3. Sprint-2/3 hermetic suites still green (metadata prompt untouched).

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "CLASSIFICATION_SYSTEM_PROMPT\|buildClassificationUserPrompt\|parseClassificationResponse" src/lib/likha/prompts.ts
# expected: >= 3

grep -c "LIKHA_CLASSIFICATION_LABELS\|LIKHA_CODE_TITLES" src/lib/likha/prompts.ts
# expected: >= 1

grep -ic "linaw" src/lib/likha/prompts.ts tests/unit/likha-classify.test.ts
# expected: 0 and 0

npx tsx --test tests/unit/likha-classify.test.ts tests/integration/likha-metadata.test.ts
# expected: ALL subtests pass (new suite + Sprint-2 regression), exit code 0
```

---

### S4-C4 — L010 DILG builder in `src/lib/likha/export.ts` + hermetic unit tests (TDD)

```json
{
  "chunk_id": "S4-C4",
  "feature_id": "L010",
  "chunk_type": "library",
  "name": "export.ts created: published-only row loader + eligibility + DILG MC 2026-041 builder (decision D27, dilg_submitted markers) + hermetic unit suite",
  "file_outputs": ["src/lib/likha/export.ts", "tests/unit/likha-export-dilg.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "dependencies": ["S4-C1"],
  "parallel_group": "GROUP-B",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

CREATE `src/lib/likha/export.ts` — the module's export builder library (SPRINT_PLAN: "src/lib/likha/export.ts owns the builder"). This chunk implements the DILG builder + the shared row-loading/eligibility layer; S4-C7 appends the L1 builder + canonical JSON into the SAME file. TDD. Imports allowed: `node:crypto`, `@/lib/db`, `@/types/likha` ONLY. The file may read ONLY the tables `archived_ordinances` and `classifications` (grep-enforced at the gate).

**RED — write the failing test FIRST:** `tests/unit/likha-export-dilg.test.ts` (`node:test`, relative imports; hermetic: `process.env.DB_PATH = tempDbPath()` BEFORE `await import('../../src/lib/db')`, then dynamic-import `../../src/lib/likha/export`; seed a `users` row + use `seedPublishedRecord` from the helper; clean up the temp DB in `t.after`). Subtests:

1. **selects published only:** seed 2 `published` rows (years 2019 + 2023, one with `subject_tags ['Taxation & Revenue']`, one `status:'amended'`) + 1 `pending_review` row (via `seedPendingReviewRecord`) + 1 `flagged` row → `buildDilgPackage({ userId, db })` (no `recordIds`) returns `manifest.recordCount === 2` and ONLY the published rows in `records` (sorted `series_year ASC, ordinance_number ASC` — chronological submission order).
2. **record shape (decision D27):** every record has exactly `{ ordinanceNumber, seriesYear, title, status, subjectTags, fileHash, sourceRecordId, dilgSubmittedAt }`; `subjectTags` is the UNION of the row's `subject_tags` JSON and its `classifications` rows' categories (seed one `classifications` row `category='Title III - Taxation & Fiscal Affairs', assigned_by='ai', confidence=0.8` for one record and assert both labels present, deduplicated); `fileHash` carries the row's `file_hash`; `sourceRecordId` = row id.
3. **manifest shape:** `{ submission: 'DILG MC 2026-041', module: 'likha', platform: 'pillar-pilot', exportedAt: <ISO-8601 parseable>, exportedById: userId, recordCount }`.
4. **recordIds filter + eligibility:** `buildDilgPackage({ userId, db, recordIds: [pubId1] })` → 1 record; a recordIds list containing the pending_review id → throws/returns the ineligible outcome naming that id (builder outcome type — see GREEN).
5. **empty selection:** `recordIds: []` → valid package, `recordCount === 0`, `records: []`.
6. **marks submission:** after `buildDilgPackage` succeeds over the 2 published rows, BOTH rows have `dilg_submitted = 1` and non-null `dilg_submitted_at` in the DB; the pending/flagged rows stay `dilg_submitted = 0`. Each record's `dilgSubmittedAt` equals the timestamp written.

**GREEN — implement** in `src/lib/likha/export.ts`:

```ts
export type LikhaExportOutcome<T> =
  | { ok: true; payload: T }
  | { ok: false; kind: 'ineligible'; ineligibleIds: string[]; error: string };

export interface BuildExportParams {
  userId: string;
  /** When omitted → all published rows. Empty array → zero-record package (decision D23). */
  recordIds?: string[];
  /** DI for tests; default getDb(). */
  db?: import('better-sqlite3').Database;
  /** DI for tests; default new Date().toISOString(). */
  now?: () => string;
}

export function loadExportableRows(params: BuildExportParams):
  { rows: PublishedRow[] } | { ineligibleIds: string[] };

export function buildDilgPackage(params: BuildExportParams): LikhaExportOutcome<LikhaDilgPackage>;
```

Logic: `loadExportableRows` — if `recordIds` omitted: `SELECT … FROM archived_ordinances WHERE archive_status = 'published' ORDER BY series_year ASC, ordinance_number ASC`; otherwise SELECT by id list and verify EACH id exists AND is `archive_status='published'` — any failure collects into `ineligibleIds` (no partial results). Shared `subjectTagsFor(rowId)` helper: parse the row's `subject_tags` JSON defensively + `SELECT category FROM classifications WHERE ordinance_id = ?` → union, dedupe, preserve order (tags first, classifications appended). `buildDilgPackage` — build the `LikhaDilgPackage` per decision D27; BEFORE returning, inside one `db.transaction`: `UPDATE archived_ordinances SET dilg_submitted = 1, dilg_submitted_at = <now()> WHERE id = ?` for each included row. `now()` DI default `() => new Date().toISOString()`; pass the SAME timestamp to `manifest.exportedAt` and every record's `dilgSubmittedAt` + the DB update. NO logging inside the builder (routes log — S4-C8).

**REFACTOR:** keep `loadExportableRows` + `subjectTagsFor` ready for S4-C7's L1 builder; zero `linaw` tokens; no table besides `archived_ordinances`/`classifications` appears in any SQL string.

**acceptance_criteria:**

1. All 6 subtests pass: `npx tsx --test tests/unit/likha-export-dilg.test.ts` exit 0.
2. DILG package shape exactly per decision D27; published-only + sorted + marked; eligibility refusal lists offending ids.
3. Builder is pure of logging/auth concerns; DI seams make it fully hermetic.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "buildDilgPackage\|loadExportableRows" src/lib/likha/export.ts
# expected: >= 2 each (>= 4 total)

grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" src/lib/likha/export.ts
# expected: no output, exit code 1

grep -REn "(FROM|INTO|UPDATE)[[:space:]]+[a-z_]+" src/lib/likha/export.ts | grep -vE "archived_ordinances|classifications"
# expected: no output, exit code 1 (ONLY the two LIKHA tables)

grep -ic "linaw" src/lib/likha/export.ts tests/unit/likha-export-dilg.test.ts
# expected: 0 and 0

npx tsx --test tests/unit/likha-export-dilg.test.ts
# expected: all subtests pass, exit code 0
```

---

### S4-C5 — L007 UI: `src/components/likha/classification-editor.tsx`

```json
{
  "chunk_id": "S4-C5",
  "feature_id": "L007",
  "chunk_type": "frontend_component",
  "name": "Classification tab editor — record queue, select + Run Classification, suggestions with confidence bars, rose <0.6 override treatment, override multi-select, provenance (AI vs user)",
  "file_outputs": ["src/components/likha/classification-editor.tsx"],
  "tdd_steps": [],
  "dependencies": ["S4-C1"],
  "parallel_group": "GROUP-B",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/likha/classification-editor.tsx` (`'use client';`) — the real Classification tab content (replaces the Sprint-3 stub when wired in S4-C9). Allowed imports: `react`, `lucide-react` (`Tags`, `Sparkles`, `Check`, `Loader2`, `AlertTriangle`, `UserRound`, `Bot`), `@/lib/utils` (`cn`), types + `LIKHA_SUBJECTS` + `LIKHA_CODE_TITLES` from `@/types/likha`. NO server imports (`@/lib/db`, `@/lib/likha/*`, `@/app/api` forbidden), NO kit modifications. Response shapes are pinned by S4-C1 types (`LikhaArchiveSearchResponse`, `LikhaClassifyResponse`, `LikhaClassificationEntry`, `LikhaRecordDetailResponse`) — code against them; the routes land in S4-C6/C8.

Props: `{ className?: string }`. Behavior contract:

1. **Record queue load (on mount + refresh):** GET `/api/likha/archive?archiveStatus=published&limit=50` AND GET `/api/likha/archive?archiveStatus=pending_review&limit=50` (two fetches, results concatenated, `pending_review` first). One row per record: checkbox (selection), `Ordinance No. <n>, S. <year>` (ui-monospace), title (one line, truncated), archive-status badge (`PUBLISHED` green / `PENDING REVIEW` yellow). States: loading (muted "Loading records…"), empty ("No records to classify yet — publish records first."), error (rose inline + retry button).
2. **Selection toolbar:** `[ Select all ]` / `[ Clear ]` + live count "N selected" + `[ Run Classification ]` button (accent `#0038A8`, white text, `Sparkles` icon, min-h-11, disabled when 0 selected or a run is in flight; `Loader2` while in flight).
3. **Run Classification:** POST `/api/likha/classify` with `{ ordinanceIds: <selected ids> }`; 200 → merge `results` into the per-record panels; 400 → rose inline error from `error`; 401 → "Session expired — reload and sign in."; 500 → rose inline "Classification failed — try again."
4. **Per-record suggestion panel (opens inline under each classified row):** for each suggestion: label + confidence bar (`width: confidence*100%`, cyan `#22D3EE` fill on `#1E293B` track) + numeric `0.XX`; when `hitlRequired === true` (low confidence) render the panel with a rose left border + `AlertTriangle` note "Confidence below 0.6 — human override required (SB Secretary / Legal Officer)". Provenance line per persisted classification (from GET `/api/likha/archive/<id>` `classifications`): `Bot` icon + "AI — confidence 0.XX" when `assignedBy === 'ai'`, else `UserRound` icon + "Override by <assignedBy first 8 chars>…".
5. **Override UI (PRD feature 7 — admin override):** a multi-select (checkboxes grouped under headings "Code Titles" = `LIKHA_CODE_TITLES` and "Subject categories" = `LIKHA_SUBJECTS`) + `[ Apply Override ]` button (gray `#334155`, min-h-11, disabled until ≥1 category chosen) → PUT `/api/likha/classify/<recordId>` `{ categories }`; 200 → refetch that record's classifications, show confirmed state (green `Check` pill "Override saved"); 400/404/409 → rose inline error from the server `error`.
6. **Accessibility + styling:** every interactive element min-h-11; keyboard operable (native checkboxes/buttons); dark tokens (`#1E293B` cards, `#283147` borders, `#94A3B8` muted, rose `#F43F5E` for the low-confidence treatment); wraps cleanly at 360px; zero `linaw` tokens; self-contained `useState`/`useEffect` state.

Export `export default function ClassificationEditor(props: { className?: string })`.

**acceptance_criteria:**

1. Component compiles under `strict: true`, is `'use client'`, implements the queue → select → run → suggestions/confidence → override → provenance loop with the exact route contracts.
2. Low-confidence (<0.6) treatment is rose and names the gate role; provenance distinguishes `ai` vs user-id rows; override targets PUT `/api/likha/classify/[id]`.
3. No server-only imports; no kit edits; no export buttons in this component (the Export DILG button lives on the page — S4-C9).

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "'use client'" src/components/likha/classification-editor.tsx
# expected: 1

grep -REn "from ['\"]@/(lib/db|lib/likha|app/api)" src/components/likha/classification-editor.tsx
# expected: no output, exit code 1 (client component — no server imports)

grep -c "/api/likha/classify" src/components/likha/classification-editor.tsx && grep -c "0.6" src/components/likha/classification-editor.tsx && grep -c "LIKHA_CODE_TITLES" src/components/likha/classification-editor.tsx
# expected: >= 2, >= 1, >= 1

grep -ic "linaw" src/components/likha/classification-editor.tsx
# expected: 0
```

---

### S4-C6 — L007 server: real agent 4 in the runner + classify/override routes + `[id]` GET classifications + hermetic tests (TDD)

```json
{
  "chunk_id": "S4-C6",
  "feature_id": "L007",
  "chunk_type": "library + api_route",
  "name": "Real agent 4 in the runner (LLM default, classifications persistence, low_confidence_classification gate, s3-passthrough removed) + classifyLikhaRecords engine + classify POST + override PUT routes + archive/[id] GET classifications + hermetic suite",
  "file_outputs": ["src/lib/likha/agents.ts", "src/app/api/likha/classify/route.ts", "src/app/api/likha/classify/[id]/route.ts", "src/app/api/likha/archive/[id]/route.ts", "tests/integration/likha-classification.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "dependencies": ["S4-C3"],
  "parallel_group": "GROUP-C",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement the L007 SERVER side with TDD: agent 4 (Subject Classifier, 1200ms slot) becomes REAL in the pipeline runner (replacing the Sprint-3 pass-through — decision D24), `POST /api/likha/classify` runs the same classification over existing records, `PUT /api/likha/classify/[id]` persists admin overrides, and `GET /api/likha/archive/[id]` returns classifications. All classification decisions (AI + overrides) audit to `agent_decisions`.

**RED — write the failing test FIRST:** `tests/integration/likha-classification.test.ts` (`node:test`, relative imports; hermetic: `process.env.DB_PATH = tempDbPath()` + `process.env.LIKHA_SEARCH_INDEX_PATH = tempIndexPath()` BEFORE dynamic imports of `../../src/lib/db` and `../../src/lib/likha/agents`; seed one approved `users` row like `likha-publish.test.ts` does). Subtests:

1. **Runner agent 4 persists AI classifications + gate fires:** seed 2 `'processing'` rows (`scan_file_path='tests/fixtures/likha/sample-ordinance.pdf'`); `runLikhaPipeline({ pipelineId: 'p4', userId, files, ocr: stubOcr, extractMetadata: stubMeta, classify: async () => [{label:'Taxation & Revenue', confidence:0.42}] })`. Assert: each file result carries `classification.hitlRequired === true` with `gate === 'low_confidence_classification'`; `classifications` table has one row per suggestion per record with `assigned_by='ai'`, `confidence=0.42`, valid FK `ordinance_id`; `agent_decisions` for `pipeline_id='p4'` contains agent-4 rows: `start` (snapshot contains `"mode":"s4-stub"` when the seam is injected) + `complete` (snapshot contains the subjects) + an `action='hitl'` row whose `reason` contains `low_confidence_classification`; rows still end `archive_status='pending_review'`.
2. **Runner gate silent above threshold:** same with `classify` stub returning confidence `0.81` → `classification.hitlRequired === false`, NO agent-4 `'hitl'` rows, classifications persisted. Empty suggestions (`[]`) → gate fires ("no suggestion" case).
3. **`classifyLikhaRecords` standalone (the classify route's engine):** seed one `published` + one `pending_review` + one `flagged` row (helpers) + pass one unknown id; call the exported `classifyLikhaRecords({ recordIds: [pubId, pendId, flagId, 'missing'], userId, pipelineId: 'cls-1', db, classify: stubHigh })`. Assert: `classified === 2` (published + pending_review), `skipped` contains the flagged id (`reason` starts `'not_classifiable'`) and the unknown id (`reason === 'not_found'`); `results` entries carry `ordinanceNumber/seriesYear/suggestions/hitlRequired`; classifications persisted with `assigned_by='ai'`; agent-4 `start`+`complete` audit rows exist for `pipeline_id='cls-1'`. Re-classifying the same record REPLACES its `assigned_by='ai'` rows (no duplicates accumulate for AI provenance).
4. **Override persists with user provenance (decision D25):** `applyClassificationOverride({ recordId: pubId, userId, categories: ['Title III - Taxation & Fiscal Affairs', 'Taxation & Revenue'], db })` → ok; `classifications` for the record now EXACTLY those 2 rows with `assigned_by = userId`, `confidence IS NULL` (previous AI rows deleted); audit row `module='likha'`, `agent_id=4`, `agent_name='Subject Classifier'`, `action='confirm'`, `reason='override'`, `user_id=userId`, snapshot containing both categories. Invalid category (outside the union) → invalid outcome; empty categories → invalid; unknown record → not_found; `processing` record → conflict. A later AI re-classification run must NOT delete override rows (it replaces only `assigned_by='ai'` rows).
5. **Logging:** after subtests 3+4, `interaction_logs` has ≥1 row `module='likha'`, `interaction_type='likha_classify'` and ≥1 `interaction_type='likha_classification_override'`.

**GREEN — implement** in this order:

**(a) `src/lib/likha/agents.ts` — agent 4 completion (Sprint-3 behavior preserved otherwise; `likha-metadata.test.ts` + `likha-verification.test.ts` MUST stay green):**
- Imports: add `CLASSIFICATION_SYSTEM_PROMPT`, `buildClassificationUserPrompt`, `parseClassificationResponse` from `@/lib/likha/prompts`; add `LikhaClassificationResult`, `LikhaClassifyResponse` etc. from `@/types/likha` as needed.
- In `runLikhaPipeline`, replace the pass-through default: `const classify = opts.classify ?? (async (input) => parseClassificationResponse(await chatCompletion(CLASSIFICATION_SYSTEM_PROMPT, buildClassificationUserPrompt(input.rawText, input.title), { temperature: 0, maxTokens: 1024 })));`. Keep the seam (tests inject stubs).
- Agent-4 block in the per-file loop becomes: `start` row (`input_snapshot` `{recordId, mode: opts.classify ? 's4-stub' : 's4-llm'}`) → `await classify(…)` → **persist** every suggestion: DELETE existing `classifications` rows for the record `WHERE assigned_by = 'ai'` then INSERT one row per suggestion `(crypto.randomUUID(), recordId, label, confidence, 'ai')` (single `db.transaction`) → compute gate: `hitlRequired = subjects.length === 0 || Math.max(...confidences) < 0.6` → `complete` row (`output_snapshot` `JSON.stringify({ mode, subjects })`, `confidence` = max confidence or null) → when `hitlRequired` an `action='hitl'` row (`reason: 'low_confidence_classification: ' + (subjects.length === 0 ? 'no suggestions' : 'max confidence < 0.6')`). Attach `classification: { subjects, hitlRequired, gate: hitlRequired ? 'low_confidence_classification' : undefined }` to the file result. Agent 5 code unchanged.
- NEW exported engine for the standalone route (DI-friendly, same pattern as `applyVerificationDecision`):

```ts
export function classifyLikhaRecords(params: {
  recordIds: string[];
  userId: string;
  pipelineId?: string;              // default 'classify-' + crypto.randomUUID()
  db?: import('better-sqlite3').Database;
  classify?: (input: { rawText: string; title: string }) => Promise<Array<{ label: string; confidence: number }>>;
}): Promise<LikhaClassifyResponse>;   // async — the LLM seam is awaited per record
```

Logic: load each id from `archived_ordinances`; missing → `skipped {reason:'not_found'}`; `archive_status` not in `('pending_review','published')` → `skipped {reason:'not_classifiable:' + archive_status}`; otherwise classify over `{rawText: content, title}`, persist AI rows exactly like the runner (replace only `assigned_by='ai'` rows — overrides survive), audit agent-4 start/complete (+hitl when the gate fires, using the SAME 0.6 rule), build the result item. Finally `logModuleEvent({module:'likha', interactionType:'likha_classify', content: JSON.stringify({pipelineId, classified, skipped: skipped.length}), ipAddress:'127.0.0.1', participantSessionId:'likha-'+userId})`.
- NEW exported override persistence (decision D25):

```ts
export type LikhaOverrideOutcome =
  | { ok: true; response: LikhaClassificationOverrideResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

export function applyClassificationOverride(params: {
  recordId: string;
  userId: string;
  categories: string[];
  pipelineId?: string;              // default 'override-' + recordId
  db?: import('better-sqlite3').Database;
}): LikhaOverrideOutcome;
```

Logic: missing record → `not_found`; `archive_status === 'processing'` → `conflict`; empty categories or any category ∉ `LIKHA_CLASSIFICATION_LABELS` → `invalid`. Transaction: DELETE ALL `classifications` rows for the record, INSERT one per category `(uuid, recordId, category, NULL, userId)`. Audit row: `agent_id=4, agent_name='Subject Classifier', action='confirm', reason='override', user_id=userId, output_snapshot=JSON.stringify({categories})`. `logModuleEvent({module:'likha', interactionType:'likha_classification_override', …})`.

**(b) `src/app/api/likha/classify/route.ts`** (NEW): `export const runtime = 'nodejs';` `export const POST = withUserAuth(async (request, { user }) => { … })`. Parse JSON body; missing/empty/non-array `ordinanceIds` → 400 `{ error: 'ordinanceIds must be a non-empty array', code: 'INVALID_BODY' }`. Call `classifyLikhaRecords({ recordIds, userId: user.user.id })` (real LLM default) → 200 `LikhaClassifyResponse`. Unexpected error → 500 `{ error: 'Classification failed' }`.

**(c) `src/app/api/likha/classify/[id]/route.ts`** (NEW): `PUT` with `withUserAuth` using the repo dynamic-route pattern (`const { id } = await params;`). Parse `{ categories }` (400 `INVALID_BODY` when absent/non-array). Map `applyClassificationOverride` outcomes: `not_found` → 404 `{error, code:'NOT_FOUND'}`, `invalid` → 400 `{error, code:'VALIDATION'}`, `conflict` → 409 `{error, code:'CONFLICT'}`, ok → 200 response.

**(d) `src/app/api/likha/archive/[id]/route.ts` — GET extension ONLY (decision D26):** after loading the row, `SELECT id, category, confidence, assigned_by, created_at FROM classifications WHERE ordinance_id = ? ORDER BY created_at DESC, rowid DESC` and add `classifications: entries.map(…camelCase…)` to the response object. PUT branch byte-identical. Additive imports only.

**REFACTOR:** AI-row persistence shared between runner + `classifyLikhaRecords` (one private helper `persistAiClassifications(db, recordId, subjects)`); zero `linaw` tokens; no Sprint-2/3 behavior change.

**acceptance_criteria:**

1. All 5 subtests pass hermetically: `npx tsx --test tests/integration/likha-classification.test.ts` exit 0; Sprint-2/3 hermetic suites (`likha-metadata`, `likha-verification`, `likha-publish`) still green.
2. Agent 4 is real: suggestions persisted with `assigned_by='ai'` + confidence; `low_confidence_classification` fires exactly when empty OR max confidence < 0.6 (PRD §12.4 row 2 / WORKFLOW); audit rows present for pipeline + standalone runs + overrides (including `action='hitl'`).
3. Overrides replace ALL rows for the record with `assigned_by=<user id>`, `confidence NULL`; later AI runs never touch override rows.
4. Routes: 400/404/409/200 envelopes per contract; all four handlers `withUserAuth`; `archive/[id]` GET now returns classifications newest-first.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "s3-passthrough" src/lib/likha/agents.ts
# expected: 0  (pass-through fully replaced)

grep -c "low_confidence_classification" src/lib/likha/agents.ts src/app/api/likha/classify/route.ts
# expected: >= 2, >= 0 (gate lives in agents.ts)

grep -c "withUserAuth" src/app/api/likha/classify/route.ts "src/app/api/likha/classify/[id]/route.ts"
# expected: 1 and 1

grep -c "classifications" "src/app/api/likha/archive/[id]/route.ts"
# expected: >= 2  (GET extension)

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/lib/likha src/app/api/likha
# expected: no output, exit code 1 (zero forbidden imports)

grep -REin "linaw" src/lib/likha src/app/api/likha/classify tests/integration/likha-classification.test.ts
# expected: no output, exit code 1

npx tsx --test tests/integration/likha-metadata.test.ts tests/integration/likha-verification.test.ts tests/integration/likha-publish.test.ts tests/integration/likha-classification.test.ts
# expected: ALL pass (Sprint-2/3 regression + new suite), exit code 0
```

---

### S4-C7 — L013 builder in `src/lib/likha/export.ts` (canonical JSON + SHA-256 + manifest/record mapping) + hermetic unit tests with hash round-trip (TDD)

```json
{
  "chunk_id": "S4-C7",
  "feature_id": "L013",
  "chunk_type": "library",
  "name": "L1 interchange builder appended to export.ts — canonical JSON (sorted keys, no insignificant whitespace) + SHA-256 packageHash + manifest §3 / record §4 mapping verbatim + hermetic suite with hash round-trip",
  "file_outputs": ["src/lib/likha/export.ts", "tests/unit/likha-export-l1.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "dependencies": ["S4-C4"],
  "parallel_group": "GROUP-C",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

APPEND the L1 interchange builder to `src/lib/likha/export.ts` (S4-C4 created the file with the DILG builder — keep all of it byte-identical). The builder implements docs/INTERCHANGE-SPEC.md v1.0.0 **verbatim**: §2 package `{manifest, records, packageHash}` (NO `relationships` key for LIKHA), §3 manifest, §4 LIKHA record mapping, §6 packageHash. TDD. Additive imports allowed: none beyond what S4-C4 already permits (`node:crypto`, `@/lib/db`, `@/types/likha`).

**RED — write the failing test FIRST:** `tests/unit/likha-export-l1.test.ts` (hermetic like S4-C4's suite). Subtests:

1. **canonicalJson contract:** exported `canonicalJson(value)` — object keys sorted lexicographically at EVERY depth (`{"b":1,"a":{"d":2,"c":[3,{"z":1,"a":2}]}}` → `{"a":{"c":[3,{"a":2,"z":1}],"d":2},"b":1}`); no insignificant whitespace; arrays preserve order; strings JSON-escaped (`"a\"b"` stays valid); numbers/booleans/null literal; unicode untouched.
2. **record mapping (§4 LIKHA):** seed via helper — one published row (`subjectTags ['Health & Sanitation']`, `summary 'X'`, `fileHash` set, `sourceType 'scan'`, status `active`) + one `classifications` row (`category 'Title VI - Health, Sanitation & Welfare', assigned_by='ai'`) + one published row with `summary NULL`, `file_hash NULL`. `buildInterchangePackage({ userId, db })` → records[0] `{ ordinanceNumber, seriesYear, title, content, summary: 'X', subjectTags: ['Health & Sanitation', 'Title VI - Health, Sanitation & Welfare'] (union, deduped), status: 'active', sourceType: 'scan', fileHash: <hash>, sourceRecordId: <id> }`; records[1] has `summary: null` and `fileHash: null`. Records sorted `series_year ASC, ordinance_number ASC`. NO record carries internal-only columns (no `archive_status`, no `uploaded_by_id`).
3. **manifest (§3):** `schemaVersion === '1.0.0'`, `module === 'likha'`, `interchangeLevel === 'L1'`, `exportedAt` ISO-8601 parseable, `exportedById === userId`, `source.table === 'archived_ordinances'`, `source.recordCount === records.length`, `source.yearRange` = `[min, max]` of exported series years, `exporter.platform === 'pillar-pilot'`, `exporter.appVersion === '1.0.0'` (read from package.json).
4. **packageHash (§6) + ROUND-TRIP:** `packageHash` matches `^sha256:[0-9a-f]{64}$`. ROUND-TRIP (the acceptance-critical assertion): take the RETURNED package object, rebuild `{ records: pkg.records }`, serialize with the test's OWN copy of canonical serialization (or re-call `canonicalJson`), SHA-256 it via `node:crypto`, and assert equality with `pkg.packageHash`. ALSO assert the hash does NOT change when the manifest changes (hash covers payload only): mutate a copy's `manifest.exportedAt` → recomputed hash from records still equals `packageHash`.
5. **eligibility + filter + empty:** `recordIds` containing a `pending_review` id → `ok:false, kind:'ineligible'`, `ineligibleIds` names it; `recordIds: [pubId]` → 1 record; `recordIds: []` → `records: []`, `recordCount: 0`, `yearRange: []`, and `packageHash === 'sha256:' + sha256Hex(canonicalJson({records: []}))` computed independently in the test (deterministic empty-payload hash).
6. **verbatim shape:** `Object.keys(package)` deep-equals `['manifest','records','packageHash']`; no `relationships` key; record key set equals exactly the 10 keys of INTERCHANGE-SPEC §4.

**GREEN — implement** (append to `src/lib/likha/export.ts`):

```ts
/** INTERCHANGE-SPEC §6 — canonical JSON: object keys sorted lexicographically,
 *  no insignificant whitespace. Recursive; arrays preserve order. */
export function canonicalJson(value: unknown): string;

export function buildInterchangePackage(params: BuildExportParams): LikhaExportOutcome<LikhaInterchangePackage>;
```

Logic: reuse `loadExportableRows` (published-only + eligibility) and `subjectTagsFor` (S4-C4). Record mapping per §4: `summary: row.summary` (null passthrough), `sourceType: (row.source_type as …) ?? 'scan'`, `fileHash: row.file_hash`, `sourceRecordId: row.id`, content/title/status/number/year direct. `appVersion`: `JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version` — add `node:fs` + `node:path` to the file's imports if needed. `packageHash = 'sha256:' + crypto.createHash('sha256').update(canonicalJson({ records })).digest('hex')` — payload object literal `{ records }` EXACTLY (relationships omitted per §2). `yearRange`: `[min, max]` over exported rows; `[]` when empty (decision D29). `now()` DI shared with the DILG builder.

**REFACTOR:** `canonicalJson` in one pure recursive function; zero `linaw` tokens; the DILG builder untouched.

**acceptance_criteria:**

1. All 6 subtests pass: `npx tsx --test tests/unit/likha-export-l1.test.ts` exit 0 (round-trip subtest is the gate).
2. Package shape verbatim per INTERCHANGE-SPEC §2–§4 + §6 (subtest 6 proves key sets); hash covers `{records}` only; manifest never hashed.
3. Only `archived_ordinances`/`classifications` read; builder pure of logging/auth.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "canonicalJson\|buildInterchangePackage" src/lib/likha/export.ts
# expected: >= 2 each (>= 4 total)

grep -c "sha256" src/lib/likha/export.ts
# expected: >= 2

grep -REn "(FROM|INTO|UPDATE)[[:space:]]+[a-z_]+" src/lib/likha/export.ts | grep -vE "archived_ordinances|classifications"
# expected: no output, exit code 1 (still only the two LIKHA tables)

grep -c "relationships" src/lib/likha/export.ts
# expected: 0  (the L1 test asserts the key's ABSENCE and may name it literally; the builder never does)

grep -ic "linaw" src/lib/likha/export.ts tests/unit/likha-export-l1.test.ts
# expected: 0 and 0

npx tsx --test tests/unit/likha-export-dilg.test.ts tests/unit/likha-export-l1.test.ts
# expected: ALL pass (both builder suites; hash round-trip green), exit code 0
```

---

### S4-C8 — L010 + L013 routes + API-level integration suites for ALL three routes (TDD)

```json
{
  "chunk_id": "S4-C8",
  "feature_id": "L010 + L013 (routes) + API-level coverage for L007/L010/L013",
  "chunk_type": "api_route",
  "name": "export-dilg + export-package routes (withUserAuth, attachment, logged, 400/409 envelopes) + API-level suites: auth 401, empty selection, 409 ineligible, DILG markers, L1 hash round-trip over HTTP",
  "file_outputs": ["src/app/api/likha/export-dilg/route.ts", "src/app/api/likha/export-package/route.ts", "tests/integration/likha-classify-api.test.ts", "tests/integration/likha-exports.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "dependencies": ["S4-C6", "S4-C7"],
  "parallel_group": "GROUP-D",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement the two export routes and the API-level suites. API-level tests run against the dev server (`npm run dev`) exactly like Sprint-2/3's `likha-upload.test.ts` / `likha-archive.test.ts` (helpers: `assertServerReachable`, `seedApprovedUser`, `BASE_URL`; seed rows into `data/workshop.db` via better-sqlite3; clean up in `t.after` including seeded `classifications` + `agent_decisions` rows).

**RED — write the failing tests FIRST (two files):**

**(t1) `tests/integration/likha-classify-api.test.ts`** — suite `test('likha classify api suite', …)`. Seed: approved user + 2 published rows (distinct ordinance numbers; one with a pre-seeded `classifications` row `assigned_by='ai'`), 1 pending_review row, 1 processing row (use helpers / direct SQL mirroring `likha-archive.test.ts` seeding). Subtests:
1. **auth:** POST `/api/likha/classify` and PUT `/api/likha/classify/<pubId>` without cookie → 401 `{error:'Authentication required', code:'NO_SESSION'}`.
2. **body validation:** POST with `{}` / `{ordinanceIds: []}` / `{ordinanceIds: 'x'}` → 400 `code:'INVALID_BODY'`.
3. **classify happy path (contract-level — decision D32):** POST `{ordinanceIds: [pubId, pendId, processingId, 'missing-id']}` with cookie → 200; body has `classified` (number ≥ 0), `results` (array), `skipped` (array containing the processing id with reason starting `not_classifiable` and `missing-id` with reason `not_found`). If the dev environment has NO usable LLM key the server may return 500 — in that case the test MUST record the structured failure and still assert the 401/400/404 behaviors above and below (document this fallback in a comment; pilot accuracy is SYSTEM_TEST scope). When 200: for each classified record the DB `classifications` table contains rows with `assigned_by='ai'` and `agent_decisions` has agent-4 (`agent_id=4`, `agent_name='Subject Classifier'`) rows with `module='likha'`.
4. **override round-trip over HTTP:** PUT `/api/likha/classify/<pubId>` `{categories: ['Taxation & Revenue']}` → 200 `{recordId, categories, assignedBy: userId}`; GET `/api/likha/archive/<pubId>` → `classifications` contains the override row (`assignedBy === userId`, `confidence === null`) and the pre-seeded AI row is gone (REPLACE semantics); `agent_decisions` has an `action='confirm'`, `reason='override'` row. PUT with `{categories: ['Not A Real Category']}` → 400; PUT on unknown id → 404; PUT with `{}` → 400.

**(t2) `tests/integration/likha-exports.test.ts`** — suite `test('likha exports suite', …)`. Seed: approved user + 3 published rows (years 2019/2023/2024; one with `subject_tags ['Taxation & Revenue']` + one `classifications` row `assigned_by='ai'` category `'Title III - Taxation & Fiscal Affairs'`; one `status:'amended'`), 1 pending_review row, 1 flagged row. Subtests:
1. **auth:** POST `/api/likha/export-dilg` and `/api/likha/export-package` without cookie → 401 `code:'NO_SESSION'`.
2. **DILG download (all):** POST `/api/likha/export-dilg` `{}` with cookie → 200; headers: `content-type` includes `application/json`, `content-disposition` matches `attachment; filename="likha-dilg-mc-2026-041-` prefix; body JSON: `manifest.submission === 'DILG MC 2026-041'`, `manifest.module === 'likha'`, `manifest.exportedById === userId`, `manifest.recordCount === records.length === 3` (only the published rows; pending/flagged excluded); records sorted chronologically; every record carries `sourceRecordId`/`dilgSubmittedAt`; afterwards the 3 published rows have `dilg_submitted = 1` in the DB and the pending/flagged rows stay 0; `interaction_logs` has a `module='likha'`, `interaction_type='likha_export_dilg'` row.
3. **DILG filter + eligibility + empty:** `{ordinanceIds: [pubId1]}` → 1 record; `{ordinanceIds: [pendingId]}` → **409** `code:'CONFLICT'` (error names the id) and `dilg_submitted` unchanged for everyone; `{ordinanceIds: []}` → 200 with `recordCount === 0`.
4. **L1 package verbatim + hash ROUND-TRIP over HTTP:** POST `/api/likha/export-package` `{}` → 200; `content-disposition` attachment; body keys EXACTLY `['manifest','records','packageHash']`; manifest assertions per INTERCHANGE-SPEC §3 (`schemaVersion '1.0.0'`, `module 'likha'`, `interchangeLevel 'L1'`, `source.table 'archived_ordinances'`, `source.recordCount === records.length`, `source.yearRange [2019, 2024]`, `exporter.platform 'pillar-pilot'`); each record has exactly the §4 keys; the tagged record's `subjectTags` is the union incl. the classifications label; ROUND-TRIP: recompute canonical JSON of `{records}` inside the test (own sorted-keys serializer — do NOT import the app's), SHA-256 it, assert `'sha256:' + hex === body.packageHash`; `interaction_logs` has `interaction_type='likha_export_package'` row.
5. **L1 filter + eligibility + empty:** `{ordinanceIds: [pubId2]}` → 1 record + hash still round-trips; `{ordinanceIds: [flaggedId]}` → 409 `code:'CONFLICT'`; `{ordinanceIds: []}` → `records: []`, `recordCount: 0`, and `packageHash` equals the test-side recomputation over `{records: []}`; no body contains a `relationships` key.

**GREEN — implement:**

**(a) `src/app/api/likha/export-dilg/route.ts`** (NEW): `export const runtime = 'nodejs';` `POST = withUserAuth(async (request, { user }) => { … })`. Parse body tolerantly (`{}` allowed; `ordinanceIds` when present must be a string array — else 400 `INVALID_BODY`). Call `buildDilgPackage({ userId: user.user.id, recordIds: body.ordinanceIds })`; on `ineligible` → **409** `{ error: 'Records not eligible for export (published only): ' + ineligibleIds.join(', '), code: 'CONFLICT' }`; on ok → `logModuleEvent({module:'likha', interactionType:'likha_export_dilg', content: JSON.stringify({recordCount, recordIds: …}), ipAddress:'127.0.0.1', participantSessionId:'likha-'+userId})` then respond `new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="likha-dilg-mc-2026-041-' + exportedAt.slice(0,10) + '.json"' } })`.

**(b) `src/app/api/likha/export-package/route.ts`** (NEW): identical structure calling `buildInterchangePackage`; filename `'pillar-likha-l1-package-' + exportedAt.replace(/[:.]/g, '-') + '.json'`; log `interactionType: 'likha_export_package'`. SAME 400/409 envelope semantics. Both routes import ONLY from `next/server`, `@/lib/user-auth-middleware`, `@/lib/likha/export`, `@/lib/logger`, `@/types/likha`.

**REFACTOR:** shared body-parsing helper local to each route (duplicate tiny helpers rather than cross-import); zero `linaw` tokens; tests clean up every seeded row + classifications + agent_decisions + interaction logs they created.

**acceptance_criteria:**

1. Both API suites pass against the dev server: `npx tsx --test tests/integration/likha-classify-api.test.ts tests/integration/likha-exports.test.ts` exit 0 (classify happy-path follows the D32 fallback rule when no LLM key is configured).
2. Auth 401 on all three feature routes; empty-selection behavior per decision D23/D22; 409 all-or-nothing eligibility; DILG markers set only on included rows; L1 hash round-trip verified over the wire.
3. Exports logged with `module='likha'` + exporter id; routes contain no business logic beyond parsing/mapping/logging.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "withUserAuth" src/app/api/likha/export-dilg/route.ts src/app/api/likha/export-package/route.ts
# expected: 1 and 1

grep -c "Content-Disposition" src/app/api/likha/export-dilg/route.ts src/app/api/likha/export-package/route.ts
# expected: >= 1 and >= 1

grep -c "likha_export_dilg" src/app/api/likha/export-dilg/route.ts && grep -c "likha_export_package" src/app/api/likha/export-package/route.ts
# expected: >= 1 and >= 1

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/app/api/likha
# expected: no output, exit code 1

grep -ic "linaw" src/app/api/likha/export-dilg/route.ts src/app/api/likha/export-package/route.ts tests/integration/likha-classify-api.test.ts tests/integration/likha-exports.test.ts
# expected: 0, 0, 0, 0

# Live contract (dev server running in another terminal):
npx tsx --test tests/integration/likha-classify-api.test.ts tests/integration/likha-exports.test.ts
# expected: all subtests pass, exit code 0
```

---

### S4-C9 — `src/app/likha/page.tsx`: real agent 4, classification HITL gate, live Classification tab, Export DILG button

```json
{
  "chunk_id": "S4-C9",
  "feature_id": "L007+L010 (UI wiring; completes the LIKHA page)",
  "chunk_type": "frontend_page",
  "name": "Agent 4 real visualization (1200ms slot, subjects preview, hitl state), low_confidence_classification queue wiring, live Classification tab (editor + Export DILG toolbar), stub removed",
  "file_outputs": ["src/app/likha/page.tsx"],
  "tdd_steps": [],
  "dependencies": ["S4-C5", "S4-C6", "S4-C8"],
  "parallel_group": "GROUP-E",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT `src/app/likha/page.tsx` (the Sprint-3 version). `'use client';` retained. Allowed imports: everything already imported + `@/components/likha/classification-editor` and lucide `Download` if needed. NO `getDb`, NO `@/lib/likha/*` imports, NO kit edits. Preserve EVERYTHING from Sprint 3 (shell tokens, H1, `data-likha-copy` script tag, tab structure, DEFAULT active tab `'upload'`, upload/agents 1–3/5 orchestration, verification panel wiring, Archive Browser tab, batch footer). Make exactly these changes:

1. **Agent 4 (Subject Classifier) — REAL pass (decision D24):** replace the S3 block (`setAgent(4, …); await sleep(delayFor(4)); setAgent(4, { status:'completed', output: { preview: 'Subjects suggested', subjects: [], success: true } })`) with: `setAgent(4, {status:'processing'})`; `await sleep(delayFor(4))` (1200ms slot retained); compute `const allSubjects = pipeline.files.flatMap(f => f.classification?.subjects ?? [])` and `const anyClassGate = pipeline.files.some(f => f.classification?.hitlRequired === true)`; if `anyClassGate` → `setAgent(4, {status:'hitl', output:{preview:'Subjects suggested — review required', hitlRequired:true, subjects: allSubjects, success:true}})` else `setAgent(4, {status:'completed', output:{preview:'Subjects suggested', subjects: allSubjects, success:true}})`.
2. **Classification HITL gate wiring (PRD §12.4 row 2):** inside the per-file loop that builds `reviewActivities`/`newQueueItems` (Sprint-3 agent-5 section), ALSO handle `file.classification?.hitlRequired === true`: when fired (independently of the metadata gate), push a `LikhaHitlItem` `{ id: uuid, activityId: <that file's activity id>, agentId: 4, module: 'likha', gate: 'low_confidence_classification', fieldSchema: { subjects: { type: 'multiselect', label: 'Subjects', value: file.classification?.subjects?.map(s => s.label) ?? [] } }, suggestedAction: 'edit', context: { preview: 'Classification review required', hitlRequired: true, exceptions: ['Classification confidence below 0.6 — override the subject category.'], recordId, ordinanceNumber, seriesYear, title, success: true } }`. If the metadata gate did NOT fire but the classification gate did, the activity card becomes `type:'hitl'` with title `REVIEW REQUIRED — Ordinance No. <n> S. <year> low classification confidence` and details "Classification confidence < 0.6 — override the subject category." (Records already in `awaitingDecision` from Sprint-3 logic — every record still needs human approval before publish; the classification gate does NOT add duplicate awaiting entries.)
3. **Classification tab live:** replace the stub block (`{activeTab === 'classification' && ( <div …>AI subject classification lands in Sprint 4 (L007).</div> )}`) with `{activeTab === 'classification' && ( <div className="space-y-6"> <ClassificationEditor /> <div>…the Export DILG toolbar from item 4…</div> </div> )}`.
4. **Export DILG toolbar (L010 hook, decision D30):** inside the classification tab section, a toolbar row under the editor: `[ Export DILG Package ]` button (`Download` icon, `#0038A8`, min-h-11) + status line. On click: POST `/api/likha/export-dilg` with body `{}` (all published records); 200 → trigger a browser download of the returned JSON as `likha-dilg-mc-2026-041-<today>.json` (Blob + object URL + anchor click + revoke) and show success line "DILG package exported (N records)"; 409 → rose inline error from the server `error`; other errors → rose inline "Export failed — try again."; in-flight → `Loader2`, button disabled. NO Export L1 button in the UI (L013 is API-only this sprint — SPRINT_PLAN file list).
5. **Machine-readable copy (smoke-greppable):** extend the `data-likha-copy` script tag's JSON with one key: `"classificationTab":"AI SUBJECT CLASSIFICATION"` (append inside the existing JSON string; keep existing keys byte-identical).
6. All six agent NAMES still render; zero `linaw` tokens; no dead imports; the Sprint-3 smoke greps (`DRAG & DROP SCAN FILES`, `ACTIVITY FEED`) still match.

**acceptance_criteria:**

1. Page compiles; upload run shows agent 4 processing its 1200ms slot then completing with REAL subjects from the pipeline response (or rose `'hitl'` when the classification gate fired); gate produces a rose feed card + `low_confidence_classification` queue item resolvable through the existing verification panel flow.
2. Classification tab renders `<ClassificationEditor />` (stub text gone) + the Export DILG toolbar; export downloads the attachment and surfaces 409 errors inline.
3. Kit consumed props-only; default active tab still `'upload'`; `npm run build` route table gains `/api/likha/classify`, `/api/likha/classify/[id]`, `/api/likha/export-dilg`, `/api/likha/export-package`.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run build
# expected: build succeeds; route table includes /likha, /api/likha/classify, /api/likha/classify/[id],
# /api/likha/export-dilg, /api/likha/export-package (+ all Sprint-2/3 routes)

grep -c "ClassificationEditor" src/app/likha/page.tsx && grep -c "low_confidence_classification" src/app/likha/page.tsx && grep -c "export-dilg" src/app/likha/page.tsx
# expected: >= 2, >= 1, >= 1

grep -c "lands in Sprint 4" src/app/likha/page.tsx
# expected: 0  (stub removed)

grep -c "AI SUBJECT CLASSIFICATION" src/app/likha/page.tsx
# expected: 1

grep -REn "from ['\"]@/(lib/likha|lib/db|app/api)" src/app/likha/page.tsx
# expected: no output, exit code 1 (client page — no server imports)

grep -ic "linaw" src/app/likha/page.tsx
# expected: 0
```

---

### S4-C10 — Sprint 4 final gate: boundary greps, full test battery, regression (Sprints 1–3 re-run), commits (no new files)

```json
{
  "chunk_id": "S4-C10",
  "feature_id": "gate",
  "chunk_type": "testing",
  "name": "Boundary verification (both directions + export.ts table check) + Sprint-4 suites + Sprint-1/2/3 regression re-run + 3 feature commits (decision D30)",
  "file_outputs": [],
  "tdd_steps": [],
  "dependencies": ["S4-C1", "S4-C2", "S4-C3", "S4-C4", "S4-C5", "S4-C6", "S4-C7", "S4-C8", "S4-C9"],
  "parallel_group": "GROUP-F (sequential gate)",
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint 4 gate battery exactly as listed, from the repo root (Git Bash). No code changes here; failures go back to the responsible chunk (C1 types · C2 harness · C3 classify prompt/parser · C4 DILG builder · C5 editor UI · C6 L007 server · C7 L1 builder · C8 export routes + API suites · C9 page). Record every output as SPRINT_REVIEW evidence. THEN create the three feature commits with the explicit staging lists (decision D30).

**A. Static gates:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run lint
# expected: no errors. Zero findings in Sprint-4 files mandatory
# (src/types/likha.ts additions, src/lib/likha/*, src/app/api/likha/**, src/components/likha/classification-editor.tsx,
#  src/app/likha/page.tsx, tests/**). Pre-existing warnings elsewhere tolerated.

npm run build
# expected: "Compiled successfully"; route table includes /likha, /api/likha/classify,
# /api/likha/classify/[id], /api/likha/export-dilg, /api/likha/export-package (+ Sprint-2/3 routes)
```

**B. Boundary greps (SPRINT_PLAN Sprint 4 — both directions + export-builder table check):**

```bash
grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (ZERO forbidden imports)

grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha
# expected: no output, exit code 1 (ZERO LINAW table reads)

grep -REin "linaw" src/lib/likha src/app/api/likha src/components/likha src/app/likha/page.tsx src/types/likha.ts tests
# expected: no output, exit code 1 (zero linaw references in ANY Sprint-4 file)

grep -REn "from ['\"]@/(app/(ella|obra|yala)|components/(ella|obra|yala))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (zero ELLA/OBRA/YALA imports)

# SPRINT_PLAN Sprint-4 special: export builders read only archived_ordinances/classifications:
grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+[a-z_]+" src/lib/likha/export.ts | grep -vE "archived_ordinances|classifications"
# expected: no output, exit code 1

# Reverse direction: no likha leak into linaw-prefixed paths — none exist yet:
test ! -d src/lib/linaw && test ! -d src/app/api/linaw && test ! -d src/components/linaw && test ! -d src/app/linaw && echo NO-LINAW-PATHS
# expected: NO-LINAW-PATHS
```

**C. Sprint-4 test battery:**

```bash
npm run dev &   # background; wait for "Ready" on http://localhost:3000
sleep 8

npm run test
# expected: hermetic suite passes — Sprint-2/3 suites (OCR, search/BM25, metadata, verification,
# publish/gating) + Sprint-4: classification prompt parsing/confidence (never-throws, taxonomy
# filter, clamp, cap-5), DILG builder (published-only, markers, shape), L1 builder (manifest §3,
# record mapping §4, canonical JSON sorted/no-whitespace, packageHash §6, HASH ROUND-TRIP),
# classification runner + overrides (provenance 'ai' vs user id, gate <0.6, audit rows) — exit 0

npm run test:integration
# expected: Sprint-2/3 API suites (upload, archive) + Sprint-4: classify API (401, 400 empty
# selection, classify+skipped, override round-trip + provenance) + exports API (401 both routes,
# DILG download + markers, filter, 409 ineligible, empty selection, L1 manifest/hash ROUND-TRIP
# over HTTP, no relationships key) — exit 0

kill %1
```

**D. Regression — FULL re-run of Sprint 1 + Sprint 2 + Sprint 3 gates:**

```bash
# Sprint 1: kit neutrality (kit files untouched in Sprint 4):
grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" \
  src/components/agent-pipeline.tsx src/components/agent-card.tsx \
  src/components/activity-feed.tsx src/types/agentic.ts
# expected: no output, exit code 1
git --no-pager diff --stat v0.3.0-sprint-3..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts | grep -c . || echo KIT-UNTOUCHED
# expected: KIT-UNTOUCHED

# Sprint 1+2+3: schema intact + idempotent (run TWICE) — Sprint 4 adds NO schema:
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_arch_ord_year','idx_arch_ord_status','idx_arch_ord_astat','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); if(missing.length){console.error('FAIL missing:',missing); process.exit(1);} const cols=db.prepare('PRAGMA table_info(archived_ordinances)').all().map(c=>c.name); for(const c of ['extraction_confidence','section_count','rejection_reason','dilg_submitted','dilg_submitted_at']){ if(!cols.includes(c)){console.error('FAIL: '+c+' missing'); process.exit(1);} } console.log('SCHEMA OK: foundation tables + Sprint-2/3 migrations present');"
# expected (both runs): SCHEMA OK: foundation tables + Sprint-2/3 migrations present
git --no-pager diff --stat v0.3.0-sprint-3..HEAD -- src/lib/db.ts | grep -c . || echo DBTS-UNTOUCHED
# expected: DBTS-UNTOUCHED  (Sprint 4 makes zero schema changes)

# Sprint 2+3 suites are already re-run inside C's npm run test + test:integration — confirm
# counts explicitly as regression evidence: likha-ocr, likha-search, likha-metadata,
# likha-verification, likha-publish, likha-upload, likha-archive ALL green inside the C runs.

# Render smoke (all six agent names + live tabs + classification copy):
npm run dev & sleep 8
curl -s http://localhost:3000/likha | grep -oE "Ingestor|OCR Extractor|Metadata Parser|Subject Classifier|Legal Validator|Archiver" | sort -u | wc -l
# expected: 6
curl -s http://localhost:3000/likha | grep -c "DRAG & DROP SCAN FILES"
# expected: >= 1 (upload tab still default + dropzone intact)
curl -s http://localhost:3000/likha | grep -c "AI SUBJECT CLASSIFICATION"
# expected: >= 1 (classification tab copy present)
curl -s http://localhost:3000/likha | grep -c "lands in Sprint 4"
# expected: 0 (no stub text remains)
kill %1
```

**E. Feature commits (exact messages, explicit staging — decision D30):**

```bash
git add src/types/likha.ts package.json tests/helpers/likha-test-util.ts \
        src/lib/likha/prompts.ts src/lib/likha/agents.ts \
        src/app/api/likha/classify/route.ts "src/app/api/likha/classify/[id]/route.ts" \
        "src/app/api/likha/archive/[id]/route.ts" \
        src/components/likha/classification-editor.tsx \
        tests/unit/likha-classify.test.ts tests/integration/likha-classification.test.ts \
        tests/integration/likha-classify-api.test.ts
git commit -m "feat: implement L007 AI-assisted subject classification pillar-likha-linaw-20260809"

git add src/lib/likha/export.ts src/app/api/likha/export-dilg/route.ts \
        tests/unit/likha-export-dilg.test.ts src/app/likha/page.tsx
git commit -m "feat: implement L010 DILG MC 2026-041 submission package export pillar-likha-linaw-20260809"

git add src/app/api/likha/export-package/route.ts \
        tests/unit/likha-export-l1.test.ts tests/integration/likha-exports.test.ts
git commit -m "feat: implement L013 L1 interchange export package pillar-likha-linaw-20260809"

git log --oneline -3
# expected: exactly these 3 commits, in this order, with these exact messages
git status --porcelain -- src tests package.json
# expected: empty (all sprint files staged into the three feature commits)
```

NOTE on intermediate-commit semantics (decision D30): the L007 commit is complete WITHOUT exports; the L010 commit stages `src/lib/likha/export.ts` WHOLE (DILG + L1 builders — the shared builder module lands with its first consumer) plus the additive `page.tsx` export-toolbar edit; the L013 commit adds the L1 route + its tests. `page.tsx` therefore appears in BOTH the L007 and L010 commits (additive second edit). Each commit independently compiles and its tests pass. Tag `v0.4.0-sprint-4` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do not tag in this chunk.

**acceptance_criteria:**

1. Sections A–D all produce their expected outputs; C's results are captured as the Sprint-4 regression baseline.
2. Exactly 3 commits with the exact `feat: implement [Feature] pillar-likha-linaw-20260809` messages; working tree (module files) clean afterward.
3. All evidence (command outputs, test counts, commit SHAs) recorded for SPRINT_REVIEW and the cumulative quality score.

---

## Sprint 4 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 4)

**This sprint completes LIKHA — the LIKHA feature set (L001–L007 Must + L010/L013 Should) ends here. After SPRINT_REVIEW, LIKHA is declared feature-complete and frozen; Sprints 5–7 build LINAW only.**

- [ ] **L007 acceptance (PRD-LIKHA §6.7 feature 7 + §11):** AI classification suggests ≥1 subject category with confidence per record against the Code Titles/Chapters taxonomy + LIKHA subject categories (S4-C3, S4-C6); results persisted to `classifications` with provenance — `assigned_by='ai'` for model suggestions, `assigned_by=<user id>` for admin overrides via `PUT /api/likha/classify/[id]` (REPLACE semantics, confidence NULL) (S4-C6); HITL gate `low_confidence_classification` raises when confidence < 0.6 (empty suggestions included), rose card + override path in the UI (S4-C6, S4-C9); Subject Classifier agent 4 is REAL in the pipeline runner — S3 pass-through fully replaced (`s3-passthrough` grep = 0), 1200ms slot retained client-side, audit rows per run (S4-C6, S4-C9); Classification tab on `/likha` is real (`classification-editor.tsx`, stub removed) (S4-C5, S4-C9)
- [ ] **L010 acceptance:** `POST /api/likha/export-dilg` produces a downloadable DILG MC 2026-041 submission package (single JSON attachment — decision D27), published records only, `dilg_submitted` markers set on included rows, export logged with module + user id (S4-C4, S4-C8, S4-C9)
- [ ] **L013 acceptance — package validates against INTERCHANGE-SPEC §11:** manifest `module='likha'`, `schemaVersion='1.0.0'`, `interchangeLevel='L1'`, `recordCount == records.length`; records exactly the §4 shape from published `archived_ordinances` rows (subjectTags = subject_tags JSON ∪ classifications); `ordinanceIds` filter works, omitted → all published, `[]` → valid empty package; `packageHash` recomputation from the downloaded payload succeeds (round-trip — hermetic AND over HTTP); `Content-Disposition: attachment`; auth required (S4-C7, S4-C8)
- [ ] **All routes `withUserAuth`** (classify POST, classify/[id] PUT, export-dilg POST, export-package POST); all classification decisions (AI runs, gates, overrides) + both export actions audited to `agent_decisions` and logged via `logger.ts` with `module='likha'` (S4-C6, S4-C8)
- [ ] **Boundary grep clean, both directions:** zero forbidden imports, zero LINAW table reads, zero `linaw` tokens in any Sprint-4 file, zero ELLA/OBRA/YALA imports, `export.ts` reads only `archived_ordinances`/`classifications`, no likha leak into linaw paths (S4-C10.B)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S4-C10.A)
- [ ] **New tests green:** hermetic — classifier prompt parsing/confidence (never-throws, taxonomy filter, clamp, cap), DILG builder (published-only/markers/shape), L1 builder (manifest/record mapping/canonical JSON/hash round-trip), runner + override persistence (provenance/gate/audit); API-level — classify batch + override + 401/400/empty selection, export-dilg download + markers + 409, export-package manifest/hash round-trip over HTTP + 409 + empty selection (S4-C10.C)
- [ ] **Regression:** FULL re-run of Sprint 1 (kit neutrality, schema assertions — zero Sprint-4 schema changes, render smoke incl. all 6 agent names) + Sprint 2 (OCR contract, metadata persistence, upload contract) + Sprint 3 (verification, publish gating, archive search) suites — all green (S4-C10.D)
- [ ] **Per-feature commits:** exactly 3, format `feat: implement [Feature] pillar-likha-linaw-20260809` (S4-C10.E)
- [ ] **LIKHA module declared complete** — L001–L007 + L010 + L013 delivered; tag `v0.4.0-sprint-4` after SPRINT_REVIEW passes; cumulative quality score recorded

**Integration/Regression notes (SPRINT_PLAN):** new tests = classify batch + override; export-dilg download; export-package manifest/hash round-trip (recompute from downloaded payload). Regression = re-run Sprint 2–3 suites (plus Sprint-1 smoke). From Sprint 5 onward, the combined Sprint 2–4 LIKHA suites re-run as part of every sprint's regression battery (cross-module non-interference evidence).

---

## Flagged for SPRINT_REVIEW

1. **D21 — Classification taxonomy defined in-repo.** PRP-LIKHA names "the 13 Code Titles taxonomy" without enumerating it; S4-C1 pins `LIKHA_CODE_TITLES` (13 titles, municipal Code of Ordinances template) and the legal label union with `LIKHA_SUBJECTS` (25 labels). Confirm the title names match the pilot LGU's Code of Ordinances template — swapping titles later is a one-constant edit (labels already persisted in `classifications` would keep their historical text).
2. **D22 — Classify eligibility (`pending_review` + `published`; others `skipped`)** and the total-batch 200-with-skipped posture (mirrors the pipeline runner's never-crash rule). PRD §12.6 does not constrain which records are classifiable.
3. **D23 — Published-only exports, all-or-nothing 409.** Ineligible/unknown ids reject the WHOLE export with 409 `CONFLICT` (chosen over 422 for consistency with Sprint-3 state-conflict semantics); `ordinanceIds: []` = valid empty package (literal reading of INTERCHANGE-SPEC §4's omission rule); omitted = all published.
4. **D24 — Gate ownership split:** agent 4 raises `low_confidence_classification` itself (WORKFLOW exception rule); agent 5 stays metadata-only (`validateLikhaExtraction` unchanged). Both PRD §12.4 gates now have exactly one owner each.
5. **D25 — Additive override route** `PUT /api/likha/classify/[id]` (not in PRD §12.6's route table, same precedent as Sprint-3's D15 scan route); REPLACE semantics with `confidence NULL` for human rows; overrides immune to later AI re-classification runs.
6. **D26 — Additive `classifications` field on `GET /api/likha/archive/[id]`** (PRD §12.6 row: "ordinance detail + classifications"); Sprint-3 response fields unchanged.
7. **D27 — DILG format = single JSON attachment** (no zip dependency in the repo; INTERCHANGE-SPEC single-JSON precedent). Manifest carries `exportedById` only — no users-table join for LGU metadata (boundary-safe). Confirm this satisfies the DILG MC 2026-041 submission expectations for the pilot.
8. **D28/D29 — L1 hash payload `{records}` only; empty-package `yearRange: []`.** LIKHA omits relationships (SPEC §2), so the canonical payload is exactly `{records}`; for a zero-record export `source.yearRange` emits `[]` (spec shows a 2-element example but defines no empty case).
9. **D30 — Commit seam:** `src/lib/likha/export.ts` staged WHOLE (both builders) in the L010 commit; `page.tsx` appears in both the L007 commit (classification wiring) and the L010 commit (additive Export DILG toolbar). Each commit compiles and tests green independently.
10. **D32 — No real OpenRouter calls in automated tests** (Sprint-2/3 precedent). The API-level classify happy-path tolerates a missing LLM key via a documented fallback assertion; pilot classification accuracy (≥ useful suggestions) is verified at SYSTEM_TEST on the pilot batch.
11. **`amendment_links` remains empty** — amendment/repeal link detection is not a LIKHA MVP feature (out of scope per SPRINT_PLAN §2); the table exists from Sprint 1 and is untouched.
12. **L013 has no UI surface** this sprint (API + tests only — SPRINT_PLAN Sprint-4 file list carries no L013 UI file); the L1 package is user-triggered via the route (e.g., by an admin tool or curl) per INTERCHANGE-SPEC §1 "user-triggered".

**Handoff:** Sprint 5 (LINAW Standalone Ingestion & Library Verification — N013, N014; PRP-LINAW only) depends on Sprint 1's shared foundation ONLY — it must NOT import, reference, or test against any LIKHA code (standalone-SKU proof). LIKHA is now frozen: the combined Sprint 2–4 LIKHA suites join every future regression battery as the cross-module non-interference baseline.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 4 of 7*
