# Sprint 5 Instruction Set — LINAW Standalone Ingestion & Library Verification

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 5 of 7 — "LINAW Standalone Ingestion & Library Verification" — features **N013, N014** (+ supporting manual entry & own verification) |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith (verified installed), React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^12, lucide-react ^0.468, openai ^6.35, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `FormData`, `Blob`, `node:test`), test runner `tsx --test` (scripts `test` / `test:integration`) |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 5 uses **`docs/PRP-LINAW.md` ONLY** — it is the sole module instruction source. Do NOT read or attach any module section of `docs/PRP-LIKHA.md`. Supporting inputs already consumed by this instruction set: `docs/PRD-LINAW.md` §6.5/§6.8/§11/§12 (standalone ingestion rules, library lifecycle `processing → pending_review → ready/rejected`, API contract), `docs/WORKFLOW-LINAW.json` (data_rules ingestion rows, exception rules, 6-agent definitions for display), and the Sprint-1–4 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes").

**Pattern duplication is intentional.** The LIKHA implementation (Sprints 2–4) may be studied as PROVEN PRECEDENT, but every LINAW artifact is independently owned: `src/lib/linaw/ocr.ts` duplicates the pattern of `src/lib/likha/ocr.ts` WITHOUT importing it; LINAW's verification panel duplicates LIKHA's panel pattern WITHOUT sharing code; the LINAW test harness duplicates the LIKHA helper pattern WITHOUT importing it. Separate SKUs — independence over DRY (Audit v2 §3, PRP-LINAW constraint 4).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 1 foundation is in place and frozen.** `src/lib/db.ts` `initSchema()` already contains `linaw_ordinances` (+`idx_linaw_ord_year`, `idx_linaw_ord_lstat`), `codification_records`, `ordinance_relationships` (+3 idx), `code_volumes`, and shared `agent_decisions` (+2 idx) — all idempotent. **`linaw_ordinances` is the ONLY ordinance table LINAW touches this sprint.** Exact DDL (verbatim in db.ts): `id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(...active/amended/repealed/superseded/expired), source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('scan','import','manual')), source_filename TEXT, file_hash TEXT, library_status TEXT DEFAULT 'pending_review' CHECK(library_status IN ('processing','pending_review','ready','rejected')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, created_at, updated_at, UNIQUE(ordinance_number, series_year), FK uploaded_by_id/verified_by_id → users(id)`. **Note: there is NO `scan_file_path` column and NO `rejection_reason` column** — see decisions D6/D9. **Sprint 5 makes ZERO schema changes** (db.ts must remain byte-identical; regression gate asserts this).
2. **`src/app/linaw/page.tsx` is the Sprint-1 placeholder** (static DEMO_AGENTS fixtures, `--pillar-*` shell tokens, "This module lands in Sprint 5" badge). Sprint 5 replaces it wholesale (S5-C9).
3. **Shared kit exists and is prop-driven** (`agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx`); `src/types/agentic.ts` exports `AgentState<M,O>`, `AgentOutputBase`, `ActivityItem<O>`, `HitlItem<M,O>`, `AgentDecisionRecord`, `AgenticModuleName = 'likha' | 'linaw'`. Sprint 5 must NOT modify the kit or `agentic.ts` (regression gate asserts byte-identical).
4. **`src/lib/ai/llm.ts` real API (inspected):** `chatCompletion(systemPrompt, userPrompt, options?: {maxTokens?, temperature?}) → Promise<string>` (text-only, single env model `LLM_MODEL` default `qwen/qwen3.7-plus`, no timeout) + `streamChatResponse(...)`. `chatCompletion` IS suitable for text-in/text-out metadata parsing (decision D3). Multimodal OCR cannot use it → direct OpenRouter fetch in the module-owned wrapper (decision D2), exactly the contract shape proven by the LIKHA OCR wrapper: endpoint `https://openrouter.ai/api/v1/chat/completions`, models `google/gemini-2.5-flash` (PDF) / `qwen/qwen3.7-plus` (image), temperature 0, max_tokens 8192, `AbortSignal.timeout(60_000)` per attempt, at most 2 attempts, retry ONLY on timeout/abort, network failure, or HTTP ≥ 500, injectable `fetcher`, same `OPENROUTER_API_KEY` env var.
5. **`src/lib/user-auth-middleware.ts` real signature (inspected):** `withUserAuth(handler)` where `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession }) => …`; acting user id = `user.user.id`, full name `user.user.full_name`. 401 body: `{ error: "Authentication required", code: "NO_SESSION" }`.
6. **`src/lib/logger.ts` real API (inspected):** the additive generic writer from Sprint 2, `logModuleEvent({ module, interactionType, content?, ipAddress, participantName?, participantSessionId? })`, already exists and is module-neutral — LINAW calls it with `module: 'linaw'` and `participantSessionId: 'linaw-' + userId`. **logger.ts is NOT edited this sprint.**
7. **`src/middleware.ts` (inspected):** `PROTECTED_PATHS = ["/ella", "/obra", "/yala", "/likha"]` — Sprint 2 appended `"/likha"`; Sprint 5 appends `"/linaw"` (decision D8). FINDING: `config.matcher` lists only `/ella|/obra|/yala|/admin` — neither `/likha` nor `/linaw` is in the matcher, so page-level cookie redirect is not middleware-enforced for either module (API routes remain hard-gated by `withUserAuth`). Sprint 5 does NOT touch the matcher; flagged for SPRINT_REVIEW.
8. **Test harness convention (inspected from Sprints 2–4):** `node:test` + `node:assert/strict` executed via `tsx --test` with explicit file lists in package.json (`test` = hermetic unit/in-process; `test:integration` = API-level against a running `npm run dev`). Helpers use ONLY Node built-ins + `better-sqlite3` with relative imports (no `@/` alias in tests). `data/workshop.db` is the dev-server DB; integration tests seed an approved user + session directly and pass the cookie `pillar_user_session=<sessionId>`. Sprint 5 creates its OWN helper `tests/helpers/linaw-test-util.ts` (duplicates the pattern; zero imports from the likha helper).
9. **No DOCX parser exists in direct dependencies (inspected).** `docx ^9.7.1` is a DOCX **generator** (used by LIKHA exports); `jszip` exists in node_modules only as a transitive dependency (phantom — must not be imported). No mammoth/adm-zip/unzipper. → decision D1: DOCX accepted via a dependency-free raw text extraction fallback (Node `zlib` + manual ZIP local-header scan).
10. **Upload storage precedent (inspected):** LIKHA stores scans at `data/uploads/likha/<recordId>__<sanitized>`; `.gitignore` already covers `data/uploads/`. LINAW mirrors at `data/uploads/linaw/`. Because `linaw_ordinances` has **no path column**, the path is a deterministic convention reconstructed from `id` + `source_filename` (decision D6).
11. **Audit precedent (inspected):** LIKHA logs ingestion batches to `agent_decisions` (agent_id 1 'Ingestor', start/complete rows, `pipeline_id = batchId`) and human verification decisions (agent_id 5 'Legal Validator', user_id + reason). Sprint 5 has NO LINAW pipeline agents (they are Sprint 6), so LINAW uses the human/module-level convention `agent_id = 0` with `agent_name='Ingestion'` / `'Library Verification'`, `module='linaw'` (decision D7).
12. **BM25 namespace is NOT this sprint.** `src/lib/data/` holds `likha-search-index.json` (LIKHA-owned). `src/lib/linaw/search.ts` + the LINAW BM25 index file are deferred to Sprint 6 (SPRINT_PLAN's Sprint-5 file list mentions search.ts; the sprint scope ruling is ingestion + verification only — flagged for SPRINT_REVIEW). Sprint 5 library search (`?q=`) is SQL `LIKE` (decision D5).

## Sprint 5 Boundary Rules (apply to EVERY chunk — violation = build failure)

1. **LINAW-only code paths.** Every file created or edited for Sprint 5 lives in the `linaw/` namespace (`src/lib/linaw`, `src/app/api/linaw`, `src/components/linaw`, `src/app/linaw`, `src/types/linaw.ts`, `tests/**/linaw-*`) or is an explicitly listed additive shared edit (S5-C9: one-line `src/middleware.ts` PROTECTED_PATHS entry; S5-C10: package.json test-script file lists).
2. **Zero cross-module imports (hard boundary, checked both directions).** No Sprint 5 file may import from `src/lib/likha`, `src/app/api/likha`, `src/components/likha`, `src/app/likha`, `@/app/api/{obra,chat}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, or any ELLA/OBRA/YALA code. Allowed imports ONLY: `@/lib/ai/llm`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed`), `@/types/agentic`, `@/types/linaw`, Node built-ins, `lucide-react`, `next/server`, `better-sqlite3` (tests only). Test files additionally may import ONLY `../helpers/linaw-test-util` (never the likha helper) and relative `../../src/lib/linaw/*` paths.
3. **`linaw_ordinances` is the ONLY ordinance table LINAW touches.** Zero references to `archived_ordinances`, `amendment_links`, or `classifications` anywhere in Sprint 5 files (grep gate S5-C10.A); zero writes to `codification_records` / `ordinance_relationships` / `code_volumes` this sprint (they are S6/S7 tables — they exist but stay empty). `agent_decisions` rows are `module='linaw'` only.
4. **Zero `likha|obra|ella|yala` tokens** (case-insensitive) in any Sprint 5 file, except this instructions document itself.
5. **Auth + logging on every route.** Every LINAW API route handler is wrapped in `withUserAuth`; acting user = `user.user.id`. Every write path calls `logModuleEvent` with `module: 'linaw'`; ingestion batches + all verification decisions are persisted to `agent_decisions` with `module='linaw'`.
6. **No pipeline agents this sprint.** NO `src/lib/linaw/agents.ts`, NO pipeline route, NO HITL gate machinery — the six codification agents (Inventory Analyst … Code Assembler) render as IDLE cards from `LINAW_AGENT_DEFS`; their runner lands in Sprint 6. Ingestion + verification only.
7. **No schema changes.** `src/lib/db.ts` byte-identical; no ALTER migrations (contrast Sprint-2 LIKHA D7). Per-field OCR confidence is therefore response/audit-only (decision D4); rejection reasons live in `agent_decisions.reason` only (decision D9).
8. **Two feature commits (decision D10), exact messages:** `feat: implement N013 bulk text import into LINAW's own library pillar-likha-linaw-20260809` and `feat: implement N014 scan upload with module-owned OCR pillar-likha-linaw-20260809`. Manual entry + library routes + verification + all UI join the N014 commit (N014's feature title is "Scan upload + module-owned OCR + own verification"; seam stated in D10).
9. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprints 1–4). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (all flagged for SPRINT_REVIEW — see end of file)

- **D1 — DOCX handling (N013): accept `.docx` via a dependency-free raw text extraction fallback.** No DOCX parser exists in direct dependencies (`docx` is generation-only; `jszip` is a phantom transitive dep — not importable). MVP therefore implements `extractDocxText()` in `src/lib/linaw/import-parser.ts`: scan ZIP local file headers (`PK\x03\x04`), locate `word/document.xml`, inflate with `zlib.inflateRawSync` (method 8) or copy (method 0), then strip XML (`</w:p>`/`<w:br/>` → newline, `<w:tab/>` → tab, remove remaining tags, decode `&amp; &lt; &gt; &quot; &apos;`). The extracted text is fed to the same format detector as pasted text: trimmed content starting with `{` or `[` → JSON parse, else CSV parse. Limitations (stated in code + here): only plain text runs survive (tables/text boxes flatten to runs), and DOCX records must be JSON- or CSV-shaped text inside the document. Chosen over "DOCX returns 501" because PRP-LINAW + PRD §11 acceptance explicitly require DOCX acceptance; 501 would fail the frozen acceptance criteria.
- **D2 — OCR call strategy: direct OpenRouter `fetch` inside `src/lib/linaw/ocr.ts` (module-owned).** Same reason LIKHA had: `llm.ts` is text-only / single-model / no-timeout and cannot satisfy the multimodal ≤60s contract. Identical model contract to LIKHA's wrapper (`google/gemini-2.5-flash` PDF / `qwen/qwen3.7-plus` image, temperature 0, 60s timeout, one retry on timeout/network/5xx, injectable fetcher, `OPENROUTER_API_KEY`) but independently implemented — ZERO shared code, ZERO imports from likha. Timeout-retry-once semantics are contract-identical, implementation-separate.
- **D3 — N014 metadata-parse scope: FULL per-field parse NOW via LINAW's own `src/lib/linaw/prompts.ts`** (ordinanceNumber / seriesYear / title + per-field confidence, using the permitted shared `chatCompletion`). Rationale: (a) `linaw_ordinances` requires NOT NULL `ordinance_number/series_year/title` with `UNIQUE(ordinance_number, series_year)` — scan records need real values to be meaningful library rows; (b) the verification panel must show prefilled editable fields to be useful (N014 acceptance = OCR + verification; metadata parsing aids verification); (c) LIKHA's L003 precedent proves the pattern is hermetically testable. Deferred alternative (placeholders only, parse in S6) was rejected because it would ship an empty-fields verification UI.
- **D4 — Confidence is response/audit-only (no schema change).** `linaw_ordinances` has no confidence column and Sprint 5 freezes the schema (rule 7). Per-field confidence from the metadata parse is returned in the upload response and journaled in the `agent_decisions` output_snapshot; the verification panel renders plain editable fields (no rose confidence styling this sprint — unlike LIKHA, which has an `extraction_confidence` column from its Sprint-2 ALTER).
- **D5 — Library list search: SQL `LIKE` in Sprint 5; LINAW BM25 namespace deferred to Sprint 6.** `GET /api/linaw/library?q=` does case-insensitive `LIKE` over `title`/`content` (wildcards escaped). `src/lib/linaw/search.ts` + the `src/lib/data/` LINAW index file land with Sprint 6's inventory/search work. (SPRINT_PLAN's Sprint-5 "Files expected" lists search.ts; the binding sprint scope is ingestion + verification — flagged.)
- **D6 — Scan storage path convention (no path column in the DDL):** files persist at `data/uploads/linaw/<recordId>__<sanitizedSourceFilename>` where sanitize = `name.replace(/[^a-zA-Z0-9._-]/g, '_')`. The detail + scan routes RECONSTRUCT the same path from `id` + `source_filename` (LIKHA's D15 authenticated-streaming precedent — scans never sit in `public/`). `source_filename IS NULL` (import/manual records) → `scanAvailable=false`.
- **D7 — Audit convention with no agents:** `agent_decisions` rows use `module='linaw'`, `agent_id=0`, `agent_name='Ingestion'` (import/upload batch start+complete, `pipeline_id=batchId`) and `agent_name='Library Verification'` (approve/reject/edit decisions, `user_id` + `reason`). Sprint 6 agents will use ids 1–6; 0 is reserved for pre-pipeline human/module actions.
- **D8 — Page auth: additive `"/linaw"` entry in `src/middleware.ts` `PROTECTED_PATHS`** (mirrors Sprint-2's `/likha` addition). `config.matcher` is NOT touched (it currently omits both `/likha` and `/linaw`); API-level enforcement is `withUserAuth` regardless. Matcher fix flagged for SPRINT_REVIEW.
- **D9 — Rejection reasons persist in `agent_decisions.reason` only.** `linaw_ordinances` has no rejection_reason column and Sprint 5 adds no schema; the reject action requires a non-empty reason and journals it in the audit row.
- **D10 — Commit seam (2 commits).** Commit 1 = N013 backend: types + test harness + fixtures + import parser + import route + their tests (NO UI — N013's preview table ships inside commit 2's `library-ingestion.tsx`, same precedent as Sprint-4's API-first L013). Commit 2 = N014 + manual entry + verification + ALL UI + page replacement + middleware line + package.json test scripts. Each commit compiles and its staged tests pass independently.
- **D11 — OCR runs inline and sequentially inside `POST /api/linaw/upload`.** Sprint 5 has no pipeline route/runner (S6), so the upload route performs hash → persist `processing` row → OCR → metadata parse → UPDATE to `pending_review` per accepted file, sequentially. Worst-case latency ≈ files × (60s OCR + parse) — acceptable for pilot batches (SPRINT_PLAN risk 7: assert contract, tolerate model latency); flagged. OCR failure after retry → row still transitions to `pending_review` with placeholder metadata + empty content and the file is reported `ocr_failed` (PRP exception rule "OCR timeout after retry → HITL manual entry" — in Sprint 5 the verification panel is the human-entry surface).
- **D12 — Duplicate semantics.** (a) Scan upload: SHA-256 computed BEFORE OCR; existing `file_hash` in `linaw_ordinances` → file reported `duplicate`, no row written. (b) Parsed metadata colliding with an existing `UNIQUE(ordinance_number, series_year)` row → file reported `duplicate_metadata`, inserted placeholder row rolled back, stored file deleted. (c) Import: duplicates on `(ordinance_number, series_year)` — first-in-batch wins; collisions within the batch OR against any existing row (any `library_status`, including `rejected`) increment `skippedDuplicates` (strict UNIQUE reading; re-import over a rejected row is flagged for SPRINT_REVIEW). (d) Manual create: existing pair → HTTP 409 per PRD §12.6.
- **D13 — Response key style.** Import response follows PRD §12.6 VERBATIM: `{ imported, skippedDuplicates, records: [{ id, library_status }] }` (snake_case `library_status` inside `records` because the PRD contract text says so), plus additive keys `batchId` and `invalidRecords`. All other LINAW responses use camelCase like the rest of the repo. Upload response items use the PRD's literal item keys `id`/`status`/`hash` plus additive detail keys.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)              GROUP-B (parallel)              GROUP-C (parallel)         GROUP-D          GROUP-F
──────────────────              ──────────────────              ──────────────────         ───────          ───────
S5-C1 types/linaw.ts ──────────► S5-C3 import parser + test ───► S5-C5 import route+test ─┐
S5-C2 harness + fixtures ──────► S5-C4 ocr.ts + contract test ─► S5-C6 prompts+ingest ────┤► S5-C9 ───────► S5-C10
                  (disjoint)                                        + digitize test        │  (UI + page     (final gate,
                                                                                            ├─ S5-C7/C8      regression,
                                                                                            │  (routes,      commits)
                                                                                            │   parallel)
```

| Chunk | Feature | Depends on | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S5-C1 | N013+N014 (module types) | Sprint 1 only | none | **GROUP-A** |
| S5-C2 | test harness + fixtures | Sprint 1 only | none | **GROUP-A** |
| S5-C3 | **N013** import parser + unit test | S5-C1, S5-C2 | none | **GROUP-B** |
| S5-C4 | **N014** ocr.ts + hermetic contract test | S5-C1 | none | **GROUP-B** |
| S5-C5 | **N013** import route + integration test | S5-C1, S5-C2, S5-C3 | none | **GROUP-C** |
| S5-C6 | **N014** prompts + ingest logic + hermetic digitize test | S5-C1, S5-C2, S5-C4 | none | **GROUP-C** |
| S5-C7 | **N014** upload route + API-level upload test | S5-C1, S5-C2, S5-C4, S5-C6 | none | **GROUP-D** |
| S5-C8 | **N014** library routes (list/create/detail/verify/scan) + API-level test | S5-C1, S5-C2, S5-C6 | none | **GROUP-D** |
| S5-C9 | **N013 UI + N014 + manual entry** components + page replacement + middleware line | S5-C5, S5-C7, S5-C8 | none | **GROUP-E** |
| S5-C10 | gate | ALL (S5-C1…S5-C9) | n/a | **GROUP-F** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E → GROUP-F.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`, zero shared state). Commit points: after S5-C5 stage **commit 1** (N013); after S5-C9 stage **commit 2** (N014) — staging uses the explicit per-feature file lists in S5-C10.E, so commits are correct even if groups executed in parallel. When in doubt, execute sequentially.

---

## Chunks

---

### S5-C1 — `src/types/linaw.ts`: LINAW module interfaces + agent definitions

```json
{
  "chunk_id": "S5-C1",
  "feature_id": "N013+N014 (shared module types)",
  "chunk_type": "setup",
  "name": "LINAW types — LinawOrdinance, LINAW_AGENT_DEFS, import/upload/library/verification contracts",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/linaw.ts"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW file `src/types/linaw.ts` — the LINAW module type file (PRP-LINAW `Types` section, narrowed to `module: 'linaw'`, built ON TOP of the Sprint-1 generics in `@/types/agentic`). It must compile under `strict: true`, import types ONLY from `./agentic`, contain NO runtime imports (no db/llm/fetch), and contain the tokens `likha`, `obra`, `ella`, `yala` ZERO times. Write exactly this content (JSDoc allowed, nothing else):

```ts
// src/types/linaw.ts
// Sprint 5 — LINAW module interfaces (PRP-LINAW Types section, module-narrowed).
// Builds on the Sprint-1 shared generics in @/types/agentic. Pure types + static
// agent definitions: safe to import from BOTH server code and client components.
// The six pipeline agents are DEFINED here for display; their runner is Sprint 6.

import type {
  AgentOutputBase,
  AgentState,
  HitlItem,
  AgentDecisionRecord,
} from './agentic';

// ── Agent definitions (WORKFLOW-LINAW.json — all 6; IDLE until Sprint 6) ──

export interface LinawAgentDef {
  id: number;
  name: string;
  description: string;
  functionName: string;
  color: string;      // hex, e.g. '#F59E0B'
  glowClass: string;  // e.g. 'glow-amber'
  delayMs: number;    // UI simulation delay (used by the Sprint-6 runner)
  outputLabel: string;
}

export const LINAW_AGENT_DEFS: LinawAgentDef[] = [
  { id: 1, name: 'Inventory Analyst',      description: 'Computes inventory completeness and year gaps',        functionName: 'analyzeInventory',     color: '#F59E0B', glowClass: 'glow-amber',   delayMs: 1100, outputLabel: 'Inventory analyzed' },
  { id: 2, name: 'Code Classifier',        description: 'Assigns ordinances to Code Titles/Chapters',         functionName: 'classifyToCode',       color: '#8B5CF6', glowClass: 'glow-violet',  delayMs: 1300, outputLabel: 'Code placement assigned' },
  { id: 3, name: 'Cross-Reference Scanner', description: 'Detects amendment/repeal/supersede relationships',  functionName: 'scanCrossReferences',  color: '#10B981', glowClass: 'glow-emerald', delayMs: 1600, outputLabel: 'Relationships detected' },
  { id: 4, name: 'Conflict Detector',      description: 'Flags semantic contradictions across ordinances',    functionName: 'detectConflicts',      color: '#F43F5E', glowClass: 'glow-rose',    delayMs: 1500, outputLabel: 'Conflicts flagged' },
  { id: 5, name: 'Relationship Reviewer',  description: 'Presents relationships for human confirmation (HITL)', functionName: 'reviewRelationships',  color: '#22D3EE', glowClass: 'glow-cyan',    delayMs: 1100, outputLabel: 'Awaiting human review' },
  { id: 6, name: 'Code Assembler',         description: 'Builds hierarchical Code of Ordinances with TOC',    functionName: 'assembleCode',         color: '#6366F1', glowClass: 'glow-indigo',  delayMs: 1300, outputLabel: 'Code assembled' },
];

// ── Domain entity (row contract of linaw_ordinances — the ONLY ordinance table LINAW touches) ──

export interface LinawOrdinance {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary?: string;
  subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  sourceType: 'scan' | 'import' | 'manual';
  sourceFilename?: string;
  fileHash?: string;
  libraryStatus: 'processing' | 'pending_review' | 'ready' | 'rejected';
  uploadedById: string;
  verifiedById?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Outputs / HITL (narrowings of the shared kit generics) ──

export interface LinawAgentOutput extends AgentOutputBase {
  completenessScore?: number;
  yearGaps?: Array<{ year: number; missing: number[] }>;
  codePlacement?: { titleNumber: number; chapterNumber: number; articleNumber?: number; confidence: number };
  relationships?: Array<{ sourceId: string; targetId: string; type: LinawRelationshipType; sectionRef?: string; confidence: number }>;
  conflicts?: Array<{ ordinanceAId: string; ordinanceBId: string; reason: string; confidence: number }>;
  toc?: unknown[];
  codeVolumeId?: string;
}

export type LinawRelationshipType = 'amends' | 'repeals' | 'partial_repeal' | 'supersedes' | 'extends' | 'implements';

export type LinawAgentState = AgentState<'linaw', LinawAgentOutput>;

export type LinawHitlGate =
  | 'low_confidence_classification'
  | 'detected_relationship'
  | 'code_placement'
  | 'final_code_export';

export type LinawHitlItem = HitlItem<'linaw', LinawAgentOutput> & { gate: LinawHitlGate };

export type LinawDecisionRecord = AgentDecisionRecord & { module: 'linaw' };

// ── N013 bulk import contracts ──

export interface ParsedImportRecord {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags: string[];
}

export interface LinawImportResponse {
  batchId: string;
  imported: number;
  skippedDuplicates: number;
  /** PRD §12.6 verbatim item shape: { id, library_status } (snake_case by contract). */
  records: Array<{ id: string; library_status: 'pending_review' }>;
  invalidRecords: Array<{ index: number; error: string }>;
}

// ── N014 scan upload contracts ──

export interface LinawUploadFileResult {
  /** Record id (PRD §12.6 literal key `id`). */
  id?: string;
  /** PRD §12.6 literal key `hash` — SHA-256 of the uploaded bytes. */
  hash: string;
  status: 'accepted' | 'duplicate' | 'duplicate_metadata' | 'ocr_failed' | 'rejected';
  originalFilename: string;
  mimeType?: string;
  sizeBytes: number;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  /** Per-field confidence from LINAW's own metadata parse (response/audit-only — decision D4). */
  confidence?: { ordinanceNumber: number; seriesYear: number; title: number };
  error?: string;
}

export interface LinawUploadResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  failed: number;
  files: LinawUploadFileResult[];
}

// ── Library list / detail / verification contracts ──

export interface LinawLibraryListItem {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: LinawOrdinance['status'];
  libraryStatus: LinawOrdinance['libraryStatus'];
  sourceType: LinawOrdinance['sourceType'];
  subjectTags: string[];
  snippet: string;
  updatedAt: string;
}

export interface LinawLibraryListResponse {
  items: LinawLibraryListItem[];
  total: number;
  page: number;
  limit: number;
  tookMs: number;
}

export interface LinawLibraryDetailResponse {
  record: LinawOrdinance;
  scanAvailable: boolean;
  scanUrl: string | null;
  scanMimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | null;
}

export interface LinawManualCreateRequest {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  subjectTags?: string[];
}

export interface LinawVerificationRequest {
  action: 'approve' | 'reject' | 'edit';
  /** Required (non-empty) when action === 'reject'. */
  reason?: string;
  fields?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    subjectTags?: string[];
  };
  /** Optimistic-concurrency guard: must equal the row's current updated_at when provided. */
  expectedUpdatedAt?: string;
}

export interface LinawVerificationResponse {
  recordId: string;
  action: 'approve' | 'reject' | 'edit';
  libraryStatus: 'pending_review' | 'ready' | 'rejected';
  reason?: string;
}
```

**acceptance_criteria:**

1. File compiles: `npx tsc --noEmit` green (whole repo).
2. Zero runtime imports; only `import type ... from './agentic'`.
3. Boundary: `grep -inE "likha|obra|ella|yala" src/types/linaw.ts` → no output (exit 1).

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                      # expected: TSC-OK
grep -inE "likha|obra|ella|yala" src/types/linaw.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S5-C2 — Test harness + fixtures (LINAW-owned, pattern duplication)

```json
{
  "chunk_id": "S5-C2",
  "feature_id": "N013+N014 (test scaffolding)",
  "chunk_type": "setup",
  "name": "tests/helpers/linaw-test-util.ts + tests/fixtures/linaw/* (own harness, zero likha imports)",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": [
    "tests/helpers/linaw-test-util.ts",
    "tests/fixtures/linaw/sample-ordinance.pdf",
    "tests/fixtures/linaw/sample-scan.png"
  ],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Create the LINAW test harness by DUPLICATING the proven LIKHA helper pattern with ZERO imports from it (pattern duplication is intentional — separate SKUs; you may read `tests/helpers/likha-test-util.ts` as precedent, then write LINAW's own).

1. `tests/helpers/linaw-test-util.ts` — Node built-ins + `better-sqlite3` + relative imports only (no `@/` alias). Export exactly:
   - `BASE_URL = process.env.LINAW_TEST_BASE_URL || 'http://localhost:3000'`.
   - `assertServerReachable(): Promise<void>` — GET `/api/health`; on failure throw `Error('SKIP-FAIL: start the dev server first (npm run dev) — integration tests run API-level per SPRINT_PLAN')`.
   - `seedApprovedUser(dbFile?: string)` — same shape as the LIKHA helper: inserts one `users` row (status `'approved'`, email `linaw-test-<ts>@example.com`, full_name `'Linaw Integration Test'`, lgu `'Municipality of Pitogo'`/`'municipality'`/`'Quezon'`) + one `user_sessions` row (expires +1h) into `dbFile || <cwd>/data/workshop.db`; returns `{ userId, sessionId, cookie: 'pillar_user_session=' + sessionId, cleanup }` where cleanup deletes session row THEN user row and closes the handle.
   - `tempDbPath(): string` — `os.tmpdir()` path `pillar-linaw-test-<uuid>.db` (callers set `process.env.DB_PATH` BEFORE dynamically importing `src/lib/db`).
   - `readLinawFixture(name: 'sample-ordinance.pdf' | 'sample-scan.png'): Buffer` — reads `tests/fixtures/linaw/<name>` relative to `process.cwd()`.
   - `seedLinawPendingReviewRecord(db, userId, overrides?)` — inserts one `linaw_ordinances` row (`library_status` default `'pending_review'`, `source_type` default `'scan'`, defaults ordinanceNumber 7 / seriesYear 2021 / title 'An ordinance establishing the municipal library system' / content 'Section 1. Title. This ordinance establishes the municipal library system.', subject_tags '[]', source_filename 'ord-07-s2021.pdf', file_hash a 64-hex string, uploaded_by_id = userId); overrides may set `ordinanceNumber, seriesYear, title, content, sourceType, libraryStatus, sourceFilename (null allowed), fileHash (null allowed)`; returns the new id. IMPORTANT: insert uses ONLY columns that exist in the Sprint-1 DDL (id, ordinance_number, series_year, title, content, subject_tags, source_type, source_filename, file_hash, library_status, uploaded_by_id) — never `scan_file_path` or `rejection_reason` (they do not exist on this table).
   - `buildMinimalDocx(text: string): Buffer` — dependency-free minimal DOCX (ZIP) builder used by DOCX tests: implements a tiny ZIP writer with STORED or DEFLATE entries (`zlib.deflateRawSync`), correct CRC-32 (implement the standard table-based CRC32 in ~10 lines), local file headers with general-purpose bit 3 UNSET, and a matching central directory + EOCD. Entries: `[Content_Types].xml` (static minimal content-types XML) and `word/document.xml` where the input text is split on `\n` into `<w:p><w:r><w:t xml:space="preserve">…</w:t></w:r></w:p>` paragraphs with `&`, `<`, `>` XML-escaped. The output MUST round-trip through Sprint 5's `extractDocxText` (S5-C3) and through real-world DOCX readers' basic layout (local-header-readable).
2. `tests/fixtures/linaw/sample-ordinance.pdf` and `tests/fixtures/linaw/sample-scan.png` — byte copies of the existing LIKHA fixtures: `mkdir -p tests/fixtures/linaw && cp tests/fixtures/likha/sample-ordinance.pdf tests/fixtures/linaw/ && cp tests/fixtures/likha/sample-scan.png tests/fixtures/linaw/`. (Fixtures are inert test DATA, not code — byte duplication is the intended standalone-SKU pattern; the LINAW helper reads ONLY the linaw copies.)

The helper must contain the tokens `likha`, `obra`, `ella`, `yala` ZERO times (env var is `LINAW_TEST_BASE_URL`).

**acceptance_criteria:**

1. `npx tsc --noEmit` green (helper type-checks; tests dir is inside the tsconfig).
2. Both fixtures exist and are non-empty; SHA-256 differs from nothing relevant — they are byte copies, that is allowed and intended.
3. `buildMinimalDocx('a\nb')` produces a Buffer starting with `PK\x03\x04` (smoke-checked in S5-C3's unit suite via round-trip).
4. Zero imports from `tests/helpers/likha-test-util.ts` or anywhere under `src/`.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK                                  # expected: TSC-OK
ls -la tests/fixtures/linaw/ | grep -c "sample-"                 # expected: 2
grep -inE "likha|obra|ella|yala" tests/helpers/linaw-test-util.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -c "import" tests/helpers/linaw-test-util.ts                # expected: only node:/better-sqlite3 imports (inspect output)
```

---

### S5-C3 — N013 import parser (JSON/CSV/DOCX) + hermetic unit test

```json
{
  "chunk_id": "S5-C3",
  "feature_id": "N013",
  "chunk_type": "feature",
  "name": "src/lib/linaw/import-parser.ts — JSON/CSV parsing, dependency-free DOCX text extraction, ≤500 cap support, per-record validation",
  "parallel_group": "GROUP-B",
  "dependencies": ["S5-C1", "S5-C2"],
  "file_outputs": ["src/lib/linaw/import-parser.ts", "tests/unit/linaw-import-parser.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-import-parser.test.ts first (cases listed in acceptance_criteria) — run, watch fail (module missing)",
    "GREEN: implement src/lib/linaw/import-parser.ts until the suite passes",
    "REFACTOR: keep pure functions, zero I/O except the zlib inflate, zero imports beyond node:zlib + @/types/linaw"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/lib/linaw/import-parser.ts` — the N013 bulk-import parsing library. Pure functions, NO DB access, NO network. Imports ONLY `node:zlib` and types from `@/types/linaw` (`ParsedImportRecord`). Must contain the tokens `likha|obra|ella|yala` zero times.

Export exactly:

1. `export const MAX_IMPORT_RECORDS = 500;`
2. `export class DocxParseError extends Error` (name `'DocxParseError'`).
3. `export function extractDocxText(buffer: Buffer): string` — dependency-free raw DOCX text extraction (decision D1): scan the buffer for ZIP local file headers (signature `0x04034b50` little-endian, i.e. bytes `PK\x03\x04`); for each entry read flags (offset 6), compression method (offset 8), compressed size (offset 18), filename length (offset 26), extra length (offset 28), then filename; if filename === `word/document.xml`: if general-purpose bit 3 (0x08) is set → throw `DocxParseError('unsupported DOCX: data-descriptor zip entries')`; method 0 → slice raw bytes; method 8 → `zlib.inflateRawSync` using the compressed size (if compressed size is 0, fall back to slicing up to the next `PK` signature before inflating); any other method → throw `DocxParseError`. Then convert XML → text: replace `</w:p>` with `\n`, `<w:br/>` and `<w:br />` with `\n`, `<w:tab/>` and `<w:tab />` with `\t`, strip ALL remaining `<…>` tags, decode entities `&amp; &lt; &gt; &quot; &apos;`, trim trailing whitespace per line, drop lines that are empty after trim, join with `\n`. If `word/document.xml` is not found → throw `DocxParseError('not a DOCX: word/document.xml missing')`.
4. `export function normalizeImportRecord(raw: unknown, index: number): { ok: true; record: ParsedImportRecord } | { ok: false; error: string }` — accepts camelCase OR snake_case keys (`ordinanceNumber|ordinance_number`, `seriesYear|series_year`, `title`, `content`, `subjectTags|subject_tags`); ordinanceNumber/seriesYear must coerce to positive integers (`Number(...)` then `Number.isInteger` + `> 0`); title/content must be non-empty strings after trim; subjectTags optional: string array, OR a single string split on `;` — entries trimmed, empties dropped, max 20 tags, each ≤ 60 chars; missing tags → `[]`. Error messages are precise: `'record N: ordinanceNumber must be a positive integer'` / `'record N: seriesYear must be a positive integer'` / `'record N: title must be a non-empty string'` / `'record N: content must be a non-empty string'` (N = index).
5. `export function parseCsvRows(text: string): Record<string, string>[]` — minimal RFC-4180-style CSV: first non-empty line is the header; fields may be double-quoted (escaped quote = `""`); handles commas, embedded newlines, and CRLF inside quotes; unquoted fields trim surrounding whitespace; blank lines skipped; rows with a different field count than the header are still emitted (missing → `''`, extra dropped).
6. `export function parseImportPayload(input: { text?: string; docxBuffer?: Buffer }): { records: ParsedImportRecord[]; invalidRecords: Array<{ index: number; error: string }> }` — if `docxBuffer` given: `extractDocxText` first, result becomes `text`. Format detection on trimmed text: starts with `{` or `[` → JSON (accept a bare array OR `{records: [...]}`; anything else → throw `Error('Invalid JSON import payload')` which the route maps to 400); otherwise CSV via `parseCsvRows` (header names matched case-insensitively against the normalize keys). Every row goes through `normalizeImportRecord`; failures land in `invalidRecords` with their 0-based index; successes in `records`. Empty text → `{records: [], invalidRecords: []}` (route maps to 400 NO_RECORDS).

Then create `tests/unit/linaw-import-parser.test.ts` — hermetic (`node:test` + `node:assert/strict`, relative import `../../src/lib/linaw/import-parser`, plus `buildMinimalDocx` from `../helpers/linaw-test-util`). Suite MUST cover: JSON array happy path (2 records, tags array preserved); JSON `{records:[...]}` envelope; snake_case keys accepted; CSV with quoted field containing comma + embedded newline + CRLF line endings; CSV missing optional tags → `[]`; tags given as `;`-separated string; per-record failures collected with correct indices (bad ordinanceNumber 0, missing title, non-numeric year) while valid rows still parse; DOCX round-trip — `buildMinimalDocx` of a CSV-shaped table text AND of a JSON array text both parse back to identical records (escaping check: include `&`, `<`, `>` in a title); `extractDocxText` throws `DocxParseError` on a non-zip buffer and on a zip without `word/document.xml`; 500-record JSON array parses fully (cap enforcement is the route's job — assert length 500 here).

**acceptance_criteria:**

1. Suite passes: `npx tsx --test tests/unit/linaw-import-parser.test.ts` exit 0, all subtests green.
2. Parser is pure: no `getDb`, no `fetch`, no fs; only `node:zlib` runtime import.
3. Boundary grep clean (see verification).

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-import-parser.test.ts   # expected: pass 1 suite, 0 failures
grep -inE "likha|obra|ella|yala" src/lib/linaw/import-parser.ts tests/unit/linaw-import-parser.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -cE "from ['\"]@/lib/(db|ai)" src/lib/linaw/import-parser.ts   # expected: 0
```

---

### S5-C4 — N014 module-owned OCR wrapper + hermetic contract test

```json
{
  "chunk_id": "S5-C4",
  "feature_id": "N014",
  "chunk_type": "feature",
  "name": "src/lib/linaw/ocr.ts — LINAW-owned OpenRouter OCR (gemini-2.5-flash PDF / qwen3.7-plus image, temp 0, 60s, one retry, injectable fetcher) + mocked-fetch contract test",
  "parallel_group": "GROUP-B",
  "dependencies": ["S5-C1"],
  "file_outputs": ["src/lib/linaw/ocr.ts", "tests/unit/linaw-ocr.test.ts"],
  "tdd_steps": [
    "RED: write tests/unit/linaw-ocr.test.ts with a mocked injectable fetcher (zero network, zero real API key) — run, watch fail",
    "GREEN: implement src/lib/linaw/ocr.ts until the suite passes",
    "REFACTOR: verify retry-once semantics match the contract table below exactly"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/lib/linaw/ocr.ts` — LINAW's OWN OCR wrapper. It implements the SAME model contract as the proven LIKHA pattern but is an INDEPENDENT implementation: ZERO imports from `src/lib/likha` (or obra/ella/yala), ZERO shared code. Node built-ins + global `fetch` only; zero DB access; zero console logging. Imports: none at runtime (types only where needed); `@/types/linaw` is NOT required here.

Contract (implement exactly):
- Endpoint constant `https://openrouter.ai/api/v1/chat/completions`; model constants `google/gemini-2.5-flash` (PDF) and `qwen/qwen3.7-plus` (JPEG/PNG); `DEFAULT_TIMEOUT_MS = 60_000`; `MAX_ATTEMPTS = 2`; `MAX_TOKENS = 8192`; temperature 0.
- `export type LinawOcrMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';`
- `export class OcrError extends Error` with optional `readonly status?: number` (name `'OcrError'`); `export class OcrTimeoutError extends OcrError` (default message `'OCR timed out after retry'`, name `'OcrTimeoutError'`).
- `export interface OcrOptions { fileBuffer: Buffer; mimeType: LinawOcrMimeType; filename?: string; timeoutMs?: number; fetcher?: typeof fetch }` (fetcher DI for tests; default global fetch).
- `export interface OcrResult { text: string; model: string; attempts: number }`.
- `export async function extractText(options: OcrOptions): Promise<OcrResult>`:
  - Lazily read `process.env.OPENROUTER_API_KEY`; missing → `OcrError('OPENROUTER_API_KEY is not configured')`.
  - Model by MIME: PDF → gemini; images → qwen. Request body: `{model, temperature: 0, max_tokens: 8192, messages: [{role:'system', content: <LINAW system prompt>}, {role:'user', content: [<media part>, <text part>]}]}`. The system prompt is LINAW's OWN wording (LGU legislative transcription, plain text only) — do not copy LIKHA's string verbatim. Media part: PDF → `{type:'file', file:{filename, file_data: 'data:application/pdf;base64,' + b64}}`; image → `{type:'image_url', image_url:{url: dataUri}}`.
  - Loop at most 2 attempts; fresh `AbortSignal.timeout(timeoutMs)` per attempt; headers `Authorization: Bearer <key>`, `Content-Type: application/json`.
  - `!response.ok`: HTTP ≥ 500 with attempts remaining → retry; otherwise throw `OcrError('OCR request failed with HTTP <status>', status)` (4xx never retried).
  - Success: parse `choices[0].message.content`; empty string → `OcrError('OCR returned empty text')` (NOT retried); else return `{text, model, attempts}`.
  - Catch: timeout-like errors (name `AbortError`/`TimeoutError` or message matching `/abort|timeout/i`) and network failures retry once; after the final attempt, if the last failure was timeout-like → `OcrTimeoutError`; else rethrow the last `OcrError` or wrap in `OcrError`.

Then create `tests/unit/linaw-ocr.test.ts` — hermetic contract test (set `process.env.OPENROUTER_API_KEY = 'test-key'` at top; mocked fetcher captures `{url, init}`; NO network). Subtests: (1) PDF → gemini model, image → qwen model; URL, `temperature 0`, Bearer header; PDF media part is the `file`/`file_data` data-URI shape; image media part is `image_url`; (2) 4xx (e.g. 401) → throws `OcrError` with `status`, exactly ONE fetch call; (3) 500 then success → returns text with `attempts === 2`; (4) 500 twice → throws `OcrError` status 500, exactly 2 calls; (5) timeout-like rejection (an `Error` named `AbortError`) twice → throws `OcrTimeoutError`, exactly 2 calls; (6) network error then success → succeeds, `attempts === 2`; (7) empty content → `OcrError('OCR returned empty text')`, one call; (8) missing API key (delete the env var, restore after) → `OcrError` before any fetch.

**acceptance_criteria:**

1. `npx tsx --test tests/unit/linaw-ocr.test.ts` exit 0, all subtests green — the mocked-fetch hermetic OCR contract test required by the sprint plan.
2. Retry-once semantics contract-identical to LIKHA's wrapper, implementation fully separate: `grep -inE "likha" src/lib/linaw/ocr.ts tests/unit/linaw-ocr.test.ts` → zero hits.
3. No imports from any other module; no `console.*`; no DB.

**verification_commands:**

```bash
npx tsx --test tests/unit/linaw-ocr.test.ts             # expected: pass, 0 failures
grep -inE "likha|obra|ella|yala" src/lib/linaw/ocr.ts tests/unit/linaw-ocr.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -cE "^import .*from ['\"]@/" src/lib/linaw/ocr.ts  # expected: 0
```

---

### S5-C5 — N013 `POST /api/linaw/import` route + API-level integration test

```json
{
  "chunk_id": "S5-C5",
  "feature_id": "N013",
  "chunk_type": "feature",
  "name": "Import route — JSON/CSV/DOCX ≤500 records → linaw_ordinances (source_type='import', pending_review), duplicate skip report, audit + logging",
  "parallel_group": "GROUP-C",
  "dependencies": ["S5-C1", "S5-C2", "S5-C3"],
  "file_outputs": ["src/app/api/linaw/import/route.ts", "tests/integration/linaw-import.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-import.test.ts (cases in acceptance_criteria) — run against dev server, watch fail (route missing)",
    "GREEN: implement the route until the suite passes",
    "REFACTOR: transaction-wrapped inserts, parameterized SQL only"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/app/api/linaw/import/route.ts` — N013 bulk text import into LINAW's own library. `export const runtime = "nodejs";`. Allowed imports: `next/server`, `node:crypto`, `@/lib/db`, `@/lib/logger` (`logModuleEvent`), `@/lib/user-auth-middleware` (`withUserAuth`), `@/lib/linaw/import-parser`, `@/types/linaw`. NOTHING from likha/obra/ella/yala. Wrap the handler: `export const POST = withUserAuth(async (request, { user }) => { … })`; acting user `user.user.id`, name `user.user.full_name`.

Behavior:
1. **Payload intake.** If `Content-Type` is `multipart/form-data`: read form field `file` (single `File`); extension (case-insensitive) decides format: `.json` → JSON text, `.csv` → CSV text, `.docx` → pass the buffer to `parseImportPayload({docxBuffer})` (decision D1 raw extraction); any other extension/MIME → 400 `{error: 'Unsupported import format — JSON, CSV or DOCX only', code: 'UNSUPPORTED_FORMAT'}`. If body is `application/json`: parse; accept bare array or `{records:[...]}` (hand the JSON string to `parseImportPayload({text})`). If body is `text/csv`: `parseImportPayload({text})`. Malformed JSON / unparseable payload → 400 `{error, code:'INVALID_PAYLOAD'}`. Unparseable/corrupt DOCX (`DocxParseError`) → 400 `{error: <message>, code:'INVALID_DOCX'}`.
2. **Batch gates.** 0 parseable records → 400 `{error:'No records found', code:'NO_RECORDS'}`. More than `MAX_IMPORT_RECORDS` (500) input rows → 400 `{error:'Maximum 500 records per batch', code:'TOO_MANY_RECORDS'}` (count input rows BEFORE per-record validation; the 501st record is rejected wholesale).
3. **Insert loop (better-sqlite3 transaction).** `batchId = crypto.randomUUID()`. Audit first: `INSERT INTO agent_decisions (id, module, pipeline_id, agent_id, agent_name, action, input_snapshot) VALUES (?, 'linaw', ?, 0, 'Ingestion', 'start', ?)` with inputSnapshot `{recordCount, format}`. Then in ONE `db.transaction`: keep an in-batch `seen` Set of `ord#|series`; for each valid record: if in `seen` OR `SELECT 1 FROM linaw_ordinances WHERE ordinance_number = ? AND series_year = ?` hits → `skippedDuplicates++`; else `INSERT INTO linaw_ordinances (id, ordinance_number, series_year, title, content, subject_tags, source_type, library_status, uploaded_by_id) VALUES (?, ?, ?, ?, ?, ?, 'import', 'pending_review', ?)` with `subject_tags = JSON.stringify(record.subjectTags)`, push `{id, library_status: 'pending_review'}` to `records`. Per-record validation failures from the parser go to `invalidRecords` (never inserted). Audit complete row (`action='complete'`, outputSnapshot `{imported, skippedDuplicates, invalid}`).
4. **Logging.** `logModuleEvent({module:'linaw', interactionType:'linaw_import', content: JSON.stringify({batchId, imported, skippedDuplicates, invalid: invalidRecords.length}), ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1', participantName: user.user.full_name, participantSessionId: 'linaw-' + user.user.id})`. Unexpected errors: log `linaw_import_error` (try/catch so logging never masks) and return 500 `{error:'Import failed'}`.
5. **Response 200:** `{ batchId, imported, skippedDuplicates, records: [{id, library_status}], invalidRecords }` (records items use snake_case `library_status` — PRD §12.6 verbatim, decision D13).

Then create `tests/integration/linaw-import.test.ts` — API-level (`assertServerReachable`, `seedApprovedUser`, cookie header; `BASE_URL + '/api/linaw/import'`; `node:test`; relative imports only; teardown deletes created `linaw_ordinances` rows by id, `agent_decisions` rows by pipeline_id, then user rows via cleanup). Cases: (1) no cookie → 401 `NO_SESSION`; (2) JSON body `{records:[2 valid]}` → 200, `imported===2`, both rows in DB with `source_type='import'`, `library_status='pending_review'`, `uploaded_by_id` = seeded user; (3) duplicate WITHIN batch (same ord#/series twice) → `imported===1, skippedDuplicates===1`; (4) duplicate against pre-existing DB row (seed via direct better-sqlite3 insert first) → skipped, `skippedDuplicates===1`; (5) 501-record JSON array → 400 `TOO_MANY_RECORDS` and ZERO rows inserted; (6) CSV body (`text/csv`, quoted commas) → imported correctly; (7) DOCX multipart: build JSON-array text via `buildMinimalDocx` from the helper, send as `FormData` file `batch.docx` → imported correctly (proves decision D1 end-to-end); (8) invalid-record report: batch with one bad row (year 0) → valid rows imported, `invalidRecords[0].index` correct; (9) unsupported `.xlsx` file → 400 `UNSUPPORTED_FORMAT`.

**acceptance_criteria:**

1. Suite green against a running dev server: `npx tsx --test tests/integration/linaw-import.test.ts` exit 0.
2. ≤500-record batch imports in a single synchronous transaction without timeout; response shape matches decision D13 exactly.
3. Every import writes an `agent_decisions` start+complete pair (`module='linaw'`, `agent_id=0`, `agent_name='Ingestion'`) and a `linaw_import` interaction_logs row (assert agent_decisions rows in test; logger rows best-effort).
4. Route imports nothing forbidden; `grep -inE "likha|archived_ordinances" src/app/api/linaw/import/route.ts` → zero hits.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-import.test.ts   # expected: pass, 0 failures
kill %1
grep -inE "likha|obra|ella|yala|archived_ordinances|amendment_links|classifications" src/app/api/linaw/import/route.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S5-C6 — N014 prompts + ingestion logic (`ingest.ts`) + hermetic digitize test

```json
{
  "chunk_id": "S5-C6",
  "feature_id": "N014",
  "chunk_type": "feature",
  "name": "src/lib/linaw/prompts.ts (own metadata prompt + never-throws parser) + src/lib/linaw/ingest.ts (scan digitize chain, manual create, verification decisions — DI for tests)",
  "parallel_group": "GROUP-C",
  "dependencies": ["S5-C1", "S5-C2", "S5-C4"],
  "file_outputs": ["src/lib/linaw/prompts.ts", "src/lib/linaw/ingest.ts", "tests/integration/linaw-digitize.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-digitize.test.ts (hermetic: temp DB_PATH + injected OCR/LLM stubs) — run, watch fail",
    "GREEN: implement prompts.ts + ingest.ts until the suite passes",
    "REFACTOR: keep every DB handle / OCR fn / LLM fn injectable; no hidden globals except process.env"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create TWO server-only LINAW modules. Allowed imports: `node:crypto`, `node:fs`, `node:path`, `@/lib/db` (`getDb`), `@/lib/ai/llm` (`chatCompletion` — permitted shared primitive), `@/lib/linaw/ocr` (S5-C4), `@/types/linaw`. NOTHING from likha/obra/ella/yala. Tokens `likha|obra|ella|yala` forbidden in all three files.

**A. `src/lib/linaw/prompts.ts`** — LINAW's OWN metadata prompt + parser (duplicates the LIKHA pattern, separate wording):
- `export const LINAW_METADATA_SYSTEM_PROMPT: string` — strict-JSON extraction prompt for Philippine LGU ordinances: return ONLY `{"ordinanceNumber": number, "seriesYear": number, "title": string, "confidence": {"ordinanceNumber": number, "seriesYear": number, "title": number}}`; ordinanceNumber = numeric part of 'Ordinance No. X'; seriesYear = 'Series of YYYY' year; title = full 'An ordinance …' enactment clause; confidence 0–1 self-estimates, 0 when not found. No prose, no markdown fences.
- `export function buildLinawMetadataUserPrompt(rawText: string): string` — truncates to 12,000 chars and asks for the JSON object.
- `export interface ParsedLinawMetadata { ordinanceNumber: number; seriesYear: number; title: string; confidence: { ordinanceNumber: number; seriesYear: number; title: number } }`.
- `export function parseLinawMetadataResponse(llmText: string): ParsedLinawMetadata` — NEVER throws: strips ``` fences, finds first `{…}` span, coerces integers (`Math.trunc`, fallback 0), clamps confidences to [0,1], any failure → all-zero defaults.

**B. `src/lib/linaw/ingest.ts`** — the ingestion/verification logic with full DI (mirror of the proven LIKHA server-logic pattern, independently written):

- `export const LINAW_UPLOAD_DIR = path.join('data', 'uploads', 'linaw');` and `export function linawScanRelPath(recordId: string, sourceFilename: string): string` → `'data/uploads/linaw/' + recordId + '__' + sourceFilename.replace(/[^a-zA-Z0-9._-]/g, '_')` (decision D6 — deterministic; the detail/scan routes reconstruct this).
- `export function digitizeScanFile(params: { buffer: Buffer; mimeType: 'application/pdf'|'image/jpeg'|'image/png'; filename: string; uploadedById: string; db?: Database; ocr?: typeof extractText; llm?: (system: string, user: string) => Promise<string> }): { status: 'accepted'|'duplicate'|'duplicate_metadata'|'ocr_failed'; id?: string; hash: string; ordinanceNumber?: number; seriesYear?: number; title?: string; confidence?: {ordinanceNumber:number;seriesYear:number;title:number}; error?: string }` — the inline chain (decision D11), defaults `db=getDb()`, `ocr=extractText`, `llm=chatCompletion`:
  1. `hash = sha256(buffer)` hex — computed BEFORE anything else.
  2. Hash duplicate check: `SELECT id FROM linaw_ordinances WHERE file_hash = ?` → hit ⇒ return `{status:'duplicate', hash}` (nothing written).
  3. `recordId = crypto.randomUUID()`; mkdir recursive `LINAW_UPLOAD_DIR`; write file to `linawScanRelPath(recordId, filename)`.
  4. Insert `processing` row with PLACEHOLDER metadata: `ordinance_number = -crypto.randomInt(1, 2_000_000_000)`, `series_year = 0`, `title = 'Processing — ' + filename`, `content = ''`, `source_type='scan'`, `source_filename=filename`, `file_hash=hash`, `library_status='processing'`, `uploaded_by_id`. (On astronomically unlikely placeholder UNIQUE collision, retry once with a fresh random number.)
  5. OCR: `await ocr({fileBuffer: buffer, mimeType, filename})`. On `OcrError`/`OcrTimeoutError` (after the wrapper's own retry) → UPDATE row to `library_status='pending_review'` (content stays `''`, placeholders stay), log nothing here (route logs), return `{status:'ocr_failed', id: recordId, hash, error: <message>}` — the human fixes it in verification (PRP exception rule).
  6. Metadata parse: `raw = await llm(LINAW_METADATA_SYSTEM_PROMPT, buildLinawMetadataUserPrompt(ocrText))` inside try/catch; `parsed = parseLinawMetadataResponse(raw)`.
  7. If `parsed.ordinanceNumber > 0 && parsed.seriesYear > 0 && parsed.title !== ''`: check `SELECT id FROM linaw_ordinances WHERE ordinance_number = ? AND series_year = ?` → hit ⇒ DELETE the placeholder row, delete the stored file (fs.rmSync force), return `{status:'duplicate_metadata', hash}`; else UPDATE row SET real ordinance_number/series_year/title, `content = ocrText`, `library_status='pending_review'`, `updated_at=datetime('now')` and return `{status:'accepted', id, hash, ordinanceNumber, seriesYear, title, confidence}`.
  8. Else (parse produced zeros): UPDATE row SET `content = ocrText`, `library_status='pending_review'` (placeholders remain for the human) and return `{status:'accepted', id, hash}` with no metadata keys.
- `export function createManualRecord(params: { userId: string; fields: LinawManualCreateRequest; db?: Database }): { ok: true; record: LinawOrdinance } | { ok: false; kind: 'invalid'|'conflict'; error: string }` — validates (ordinanceNumber/seriesYear positive integers; title/content non-empty strings after trim; subjectTags optional string[] ≤20 entries ≤60 chars each, trimmed); UNIQUE(ordinance_number, series_year) collision → `{ok:false, kind:'conflict', error:'An ordinance with this number and series year already exists'}`; success inserts `source_type='manual'`, `library_status='pending_review'` and returns the camelCase record.
- `export function applyLibraryDecision(params: { recordId: string; userId: string; body: LinawVerificationRequest; db?: Database }): { ok: true; response: LinawVerificationResponse } | { ok: false; kind: 'not_found'|'conflict'|'invalid'; error: string }` — mirror of the proven LIKHA verification semantics on `linaw_ordinances`: 404 when missing; `expectedUpdatedAt` mismatch → conflict; ONLY `library_status='pending_review'` rows are mutable (anything else → conflict `'Record already finalized'`); reject requires non-empty reason (invalid otherwise); fields validated like createManualRecord; then in a transaction: **approve** → guarded `UPDATE … SET library_status='ready', verified_by_id=?, updated_at=datetime('now') WHERE id=? AND library_status='pending_review'` (0 changes → conflict), audit `('confirm', module='linaw', agent_id=0, agent_name='Library Verification', user_id, output_snapshot={"decision":"approve"})`; **reject** → `library_status='rejected'`, audit `'reject'` with `reason` (the reason persists ONLY in agent_decisions — decision D9, the table has no reason column); **edit** → apply provided fields (UPDATE sets), stays `pending_review`, UNIQUE collision on (ordinance_number, series_year) → conflict, audit `'confirm'` with output_snapshot of the changed fields. Also write `logModuleEvent` is NOT done here (route does it).
- All SQL parameterized; all audit inserts `module='linaw'`, `pipeline_id = 'verification-' + recordId` for decisions, caller-provided `batchId` for ingestion (export a small `recordIngestionDecision({db?, pipelineId, action, inputSnapshot?, outputSnapshot?})` helper used by both import and upload routes, `agent_name='Ingestion'`, `agent_id=0` — decision D7).

**C. `tests/integration/linaw-digitize.test.ts`** — hermetic in-process (NO server, NO network): set `process.env.DB_PATH = tempDbPath()` BEFORE dynamic imports of `../../src/lib/db` and `../../src/lib/linaw/ingest`; seed an approved uploader row. Inject stub `ocr` (returns `{text: 'Ordinance No. 9, Series of 2020 …', model:'stub', attempts:1}`) and stub `llm` (returns metadata JSON for ordinanceNumber 9 / seriesYear 2020 / title 'An ordinance …' with confidences). Cases: (1) happy chain → row exists `library_status='pending_review'`, real metadata, content = OCR text, file exists at reconstructed path; (2) hash duplicate: second call with same buffer → `status 'duplicate'`, still one row; (3) metadata collision: seed existing (9, 2020) row, new buffer with same parsed metadata → `status 'duplicate_metadata'`, placeholder row deleted, file removed; (4) OCR failure: stub ocr throws `OcrTimeoutError` → row `pending_review` with placeholders + empty content, `status 'ocr_failed'`; (5) LLM garbage (stub returns 'not json') → row accepted with placeholders + OCR content present; (6) `createManualRecord` happy → `source_type='manual'`, `pending_review`; invalid fields → `kind 'invalid'`; same pair again → `kind 'conflict'`; (7) `applyLibraryDecision`: approve → `ready` + `verified_by_id` set + agent_decisions row (`module='linaw'`, `agent_name='Library Verification'`, `action='confirm'`, user_id); approve again → conflict; reject without reason → invalid; reject with reason → `rejected` + audit reason persisted; edit title/content → persists, stays `pending_review`; edit onto an existing pair → conflict; decision on a `ready` row → conflict.

**acceptance_criteria:**

1. `npx tsx --test tests/integration/linaw-digitize.test.ts` exit 0 — fully hermetic (temp DB, stubbed OCR/LLM).
2. `prompts.ts` parser never throws on arbitrary garbage input (covered by case 5 + a direct unit-style subtest feeding `'```json garbage'`).
3. Zero forbidden imports/tokens; `chatCompletion` is the ONLY `@/lib/ai/*` import.

**verification_commands:**

```bash
npx tsx --test tests/integration/linaw-digitize.test.ts   # expected: pass, 0 failures
grep -inE "likha|obra|ella|yala|archived_ordinances" src/lib/linaw/prompts.ts src/lib/linaw/ingest.ts tests/integration/linaw-digitize.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
grep -cE "from ['\"]@/lib/ai/(prompts|obra-export)" src/lib/linaw/ingest.ts   # expected: 0
```

---

### S5-C7 — N014 `POST /api/linaw/upload` route + API-level upload test

```json
{
  "chunk_id": "S5-C7",
  "feature_id": "N014",
  "chunk_type": "feature",
  "name": "Upload route — ≤10 files PDF/JPG/PNG ≤20MB, SHA-256 before OCR, inline digitize (processing → pending_review), per-file result report",
  "parallel_group": "GROUP-D",
  "dependencies": ["S5-C1", "S5-C2", "S5-C4", "S5-C6"],
  "file_outputs": ["src/app/api/linaw/upload/route.ts", "tests/integration/linaw-upload.test.ts"],
  "tdd_steps": [
    "RED: write tests/integration/linaw-upload.test.ts — run against dev server, watch fail",
    "GREEN: implement the route until the suite passes",
    "REFACTOR: keep the route a thin wrapper over ingest.digitizeScanFile"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create `src/app/api/linaw/upload/route.ts` — N014 scan upload with module-owned OCR. `export const runtime = "nodejs";`. Allowed imports: `next/server`, `node:crypto`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/linaw/ingest` (`digitizeScanFile`, `recordIngestionDecision`), `@/types/linaw`. Nothing from likha/obra/ella/yala. `export const POST = withUserAuth(async (request, { user }) => { … })`.

Behavior (mirror of the proven LIKHA upload contract, LINAW-owned):
1. Read multipart field `files` (`form.getAll('files')` filtered to `File` instances).
2. All-or-nothing validation BEFORE any write: 0 files → 400 `{error:'No files provided', code:'NO_FILES'}`; >10 → 400 `TOO_MANY_FILES` (`Maximum 10 files per batch`); any `file.size > 20*1024*1024` → 400 `FILE_TOO_LARGE`; any MIME outside `['application/pdf','image/jpeg','image/png']` → 400 `UNSUPPORTED_TYPE`. Error bodies include `files: [{originalFilename, error}]` details.
3. `batchId = crypto.randomUUID()`; audit start row via `recordIngestionDecision` (`pipeline_id=batchId`, inputSnapshot `{fileCount}`).
4. Loop files SEQUENTIALLY (decision D11): `buffer = Buffer.from(await file.arrayBuffer())` → `const result = await digitizeScanFile({buffer, mimeType: file.type, filename: file.name, uploadedById: user.user.id})`; map to `LinawUploadFileResult` (`id: result.id`, `hash: result.hash`, `status`, `originalFilename: file.name`, `mimeType: file.type`, `sizeBytes: file.size`, + metadata/confidence/error when present). Counters: accepted = status 'accepted'; duplicates = 'duplicate' + 'duplicate_metadata'; failed = 'ocr_failed'.
5. Audit complete row (outputSnapshot `{accepted, duplicates, failed}`); `logModuleEvent({module:'linaw', interactionType:'linaw_upload', content: JSON.stringify({batchId, accepted, duplicates, failed}), ipAddress, participantName, participantSessionId: 'linaw-' + user.user.id})`. Unexpected error → log `linaw_upload_error` (never mask) + 500 `{error:'Upload failed'}`.
6. Response 200: `LinawUploadResponse` `{batchId, accepted, duplicates, failed, files}`.

Then `tests/integration/linaw-upload.test.ts` — API-level (cookie auth; fixtures via `readLinawFixture`; teardown: delete created rows + audit rows + files under `data/uploads/linaw/` for created record ids, then user cleanup). Cases: (1) 401 without cookie; (2) NO_FILES (empty form); (3) 11 tiny PNGs → 400 TOO_MANY_FILES; (4) oversize file (21 MB zero-buffer `File`) → 400 FILE_TOO_LARGE; (5) `text/plain` file → 400 UNSUPPORTED_TYPE; (6) duplicate hash: seed a `linaw_ordinances` row whose `file_hash` equals sha256 of the PNG fixture (compute in-test), upload that fixture → 200 with that file `status 'duplicate'`, no new row (duplicate detection happens BEFORE OCR, so this needs no API key); (7) single small PNG happy path — CONTRACT-ONLY assertions that hold with or without `OPENROUTER_API_KEY` on the server: 200; `files[0].status` ∈ {`accepted`, `ocr_failed`}; a `linaw_ordinances` row exists with `source_type='scan'`, `library_status='pending_review'`, non-empty `file_hash`, the stored file present at the reconstructed `data/uploads/linaw/<id>__<name>` path; an `agent_decisions` start+complete pair exists for the batchId. (Do NOT assert model output quality — SPRINT_PLAN risk 7; pilot OCR accuracy is a SYSTEM_TEST concern.)

**acceptance_criteria:**

1. `npx tsx --test tests/integration/linaw-upload.test.ts` exit 0 against the dev server (no OpenRouter key required for determinism).
2. SHA-256 computed before OCR; hash duplicates never trigger OCR (proven by case 6 with stub-quality speed).
3. `processing → pending_review` transition observable in DB for every accepted/failed file; zero rows left at `processing` after the response.
4. Boundary grep clean; `withUserAuth` on the route.

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-upload.test.ts   # expected: pass, 0 failures
kill %1
grep -inE "likha|obra|ella|yala|archived_ordinances" src/app/api/linaw/upload/route.ts tests/integration/linaw-upload.test.ts || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S5-C8 — Library routes (list / manual create / detail / verify / scan) + API-level test

```json
{
  "chunk_id": "S5-C8",
  "feature_id": "N014 (+ manual entry)",
  "chunk_type": "feature",
  "name": "GET/PUT /api/linaw/library + GET/PUT /api/linaw/library/[id] + GET /api/linaw/library/[id]/scan — list/search (SQL LIKE), manual entry 409, approve→ready / reject+reason / edit, authenticated scan stream",
  "parallel_group": "GROUP-D",
  "dependencies": ["S5-C1", "S5-C2", "S5-C6"],
  "file_outputs": [
    "src/app/api/linaw/library/route.ts",
    "src/app/api/linaw/library/[id]/route.ts",
    "src/app/api/linaw/library/[id]/scan/route.ts",
    "tests/integration/linaw-library.test.ts"
  ],
  "tdd_steps": [
    "RED: write tests/integration/linaw-library.test.ts — run against dev server, watch fail",
    "GREEN: implement the three route files until the suite passes",
    "REFACTOR: routes stay thin over ingest.ts (createManualRecord / applyLibraryDecision)"
  ]
}
```

**instruction_prompt (verbatim, self-contained):**

Create THREE route files under `src/app/api/linaw/library/`. Each: `export const runtime = "nodejs";`, every handler wrapped in `withUserAuth`. Allowed imports: `next/server`, `node:fs`, `node:path`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/linaw/ingest`, `@/types/linaw`. Nothing from likha/obra/ella/yala; zero reference to `archived_ordinances`.

1. **`route.ts` — GET list + PUT manual create.**
   - `GET /api/linaw/library?q=&libraryStatus=&page=&limit=`: validate `libraryStatus` against `processing|pending_review|ready|rejected` when present (400 VALIDATION otherwise); `page`/`limit` integers (page ≥1; limit clamped 1..100, default 20); `q` optional. WITHOUT q: SQL listing `WHERE library_status = ?` (when filtered) ordered `updated_at DESC, series_year DESC`, LIMIT/OFFSET + COUNT. WITH q (decision D5 — SQL LIKE this sprint, BM25 in Sprint 6): escape `\ % _` in q, `WHERE (title LIKE ? ESCAPE '\' OR content LIKE ? ESCAPE '\')` with `'%'+escaped+'%'` AND the optional status filter. Items map to `LinawLibraryListItem` (camelCase; `snippet` = server-side HTML-escaped first 200 chars of content — escape-then-mark rule, no `<mark>` this sprint). Response `{items, total, page, limit, tookMs}`.
   - `PUT /api/linaw/library` — manual entry (PRD §6.5): JSON body `LinawManualCreateRequest`; invalid JSON → 400 INVALID_BODY; delegate to `createManualRecord({userId: user.user.id, fields})`; invalid → 400 VALIDATION; conflict → 409 `{error, code:'CONFLICT'}`; success → **201** with the created record, `logModuleEvent` `linaw_manual_create` (content `{id, ordinanceNumber, seriesYear}`), agent_decisions row via the decision helper (`agent_name='Library Verification'`? NO — use `recordIngestionDecision` with a fresh `pipeline_id = 'manual-' + id`, `agent_name='Ingestion'`, action 'complete', outputSnapshot `{ordinanceNumber, seriesYear}`).
2. **`[id]/route.ts` — GET detail + PUT decision.**
   - `GET /api/linaw/library/[id]` → 404 NOT_FOUND when missing; `LinawLibraryDetailResponse`: camelCase record incl. content; `scanAvailable = source_filename != null AND reconstructed file exists` (path = `linawScanRelPath(id, source_filename)` resolved against `process.cwd()`); `scanUrl = scanAvailable ? '/api/linaw/library/' + id + '/scan' : null`; `scanMimeType` from extension (`.pdf`→application/pdf, `.jpg/.jpeg`→image/jpeg, `.png`→image/png, else null).
   - `PUT /api/linaw/library/[id]` — body `LinawVerificationRequest` (invalid JSON → 400; action outside approve/reject/edit → 400); delegate to `applyLibraryDecision`; map not_found→404, invalid→400, conflict→409; success 200 with `LinawVerificationResponse`; `logModuleEvent` `linaw_library_verify` (content `{recordId, action, libraryStatus}`); reject persists the reason in `agent_decisions.reason` (no table column — decision D9).
3. **`[id]/scan/route.ts` — GET authenticated scan stream** (D6/D15 precedent): 404 when record missing, `source_filename` null, or file absent; else serve the bytes with `Content-Type` by extension, `Content-Disposition: inline; filename="<sanitized>"`, `Cache-Control: private, max-age=0` (auth-gated, never public).

Then `tests/integration/linaw-library.test.ts` — API-level. Setup helper writes: seeded user; one manual-ish pending row via direct DB insert; one scan-shaped pending row WITH a real file: write the PNG fixture bytes to `data/uploads/linaw/<id>__scan-sample.png` and insert the row with matching id/source_filename/file_hash. Teardown removes rows, audit rows, the written file, user. Cases: (1) GET without cookie → 401; PUT (both routes) without cookie → 401; scan GET without cookie → 401; (2) PUT create happy → 201, DB row `source_type='manual'`, `library_status='pending_review'`; (3) PUT create same (ord#, series) again → 409 CONFLICT (duplicate 409 requirement); (4) PUT create invalid (year 0) → 400; (5) GET list `?libraryStatus=pending_review` returns seeded rows only, camelCase items + total/page/limit/tookMs; `?q=<unique title word>` matches; `?libraryStatus=bogus` → 400; (6) GET [id] detail for the scan row → `scanAvailable true`, `scanMimeType 'image/png'`, `scanUrl` ends with `/scan`; GET the scanUrl (with cookie) → 200, body bytes equal the fixture, content-type image/png; GET detail of unknown id → 404; (7) approve → 200 `libraryStatus 'ready'`; DB: `library_status='ready'` AND `verified_by_id` = seeded user; agent_decisions row `module='linaw'`, `agent_name='Library Verification'`, `action='confirm'`; approve again → 409; (8) reject without reason → 400; reject with reason → `library_status='rejected'` + audit row carries the reason; (9) edit title+content → persisted, stays `pending_review`; edit onto an existing (ord#, series) pair → 409.

**acceptance_criteria:**

1. `npx tsx --test tests/integration/linaw-library.test.ts` exit 0.
2. Approve is the ONLY path to `library_status='ready'`; rejected records never become ready (re-approve of rejected → 409 covered by the pending_review-only guard).
3. Scan bytes stream ONLY through the authenticated route; nothing under `public/`.
4. All decisions audited (`agent_decisions module='linaw'`) + logged (`logModuleEvent module='linaw'`).

**verification_commands:**

```bash
npm run dev & sleep 8
npx tsx --test tests/integration/linaw-library.test.ts   # expected: pass, 0 failures
kill %1
grep -rinE "likha|archived_ordinances|amendment_links|classifications" src/app/api/linaw/library || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN (exit via echo)
```

---

### S5-C9 — UI: library-ingestion + library-verification + /linaw page replacement + middleware line

```json
{
  "chunk_id": "S5-C9",
  "feature_id": "N013 (UI) + N014 (verification UI) + manual entry (UI)",
  "chunk_type": "ui",
  "name": "src/components/linaw/library-ingestion.tsx (three input modes) + library-verification.tsx (own review queue/panel) + src/app/linaw/page.tsx (tabs, kit wired, agents idle) + PROTECTED_PATHS '/linaw'",
  "parallel_group": "GROUP-E",
  "dependencies": ["S5-C5", "S5-C7", "S5-C8"],
  "file_outputs": [
    "src/components/linaw/library-ingestion.tsx",
    "src/components/linaw/library-verification.tsx",
    "src/app/linaw/page.tsx",
    "src/middleware.ts"
  ],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Build LINAW's UI for Sprint 5. All components `'use client'`, Tailwind + DESIGN.md palette (bg `#0F1729` / surface `#1E293B` / border `#283147` / text `#FFFFFF` + `#94A3B8` / accent `#0038A8` / AI cyan `#22D3EE` / success `#22C55E` / error-rose `#F43F5E`), lucide-react icons, `cn()` from `@/lib/utils`, touch targets ≥44px below 1024px (`min-h-11`), responsive at 360/768/1280, keyboard-operable dialogs. Allowed imports: React, `lucide-react`, `@/lib/utils`, `@/components/ui/*`, the shared kit, `@/types/agentic`, `@/types/linaw`, `next/...` where needed. Client components talk to the API over HTTP ONLY (no server imports). Tokens `likha|obra|ella|yala` forbidden.

1. **`src/components/linaw/library-ingestion.tsx`** — ONE panel, THREE input modes (PRP-LINAW "Library Ingestion"), mode switcher (segmented tabs): 
   (a) **Bulk import (N013):** file input accepting `.json,.csv,.docx` OR a paste textarea (JSON/CSV text); a format hint line ("DOCX is parsed server-side — text inside the document must be JSON- or CSV-shaped"); client-side preview table for JSON/CSV pasted/file text (component-local minimal parse: same field rules as the server — ordinanceNumber/seriesYear/title/content; rows that fail render rose with the reason; in-batch duplicate (ord#, series) rows flagged with an inline warning — decision D12 surfaced pre-submit); DOCX selection shows a file chip + note instead of a preview. Import button POSTs to `/api/linaw/import` (FormData file when a file was chosen, JSON body when pasted) and renders the result report (`imported`, `skippedDuplicates`, `invalidRecords` list). 
   (b) **Scan upload (N014):** drag-drop zone + file picker, ≤10 files PDF/JPG/PNG ≤20 MB each with client-side pre-validation (over-limit files listed rose, not sent); per-file progress rows (queued → uploading/OCR running → accepted / duplicate / ocr_failed with reason); POSTs `FormData` field `files` to `/api/linaw/upload`; result summary line; note "Scans land as pending_review — approve them in Verification below." 
   (c) **Manual entry:** form ordinanceNumber (number), seriesYear (number), title (text), content (textarea), subjectTags (comma-separated text input → trimmed array); PUTs `/api/linaw/library`; on 409 shows inline duplicate warning "(ordinance number, series year) already exists"; on 201 success message + reset. Panel disables its buttons while a request is in flight.
2. **`src/components/linaw/library-verification.tsx`** — LINAW's OWN verification queue + review panel (duplicates the proven LIKHA panel pattern — no shared code): loads `GET /api/linaw/library?libraryStatus=pending_review&limit=50`; renders review cards (Ord. No. / series / title / source-type badge / updated time / "Review" button); empty state "No records awaiting review.". Opening a record launches a focus-trapped, Esc-closeable modal dialog (restore focus on close): LEFT "ORIGINAL SCAN" — when `scanAvailable`: `<iframe>` for PDF, `<img>` with Zoom −/Zoom +/Rotate controls for images, streaming from `scanUrl`; when not available (import/manual): note "No source scan — text-only record"; RIGHT "EXTRACTED TEXT (editable)" — inputs for ordinanceNumber, seriesYear, title, a content textarea, subjectTags comma input; decision bar: reason input (required for reject), Reject (rose, disabled until reason non-empty), Edit & Save (gray), Approve (Philippine-blue) — PUT `/api/linaw/library/<id>` with `{action, reason?, fields?, expectedUpdatedAt: record.updatedAt}`; 409 → "Record changed or already finalized — reload and retry"; approve/reject close + refresh queue; edit stays open with "Corrections saved — record still awaits review."
3. **`src/app/linaw/page.tsx`** — REPLACE the Sprint-1 placeholder wholesale. Header: "L.I.N.A.W." + subtitle "Legislative Indexing for Normalized & Accessible Wisdom — Library & Codification". Tabs (state): **Library & Ingestion** (default; renders `<LibraryIngestion/>` then `<LibraryVerification/>` stacked), **Inventory**, **Classification**, **Relationships**, **Code Assembly** (the last four render stub cards: "Lands in Sprint 6" for Inventory/Classification/Relationships, "Lands in Sprint 7" for Code Assembly). Above the tabs: the shared kit wired PROPS-ONLY — `<AgentPipeline agents={…} isProcessing={false} pipelineComplete={false}/>` where agents = `LINAW_AGENT_DEFS.map(def => ({id: def.id, name: def.name, module: 'linaw', description: def.description, status: 'idle', color: def.color, glowClass: def.glowClass}))`, plus `<ActivityFeed activities={[]} onConfirm onEdit onReject={noop}/>` (empty state renders) and the caption "Pipeline agents activate once the library holds ready records (Sprint 6) — ingestion & verification run directly.". NO pipeline-run logic this sprint.
4. **`src/middleware.ts`** — ONE additive line: append `"/linaw"` to `PROTECTED_PATHS` (becomes `["/ella", "/obra", "/yala", "/likha", "/linaw"]`). Do NOT touch `config.matcher` (finding flagged for SPRINT_REVIEW). Nothing else in the file changes.

**acceptance_criteria:**

1. `npm run build` green (client components compile); `npx tsc --noEmit` green.
2. `/linaw` renders all five tab labels, the six LINAW agent names, the empty-feed message, and both ingestion/verification sections (render smoke in S5-C10).
3. Kit untouched (prop-driven only); no fetch calls to any non-`/api/linaw/*` endpoint in the components.
4. Middleware diff is exactly the one-line PROTECTED_PATHS addition.

**verification_commands:**

```bash
npx tsc --noEmit && echo TSC-OK    # expected: TSC-OK
git --no-pager diff --stat v0.4.0-sprint-4..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts | grep -c . || echo KIT-UNTOUCHED   # expected: KIT-UNTOUCHED
git --no-pager diff -- src/middleware.ts | grep -c '"/linaw"'   # expected: >= 1 (exactly the one added entry)
grep -rinE "likha|obra|ella|yala" src/components/linaw src/app/linaw/page.tsx || echo BOUNDARY-CLEAN   # expected: BOUNDARY-CLEAN
```

---

### S5-C10 — Final gate: boundary greps, quality gates, FULL regression, commits

```json
{
  "chunk_id": "S5-C10",
  "feature_id": "ALL (Sprint 5 gate)",
  "chunk_type": "gate",
  "name": "Boundary verification both directions, lint/tsc/build, package.json test-script update, full Sprint 1–4 regression, render smoke, 2 feature commits",
  "parallel_group": "GROUP-F",
  "dependencies": ["S5-C1", "S5-C2", "S5-C3", "S5-C4", "S5-C5", "S5-C6", "S5-C7", "S5-C8", "S5-C9"],
  "file_outputs": ["package.json"],
  "tdd_steps": []
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint-5 gate end-to-end and record every output as SPRINT_REVIEW evidence. Work from the repo root; Git Bash/POSIX shell.

**A. Boundary verification (both directions — violation = build failure):**

```bash
# LINAW direction — zero forbidden imports:
grep -REn "from ['\"]@/(app/api/(obra|chat|likha)|lib/(ai/(prompts|obra-export)|likha)|components/(ella|obra|yala|likha))" \
  src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts
# expected: no output, exit code 1

# LINAW direction — zero sibling-module tokens anywhere in Sprint-5 source:
grep -RinE "likha|obra|ella|yala" src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw src/types/linaw.ts
# expected: no output, exit code 1

# LINAW direction — zero cross-module table reads (archived_ordinances / amendment_links / classifications):
grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(archived_ordinances|amendment_links)\b|(FROM|INTO|UPDATE|TABLE)[[:space:]]+classifications\b" \
  src/lib/linaw src/app/api/linaw
# expected: no output, exit code 1

# Sprint-5 file set (incl. tests) — archived_ordinances mentions must be ZERO:
grep -Rin "archived_ordinances" src/lib/linaw src/app/api/linaw src/components/linaw src/app/linaw \
  src/types/linaw.ts tests/helpers/linaw-test-util.ts tests/unit/linaw-import-parser.test.ts tests/unit/linaw-ocr.test.ts \
  tests/integration/linaw-digitize.test.ts tests/integration/linaw-import.test.ts tests/integration/linaw-upload.test.ts \
  tests/integration/linaw-library.test.ts
# expected: no output, exit code 1

# Test-harness isolation — LINAW tests never import LIKHA helpers/code:
grep -RinE "likha" tests/helpers/linaw-test-util.ts tests/unit/linaw-*.test.ts tests/integration/linaw-*.test.ts
# expected: no output, exit code 1

# LIKHA direction (regression — LIKHA remains clean after a LINAW sprint):
grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha
# expected: no output, exit code 1
grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha
# expected: no output, exit code 1
```

**B. Quality gates:**

```bash
npx tsc --noEmit && echo TSC-OK      # expected: TSC-OK
npm run lint 2>&1 | tail -5          # expected: no NEW errors in Sprint-5 files (legacy warn debt may persist repo-wide)
npm run build 2>&1 | tail -15        # expected: Compiled successfully / route table lists /api/linaw/import, /api/linaw/upload, /api/linaw/library, /api/linaw/library/[id], /api/linaw/library/[id]/scan, /linaw
```

**C. New Sprint-5 suites + package.json wiring:**

First, additive edit to `package.json` scripts (explicit file lists, same convention as Sprints 2–4):
- `test` appends: `tests/unit/linaw-ocr.test.ts tests/unit/linaw-import-parser.test.ts tests/integration/linaw-digitize.test.ts`
- `test:integration` appends: `tests/integration/linaw-import.test.ts tests/integration/linaw-upload.test.ts tests/integration/linaw-library.test.ts`

```bash
npm run dev &   # background; wait for "Ready" on http://localhost:3000
sleep 8

npm run test
# expected: hermetic suite passes — Sprint-2/3/4 LIKHA suites (ocr, search, classify, export-dilg,
# export-l1, metadata, verification, publish, classification) + Sprint-5 LINAW: linaw-ocr contract
# (mocked fetch: models/temp/auth/media parts, 4xx no-retry, 5xx retry-once, timeout retry-once →
# OcrTimeoutError), linaw-import-parser (JSON/CSV/DOCX round-trip, quoting, invalid rows, caps),
# linaw-digitize (hash→processing→OCR→parse→pending_review chain, duplicates, OCR-failure fallback,
# manual create + conflict, approve/reject/edit persistence + audit rows) — exit 0

npm run test:integration
# expected: API-level suites pass — LIKHA upload/archive/classify/exports (regression) + LINAW
# import (401, happy, in-batch + DB duplicates, 501st rejected, CSV, DOCX, invalid report, bad
# format), upload (401, NO_FILES, 11th file, >20MB, bad MIME, hash duplicate, contract happy path),
# library (401s, manual create 201 + 409 duplicate + 400 invalid, list filter/q/400, detail +
# scan stream, approve → ready + verified_by_id, double-approve 409, reject reason required +
# persisted to agent_decisions, edit persists + collision 409) — exit 0

kill %1
```

**D. Regression — FULL Sprint 1–4 re-run (a LIKHA failure here is boundary-violation evidence and blocks the tag):**

```bash
# Sprint 1: kit neutrality — kit + agentic types byte-identical since Sprint 4:
git --no-pager diff --stat v0.4.0-sprint-4..HEAD -- src/components/agent-pipeline.tsx src/components/agent-card.tsx src/components/activity-feed.tsx src/types/agentic.ts | grep -c . || echo KIT-UNTOUCHED
# expected: KIT-UNTOUCHED

# Sprint 1: schema intact + idempotent (run TWICE) — Sprint 5 adds NO schema:
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','idx_linaw_ord_year','idx_linaw_ord_lstat','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); if(missing.length){console.error('FAIL missing:',missing); process.exit(1);} console.log('SCHEMA OK: all foundation tables + indexes present');"
# expected (both runs): SCHEMA OK: all foundation tables + indexes present
git --no-pager diff --stat v0.4.0-sprint-4..HEAD -- src/lib/db.ts src/lib/logger.ts src/lib/ai/llm.ts | grep -c . || echo SHARED-UNTOUCHED
# expected: SHARED-UNTOUCHED (Sprint 5 edits no shared file except middleware's one line)

# Sprint 2–4 LIKHA suites already re-ran inside C's npm run test + test:integration — record the
# pass counts as cross-module non-interference evidence (likha-ocr, likha-search, likha-classify,
# likha-export-dilg, likha-export-l1, likha-metadata, likha-verification, likha-publish,
# likha-classification, likha-upload, likha-archive, likha-classify-api, likha-exports ALL green).

# Render smoke:
npm run dev & sleep 8
curl -s http://localhost:3000/linaw | grep -oE "Inventory Analyst|Code Classifier|Cross-Reference Scanner|Conflict Detector|Relationship Reviewer|Code Assembler" | sort -u | wc -l
# expected: 6
curl -s http://localhost:3000/linaw | grep -oE "Library &amp; Ingestion|Inventory|Classification|Relationships|Code Assembly" | sort -u | wc -l
# expected: 5
curl -s http://localhost:3000/linaw | grep -c "lands in Sprint 5"
# expected: 0 (placeholder text gone)
curl -s http://localhost:3000/linaw | grep -c "No activities yet"
# expected: >= 1 (empty feed state)
curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:3000/api/linaw/library
# expected: 401 (withUserAuth hard gate, no cookie)
kill %1
```

**E. Feature commits (exact messages, explicit staging — decision D10):**

```bash
git add src/types/linaw.ts tests/helpers/linaw-test-util.ts \
        tests/fixtures/linaw/sample-ordinance.pdf tests/fixtures/linaw/sample-scan.png \
        src/lib/linaw/import-parser.ts src/app/api/linaw/import/route.ts \
        tests/unit/linaw-import-parser.test.ts tests/integration/linaw-import.test.ts
git commit -m "feat: implement N013 bulk text import into LINAW's own library pillar-likha-linaw-20260809"

git add src/lib/linaw/ocr.ts src/lib/linaw/prompts.ts src/lib/linaw/ingest.ts \
        src/app/api/linaw/upload/route.ts src/app/api/linaw/library/route.ts \
        "src/app/api/linaw/library/[id]/route.ts" "src/app/api/linaw/library/[id]/scan/route.ts" \
        src/components/linaw/library-ingestion.tsx src/components/linaw/library-verification.tsx \
        src/app/linaw/page.tsx src/middleware.ts package.json \
        tests/unit/linaw-ocr.test.ts tests/integration/linaw-digitize.test.ts \
        tests/integration/linaw-upload.test.ts tests/integration/linaw-library.test.ts
git commit -m "feat: implement N014 scan upload with module-owned OCR pillar-likha-linaw-20260809"

git log --oneline -2
# expected: exactly these 2 commits, in this order, with these exact messages
git status --porcelain -- src tests package.json docs/sprints
# expected: only this instructions file may remain untracked/unstaged; all sprint code staged
```

Intermediate-commit semantics: the N013 commit is complete WITHOUT UI (its preview table ships inside the N014 commit's `library-ingestion.tsx` — same precedent as Sprint-4's API-first L013); the N014 commit carries scan upload + manual entry + verification + all UI + the middleware line + test-script wiring. Each commit independently compiles. Tag `v0.5.0-sprint-5` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do not tag in this chunk.

**acceptance_criteria:**

1. Sections A–D all produce their expected outputs; C's results are captured as the Sprint-5 regression baseline (FULL Sprint 1–4 suite green).
2. Exactly 2 commits with the exact `feat: implement [Feature] pillar-likha-linaw-20260809` messages; working tree (module files) clean afterward.
3. All evidence (command outputs, test counts, commit SHAs) recorded for SPRINT_REVIEW and the cumulative quality score.

---

## Sprint 5 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 5)

**This sprint delivers LINAW's entire ingestion chain into its OWN library plus LINAW's own verification reaching `library_status='ready'` — the prerequisite for every LINAW pipeline sprint. Sprint 5 depends on Sprint 1's shared foundation ONLY: nothing here imports, references, or tests against any LIKHA code (standalone-SKU proof).**

- [ ] **N013 acceptance (PRD-LINAW §6.8 feature 8 + §11):** `POST /api/linaw/import` accepts JSON/CSV/DOCX (DOCX via the dependency-free raw-extraction fallback — decision D1); ≤500-record batch imports without timeout (501st rejected wholesale, 400 TOO_MANY_RECORDS); records land in `linaw_ordinances` with `source_type='import'`, `library_status='pending_review'`; duplicates rejected on `(ordinance_number, series_year)` with count in response — `{ imported, skippedDuplicates, records: [{id, library_status}] }` (+ additive `batchId`, `invalidRecords`) (S5-C3, S5-C5)
- [ ] **N014 acceptance (PRD-LINAW §6.8 feature 9 + §11):** `POST /api/linaw/upload` accepts ≤10 files (PDF/JPG/PNG, ≤20 MB each); OCR via `src/lib/linaw/ocr.ts` (OWN wrapper — gemini-2.5-flash PDF / qwen3.7-plus image, temperature 0, 60s per attempt, one retry on timeout/network/5xx, injectable fetcher; ZERO imports from likha/obra/ella/yala) returns text; SHA-256 hash computed BEFORE OCR for duplicate detection; files stored at `data/uploads/linaw/` (decision D6 path convention); records go `processing → pending_review` with extracted text + per-field parse of ordinanceNumber/seriesYear/title via LINAW's own `prompts.ts` (decision D3 — full parse now; confidence response/audit-only, decision D4); OCR failure after retry → row lands `pending_review` with placeholders and file reported `ocr_failed` (human-entry fallback per PRP exception rule) (S5-C4, S5-C6, S5-C7)
- [ ] **Own verification (PRD-LINAW §6.5):** LINAW's own panel reviews every `pending_review` record (scan vs extracted text side-by-side where a source file exists, via the authenticated `/api/linaw/library/[id]/scan` stream); Approve → `library_status='ready'` + `verified_by_id` set — the ONLY path to ready; Reject with required reason → `rejected` (reason journaled in `agent_decisions.reason` — decision D9); Edit persists corrections, stays `pending_review`; 409 on finalized records and on `(ordinance_number, series_year)` collisions; rejected records never become ready (S5-C6, S5-C8, S5-C9)
- [ ] **Manual entry:** `PUT /api/linaw/library` creates `source_type='manual'` records starting `pending_review`; duplicate pair → 409 (S5-C6, S5-C8, S5-C9)
- [ ] **Library list:** `GET /api/linaw/library?libraryStatus=&q=&page=&limit=` works with SQL-LIKE search (decision D5; BM25 namespace is Sprint 6) (S5-C8)
- [ ] **Auth + logging:** every LINAW route wrapped in `withUserAuth` (401 proven by tests on all four route groups); all ingestion + verification decisions logged via `logModuleEvent` with `module='linaw'` AND persisted to `agent_decisions` (`module='linaw'`, `agent_id=0` convention — decision D7, user_id + reason on human decisions) (S5-C5…S5-C8)
- [ ] **Pipeline agents NOT implemented:** no `src/lib/linaw/agents.ts`, no pipeline route; the six LINAW agent cards render idle on `/linaw` from `LINAW_AGENT_DEFS`; Inventory/Classification/Relationships/Code Assembly tabs are labeled stubs for S6/S7 (S5-C1, S5-C9)
- [ ] **Boundary grep clean, both directions:** zero forbidden imports, zero `archived_ordinances` references across ALL Sprint-5 files, zero sibling-module tokens, LINAW test harness imports nothing from likha; LIKHA-direction grep re-run clean (S5-C10.A)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S5-C10.B)
- [ ] **New tests green:** hermetic — OCR contract (mocked fetch, retry-once semantics), import parsing (JSON/CSV/DOCX incl. docx round-trip), digitize chain (stubs, temp DB); API-level — import (valid batch, 501st rejected, duplicates incl. DOCX), upload (limits + hash duplicate + contract happy path), library (list filters, manual create + 409, detail + scan stream, approve/reject/edit persistence incl. 401 on all four route groups) (S5-C10.C)
- [ ] **Regression:** FULL re-run of Sprint 1 (kit byte-identical, schema assertions — zero Sprint-5 schema changes, render smoke) + Sprints 2–4 LIKHA suites (hermetic + API-level) — all green; a LIKHA failure would be boundary-violation evidence and blocks the tag (S5-C10.D)
- [ ] **Per-feature commits:** exactly 2 — `feat: implement N013 bulk text import into LINAW's own library pillar-likha-linaw-20260809`, `feat: implement N014 scan upload with module-owned OCR pillar-likha-linaw-20260809` (manual entry + verification + UI staged into the N014 commit — decision D10) (S5-C10.E)
- [ ] Tag `v0.5.0-sprint-5` cut ONLY after SPRINT_REVIEW passes; cumulative quality score recorded

**Integration/Regression notes (SPRINT_PLAN):** new tests = import (valid batch, 501st record rejected, duplicate `(ordinance_number, series_year)` rejected), upload (limits + OCR fixture + status transitions), manual entry, verify approve/reject, 409 on duplicate manual create. Regression = FULL re-run of Sprints 2–4 LIKHA suites — green (cross-module non-interference evidence). From Sprint 6 onward, the combined Sprint 2–5 suites re-run in every regression battery.

---

## Flagged for SPRINT_REVIEW

1. **D1 — DOCX = dependency-free raw text extraction fallback** (ZIP local-header scan + `inflateRawSync` + XML strip; extracted text must be JSON- or CSV-shaped). No DOCX parser exists in direct dependencies (`docx` is a generator; `jszip` is a phantom transitive dep and was deliberately NOT imported). Chosen over "DOCX → 501" because PRP/PRD acceptance requires DOCX acceptance. Limitations: text runs only (tables flatten), data-descriptor zips rejected with a clear error, DOCX records must be JSON/CSV-shaped text. Confirm this satisfies the pilot's bulk-import expectations; a real parser (e.g. mammoth) is a post-MVP dependency decision.
2. **D3/D4 — Full metadata parse NOW, confidence not persisted.** Per-field confidence from the scan metadata parse is response/audit-only because `linaw_ordinances` (frozen Sprint-1 DDL) has no confidence column and Sprint 5 adds NO schema (contrast: LIKHA needed an ALTER in Sprint 2 to get `extraction_confidence`). If S6/S7 verification UX requires persisted confidence, an additive ALTER would need its own decision.
3. **D5 — BM25 deferral.** `src/lib/linaw/search.ts` appears in SPRINT_PLAN's Sprint-5 "Files expected" but is deferred to Sprint 6 per the sprint scope ruling (ingestion + verification only; the LINAW BM25 namespace in `src/lib/data/` comes with inventory/search work). Sprint-5 `?q=` is SQL LIKE. Confirm the re-assignment is accepted.
4. **D8 + middleware matcher finding.** `"/linaw"` appended to `PROTECTED_PATHS` exactly as Sprint 2 did for `"/likha"` — but `config.matcher` lists only `/ella|/obra|/yala|/admin`, so middleware page-level cookie redirects are NOT actually enforced for EITHER `/likha` or `/linaw` (API routes stay hard-gated by `withUserAuth`). Sprint 5 deliberately did not touch the matcher (would change frozen LIKHA behavior). Recommended follow-up: add `/likha/:path*` and `/linaw/:path*` to the matcher as a single reviewed change.
5. **D10 — Two-commit seam.** N013 commit is API/parser/tests-only; its preview-table UI ships inside the N014 commit's `library-ingestion.tsx`, and manual entry + verification + page replacement join the N014 commit (feature title includes "own verification"). Each commit compiles independently.
6. **D11 — Inline sequential OCR in the upload route.** Worst case ≈ 10 × (60s OCR + parse) per request; acceptable for pilot batches, but a background/async digitize endpoint is the scale-up path (post-MVP). No real OpenRouter calls are REQUIRED by the automated suites — the upload happy-path asserts contract only and holds with or without an API key (SPRINT_PLAN risk 7 + Sprint-4 D32 precedent); pilot OCR accuracy (≤60s, usable text) is verified at SYSTEM_TEST.
7. **D12 — Duplicate strictness.** Import skips collisions against ANY existing row regardless of `library_status` (including `rejected`) — literal UNIQUE semantics. If re-import over a rejected record should be allowed, that needs a product decision (likely Sprint-6 verification enhancement).
8. **D13 — Import response keeps PRD §12.6's literal snake_case `library_status` inside `records`** while all other LINAW responses are camelCase. Cosmetic inconsistency, contract fidelity chosen.
9. **D6 — Scan path reconstruction.** With no `scan_file_path` column, the storage path is reconstructed from `id + source_filename`; renaming `source_filename` after storage would orphan the file (edit action does not rename files — it never touches `source_filename`).
10. **D7 — `agent_id=0` audit convention** for pre-pipeline human/module actions ('Ingestion', 'Library Verification'); Sprint-6 agents use 1–6 per WORKFLOW-LINAW.json.
11. **`codification_records`, `ordinance_relationships`, `code_volumes` remain empty** — their writers are Sprints 6–7 per plan; Sprint 5 never writes them.

**Handoff:** Sprint 6 (LINAW Inventory, Classification & Relationship Detection — N001–N004; PRP-LINAW only) consumes Sprint 5's `library_status='ready'` rows as the agents' ONLY input, adds `src/lib/linaw/agents.ts` + `prompts.ts` extensions + `search.ts` (BM25 namespace), and re-runs the combined Sprint 2–5 suites as regression.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 5 of 7*
