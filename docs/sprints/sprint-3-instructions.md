# Sprint 3 Instruction Set — LIKHA Verification, Archive Publish & Search

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 3 of 7 — "LIKHA Verification, Archive Publish & Search" — features **L004, L005, L006** |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith (verified installed: 15.3.8), React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^12.11, lucide-react ^0.468, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `FormData`, `node:test`), tsx ^4.19 test harness from Sprint 2 |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 3 uses **`docs/PRP-LIKHA.md` ONLY**. Do NOT read or reference any module section of `docs/PRP-LINAW.md`. `docs/INTERCHANGE-SPEC.md` is NOT needed this sprint. Supporting inputs already consumed by this instruction set: `docs/WORKFLOW-LIKHA.json` (agents 5–6 — Legal Validator 1200ms / Archiver 1000ms — callbacks, HITL gates `low_confidence_metadata` + `low_confidence_classification`, data/exception rules), `docs/DESIGN.md` (§2.1 archive browser wireframe, §2.3 verification panel wireframe, §3 palette, §6 breakpoints/keyboard), `docs/PRD-LIKHA.md` (§6.7 features 4–6, §7.2/§7.3 HITL flows, §11 acceptance, §12.3 audit schema, §12.4 HITL gate rows 1–2, §12.6 API contract), and the Sprint-1/Sprint-2 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes" below).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 2 is committed** (`feat: implement L001/L002/L003 …`, working tree clean for module code). Real Sprint-2 surface this sprint builds on:
   - `src/lib/likha/agents.ts` — SERVER runner `runLikhaPipeline(opts: RunLikhaPipelineOptions)` executing agents 2–3 per file with DI seams `ocr?` and `extractMetadata?`, a local `recordDecision()` audit helper bound to `pipelineId`, `AGENT_NAMES: Record<number,string>` currently `{2:'OCR Extractor', 3:'Metadata Parser'}`, per-file try/catch that flags rows and never crashes the batch, and one `logModuleEvent({module:'likha', interactionType:'likha_pipeline', …})` per run. Header comment says agents 4–6 are NOT executed — this sprint changes that for agents 4–5 (agent 6 lands in S3-C5).
   - `src/app/api/likha/pipeline/route.ts` — `POST` wrapped in `withUserAuth`, selects `archive_status='processing'` rows for the caller, responds with `LikhaPipelineResponse`.
   - `src/app/api/likha/upload/route.ts` — `POST` (L001) with agent-1 audit rows; duplicate-hash detection; files stored at `data/uploads/likha/<recordId>__<sanitized>` (repo-relative `scan_file_path`); placeholder metadata per decision D6 (negative random `ordinance_number`, `series_year=0`, title `Processing — <filename>`).
   - `src/app/likha/page.tsx` — client page with tabs `archive` (stub: "Search and browse land in Sprint 3 (L004–L006).") / `upload` (live, DEFAULT active) / `classification` (S4 stub); client orchestration `runDigitizationRun` wiring agents 1–3 with UI-simulation delays (decision D9) + a non-blocking `fetch('/api/likha/pipeline')`; comment "Agents 4–6 remain idle this sprint."
   - `src/components/likha/upload-dropzone.tsx` — props `{disabled?, onBatchAccepted?, onError?, className?}`.
2. **`src/types/likha.ts` (real):** exports `LIKHA_AGENT_DEFS` (all 6 agents: delays 1000/1600/1400/1200/1200/1000, colors/glow per WORKFLOW-LIKHA.json), `LikhaAgentOutput` (already has `confidenceByField?: MetadataConfidence` and `subjects?`), `LikhaAgentState`, `LikhaHitlItem` (gate union `'low_confidence_metadata' | 'low_confidence_classification'` — already declared, UI built THIS sprint), `MetadataConfidence` `{ordinanceNumber, seriesYear, title, sectionCount}`, `ParsedMetadata`, `ArchivedOrdinance` / `ArchivedOrdinanceRow` (row shape incl. `extraction_confidence: string | null`), upload/pipeline contracts. `LikhaPipelineFileResult` has `archiveStatus: 'processing' | 'pending_review' | 'flagged'` — additive fields this sprint only.
3. **`src/types/agentic.ts` (Sprint-1 shared, NOT touched):** `ActivityItem<O>` (status `'pending'|'confirmed'|'editing'|'rejected'`), `HitlItem<M,O>` `{id, activityId, agentId, module, gate, fieldSchema, suggestedAction, context}`, `AgentDecisionRecord` with `action: 'start'|'complete'|'hitl'|'confirm'|'reject'|'error'` (there is NO `'edit'` action — edit decisions persist as `'confirm'` rows, see S3-C3).
4. **DB schema reality (`src/lib/db.ts`):** `archived_ordinances` has `CHECK(archive_status IN ('processing','pending_review','published','flagged'))` — **there is no `'rejected'` value** and SQLite cannot alter a CHECK constraint without a table rebuild → rejected records map to `'flagged'` + a new additive `rejection_reason` column (decision D10). There is **no `section_count` column** — Sprint 2 parsed `sectionCount` but only persisted number/year/title/content/confidence → additive `section_count` column (decision D11). Sprint 2 already set the migration precedent: idempotent `ALTER TABLE … ADD COLUMN` in try/catch inside `initSchema()` (the `extraction_confidence` block) — reuse that exact pattern.
5. **`withUserAuth` real signature:** `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession }) => …`; acting user id = `user.user.id`, name = `user.user.full_name`; 401 envelope `{ error: 'Authentication required', code: 'NO_SESSION' }`. Dynamic-route precedent in the repo (`src/app/api/documents/[id]/route.ts`): `export const GET = withUserAuth(async (_request, { params }: { params: Promise<{ id: string }> }) => { const { id } = await params; … })` — copy that pattern for `archive/[id]`.
6. **BM25 sibling pattern (inspected):** `src/lib/data/search-index.json` exists (≈12 MB, committed) with shape `{ documents: [{id, doc_type, title, section_number, book, chapter, snippet, terms}], idf: <term→number map>, avgDocLength: number, totalDocs: number }` — a precomputed bag-of-terms index. LIKHA gets its OWN namespace file `src/lib/data/likha-search-index.json` managed exclusively by `src/lib/likha/search.ts` (decision D13). `src/lib/ai/lightrag.ts` exports `queryLightRAG/queryLightRAGHybrid/checkLightRAGHealth/…` — stays soft-optional and is NOT wired this sprint (decision D14).
7. **Shared kit real props (Sprint 1, consumed props-only — NEVER modified):** `ActivityFeed` accepts `{activities, emptyMessage?, onConfirm?(activityId), onEdit?(activityId, data), onReject?(activityId, reason), className?}` and renders Confirm/Edit/Reject buttons for items with `status:'pending'`, a green "Confirmed" pill, and rose left border for `type:'hitl'`. `AgentPipeline` accepts `{agents, isProcessing, pipelineComplete}`. `AgentCard` renders `agent.output?.preview` in its h-8 output section.
8. **Test harness reality (Sprint 2):** scripts `"test": "tsx --test tests/unit/likha-ocr.test.ts tests/integration/likha-metadata.test.ts"` (hermetic) and `"test:integration": "tsx --test tests/integration/likha-upload.test.ts"` (API-level vs `npm run dev`). `tests/helpers/likha-test-util.ts` exports `BASE_URL`, `assertServerReachable()`, `seedApprovedUser(dbFile?)`, `readFixture(name)`, `tempDbPath()`. Hermetic pattern (from `likha-metadata.test.ts`): set `process.env.DB_PATH = tempDbPath()` BEFORE `await import('../../src/lib/db')` / `await import('../../src/lib/likha/agents')` (dynamic import REQUIRED — `db.ts` reads `DB_PATH` at module load). Tests use relative imports only (no `@/` alias).
9. **Scan files are NOT public** (decision D1, Sprint 2): stored under `data/uploads/likha/`. The verification panel therefore needs an authenticated scan-streaming route (decision D15: `GET /api/likha/archive/[id]/scan`).
10. **Logger real API:** `logModuleEvent({module, interactionType, content?, ipAddress, participantName?, participantSessionId?})` — every LIKHA write path calls it with `module: 'likha'`.

## Sprint 3 Boundary Rules (apply to EVERY chunk)

1. **LIKHA-only code paths.** Every file created or edited lives in the `likha/` namespace or is an explicitly listed additive shared edit (db.ts migrations in S3-C3, package.json/.gitignore/test helper in S3-C2).
2. **Zero cross-module imports.** No Sprint-3 file may import from `@/app/api/{obra,chat,ella,yala,linaw}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, `@/lib/linaw`, `@/components/{ella,obra,yala,linaw}`, or any ELLA/OBRA/YALA/LINAW code. Allowed imports ONLY: `@/lib/ai/llm` (if needed — not expected this sprint), `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed` — props only), `@/types/agentic`, `@/types/likha`, LIKHA-owned modules (`@/lib/likha/*`), Node built-ins, `lucide-react`, `next/server`.
3. **Zero LINAW table references / tokens.** No Sprint-3 file may contain `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, or the token `linaw` (case-insensitive) anywhere in LIKHA code or tests.
4. **Auth on every route.** Every LIKHA API route (incl. the new `[id]`, `[id]/scan`, list, stats routes) is wrapped in `withUserAuth`; acting user = `user.user.id`.
5. **Logging.** Every LIKHA write path calls `logModuleEvent` with `module: 'likha'`, AND every agent action + human decision persists to `agent_decisions` with `module='likha'` (agents 4, 5, 6 start/complete/hitl rows; human confirm/reject rows with `user_id` + `reason` + timestamp).
6. **Archiver gating (NON-NEGOTIABLE).** Agent 6 (Archiver) runs ONLY inside the `action:'approve'` branch of `PUT /api/likha/archive/[id]` after the human decision is persisted. `publishApprovedRecord` MUST refuse any row whose `archive_status` is not `'pending_review'`. Rejected (`'flagged'`) records never publish.
7. **No Sprint-4 features.** NO classification editor, NO `POST /api/likha/classify`, NO LLM classification call, NO writes to the `classifications` table, NO export routes (`export-dilg`, `export-package`). Agent 4's S3 behavior is the wired pass-through defined in decision D12; the Classification tab stays a stub.
8. **One commit per feature**, exact format: `feat: implement L004 human verification side-by-side view pillar-likha-linaw-20260809` · `feat: implement L005 publish to archive with BM25 index entry pillar-likha-linaw-20260809` · `feat: implement L006 full-text archive browser with filters pillar-likha-linaw-20260809` (decision D19).
9. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprints 1–2). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (flagged for SPRINT_REVIEW — see end of file)

(Numbering continues Sprint 2's D1–D9.)

- **D10 — Rejected records stay inside the frozen CHECK enum.** `archived_ordinances.archive_status` allows only `processing|pending_review|published|flagged`; SQLite cannot alter CHECK constraints without a table rebuild (forbidden — additive-only rule). Reject therefore sets `archive_status='flagged'` + new additive column `rejection_reason TEXT` (idempotent ALTER in the exact Sprint-2 `extraction_confidence` pattern) + an `agent_decisions` row `action='reject'` with `reason`. Rejected-vs-errored flags are distinguished by `rejection_reason IS NOT NULL` and/or the reject decision row. Approve on a flagged row → 409.
- **D11 — Additive `section_count INTEGER` column.** Sprint 2 parsed `sectionCount` but had no home for it (it survives only inside `agent_decisions.output_snapshot`). L004 edits it, L006 displays it → idempotent `ALTER TABLE archived_ordinances ADD COLUMN section_count INTEGER` (nullable until verification sets it), same migration block as D10.
- **D12 — Agent 4 (Subject Classifier) in Sprint 3 = wired pass-through slot.** SPRINT_PLAN: "Subject Classifier completes its pipeline pass in Sprint 4's classification work; its sequential slot is wired here." Concretely: the server runner records agent-4 `start` + `complete` audit rows with `output_snapshot = {"mode":"s3-passthrough","subjects":[]}`; the client card animates its 1200ms delay and completes with preview "Subjects suggested". NO LLM call, NO `classifications` writes, and `low_confidence_classification` CANNOT fire in S3 (the gate value stays supported by `LikhaHitlItem` and the gate-dispatch code so S4 only adds the trigger). Subjects in S3 come ONLY from human selection in the verification panel (multi-select over `LIKHA_SUBJECTS`) and persist to `subject_tags`.
- **D13 — LIKHA BM25 namespace.** `src/lib/likha/search.ts` exclusively manages `src/lib/data/likha-search-index.json`, mirroring the sibling shape `{documents, idf, avgDocLength, totalDocs}`. The file is a RUNTIME artifact: gitignored (additive `.gitignore` entry), lazily rebuilt from `archive_status='published'` rows when missing (`rebuildIndex()`), and never hand-edited. Tests always inject a temp index path — the dev index is never touched by tests.
- **D14 — LightRAG stays unwired this sprint.** BM25 is authoritative (PRP: "LightRAG optional soft-dependency with BM25 fallback" — the fallback path is the shipped path). `src/lib/ai/lightrag.ts` is not imported by any Sprint-3 file.
- **D15 — Authenticated scan serving.** New route `GET /api/likha/archive/[id]/scan` streams the file at `scan_file_path` with the correct content type (`application/pdf` / `image/jpeg` / `image/png` derived from the filename extension — same `mimeFromFilename` logic as the pipeline route). Scans never move to `public/`.
- **D16 — HITL pause/resume is state-machine over DB + client, not a long-lived server process.** "Pause" = agent 5 card in `'hitl'` status + pending rose cards in the feed + records sitting at `archive_status='pending_review'`. "Resume" = the human's `PUT` decision; confirm/edit keeps the record reviewable, approve runs the Archiver server-side, reject terminates the branch (PRD §12.1). This keeps every decision auditable and survives page reloads (the verification queue is simply `GET /api/likha/archive?archiveStatus=pending_review`).
- **D17 — 409 conflict semantics.** `PUT /api/likha/archive/[id]` returns 409 `{ error, code: 'CONFLICT' }` when (a) the row's `archive_status` is no longer `'pending_review'` (already published or already rejected/flagged), or (b) an edit/approve would violate `UNIQUE(ordinance_number, series_year)` against a DIFFERENT row, or (c) the client supplied `expectedUpdatedAt` and it mismatches the stored `updated_at` (optimistic concurrency). The UPDATE is guarded with `WHERE id = ? AND archive_status = 'pending_review'` and `changes === 0` triggers the conflict re-read.
- **D18 — `GET /api/likha/archive` params.** PRD contract params kept exactly (`q, yearFrom, yearTo, status, subject, page, limit`); `status` filters the LEGAL status column (`active|amended|repealed|superseded|expired`). ONE additive optional param: `archiveStatus` (default `'published'`; the verification queue uses `archiveStatus=pending_review`). Flagged for SPRINT_REVIEW.
- **D19 — Commit mapping + the L004/L005 seam.** L004's `approve` persists the human decision (audit + `verified_by_id`) and leaves the record at `'pending_review'` awaiting the Archiver; the L005 chunk then wires the publish step INTO the same approve branch (Archiver + BM25 entry). Every commit therefore compiles and tests green independently, in the chronological order L004 → L005 → L006. Explicit per-feature staging lists live in S3-C9.
- **D20 — Test script extension.** `"test"` gains `tests/unit/likha-search.test.ts`, `tests/integration/likha-verification.test.ts`, `tests/integration/likha-publish.test.ts` (all hermetic); `"test:integration"` gains `tests/integration/likha-archive.test.ts` (API-level vs the dev server). Existing Sprint-2 entries stay byte-identical.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)          GROUP-B (parallel)                        GROUP-C        GROUP-D        GROUP-E        GROUP-F
──────────────────          ──────────────────────────────────────    ───────        ───────        ───────        ───────
S3-C1 types extension ─────► S3-C3 L004 server (agents 4–5, PUT/GET ─►┐
S3-C2 harness extension ───►        [id] + scan, migrations, tests)   ├► S3-C5 ────► S3-C6 ───────► S3-C8 ───────► S3-C9
                            S3-C4 L004 verification-panel.tsx         │  (L005       (L006 routes   (page wiring)  (gate,
                            S3-C7 L006 archive-browser.tsx ───────────┘   search.ts   + stats +                     regression,
              (disjoint files)                                            + archiver  API tests)                    commits)
                                                                          + publish
                                                                          wiring)
```

| Chunk | Feature | Dependencies | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S3-C1 | L004+L005+L006 (shared types) | Sprint 2 only | none | **GROUP-A** |
| S3-C2 | test harness extension | Sprint 2 only | none | **GROUP-A** |
| S3-C3 | **L004** server: agents 4–5, decision persistence, `[id]` GET+PUT, scan route, migrations, hermetic tests | S3-C1, S3-C2 | none | **GROUP-B** |
| S3-C4 | **L004** verification-panel.tsx | S3-C1 | none | **GROUP-B** |
| S3-C7 | **L006** archive-browser.tsx (contract pinned by S3-C1 types) | S3-C1 | none | **GROUP-B** |
| S3-C5 | **L005** search.ts + archiver + publish wiring into approve + BM25/gating tests | S3-C3 | extends files from S3-C3 (sequential) | **GROUP-C** |
| S3-C6 | **L006** GET archive list/search + stats routes + API-level tests | S3-C5 | none new | **GROUP-D** |
| S3-C8 | page wiring: agents 4–6 visualization, HITL queue, browser tab | S3-C3, S3-C4, S3-C5, S3-C6, S3-C7 | page.tsx only | **GROUP-E** |
| S3-C9 | gate | ALL | n/a | **GROUP-F** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`, zero shared state). Commit points are all taken in the final gate (S3-C9) with explicit per-feature staging lists, so commits are correct regardless of GROUP-B execution order. When in doubt, execute sequentially.

---

## Chunks

---

### S3-C1 — `src/types/likha.ts`: Sprint-3 contract extensions (additive)

```json
{
  "chunk_id": "S3-C1",
  "feature_id": "L004+L005+L006 (shared module types)",
  "chunk_type": "setup",
  "name": "Validation result, verification request/response, archive list/search/stats contracts, LIKHA_SUBJECTS constant",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/likha.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

EDIT `src/types/likha.ts` ADDITIVELY — every existing line stays byte-identical (the file currently ends with `LikhaPipelineResponse`). Do not modify or delete anything existing; append the block below at the end of the file, and make exactly ONE inline addition to `LikhaPipelineFileResult` (add the optional `validation?` field shown below inside that existing interface). The file must keep compiling under `strict: true`, keep zero runtime imports (types-only file + the existing `LIKHA_AGENT_DEFS` const), and contain the token `linaw` ZERO times.

**(a) Inside the EXISTING `LikhaPipelineFileResult` interface, add one optional field** (additive — all other fields unchanged):

```ts
  /** Agent 5 (Legal Validator) result — Sprint 3. Present once validation ran. */
  validation?: LikhaValidationResult;
```

**(b) APPEND this block at the end of the file:**

```ts
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
```

**acceptance_criteria:**

1. File compiles under `strict: true`; all existing Sprint-2 exports byte-identical; new exports present: `LIKHA_SUBJECTS`, `LikhaValidationResult`, `LikhaVerificationRequest`, `LikhaVerificationResponse`, `LikhaRecordDetailResponse`, `LikhaArchiveListItem`, `LikhaArchiveSearchResponse`, `LikhaStatsResponse`.
2. `LikhaPipelineFileResult` gains ONLY the optional `validation?` field (Sprint-2 tests stay green).
3. No runtime imports added; zero `linaw` tokens.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "LikhaValidationResult" src/types/likha.ts && grep -c "LIKHA_SUBJECTS" src/types/likha.ts && grep -c "LikhaStatsResponse" src/types/likha.ts
# expected: >= 2, >= 1, >= 1

git diff --unified=0 -- src/types/likha.ts | grep -c '^-[^-]'
# expected: 0  (append-only + the single additive interface field counts as an in-hunk addition; no removed lines)

grep -ic "linaw" src/types/likha.ts
# expected: 0
```

---

### S3-C2 — Harness extension: test scripts, .gitignore, helper additions

```json
{
  "chunk_id": "S3-C2",
  "feature_id": "test harness (supports L004–L006)",
  "chunk_type": "setup",
  "name": "package.json script extension (decision D20), likha-search-index gitignore, helper: tempIndexPath + seedPendingReviewRecord",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["package.json", ".gitignore", "tests/helpers/likha-test-util.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Three additive edits. No existing line modified or removed except the two script values (which are replaced wholesale per decision D20, keeping every Sprint-2 test file in the lists).

**(a) `package.json`** — replace ONLY the two Sprint-2 test scripts with:

```json
"test": "tsx --test tests/unit/likha-ocr.test.ts tests/unit/likha-search.test.ts tests/integration/likha-metadata.test.ts tests/integration/likha-verification.test.ts tests/integration/likha-publish.test.ts",
"test:integration": "tsx --test tests/integration/likha-upload.test.ts tests/integration/likha-archive.test.ts"
```

(The new files land in S3-C3/C5/C6 — until then run the individual existing files directly. All other scripts byte-identical.)

**(b) `.gitignore`** — immediately AFTER the Sprint-2 LIKHA uploads block (`# LIKHA uploaded scans …` / `data/uploads/`), append:

```
# LIKHA BM25 index namespace (runtime artifact of src/lib/likha/search.ts — rebuilt from published rows)
src/lib/data/likha-search-index.json
```

**(c) `tests/helpers/likha-test-util.ts`** — APPEND two exports (existing code untouched; keep relative/Node-built-in imports only):

```ts
/** Fresh temp path for the LIKHA BM25 index file (hermetic search tests — decision D13). */
export function tempIndexPath(): string {
  return path.join(os.tmpdir(), `pillar-likha-index-${randomUUID()}.json`);
}

/**
 * Inserts one archived_ordinances row in archive_status='pending_review' with
 * realistic Sprint-2-shaped metadata (extraction_confidence JSON, file_hash,
 * scan_file_path) directly into the DB handle the CALLER passes (the hermetic
 * tests' dynamically-imported getDb()). Returns the new record id.
 */
export function seedPendingReviewRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    confidence?: { ordinanceNumber: number; seriesYear: number; title: number; sectionCount: number };
    archiveStatus?: 'processing' | 'pending_review' | 'published' | 'flagged';
  }
): string {
  const id = randomUUID();
  const confidence = overrides?.confidence ?? {
    ordinanceNumber: 0.92, seriesYear: 0.95, title: 0.9, sectionCount: 0.88,
  };
  db.prepare(
    `INSERT INTO archived_ordinances
       (id, ordinance_number, series_year, title, content, section_count,
        subject_tags, source_type, original_filename, scan_file_path, file_hash,
        archive_status, extraction_confidence, uploaded_by_id)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 'scan', ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides?.ordinanceNumber ?? 5,
    overrides?.seriesYear ?? 2023,
    overrides?.title ?? 'An ordinance revising the schedule of business permit fees',
    overrides?.content ?? 'Section 1. Title. This ordinance revises business permit fees.',
    12,
    'ord-05-s2023.pdf',
    'data/uploads/likha/' + id + '__ord-05-s2023.pdf',
    'deadbeef'.repeat(8),
    overrides?.archiveStatus ?? 'pending_review',
    JSON.stringify(confidence),
    userId
  );
  return id;
}
```

**acceptance_criteria:**

1. Both scripts valid; every Sprint-2 test file still listed; `npx tsx --test` resolves.
2. `.gitignore` entry appended after the uploads block; uploads block untouched.
3. Helper compiles under `strict: true`, relative imports only, zero `linaw` tokens; `seedPendingReviewRecord` matches the REAL `archived_ordinances` schema (note: it references the `section_count` column created by S3-C3's migration — this helper is only exercised after S3-C3 lands).

**verification_commands:**

```bash
node -e "const p=require('./package.json'); const ok=p.scripts.test.includes('likha-search')&&p.scripts.test.includes('likha-verification')&&p.scripts.test.includes('likha-publish')&&p.scripts.test.includes('likha-ocr')&&p.scripts.test.includes('likha-metadata')&&p.scripts['test:integration'].includes('likha-upload')&&p.scripts['test:integration'].includes('likha-archive'); console.log(ok?'SCRIPTS OK':'SCRIPTS BAD')"
# expected: SCRIPTS OK

grep -c "likha-search-index.json" .gitignore
# expected: 1

npx tsc --noEmit
# expected: no output, exit code 0

grep -ic "linaw" tests/helpers/likha-test-util.ts
# expected: 0
```

---

### S3-C3 — L004 server: agents 4–5 in the runner, verification decisions, archive `[id]` routes, migrations, hermetic tests (TDD)

```json
{
  "chunk_id": "S3-C3",
  "feature_id": "L004",
  "chunk_type": "library + api_route",
  "name": "Legal Validator (agent 5, 1200ms slot) + agent 4 pass-through audit, applyVerificationDecision (approve/edit/reject + 409 + audit), GET+PUT /api/likha/archive/[id], GET scan route, section_count + rejection_reason migrations",
  "parallel_group": "GROUP-B",
  "dependencies": ["S3-C1", "S3-C2"],
  "file_outputs": ["src/lib/likha/agents.ts", "src/lib/db.ts", "src/app/api/likha/archive/[id]/route.ts", "src/app/api/likha/archive/[id]/scan/route.ts", "tests/integration/likha-verification.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement the L004 SERVER side with TDD. NOTE on the L004/L005 seam (decision D19): in THIS chunk `approve` persists the human decision and leaves the record at `'pending_review'` (`published: false`, response field already present); S3-C5 wires the Archiver publish step into the same branch. Everything else (edit, reject, 409, audit, gates) is complete here.

**RED — write the failing test FIRST:** `tests/integration/likha-verification.test.ts` (`node:test`, `node:assert/strict`, relative imports `../helpers/likha-test-util` + dynamic `await import('../../src/lib/…')`). Hermetic: `process.env.DB_PATH = tempDbPath()` BEFORE importing `../../src/lib/db` and `../../src/lib/likha/agents`; also `process.env.LIKHA_SEARCH_INDEX_PATH = tempIndexPath()` (S3-C5's search module reads it; harmless here). Seed via the dynamically imported `getDb()`: one approved `users` row (all NOT NULL fields, same pattern as `likha-metadata.test.ts`). Use `seedPendingReviewRecord(db, userId, …)` from the helper. Subtests:

1. **Agent 5 validation (pure):** import `validateLikhaExtraction` (exported from agents.ts). Row with all confidences ≥0.7 → `{ hitlRequired: false, exceptions: [] }`. Row with `confidence.ordinanceNumber = 0.62` → `hitlRequired: true`, `gate: 'low_confidence_metadata'`, an exception string containing `ordinanceNumber` and `0.62`. Row with empty `content` / all-zero confidence → `hitlRequired: true` with an unreadable-scan exception.
2. **Pipeline runs agents 4–5 and raises the gate:** seed TWO `'processing'` rows with `scan_file_path='tests/fixtures/likha/sample-ordinance.pdf'`; call `runLikhaPipeline({ pipelineId: 'p3', userId, files, ocr: stubOcr, extractMetadata: stubLow })` where `stubLow` returns metadata with `confidence.ordinanceNumber = 0.55`. Assert: result file entries carry `validation.hitlRequired === true` with `gate`; `agent_decisions` for `pipeline_id='p3'` contains agent-4 rows (start+complete, `output_snapshot` containing `"s3-passthrough"`) and agent-5 rows (start + complete + an `action='hitl'` row whose `reason`/snapshot references the gate); rows still end `archive_status='pending_review'`. A second run with high-confidence stub → `validation.hitlRequired === false` and NO `'hitl'` action rows.
3. **approve persists the decision:** seed a pending_review row via the helper; call the exported `applyVerificationDecision(db-like seam — see GREEN)` (or invoke it the way the route does) with `{ action: 'approve' }, userId`. Assert: `agent_decisions` has a row `module='likha'`, `agent_id=5`, `agent_name='Legal Validator'`, `action='confirm'`, `user_id=userId`; record gains `verified_by_id=userId`, stays `archive_status='pending_review'` (publish lands in S3-C5), response `{ published: false }`; an `interaction_logs` row with `module='likha'` and `interaction_type` starting `likha_verification` exists.
4. **edit persists corrected fields:** same setup, action `'edit'` with `fields: { ordinanceNumber: 7, seriesYear: 2024, title: 'Corrected title', sectionCount: 9, subjects: ['Taxation & Revenue'] }` → row updated (number 7, year 2024, title, `section_count=9`, `subject_tags='["Taxation & Revenue"]'`), stays `pending_review`; audit row `action='confirm'` with `reason='edit'` and `output_snapshot` containing the edited fields; invalid subjects (not in `LIKHA_SUBJECTS`) rejected with an error the route maps to 400.
5. **reject terminates the branch:** action `'reject'`, `reason: 'Unreadable scan'` → `archive_status='flagged'`, `rejection_reason='Unreadable scan'`, `verified_by_id` set; audit row `action='reject'` with the reason; a FOLLOW-UP approve on the same row throws/returns the conflict signal (→ 409 in the route). Reject with empty reason → validation error (→ 400).
6. **409 conflict:** approve on an already-`'published'` row and on an already-`'flagged'` row → conflict; edit changing `(ordinance_number, series_year)` to collide with ANOTHER row → conflict (SQLITE_CONSTRAINT_UNIQUE mapped to the same conflict outcome).

**GREEN — implement** in this order:

**(a) `src/lib/db.ts` (additive migrations, decisions D10+D11):** inside `initSchema()`, immediately AFTER the Sprint-2 `extraction_confidence` ALTER block, append ONE more block in the identical try/catch style:

```ts
  // Migration (Sprint 3, L004): section count home + rejection reason for verified records
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN section_count INTEGER`);
  } catch {
    // Column already exists — ignore
  }
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN rejection_reason TEXT`);
  } catch {
    // Column already exists — ignore
  }
```

Touch nothing else in the file.

**(b) `src/lib/likha/agents.ts` — extend the existing runner (all existing behavior preserved; Sprint-2's `likha-metadata.test.ts` must stay green):**
- Extend `AGENT_NAMES` to `{2: 'OCR Extractor', 3: 'Metadata Parser', 4: 'Subject Classifier', 5: 'Legal Validator', 6: 'Archiver'}`.
- Add exported pure validator (agent 5 logic — deterministic, NO LLM):

```ts
/** Agent 5 (Legal Validator): raises low_confidence_metadata per PRD-LIKHA §12.4 row 1. */
export function validateLikhaExtraction(input: {
  content: string;
  ordinanceNumber: number;
  extractionConfidence: MetadataConfidence | null;
}): LikhaValidationResult;
```

Rules: `exceptions` accumulate human-readable strings; unreadable = `content.trim() === ''` OR `extractionConfidence === null` OR all four confidences `=== 0` OR `ordinanceNumber <= 0` (placeholder remnant) → exception "Scan unreadable or metadata missing — manual entry required". Each CRITICAL field (`ordinanceNumber`, `seriesYear`, `title`) with confidence `< 0.7` → exception `"<field> confidence <value> < 0.7 — confirm against the scan"`. `hitlRequired = exceptions.length > 0`; when true set `gate: 'low_confidence_metadata'`.
- Extend `RunLikhaPipelineOptions` with two additive DI seams: `classify?: (input: { rawText: string; title: string }) => Promise<Array<{ label: string; confidence: number }>>` (default: `async () => []` — decision D12 pass-through) and `validate?: typeof validateLikhaExtraction` (default: the real one).
- In the per-file loop, AFTER agent 3 completes successfully: agent 4 — start row (`input_snapshot` `{recordId, mode:'s3-passthrough'}`), `await classify(…)` (no-op by default), complete row (`output_snapshot` `JSON.stringify({ mode: 's3-passthrough', subjects })`). Agent 5 — start row, run validation over the just-persisted values, then: always a complete row (`output_snapshot` = the `LikhaValidationResult`); if `hitlRequired` ALSO an `action='hitl'` row (`reason` = `gate + ': ' + exceptions.join('; ')`). Attach `validation` to the file result. On per-file error paths keep existing behavior (flag + continue).
- Add the decision-persistence function used by the PUT route (exported; the route passes its `getDb()` handle so tests can inject a temp DB):

```ts
export type LikhaDecisionOutcome =
  | { ok: true; response: LikhaVerificationResponse }
  | { ok: false; kind: 'not_found' | 'conflict' | 'invalid'; error: string };

export function applyVerificationDecision(params: {
  recordId: string;
  userId: string;
  body: LikhaVerificationRequest;
  pipelineId?: string;        // defaults to 'verification-<recordId>'
  db?: import('better-sqlite3').Database;  // DI for tests; default getDb()
}): LikhaDecisionOutcome;
```

Logic: load the row (missing → `not_found`). If `expectedUpdatedAt` provided and ≠ stored `updated_at` → `conflict`. If `archive_status !== 'pending_review'` → `conflict` ("Record already finalized"). Validate per action: `reject` requires non-empty `reason` (else `invalid`); `edit` validates provided fields (`ordinanceNumber`/`seriesYear` positive integers, `title` non-empty string, `sectionCount` integer ≥ 0, every subject ∈ `LIKHA_SUBJECTS` from `@/types/likha`) else `invalid`. Execute inside a `db.transaction`: guarded UPDATE `… WHERE id = ? AND archive_status = 'pending_review'` (`changes === 0` → `conflict`); **approve** sets `verified_by_id`, keeps `pending_review` (Archiver wired in S3-C5), audit row `agent_id=5, agent_name='Legal Validator', action='confirm'`, `output_snapshot` `{decision:'approve'}`; **edit** applies fields (`subject_tags` = `JSON.stringify(subjects)`, `section_count`), sets `verified_by_id`, keeps `pending_review`, audit row `action='confirm'`, `reason='edit'`, `output_snapshot` = edited fields JSON; **reject** sets `archive_status='flagged'`, `rejection_reason=reason`, `verified_by_id`, audit row `action='reject'` with `reason`. All audit rows: `module='likha'`, `pipeline_id`, `user_id=userId`, `input_snapshot` = `{recordId, action}`. Catch `SQLITE_CONSTRAINT_UNIQUE` → `conflict`. Call `logModuleEvent({module:'likha', interactionType:'likha_verification', content: JSON.stringify({recordId, action, …}), ipAddress:'127.0.0.1', participantSessionId:'likha-'+userId})`. Map to `LikhaVerificationResponse` (`published: false` in this chunk).
- Import additions allowed: `LikhaValidationResult`, `LikhaVerificationRequest`, `LikhaVerificationResponse` from `@/types/likha`.

**(c) `src/app/api/likha/archive/[id]/route.ts`** (NEW; folder `src/app/api/likha/archive/[id]/`): `export const runtime = 'nodejs';`. Follow the repo's dynamic-route pattern exactly (`withUserAuth(async (request, { params }: { params: Promise<{ id: string }> }) => { const { id } = await params; … })`).
- **GET** → load the row; 404 `{ error: 'Record not found', code: 'NOT_FOUND' }` if missing. Derive scan MIME from the `original_filename`/`scan_file_path` extension with the SAME logic as the pipeline route's `mimeFromFilename`; `scanAvailable = Boolean(scan_file_path && fs.existsSync(resolved))`. Respond `LikhaRecordDetailResponse` (map snake_case row → `ArchivedOrdinance`, parse `extraction_confidence` + `subject_tags` JSON defensively).
- **PUT** → parse `LikhaVerificationRequest`; malformed body/unknown action → 400 `{ error, code: 'INVALID_BODY' }`. Call `applyVerificationDecision({ recordId: id, userId: user.user.id, body })`; map outcome: `not_found` → 404, `invalid` → 400 `{ error, code: 'VALIDATION' }`, `conflict` → **409** `{ error, code: 'CONFLICT' }`, ok → 200 with the response. Imports: `next/server`, `@/lib/user-auth-middleware`, `@/lib/likha/agents`, `@/lib/db`, `@/types/likha`, `node:fs`, `node:path`.

**(d) `src/app/api/likha/archive/[id]/scan/route.ts`** (NEW — decision D15): GET only, `withUserAuth`. Load row (404 if missing / no `scan_file_path` / file absent on disk). Stream the bytes: `new Response(buffer, { headers: { 'Content-Type': <mime>, 'Content-Disposition': 'inline; filename="<sanitized>"' } })`. NEVER serve paths outside `data/uploads/likha/` (reject if the resolved path escapes it).

**REFACTOR:** keep audit inserts in the existing `recordDecision` style; zero `linaw` tokens in all five files; Sprint-2 tests (`likha-metadata.test.ts`) must still pass unchanged.

**acceptance_criteria:**

1. All 6 test groups pass hermetically: `npx tsx --test tests/integration/likha-verification.test.ts` exit 0.
2. Agent 5 raises `low_confidence_metadata` exactly when a critical field confidence <0.7 or the scan is unreadable (PRD §12.4 row 1); gate rows land in `agent_decisions` (`action='hitl'`).
3. Every human decision persists to `agent_decisions` with `module='likha'`, `user_id`, reason (reject/edit), timestamp; `interaction_logs` row with `module='likha'`.
4. Reject → `archive_status='flagged'` + `rejection_reason` (decision D10); rejected rows can no longer be approved (409). No `'rejected'` CHECK value introduced.
5. 409 per decision D17 (status guard, UNIQUE collision, `expectedUpdatedAt`).
6. db.ts diff: only the two appended ALTER blocks; Sprint-1/2 DDL byte-identical.
7. No L005/L006 scope: no BM25, no publish status change, no list/search route, agents 6 untouched except its `AGENT_NAMES` entry.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

git diff --unified=0 -- src/lib/db.ts | grep -c '^-[^-]'
# expected: 0
git diff --unified=0 -- src/lib/db.ts | grep -c 'section_count\|rejection_reason'
# expected: >= 2

grep -c "low_confidence_metadata" src/lib/likha/agents.ts
# expected: >= 1

grep -c "withUserAuth" "src/app/api/likha/archive/[id]/route.ts" "src/app/api/likha/archive/[id]/scan/route.ts"
# expected: 1 and 1

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/lib/likha "src/app/api/likha/archive" tests/integration/likha-verification.test.ts
# expected: no output, exit code 1 (zero hits)

grep -REin "linaw" src/lib/likha "src/app/api/likha/archive" tests/integration/likha-verification.test.ts
# expected: no output, exit code 1

npx tsx --test tests/integration/likha-metadata.test.ts tests/integration/likha-verification.test.ts
# expected: ALL subtests pass (Sprint-2 regression intact), exit code 0
```

---

### S3-C4 — L004 UI: `src/components/likha/verification-panel.tsx`

```json
{
  "chunk_id": "S3-C4",
  "feature_id": "L004",
  "chunk_type": "frontend_component",
  "name": "Side-by-side HITL verification dialog — scan (zoom/rotate) ↔ editable fields with per-field confidence (rose <0.7), Reject / Edit & Save / Approve & Publish, focus-trapped, Esc closes",
  "parallel_group": "GROUP-B",
  "dependencies": ["S3-C1"],
  "file_outputs": ["src/components/likha/verification-panel.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/likha/verification-panel.tsx` (`'use client';`) — the LIKHA HITL verification dialog per DESIGN.md §2.3 and PRP-LIKHA "Verification Panel". Allowed imports: `react`, `lucide-react` (`X`, `ZoomIn`, `ZoomOut`, `RotateCw`, `CheckCircle2`, `AlertTriangle`, `Hand`, `Loader2`), `@/lib/utils` (`cn`), types + `LIKHA_SUBJECTS` from `@/types/likha`. NO `getDb`, NO `@/lib/likha/*` imports, NO kit modifications.

Props:

```ts
interface VerificationPanelProps {
  recordId: string;
  /** When present, the panel renders the rose gate styling + agent note for these exceptions. */
  gate?: { exceptions: string[] } | null;
  onClose: () => void;
  /** Called after a successful PUT so the page can update feed/pipeline state. */
  onDecision?: (result: { action: 'approve' | 'edit' | 'reject'; recordId: string; published: boolean }) => void;
}
```

Behavior contract:

1. **Data load:** on mount, `fetch('/api/likha/archive/' + recordId)` → `LikhaRecordDetailResponse`; loading spinner; error state with retry button. Local editable state initialized from the record: `ordinanceNumber`, `seriesYear`, `title`, `sectionCount`, `subjects: string[]` (from `subjectTags`), plus the per-field confidence map from `record.extractionConfidence`.
2. **Layout (DESIGN.md §2.3):** modal overlay (fixed inset-0, `bg-black/60`, content `w-[90%] max-w-6xl max-h-[90vh] overflow-auto rounded-xl border border-[#283147] bg-[#0F1729]`). Header: "VERIFY EXTRACTION — <originalFilename>" + close `X` button (≥44px target). Body grid: `md:grid-cols-2` — LEFT "ORIGINAL SCAN", RIGHT "EXTRACTED TEXT (editable)". Below 640px the dialog stacks full-screen with the scan ABOVE the text (DESIGN.md §6).
3. **Left pane — scan viewer:** if `scanMimeType` is an image type → `<img src={scanUrl}>` inside an overflow-auto container with client-side transform `scale(zoom) rotate(rotation)` (`transform-origin: top left`); controls row `[zoom -] [zoom +] [rotate]` (min-h-11 buttons; zoom 0.5–3 step 0.25; rotation 0/90/180/270). If `scanMimeType === 'application/pdf'` → `<iframe src={scanUrl} className="h-[420px] w-full">` + a plain "Open scan in new tab" link (native viewer). If `!scanAvailable` → rose note "Scan unavailable".
4. **Right pane — editable fields:** labeled inputs for Ordinance No. (number), Series Year (number), Title (textarea), Sections (number), and Subjects as a checkbox multi-select over `LIKHA_SUBJECTS`. **Per-field confidence display:** under each of the four parsed fields show `confidence: 0.XX`; when confidence `< 0.7` render the field's border + confidence text in rose (`#F43F5E`) — exactly the PRP rule "any field <0.7 renders rose".
5. **Agent note:** when `gate` is provided, render a rose-bordered note block: "Agent note (Legal Validator): " + the exceptions joined; otherwise render nothing.
6. **Decision bar (pinned bottom on mobile per DESIGN.md §7):** reason input (label "Decision reason (required on reject)") + three buttons: `[ Reject ]` (rose outline), `[ Edit & Save ]` (gray `#334155`), `[ Approve & Publish ]` (accent `#0038A8`, white text) — all `min-h-11`, keyboard-reachable.
   - **Reject:** disabled until reason is non-empty; PUT `{action:'reject', reason}`.
   - **Edit & Save:** PUT `{action:'edit', fields:{…edited values…}}` (subjects included); on success show confirmed state and call `onDecision`.
   - **Approve & Publish:** PUT `{action:'approve'}` (include `fields` only if the user edited something); on success call `onDecision` with the server's `published` flag.
   - All PUTs to `/api/likha/archive/<recordId>` with `Content-Type: application/json`; handle 409 → inline rose error "Record changed or already finalized — reload and retry"; 400 → show server `error`; in-flight → buttons disabled with `Loader2`.
7. **A11y (DESIGN.md §6):** `role="dialog"` `aria-modal="true"` `aria-label="Verify extraction"`; focus trap — on open focus the first field, Tab/Shift+Tab cycle WITHIN the dialog only (query focusable elements, wrap at ends); **Esc closes** (keydown listener → `onClose`); backdrop click closes; focus returns to the previously focused element on close. Visible focus rings `#22D3EE` 2px.
8. Styling stays foundation-compatible (dark tokens `#0F1729`/`#1E293B`/`#283147`/`#94A3B8`, agent-text-safe variants where text is agent-colored); legal excerpt text uses the serif stack per DESIGN.md §4; zero `linaw` tokens; self-contained `useState`/`useEffect`/`useRef` state.

Export `export default function VerificationPanel(props: VerificationPanelProps)`.

**acceptance_criteria:**

1. Component compiles under `strict: true`, is `'use client'`, and implements the DESIGN.md §2.3 layout (scan left / editable right / agent note / reason / three actions).
2. Per-field confidence rendered; `< 0.7` fields rose; rose gate note when `gate` present.
3. Reject disabled without reason; all three actions PUT the S3-C3 contract; 409/400 handled inline.
4. Focus-trapped, Esc closes, keyboard operable; mobile stacks scan above text; touch targets ≥44px.
5. No server-only imports; no kit edits.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "'use client'" src/components/likha/verification-panel.tsx
# expected: 1

grep -REn "from ['\"]@/(lib/db|lib/likha|app/api)" src/components/likha/verification-panel.tsx
# expected: no output, exit code 1 (client component — no server imports)

grep -c "Approve & Publish" src/components/likha/verification-panel.tsx && grep -c "Edit & Save" src/components/likha/verification-panel.tsx && grep -c "0.7" src/components/likha/verification-panel.tsx
# expected: >= 1, >= 1, >= 1

grep -c "Escape" src/components/likha/verification-panel.tsx
# expected: >= 1  (Esc closes)

grep -ic "linaw" src/components/likha/verification-panel.tsx
# expected: 0
```

---

### S3-C5 — L005: `src/lib/likha/search.ts` BM25 namespace + Archiver + publish wiring (TDD)

```json
{
  "chunk_id": "S3-C5",
  "feature_id": "L005",
  "chunk_type": "library",
  "name": "LIKHA-owned BM25 index (sibling-pattern namespace file), Archiver agent 6 publish gated on human approval, approve-branch wiring, index entry create/update, search <500ms with highlights",
  "parallel_group": "GROUP-C",
  "dependencies": ["S3-C3"],
  "file_outputs": ["src/lib/likha/search.ts", "src/lib/likha/archiver.ts", "src/app/api/likha/archive/[id]/route.ts", "tests/unit/likha-search.test.ts", "tests/integration/likha-publish.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement L005 with TDD: the Archiver (agent 6, 1000ms slot) runs ONLY after human confirmation (constraint 3 / PRD data rule) and publishes: `archive_status → 'published'`, hash stays cached (`file_hash` already stored — never cleared), and a BM25 index entry is created/updated in LIKHA's OWN namespace.

**RED — write the failing tests FIRST (two files):**

**(t1) `tests/unit/likha-search.test.ts`** (`node:test`, relative import `../../src/lib/likha/search`). Every test constructs the module with an injected temp path: the module MUST expose `createLikhaSearch(opts: { indexPath: string; db?: () => import('better-sqlite3').Database })` returning `{ indexRecord, removeRecord, search, rebuildIndex, stats }` AND a default singleton `likhaSearch` that reads `process.env.LIKHA_SEARCH_INDEX_PATH || path.join(process.cwd(), 'src/lib/data/likha-search-index.json')` lazily. Tests use `createLikhaSearch({ indexPath: tempIndexPath() })` — the dev index file is NEVER touched. Subtests:
1. **index entry create/update:** `indexRecord({id, ordinanceNumber, seriesYear, title, content, status, subjectTags})` → `stats().totalDocs === 1`; re-index same id with new title → still 1 doc, title updated (create/updated semantics per L005).
2. **file shape (sibling pattern):** after indexing, the JSON on disk parses to `{documents, idf, avgDocLength, totalDocs}` (same four keys as `src/lib/data/search-index.json`).
3. **BM25 ranking + filters:** seed ~12 records (varied years/status/subjects, one containing "business permit fees" in content and title); `search('business permit fees', {})` ranks the title-match first; `yearFrom`/`yearTo` exclude out-of-range docs; `status:'amended'` filters; `subject` filters on `subjectTags`; empty query returns `[]` (listing without q is SQL-side).
4. **highlighted snippets:** result `snippet` contains `<mark>business permit fees</mark>`-style wrapping of matched terms, is ≤ 280 chars, and any `<`/`>` in the SOURCE text is escaped (`&lt;`/`&gt;`) BEFORE marking — prove with a record whose content contains `<script>` (snippet must NOT contain a raw `<script>`).
5. **<500ms contract on a seeded set:** index 500 generated records (deterministic lorem-ordinance text, varied terms/years), then `search('permit fees', {})` — assert `Date.now()` delta `< 500` (first call after load included).
6. **lazy rebuild:** delete the index file, seed 2 `'published'` rows into a temp DB (inject `db` factory), call `rebuildIndex()` → `stats().totalDocs === 2`; `search` finds them.

**(t2) `tests/integration/likha-publish.test.ts`** (hermetic like `likha-verification.test.ts`: temp DB + `LIKHA_SEARCH_INDEX_PATH = tempIndexPath()` set BEFORE dynamic imports of `../../src/lib/likha/archiver` and `../../src/lib/db`). Subtests:
1. **publish on approval:** seed a `pending_review` row (helper) → `publishApprovedRecord({recordId, userId, pipelineId})` → row `archive_status='published'`, `file_hash` intact, `verified_by_id` set; index `stats().totalDocs === 1` and the entry's id matches; `agent_decisions` rows: agent 6 `'start'` + `'complete'` (`agent_name='Archiver'`, `output_snapshot` containing `bm25Indexed: true`).
2. **GATING — cannot publish without approval:** rows seeded as `'processing'`, `'flagged'` (rejected), and already-`'published'` each → publish refuses (returns conflict/refusal, no status change, no index entry, no agent-6 complete row). This is the Archiver-gating acceptance test.
3. **re-publish updates the entry:** approve-flow publish, then edit-approve again with new title (simulate by resetting the row to `pending_review` then publishing) → index still 1 doc with the new title.

**GREEN — implement:**

**(a) `src/lib/likha/search.ts`** — LIKHA-owned BM25 namespace manager (decision D13). Imports allowed: `node:fs`, `node:path`, `@/types/likha` (types only), and `@/lib/db` ONLY inside `rebuildIndex()` (injected in tests). Requirements:
- Index file shape mirrors the sibling: `{ documents: LikhaIndexDoc[], idf: Record<string, number>, avgDocLength: number, totalDocs: number }` where `LikhaIndexDoc = { id: string; ordinanceNumber: number; seriesYear: number; title: string; status: string; subjectTags: string[]; sectionCount: number | null; createdAt: string; terms: string[]; titleTerms: string[]; content: string }` (content kept for snippet extraction — pilot scale, decision D13).
- Tokenizer: lowercase, strip non-alphanumerics (keep digits — years matter), split, drop tokens <2 chars.
- `indexRecord(rec)`: upsert by id; recompute `idf` (standard `ln((N - df + 0.5)/(df + 0.5) + 1)`), `avgDocLength`, `totalDocs`; write atomically (`writeFileSync` to `<file>.tmp` then `renameSync`).
- `removeRecord(id)`, `stats()` (`{totalDocs}`), `rebuildIndex()` (clear + reindex every `archive_status='published'` row from the DB).
- `search(q, filters: {yearFrom?, yearTo?, status?, subject?, page?, limit?})`: metadata-filter first, BM25 score (k1 = 1.2, b = 0.75; title terms weighted ×2), rank desc, paginate (default page 1 / limit 20), snippet = best ~240-char content window around the densest query-term cluster with ALL query-term occurrences wrapped in `<mark>` AFTER HTML-escaping the window text; returns `{items, total, page, limit}` shaped for `LikhaArchiveListItem` (without `archiveStatus` — callers set it). Load the index lazily into memory on first use; if the file is missing, start empty (server callers may `rebuildIndex()`).
- NO sibling-module imports; NO writes outside the injected path; zero console logging.

**(b) `src/lib/likha/archiver.ts`** — agent 6. Imports: `@/lib/db`, `@/lib/logger`, `@/lib/likha/search`, `@/types/likha`, `node:crypto`. Exports:

```ts
export type LikhaPublishOutcome =
  | { ok: true; published: true }
  | { ok: false; kind: 'not_found' | 'conflict'; error: string };

/** Agent 6 (Archiver) — runs ONLY after a human approve decision (decision D16/D19). */
export function publishApprovedRecord(params: {
  recordId: string;
  userId: string;
  pipelineId?: string;      // defaults to 'publish-<recordId>'
  db?: import('better-sqlite3').Database;
}): LikhaPublishOutcome;
```

Logic: load row (missing → `not_found`). If `archive_status !== 'pending_review'` → `conflict` ("Archiver refused: record not approved for publish") — THIS is the gate. Agent-6 `'start'` audit row (`module='likha'`, `agent_id=6`, `agent_name='Archiver'`). Guarded UPDATE `SET archive_status='published', updated_at=datetime('now') WHERE id=? AND archive_status='pending_review'` (changes 0 → conflict). Index entry create/update via `likhaSearch.indexRecord(…)` (map the row; parse `subject_tags` JSON defensively). Agent-6 `'complete'` row with `output_snapshot = JSON.stringify({archiveStatus:'published', bm25Indexed:true})`. `logModuleEvent({module:'likha', interactionType:'likha_publish', …})`. Index write failure → still mark the row published BUT record an agent-6 `'error'` row and rethrow-safe return `{ok:false, kind:'conflict', …}`? NO — instead: wrap index write in try/catch; on failure log an `'error'` audit row and STILL return ok (publish must not be lost to an index hiccup; `rebuildIndex()` heals). Document this in a code comment.

**(c) Wire the approve branch:** in `src/app/api/likha/archive/[id]/route.ts` PUT, when `applyVerificationDecision` returns ok for `action:'approve'`, immediately call `publishApprovedRecord({recordId: id, userId: user.user.id})`; on ok set the response `archiveStatus:'published'`, `published:true`; on its `conflict` return 409 `{error, code:'CONFLICT'}`. Additive imports only (`@/lib/likha/archiver`). Also extend `AGENT_NAMES` usage — no change needed (S3-C3 already listed agent 6). In `src/lib/likha/agents.ts` make NO functional change beyond what S3-C3 left (the publish path lives in archiver.ts — keep agents.ts stable).

**REFACTOR:** BM25 scoring in one pure function (`scoreDocument(terms, queryTerms, idf, avgDocLength)`); snippet builder pure + unit-tested via `search`. Zero `linaw` tokens everywhere.

**acceptance_criteria:**

1. Both new test files pass hermetically: `npx tsx --test tests/unit/likha-search.test.ts tests/integration/likha-publish.test.ts` exit 0; Sprint-2/earlier-Sprint-3 hermetic suites still green.
2. Archiver NEVER publishes without approval (gating subtest: processing/flagged/published rows all refused); approved publish → `published` + index entry + agent-6 audit rows.
3. Index file is LIKHA's own (`likha-search-index.json`), sibling-shaped, atomically written, lazily rebuildable; dev index untouched by tests.
4. Search <500ms over 500 seeded docs; snippets highlighted AND escape-safe.
5. Rejected rows never appear publishable; re-publish updates (never duplicates) the entry.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "createLikhaSearch\|likhaSearch" src/lib/likha/search.ts
# expected: >= 2

grep -c "archive_status='pending_review'\|archive_status = 'pending_review'\|archive_status !== 'pending_review'" src/lib/likha/archiver.ts
# expected: >= 1  (the publish gate)

grep -c "'Archiver'" src/lib/likha/archiver.ts
# expected: >= 1

grep -REn "from ['\"]@/(lib/ai/lightrag|app/api/(obra|chat|linaw)|lib/linaw)" src/lib/likha
# expected: no output, exit code 1 (LightRAG unwired — decision D14; boundaries clean)

grep -REin "linaw" src/lib/likha tests/unit/likha-search.test.ts tests/integration/likha-publish.test.ts
# expected: no output, exit code 1

npx tsx --test tests/unit/likha-search.test.ts tests/integration/likha-publish.test.ts
# expected: all subtests pass, exit code 0

npx tsx --test tests/integration/likha-verification.test.ts tests/integration/likha-metadata.test.ts
# expected: still green (regression within the sprint), exit code 0
```

---

### S3-C6 — L006 server: `GET /api/likha/archive` (search/list) + `GET /api/likha/stats` + API-level tests (TDD)

```json
{
  "chunk_id": "S3-C6",
  "feature_id": "L006",
  "chunk_type": "api_route",
  "name": "Archive list/search route (q/yearFrom/yearTo/status/subject/archiveStatus/page/limit, <500ms, highlighted snippets) + stats route + API-level integration suite",
  "parallel_group": "GROUP-D",
  "dependencies": ["S3-C5"],
  "file_outputs": ["src/app/api/likha/archive/route.ts", "src/app/api/likha/stats/route.ts", "tests/integration/likha-archive.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement L006's server side with TDD. API-level tests run against the dev server (`npm run dev`) exactly like Sprint 2's `likha-upload.test.ts` (helper: `assertServerReachable`, `seedApprovedUser`, `BASE_URL`).

**RED — write the failing test FIRST:** `tests/integration/likha-archive.test.ts`. Suite body runs inside `test('likha archive suite', async (t) => { await assertServerReachable(); const { userId, cookie, cleanup } = seedApprovedUser(); t.after(cleanup); … })`. Seed test records DIRECTLY into the dev DB (`data/workshop.db`) with better-sqlite3: 3 `published` rows (distinct ordinance numbers/years 2019/2023/2024, one titled about "business permit fees" with that phrase also in `content`, statuses `active`/`amended`/`active`, `subject_tags` `["Taxation & Revenue"]` on one), 1 `pending_review` row, 1 `flagged` row with `rejection_reason`. IMPORTANT: after seeding `published` rows, sync the dev server's index by calling the rebuild path — since tests cannot reach into the server process, instead index entries get created by the publish route; for LIST (no q) tests plain SQL rows suffice, and for SEARCH tests perform the publish flow over HTTP (PUT approve with cookie) on 2 of the seeded `pending_review` rows so the server-side Archiver indexes them. Clean up all seeded rows + their `agent_decisions` rows in `t.after`. Subtests:
1. **auth:** GET `/api/likha/archive` and `/api/likha/stats` without cookie → 401 `{error:'Authentication required', code:'NO_SESSION'}`.
2. **list default = published only:** GET `/api/likha/archive` (cookie) → 200 `LikhaArchiveSearchResponse` shape (`items,total,page,limit,tookMs`); every item `archiveStatus === 'published'`; no `pending_review`/`flagged` rows leak.
3. **search q + highlighted snippets + latency:** after HTTP-approving the "business permit fees" record, GET `/api/likha/archive?q=business%20permit%20fees` → ≥1 item whose `snippet` contains `<mark>business permit fees</mark>` (case-insensitive match allowed: `<mark>` wrapping of the matched term), `score` present, `tookMs < 500`.
4. **filters:** `?yearFrom=2023&yearTo=2024` excludes the 2019 doc; `?status=amended` returns only the amended doc; `?subject=Taxation%20%26%20Revenue` returns the tagged doc; `?archiveStatus=pending_review` returns the pending row (verification queue — decision D18).
5. **pagination:** seed-list with `?page=1&limit=2` → `items.length <= 2`, `total` reflects all matches, `page === 1`; `limit > 100` clamps to 100.
6. **stats:** GET `/api/likha/stats` → counts consistent with seeded data (`published`, `pendingReview`, `flagged`, `archived` = sum; `byYear` includes 2023; `byStatus` includes `amended`; `bySubject` includes `Taxation & Revenue`; `bm25Indexed >= 1`).
7. **PUT round-trip over HTTP (regression-adjacent, exercises S3-C3/C5 through the wire):** PUT approve a fresh seeded pending row → 200 `published:true`; PUT approve AGAIN → **409** `code:'CONFLICT'`; PUT reject with reason on another row → 200 `archiveStatus:'flagged'`; PUT reject WITHOUT reason → 400.

**GREEN — implement:**

**(a) `src/app/api/likha/archive/route.ts`** — `export const runtime = 'nodejs';` `export const GET = withUserAuth(async (request, { user }) => { … })`. Parse searchParams: `q`, `yearFrom`, `yearTo` (integers), `status` (validate against the legal-status union; invalid → 400), `subject`, `archiveStatus` (default `'published'`; validate against the archive_status union), `page` (default 1, min 1), `limit` (default 20, min 1, **clamp max 100**).
- **With `q`:** delegate to `likhaSearch.search(q, {yearFrom, yearTo, status, subject, page, limit})`; if the index is empty/missing call `rebuildIndex()` once and retry (self-healing); map items to `LikhaArchiveListItem` adding `archiveStatus` (from the index doc's stored archive status or the param default). `tookMs = Date.now() - start`.
- **Without `q`:** SQL over `archived_ordinances` — WHERE `archive_status = ?` (+ `series_year BETWEEN` when yearFrom/yearTo, + `status = ?`, + `subject_tags LIKE '%"…%"'` with the escaped subject), ORDER BY `series_year DESC, ordinance_number DESC`, LIMIT/OFFSET; `total` via COUNT; `snippet` = escaped first ~200 chars of `content` (no `<mark>` without a query). Escape ALL snippet text server-side (escape-then-mark rule).
- Respond 200 `LikhaArchiveSearchResponse`. `logModuleEvent` NOT required for reads (writes-only logging rule) — but DO log when `rebuildIndex()` fires (`interactionType: 'likha_index_rebuild'`).

**(b) `src/app/api/likha/stats/route.ts`** — GET with `withUserAuth`. Aggregate from `archived_ordinances`: total, by `archive_status` (map to `published/pendingReview/flagged` + processing folded into `archived` only), `byYear` (GROUP BY `series_year` over published), `byStatus` (GROUP BY legal `status` over published), `bySubject` (parse `subject_tags` JSON of published rows, count), `bm25Indexed = likhaSearch.stats().totalDocs`. Respond `LikhaStatsResponse`.

Imports for both routes: `next/server`, `@/lib/user-auth-middleware`, `@/lib/db`, `@/lib/likha/search`, `@/lib/logger` (rebuild log only), `@/types/likha`. NO sibling-module imports.

**REFACTOR:** one shared `escapeHtml` + `parseSubjectTags` local helpers (duplicate tiny helpers rather than importing across module boundaries). Zero `linaw` tokens.

**acceptance_criteria:**

1. All 7 subtests pass against the dev server: `npm run test:integration` exit 0 (upload suite stays green too).
2. Contract params per PRD §12.6 + additive `archiveStatus` (decision D18); snippets highlighted for q-searches and escape-safe; `tookMs` reported and <500 in tests.
3. Stats consistent with DB + BM25 index size.
4. 401/400/409 envelopes match the shared conventions.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "withUserAuth" src/app/api/likha/archive/route.ts src/app/api/likha/stats/route.ts
# expected: 1 and 1

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export|lightrag)|linaw)|components/(ella|obra|yala|linaw))" src/app/api/likha
# expected: no output, exit code 1

grep -ic "linaw" src/app/api/likha/archive/route.ts src/app/api/likha/stats/route.ts tests/integration/likha-archive.test.ts
# expected: 0, 0, 0

# Live contract (dev server running in another terminal):
npm run test:integration
# expected: likha-upload (7 subtests, Sprint-2 regression) + likha-archive (7 subtests) all pass, exit code 0
```

---

### S3-C7 — L006 UI: `src/components/likha/archive-browser.tsx`

```json
{
  "chunk_id": "S3-C7",
  "feature_id": "L006",
  "chunk_type": "frontend_component",
  "name": "Archive browser — debounced search, year/status/subject filters, stats header, result cards with highlighted terms, pagination",
  "parallel_group": "GROUP-B",
  "dependencies": ["S3-C1"],
  "file_outputs": ["src/components/likha/archive-browser.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/likha/archive-browser.tsx` (`'use client';`) implementing DESIGN.md §2.1 (Archive Browser tab). Allowed imports: `react`, `lucide-react` (`Search`, `ChevronLeft`, `ChevronRight`, `FileText`, `X`), `@/lib/utils` (`cn`), types + `LIKHA_SUBJECTS` from `@/types/likha`. NO server imports, NO kit modifications. Response shapes are pinned by S3-C1's types (`LikhaArchiveSearchResponse`, `LikhaStatsResponse`) — code against them; the routes land in S3-C6.

Props: `{ className?: string }`. Behavior contract:

1. **Stats header** (on mount, GET `/api/likha/stats`): one muted line "Archived: N | Published: N | Pending review: N | Flagged: N" + right-aligned "BM25 index: N records" (DESIGN.md footer line). Silent failure (hide the line) if the fetch errors.
2. **Search row:** text input with `Search` icon, placeholder `"business permit fees"`; **debounce 300ms** before fetching (single in-flight request; cancel/ignore stale responses via a request-id guard). Enter also triggers immediately.
3. **Filters row:** Year `[number input from]`–`[number input to]`, Status select (`All` + `active/amended/repealed/superseded/expired`), Subject select (`All` + `LIKHA_SUBJECTS`), `[ Clear ]` button resetting everything. Any change re-fetches (debounced for year inputs).
4. **Fetch:** GET `/api/likha/archive?q=&yearFrom=&yearTo=&status=&subject=&page=&limit=20` (always `archiveStatus=published`). States: loading (muted "Searching…"), error (rose inline), empty ("No ordinances match — adjust filters or search terms."), results.
5. **Results:** heading "RESULTS (total)". One card per `LikhaArchiveListItem`: line 1 — `Ordinance No. <n>, S. <year>` (H3 weight, ui-monospace for the number) + legal-status badge (uppercase, bordered; `ACTIVE` green, `AMENDED` yellow, `REPEALED` rose, others muted) + subject chips; line 2 — title (serif stack per DESIGN.md §4); line 3 — the `snippet` rendered via `dangerouslySetInnerHTML` (SAFE: server escapes text before wrapping matches in `<mark>` — never render client-built HTML); line 4 — "Enacted <createdAt date> | <sectionCount> sections" caption. Hover/focus outline `#22D3EE`; cards are `<article>` elements (no dead links this sprint — View/PDF actions are post-MVP).
6. **Pagination:** `[ < ]` / page indicator "Page X of Y" / `[ > ]` buttons (min-h-11), disabled at bounds; driven by `total`/`limit`.
7. **Perf guard:** result cards render the server's `tookMs` as a tiny caption "searched in <n>ms" (acceptance evidence visible in UI).
8. Styling: dark tokens consistent with the LIKHA page (`#1E293B` cards, `#283147` borders, `#94A3B8` muted); responsive — filters wrap at 360px; zero `linaw` tokens.

Export `export default function ArchiveBrowser(props: { className?: string })`.

**acceptance_criteria:**

1. Component compiles under `strict: true`, `'use client'`, implements DESIGN.md §2.1 structure (stats header / search / filters / results / pagination).
2. Debounced search (300ms) with stale-response guard; filters map 1:1 to the GET contract; highlighted snippets rendered from server markup only.
3. No server-only imports; no kit edits; keyboard-operable controls.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "'use client'" src/components/likha/archive-browser.tsx
# expected: 1

grep -REn "from ['\"]@/(lib/db|lib/likha|app/api)" src/components/likha/archive-browser.tsx
# expected: no output, exit code 1

grep -c "dangerouslySetInnerHTML" src/components/likha/archive-browser.tsx && grep -c "300" src/components/likha/archive-browser.tsx
# expected: >= 1, >= 1

grep -ic "linaw" src/components/likha/archive-browser.tsx
# expected: 0
```

---

### S3-C8 — `src/app/likha/page.tsx`: complete the LIKHA page (agents 4–6 wired, HITL queue, browser tab)

```json
{
  "chunk_id": "S3-C8",
  "feature_id": "L004+L005+L006 (UI wiring; completes the LIKHA page)",
  "chunk_type": "frontend_page",
  "name": "Pipeline visualization for all 6 agent cards (agent 4 pass-through, agent 5 HITL pause, agent 6 on approve), hitlQueue + verification panel mount, feed Confirm/Edit/Reject flows, Archive Browser tab live",
  "parallel_group": "GROUP-E",
  "dependencies": ["S3-C3", "S3-C4", "S3-C5", "S3-C6", "S3-C7"],
  "file_outputs": ["src/app/likha/page.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

REPLACE `src/app/likha/page.tsx` wholesale (Sprint-2 version, same precedent as S2-C8). `'use client';`. Allowed imports: `react`, `lucide-react`, `@/lib/utils` (`cn`), the shared kit (`@/components/agent-pipeline`, `@/components/activity-feed` — props ONLY), `@/components/likha/upload-dropzone`, `@/components/likha/verification-panel`, `@/components/likha/archive-browser`, `@/types/likha` (incl. `LIKHA_AGENT_DEFS`, `LikhaHitlItem`, `LikhaValidationResult`), `@/types/agentic`. NO `getDb`, NO `@/lib/likha/*` imports, NO kit edits.

Preserve from Sprint 2: shell tokens (`--pillar-*`), H1/subtitle, the `data-likha-copy` script tag, tab structure and DEFAULT active tab `'upload'` (regression smoke depends on it), `UploadDropzone` wiring, agents 1–3 orchestration (identical behavior), batch footer line. Extend as follows:

1. **State additions:** `hitlQueue: LikhaHitlItem[]`, `verifyRecordId: string | null` (panel mount), `awaitingDecision: Array<{ recordId: string; activityId: string }>` (records awaiting a human decision), keep `agents/activities/isProcessing/pipelineComplete/lastBatch`.
2. **Agent 4 (Subject Classifier) — S3 pass-through (decision D12):** after agent 3 completes: `setAgent(4, {status:'processing'})`; `await sleep(1200)`; complete with `output = { preview: 'Subjects suggested', subjects: [], success: true }`. NO classification UI, NO gate from agent 4 this sprint.
3. **Agent 5 (Legal Validator) — HITL wiring (PRD §12.4 row 1 + WORKFLOW callbacks):** after agent 4: `setAgent(5, {status:'processing'})`; `await sleep(1200)`; read each pipeline file result's `validation` (server ran agent 5 — S3-C3):
   - Per file with `validation.hitlRequired === true`: agent 5 → `'hitl'` (rose Hand via kit), `output = { preview: 'Validation complete — review required', hitlRequired: true, exceptions }`; add a rose HITL activity (`type:'hitl'`, `status:'pending'`, title "REVIEW REQUIRED — Ordinance No. <n> S. <year> low confidence", details = first exception, `data` = `{ recordId, …metadata }`); push a `LikhaHitlItem` `{ id: uuid, activityId, agentId: 5, module:'likha', gate:'low_confidence_metadata', fieldSchema: { ordinanceNumber:{type:'number',…}, seriesYear:{type:'number',…}, title:{type:'text',…}, sectionCount:{type:'number',…}, subjects:{type:'multiselect',…} }, suggestedAction:'edit', context:{…} }` into `hitlQueue`.
   - Per clean file: add a pending review activity (`type:'success'`, `status:'pending'`, title "Ready for verification — Ordinance No. <n> S. <year>", `data.recordId`).
   - Always track `{recordId, activityId}` in `awaitingDecision` for EVERY accepted file (every record needs human approval before the Archiver may run — constraint 3).
   - Then `setIsProcessing(false)` (pipeline paused at the human gate — decision D16; uploads re-enabled while decisions pending).
4. **Feed handlers (DESIGN.md §2.2 Confirm/Edit flows):** pass to `<ActivityFeed>`:
   - `onConfirm(activityId)` / `onEdit(activityId)` → open the verification panel for that item's `recordId` (`setVerifyRecordId`). (Both routes lead to side-by-side review — the legal-safe flow; inline scalar editing alone cannot approve.)
   - `onReject(activityId, reason)` → `PUT /api/likha/archive/<recordId>` `{action:'reject', reason}`; on 200 mark the activity `status:'rejected'` with the reason, remove from `awaitingDecision`/`hitlQueue`, add no publish; on 409 → error activity "Record already finalized".
5. **Panel decision callback (`onDecision`):**
   - `action:'approve'` (server has already published — S3-C5): mark the activity `status:'confirmed'`; remove from queues; run **agent 6 (Archiver) visualization**: `setAgent(6,{status:'processing'})`; `await sleep(1000)`; complete with `output = { preview: 'Published to archive', archiveStatus:'published', bm25Indexed:true, success:true }` (real work already done server-side inside the PUT); add success activity "Published: Ordinance No. <n>, S. <year>".
   - `action:'edit'`: mark activity `status:'confirmed'` (confirmed badge) but KEEP the record in `awaitingDecision` (edit saves corrections; approval still required); activity details update to "Edited — awaiting approval".
   - `action:'reject'`: same as feed reject above.
   - After each decision, if `awaitingDecision` becomes empty: `setPipelineComplete(anyPublished)`; keep final agent statuses visible (kit shows completed chain); a new upload run resets everything (existing behavior).
6. **Tabs:** replace the Archive Browser stub with `<ArchiveBrowser />` (S3-C7). Classification tab keeps its Sprint-4 stub text UNCHANGED.
7. **Panel mount:** `{verifyRecordId && <VerificationPanel recordId={verifyRecordId} gate={…matching hitlQueue item's exceptions or null} onClose={() => setVerifyRecordId(null)} onDecision={…} />}`.
8. All six agent NAMES still render (Sprint-1/2 smoke greps); zero `linaw` tokens; no dead imports.

**acceptance_criteria:**

1. Page compiles; upload → agents 1–3 (unchanged) → agent 4 pass-through (1200ms, "Subjects suggested") → agent 5 (1200ms; `'hitl'` rose state when any gate fires, `'completed'` otherwise) → pause with pending feed cards; approve → agent 6 glow/pulse 1000ms → "Published to archive" + green Database bookend (`pipelineComplete`).
2. Confirm/Edit open the side-by-side panel; Reject (reason required) terminates the branch and never publishes; confirmed badge shows after approve; edited records stay review-pending.
3. Archive Browser tab live; Classification tab still stubbed (no S4 leak).
4. Kit consumed props-only; `npm run build` route table includes `/likha`.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run build
# expected: build succeeds; route table includes /likha, /api/likha/archive, /api/likha/archive/[id], /api/likha/archive/[id]/scan, /api/likha/stats

grep -c "VerificationPanel" src/app/likha/page.tsx && grep -c "ArchiveBrowser" src/app/likha/page.tsx && grep -c "hitlQueue" src/app/likha/page.tsx
# expected: >= 2, >= 1, >= 2

grep -c "low_confidence_metadata" src/app/likha/page.tsx
# expected: >= 1

grep -REn "from ['\"]@/(lib/likha|lib/db|app/api)" src/app/likha/page.tsx
# expected: no output, exit code 1 (client page — no server imports)

grep -REn "classification-editor|export-dilg|export-package|/api/likha/classify" src/app/likha/page.tsx
# expected: no output, exit code 1 (no S4 features)

grep -ic "linaw" src/app/likha/page.tsx
# expected: 0
```

---

### S3-C9 — Sprint 3 final gate: boundary greps, full test battery, regression (Sprint 1 + Sprint 2 re-run), commits (no new files)

```json
{
  "chunk_id": "S3-C9",
  "feature_id": "gate",
  "chunk_type": "testing",
  "name": "Boundary verification (both directions) + Sprint-3 suites + Sprint-1/2 regression re-run + 3 feature commits (decision D19)",
  "parallel_group": "GROUP-F (sequential gate)",
  "dependencies": ["S3-C1", "S3-C2", "S3-C3", "S3-C4", "S3-C5", "S3-C6", "S3-C7", "S3-C8"],
  "file_outputs": [],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint 3 gate battery exactly as listed, from the repo root (Git Bash). No code changes here; failures go back to the responsible chunk (C1 types · C2 harness · C3 L004 server · C4 panel · C5 L005 archiver/BM25 · C6 L006 routes · C7 browser · C8 page). Record every output as SPRINT_REVIEW evidence. THEN create the three feature commits with the explicit staging lists (decision D19).

**A. Static gates:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run lint
# expected: no errors. Zero findings in Sprint-3 files mandatory
# (src/types/likha.ts additions, src/lib/likha/*, src/app/api/likha/**, src/components/likha/*,
#  src/app/likha/page.tsx, tests/**). Pre-existing warnings elsewhere tolerated.

npm run build
# expected: "Compiled successfully"; route table includes /likha, /api/likha/archive,
# /api/likha/archive/[id], /api/likha/archive/[id]/scan, /api/likha/stats (+ Sprint-2 routes)
```

**B. Boundary greps (SPRINT_PLAN Sprint 3 — both directions):**

```bash
grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (ZERO forbidden imports)

grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha
# expected: no output, exit code 1 (ZERO LINAW table reads)

grep -REin "linaw" src/lib/likha src/app/api/likha src/components/likha src/app/likha/page.tsx src/types/likha.ts tests
# expected: no output, exit code 1 (zero linaw references in ANY Sprint-3 file)

grep -REn "from ['\"]@/(app/(ella|obra|yala)|components/(ella|obra|yala))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (zero ELLA/OBRA/YALA imports)

# Reverse direction (SPRINT_PLAN Sprint 3 note): no likha leak into linaw-prefixed paths — none exist yet:
test ! -d src/lib/linaw && test ! -d src/app/api/linaw && test ! -d src/components/linaw && test ! -d src/app/linaw && echo NO-LINAW-PATHS
# expected: NO-LINAW-PATHS
```

**C. Sprint-3 test battery:**

```bash
npm run dev &   # background; wait for "Ready" on http://localhost:3000
sleep 8

npm run test
# expected: hermetic suite passes — OCR contract (S2) + search/BM25 contract incl. <500ms on
# 500 seeded docs + metadata persistence (S2) + verification approve/edit/reject persistence &
# audit & 409 + Archiver gating (cannot publish without approval) + publish/BM25 entry — exit 0

npm run test:integration
# expected: upload contract (S2, 7 subtests) + archive list/search/filter/stats/PUT-round-trip
# (S3, 7 subtests incl. highlighted snippets + tookMs<500 + 409 conflict over HTTP) — exit 0

kill %1
```

**D. Regression — FULL re-run of Sprint 1 + Sprint 2 gates:**

```bash
# Sprint 1: kit neutrality (kit files untouched in Sprint 3):
grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" \
  src/components/agent-pipeline.tsx src/components/agent-card.tsx \
  src/components/activity-feed.tsx src/types/agentic.ts
# expected: no output, exit code 1
git diff --stat v0.2.0-sprint-2..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts 2>/dev/null | grep -c . || echo KIT-UNTOUCHED
# expected: KIT-UNTOUCHED  (if the tag exists; otherwise verify via git log that no Sprint-3 commit touched them)

# Sprint 1+2: schema intact + idempotent (run TWICE):
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_arch_ord_year','idx_arch_ord_status','idx_arch_ord_astat','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); if(missing.length){console.error('FAIL missing:',missing); process.exit(1);} const cols=db.prepare('PRAGMA table_info(archived_ordinances)').all().map(c=>c.name); for(const c of ['extraction_confidence','section_count','rejection_reason']){ if(!cols.includes(c)){console.error('FAIL: '+c+' missing'); process.exit(1);} } console.log('SCHEMA OK: foundation tables + Sprint-2/3 migrations present');"
# expected (both runs): SCHEMA OK: foundation tables + Sprint-2/3 migrations present

# Sprint 2 suite re-run (already included in C's npm run test + test:integration — confirm counts
# explicitly here as regression evidence): likha-ocr 6 subtests, likha-metadata 5 groups,
# likha-upload 7 subtests ALL green inside the C runs.

# Render smoke (all six agent names + live tabs):
npm run dev & sleep 8
curl -s http://localhost:3000/likha | grep -oE "Ingestor|OCR Extractor|Metadata Parser|Subject Classifier|Legal Validator|Archiver" | sort -u | wc -l
# expected: 6
curl -s http://localhost:3000/likha | grep -c "DRAG & DROP SCAN FILES"
# expected: >= 1 (upload tab still default + dropzone intact)
curl -s http://localhost:3000/likha | grep -c "ACTIVITY FEED"
# expected: >= 1
kill %1
```

**E. Feature commits (exact messages, explicit staging — decision D19):**

```bash
git add src/types/likha.ts src/lib/db.ts src/lib/likha/agents.ts \
        "src/app/api/likha/archive/[id]/route.ts" "src/app/api/likha/archive/[id]/scan/route.ts" \
        src/components/likha/verification-panel.tsx \
        tests/helpers/likha-test-util.ts tests/integration/likha-verification.test.ts
git commit -m "feat: implement L004 human verification side-by-side view pillar-likha-linaw-20260809"

git add src/lib/likha/search.ts src/lib/likha/archiver.ts .gitignore \
        tests/unit/likha-search.test.ts tests/integration/likha-publish.test.ts
git commit -m "feat: implement L005 publish to archive with BM25 index entry pillar-likha-linaw-20260809"

git add package.json src/app/api/likha/archive/route.ts src/app/api/likha/stats/route.ts \
        src/components/likha/archive-browser.tsx src/app/likha/page.tsx \
        tests/integration/likha-archive.test.ts
git commit -m "feat: implement L006 full-text archive browser with filters pillar-likha-linaw-20260809"

git log --oneline -3
# expected: exactly these 3 commits, in this order, with these exact messages
git status --porcelain -- src tests package.json .gitignore
# expected: empty (all sprint files staged into the three feature commits)
```

NOTE on intermediate-commit semantics: the L004 commit persists approve decisions WITHOUT publishing (publish wiring arrives in the L005 commit per decision D19); each commit independently compiles and its tests pass. Tag `v0.3.0-sprint-3` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do not tag in this chunk.

**acceptance_criteria:**

1. Sections A–D all produce their expected outputs; C's results are captured as the Sprint-3 regression baseline.
2. Exactly 3 commits with the exact `feat: implement [Feature] pillar-likha-linaw-20260809` messages; working tree (module files) clean afterward.
3. All evidence (command outputs, test counts, commit SHAs) recorded for SPRINT_REVIEW and the cumulative quality score.

---

## Sprint 3 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 3)

- [ ] **L004–L006 acceptance per PRD-LIKHA §11:** side-by-side verification supports Approve/Edit/Reject with audit logging — every decision in `agent_decisions` with user ID + timestamp (S3-C3, S3-C4); approval publishes with BM25 index entry in LIKHA's own namespace, hash cached (S3-C5); search returns results in <500ms with highlighted snippets + year/status/subject filters (S3-C5, S3-C6, S3-C7)
- [ ] **HITL gate pauses pipeline:** Legal Validator (agent 5, 1200ms) raises `low_confidence_metadata` when any critical field confidence <0.7 or the scan is unreadable (PRD §12.4 row 1); rose-bordered feed card + rose Hand on the agent card; `low_confidence_classification` (row 2) supported by the `LikhaHitlItem` schema and gate dispatch, trigger lands with agent 4's full pass in Sprint 4 (decision D12); Confirm/Edit/Reject all persist to `agent_decisions` (S3-C3, S3-C8)
- [ ] **Archiver gating proven:** agent 6 (1000ms) runs ONLY inside the approve branch after the human decision is persisted; test-proven refusal for processing/flagged/published rows; rejected records never publish (S3-C5)
- [ ] **Archive Browser tab live** (stub replaced), stats header per DESIGN.md §2.1, Classification tab still stubbed — no S4 features (classification editor, classify/export routes) anywhere (S3-C6, S3-C7, S3-C8)
- [ ] **All routes `withUserAuth`** (archive list, `[id]` GET+PUT, `[id]/scan`, stats); all writes logged via `logger.ts` with `module='likha'`; every agent action (4/5/6 start/complete/hitl) + human decision audited (S3-C3, S3-C5, S3-C6)
- [ ] **Boundary grep clean, both directions:** zero forbidden imports, zero LINAW table reads, zero `linaw` tokens in any Sprint-3 file, zero ELLA/OBRA/YALA imports, no likha leak into linaw paths (S3-C9.B)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S3-C9.A)
- [ ] **New tests green:** hermetic — verification approve/reject persistence + audit + 409, Archiver gating, BM25 index entry creation + <500ms contract + highlighted snippets + filters; API-level — archive list/search/filter/stats + PUT round-trip incl. 409 (S3-C9.C)
- [ ] **Regression:** FULL re-run of Sprint 1 (kit neutrality, schema assertions incl. `section_count`/`rejection_reason`, render smoke with all 6 agent names) + Sprint 2 (OCR contract, metadata persistence, upload contract) suites — all green (S3-C9.D)
- [ ] **Per-feature commits:** exactly 3, format `feat: implement [Feature] pillar-likha-linaw-20260809` (S3-C9.E)
- [ ] Tag `v0.3.0-sprint-3` after SPRINT_REVIEW passes; cumulative quality score recorded

**Integration/Regression notes (SPRINT_PLAN):** new tests = archive list/search/filter; PUT approve/edit/reject incl. 409 conflict; HITL decision rows present in `agent_decisions`; BM25 latency assertion (<500ms on seeded set). Regression = re-run Sprint 2 suite (and Sprint 1 smoke) — all prior tests green. From Sprint 4 onward, the combined Sprint 2+3 suites re-run as part of every sprint's regression battery.

---

## Flagged for SPRINT_REVIEW

1. **D10 — Rejected records map to `archive_status='flagged'` + new `rejection_reason` column.** The frozen Sprint-1 CHECK enum has no `'rejected'` value and SQLite cannot alter CHECK constraints without a rebuild (forbidden by the additive-only rule). Distinguishable via `rejection_reason` + the `agent_decisions` reject row. Confirm this satisfies PRD §11 "Rejected items are logged with reason and do not publish bad data."
2. **D11 — Second additive schema extension** (`section_count INTEGER`, `rejection_reason TEXT`), same idempotent-ALTER pattern as Sprint-2's D7 `extraction_confidence`. Sprint-2 parsed `sectionCount` but had no column to store it; L004 edits and L006 display require it.
3. **D12 — Agent 4 (Subject Classifier) is a wired pass-through in S3:** animated 1200ms slot + start/complete audit rows (`output_snapshot` `{"mode":"s3-passthrough","subjects":[]}`), NO LLM call, NO `classifications` writes, `low_confidence_classification` gate cannot fire until S4. This is the clean reading of SPRINT_PLAN's "its sequential slot is wired here" — confirm.
4. **D19 — L004/L005 commit seam:** the L004 commit's `approve` persists the decision but does NOT publish; publish + BM25 wiring lands in the L005 commit (each commit compiles/tests green independently). End-to-end "Approve & Publish" is complete after the L005 commit.
5. **D13 — BM25 index file `src/lib/data/likha-search-index.json` is gitignored runtime state** (sibling `search-index.json` is committed, but LIKHA's index is generated from `archived_ordinances` and rebuilt lazily / via `rebuildIndex()`). Confirm preference vs. committing a seed file.
6. **D14 — LightRAG not wired** (BM25 authoritative; PRP allows BM25 fallback as the shipped path; `lightrag.ts` untouched).
7. **D15 — New authenticated scan route** `GET /api/likha/archive/[id]/scan` (not in PRD route table, required by DESIGN.md §2.3 scan pane; scans stay out of `public/`). PDFs render via iframe/native viewer; zoom/rotate applies to image scans.
8. **D18 — Additive `archiveStatus` query param** on `GET /api/likha/archive` (default `'published'`) so the verification queue can list `pending_review` records; all PRD-contract params unchanged.
9. **Edit-decision audit mapping:** `agent_decisions.action` union (Sprint-1 shared type) has no `'edit'`; Edit & Save persists as `action='confirm'` with `reason='edit'` + edited-fields snapshot. DB column is unconstrained TEXT, so the mapping is reversible if Sprint-4 wants a distinct value.
10. **Default active tab stays 'Upload & Digitize'** (Sprint-2 regression smoke curls the page for dropzone/feed copy). DESIGN.md shows Archive Browser as tab 1 — trivial flip possible at SPRINT_REVIEW if desired.
11. **Real OpenRouter calls** are NOT exercised by any Sprint-3 automated test (all hermetic: stubbed OCR/metadata, direct DB seeding, HTTP against the dev server with seeded rows). Pilot-accuracy targets remain SYSTEM_TEST concerns per SPRINT_PLAN risk 7.

**Handoff:** Sprint 4 (LIKHA Classification & Exports — L007, L010, L013; PRP-LIKHA + INTERCHANGE-SPEC reference) builds on: published records with `subject_tags`, the agent-4 slot ready for its real LLM pass + `low_confidence_classification` trigger, the `classifications` table (still empty), this sprint's BM25 namespace, and the combined Sprint 2+3 regression suite.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 3 of 7*