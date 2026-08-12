# Sprint 2 Instruction Set — LIKHA Ingestion & Extraction (Upload → OCR → Metadata)

| Field | Value |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Sprint** | 2 of 7 — "LIKHA Ingestion & Extraction (Upload → OCR → Metadata)" — features **L001, L002, L003** |
| **Framework** | Hackathon SUPER PRIME v3.3 — BUILD phase, **Expanded** quality mode, agentic archetype, gov domain |
| **Produced by** | @instruct_agent (Super PRIME variant, per-sprint slicing) |
| **Consumed by** | @make_agent — each chunk's `instruction_prompt` is self-contained; implement WITHOUT reading other documents |
| **Target repo** | PILLAR-pilot — Next.js 15.3.8 App Router monolith (verified installed: 15.3.8), React 19, TypeScript 5 (strict), Tailwind CSS, better-sqlite3 ^9.6, lucide-react ^0.468, openai ^6.35, path alias `@/*` → `src/*`, `cn()` helper at `@/lib/utils`, Node v24 (native `fetch`, `FormData`, `Blob`, `node:test`) |

## PRP Source Note (instruction isolation — SPRINT_PLAN §3.5)

Sprint 2 uses **`docs/PRP-LIKHA.md` ONLY**. Do NOT read or reference any module section of `docs/PRP-LINAW.md`. `docs/INTERCHANGE-SPEC.md` is NOT needed this sprint. Supporting inputs already consumed by this instruction set: `docs/WORKFLOW-LIKHA.json` (agents 1–3, callbacks, data/exception rules), `docs/DESIGN.md` (kit usage, palette, breakpoints), and the Sprint-1 artifacts actually in the repo (inspected, not assumed — see "Repo Reality Notes" below).

## Repo Reality Notes (inspected at slicing time — instructions reflect the REAL code)

1. **Sprint 1 foundation is in place:** `src/lib/db.ts` already contains all 8 tables incl. `archived_ordinances` (+3 idx) and `agent_decisions` (+2 idx) inside `initSchema()`; `src/types/agentic.ts` exports generic `AgentState<M,O>` / `AgentOutputBase` / `ActivityItem<O>` / `HitlItem<M,O>` / `AgentDecisionRecord`; the kit (`agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx`) exists and is prop-driven; `src/app/globals.css` has the glow/pulse utilities; `src/app/likha/page.tsx` is the Sprint-1 placeholder (static fixtures, `--pillar-*` shell tokens). **Do NOT re-create or modify the kit components in Sprint 2** — wire them via props only.
2. **`AgentCard` renders `agent.output?.preview`** in the h-8 output section — every completed agent output object MUST carry a `preview` string (e.g. agent 1: "Files validated & hashed", agent 2: "Text extracted", agent 3: "Metadata parsed").
3. **`src/lib/ai/llm.ts` real API (inspected):** exports ONLY `streamChatResponse(systemPrompt, messages, ragContext?)` (streaming) and `chatCompletion(systemPrompt, userPrompt, options?: {maxTokens?, temperature?}) → Promise<string>`. Both are **text-only** (string content) and `chatCompletion` uses ONE env-driven model (`LLM_MODEL`, default `qwen/qwen3.7-plus`) with **no timeout control**. Consequence → decision D2 below. `chatCompletion` IS suitable for the text-in/text-out metadata extraction (agent 3).
4. **`src/lib/user-auth-middleware.ts` real signature (inspected):** `withUserAuth(handler)` where `handler = (request: NextRequest, context: { params: Promise<any>; user: UserSession }) => …`. `UserSession` = `{ id, user: UserProfile, expires_at }`; the uploader id is `user.user.id`. 401 body is `{ error: "Authentication required", code: "NO_SESSION" }`. Existing usage pattern: `export const POST = withUserAuth(async (request: NextRequest) => { … })` (see `src/app/api/obra/*/route.ts`).
5. **`src/lib/logger.ts` real API (inspected):** workshop-scoped writers into `interaction_logs` — `logChatMessage` (module typed `'ella'|'yala'`), `logObraDraft`/`logObraReview` (hardcode `'obra'`), plus `ensureParticipantSession({sessionId, workshopSessionId, module, ipAddress, participantName?})`. There is NO generic writer → decision D3 adds one additive generic function (module-neutral, additive-only edit).
6. **`src/middleware.ts` (inspected):** `PROTECTED_PATHS = ["/ella", "/obra", "/yala"]` — `/likha` is NOT yet protected → decision D4 (additive array entry).
7. **No test runner exists** (package.json scripts: dev/build/start/lint/ingest only; devDeps include `tsx ^4.19` and `playwright`). Node v24 → decision D5: `node:test` executed through `tsx --test` with explicit file lists.
8. **`data/` is the repo's local data dir** (`DB_PATH` default `data/workshop.db`; `.gitignore` covers only `data/*.db*`) → decision D1 for upload storage.
9. **DB schema constraint affecting L001:** `archived_ordinances` requires `ordinance_number`/`series_year`/`title`/`content` NOT NULL and `UNIQUE(ordinance_number, series_year)` — but these are unknown at upload time → decision D6 (placeholder values, replaced by L003). There is **no confidence column** in the Sprint-1 DDL → decision D7 (additive idempotent migration).

## Sprint 2 Boundary Rules (apply to EVERY chunk)

1. **LIKHA-only code paths.** Every file created or edited for Sprint 2 lives in the `likha/` namespace or is an explicitly listed additive shared edit (S2-C2, S2-C3, db.ts migration in S2-C7).
2. **Zero cross-module imports.** No Sprint 2 file may import from `@/app/api/{obra,chat,ella,yala,linaw}`, `@/lib/ai/prompts`, `@/lib/ai/obra-export`, `@/lib/linaw`, `@/components/{ella,obra,yala,linaw}`, or any ELLA/OBRA/YALA/LINAW code. Allowed imports ONLY: `@/lib/ai/llm.ts`, `@/lib/db`, `@/lib/logger`, `@/lib/user-auth-middleware`, `@/lib/utils`, `@/components/ui/*`, the shared kit (`@/components/agent-pipeline|agent-card|activity-feed`), `@/types/agentic`, `@/types/likha`, Node built-ins, `lucide-react`, `next/server`.
3. **Zero LINAW table references.** No Sprint 2 file may contain `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes` — nor the token `linaw` at all (case-insensitive), except `src/types/agentic.ts` which is a Sprint-1 shared file and is NOT touched this sprint.
4. **Auth on the route.** Every LIKHA API route is wrapped in `withUserAuth`; uploader id comes from `user.user.id`.
5. **Logging.** Every LIKHA write path calls the logger with `module: 'likha'` (decision D3) AND agent starts/completes/errors are persisted to `agent_decisions` with `module='likha'`.
6. **No S3 features.** L003 stores confidence values and flags only. NO verification panel, NO Approve/Edit/Reject persistence routes, NO HITL pause/resume wiring, NO publish/BM25 work. Agents 4–6 stay idle placeholders this sprint.
7. **One commit per feature**, exact format (decision D8): `feat: implement [Feature] pillar-likha-linaw-20260809`.
8. **Verification per chunk.** Every chunk lists runnable `verification_commands` with expected outputs (Git Bash / POSIX shell on Windows, same convention as Sprint 1). Repo-level gates: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Decisions made by @instruct_agent (flagged for SPRINT_REVIEW — see end of file)

- **D1 — Upload storage location: `data/uploads/likha/` (repo root).** Consistent with the repo's existing local-data pattern (`DB_PATH` defaults to `data/workshop.db`, and `getDb()` already creates `data/` recursively). NOT `public/` — scanned government documents must not be publicly servable without auth. `scan_file_path` stores the POSIX-style repo-relative path `data/uploads/likha/<recordId>__<sanitized-original-name>`. Additive `.gitignore` entry `data/uploads/` keeps binaries out of git (S2-C2). The route creates the directory with `fs.mkdirSync(..., { recursive: true })` per write.
- **D2 — OCR call strategy: direct OpenRouter `fetch` inside `src/lib/likha/ocr.ts`.** Inspected `src/lib/ai/llm.ts` cannot satisfy L002: it is text-only (no multimodal content parts), has no per-request model selection (single `LLM_MODEL` env), and no timeout control. Therefore `ocr.ts` calls `https://openrouter.ai/api/v1/chat/completions` directly with global `fetch`, `AbortSignal.timeout(60_000)`, `temperature: 0`, one retry, models `google/gemini-2.5-flash` (PDF) / `qwen/qwen3.7-plus` (image), reading the SAME `OPENROUTER_API_KEY` env var `llm.ts` uses. The fetcher is injectable (`fetcher?: typeof fetch`) so the contract test mocks OpenRouter with zero network. `llm.ts` itself is NOT modified. Agent 3 (metadata) reuses `chatCompletion` (text-in/text-out) — that IS within llm.ts's real API.
- **D3 — Logger: one additive generic writer.** Append `logModuleEvent(params: { module: string; interactionType: string; content?: string; ipAddress: string; participantName?: string })` to `src/lib/logger.ts`, following the exact pattern of the existing writers (ensures workshop + participant session, inserts into `interaction_logs`, try/catch with `console.error`). LIKHA calls it with `module: 'likha'`, `participantName` = uploader's full name, and a stable derived session id `likha-<userId>` is used internally via `ensureParticipantSession` (see S2-C2 for the exact code). Module-neutral signature keeps the shared file clean for LINAW in Sprint 5.
- **D4 — Page auth: additive `"/likha"` entry in `src/middleware.ts` `PROTECTED_PATHS`.** Matches the PRP "Route path: /likha under the existing portal auth" and the ella/obra/yala precedent. API-level enforcement is `withUserAuth` regardless.
- **D5 — Test runner: `node:test` via `tsx --test` (explicit file lists).** No runner exists; Node v24 ships `node:test`; `tsx` is already a devDependency (used by `npm run ingest`). Two additive scripts: `test` (hermetic unit/in-process tests) and `test:integration` (API-level against a running `npm run dev` server, per SPRINT_PLAN Sprint 2 integration notes). Explicit file lists avoid shell-glob differences on Windows.
- **D6 — Placeholder metadata at insert time.** To persist a file row at upload (schema NOT NULL + `UNIQUE(ordinance_number, series_year)`), L001 inserts `ordinance_number = -crypto.randomInt(1, 2_000_000_000)`, `series_year = 0`, `title = 'Processing — <original filename>'`, `content = ''`, `archive_status = 'processing'`. L003's UPDATE replaces them with parsed values; on `UNIQUE` conflict the row is set `archive_status='flagged'` with an exception logged (conflict resolution belongs to S3 verification — flagged for review).
- **D7 — Confidence storage: additive idempotent migration `ALTER TABLE archived_ordinances ADD COLUMN extraction_confidence TEXT`** (JSON `{ordinanceNumber, seriesYear, title, sectionCount}` per-field confidences), placed in `initSchema()` after the existing ALTER-migration blocks, wrapped in try/catch — the repo's EXISTING migration pattern (see the three `interaction_logs` ALTERs). The Sprint-1 DDL itself stays byte-identical. Flagged for SPRINT_REVIEW (schema extension beyond the frozen Sprint-1 DDL).
- **D8 — Commit mapping.** Exactly 3 feature commits, staged with the explicit file lists in S2-C9. `feat: implement L001 batch upload of scanned ordinance PDFs/images pillar-likha-linaw-20260809` · `feat: implement L002 module-owned OCR wrapper pillar-likha-linaw-20260809` · `feat: implement L003 auto-parse ordinance metadata pillar-likha-linaw-20260809`.
- **D9 — Client/server split for the runner.** The SERVER pipeline runner lives at `src/lib/likha/agents.ts` (imports db/ocr/llm — server-only, never imported by client components). The CLIENT orchestration (delays + glow + spinner per PRP "UI simulation delays + real async work") lives inside `src/app/likha/page.tsx` as `runDigitizationRun`. The shared agent DEFINITIONS (id/name/description/color/glowClass/delayMs/outputLabel, all 6 agents per WORKFLOW-LIKHA.json) are exported from `src/types/likha.ts` so both sides use one source without the client importing server code.

---

## Chunk Dependency Graph

```
GROUP-A (parallel)                GROUP-B (parallel)                 GROUP-C        GROUP-D        GROUP-E
──────────────────                ──────────────────                 ───────        ───────        ───────
S2-C1 types/likha.ts ────────────► S2-C4 upload route + test ───────►┐
S2-C2 shared additive edits ─────► S2-C5 upload-dropzone.tsx ────────┤► S2-C7 ────► S2-C8 ───────► S2-C9
S2-C3 test harness + fixtures ───► S2-C6 ocr.ts + unit test ────────►┘  (prompts,    (page          (final gate,
              (disjoint files)                                          agents.ts,    replacement)   regression,
                                                                        pipeline                     commits)
                                                                        route, test)
```

| Chunk | Feature | Dependencies | File overlaps | Parallel group |
|---|---|---|---|:---:|
| S2-C1 | L001/L002/L003 (types) | Sprint 1 only | none | **GROUP-A** |
| S2-C2 | L001 (shared additive edits) | Sprint 1 only | none | **GROUP-A** |
| S2-C3 | test harness | Sprint 1 only | none | **GROUP-A** |
| S2-C4 | **L001** upload route + integration test | S2-C1, S2-C2, S2-C3 | none | **GROUP-B** |
| S2-C5 | **L001** upload-dropzone component | S2-C1 | none | **GROUP-B** |
| S2-C6 | **L002** ocr.ts + unit contract test | S2-C1, S2-C3 | none | **GROUP-B** |
| S2-C7 | **L003** prompts + agents runner + pipeline route + migration + persistence test | S2-C1, S2-C2, S2-C3, S2-C4, S2-C6 | none | **GROUP-C** |
| S2-C8 | **L003** (UI wiring) page replacement | S2-C1, S2-C5, S2-C7 | none | **GROUP-D** |
| S2-C9 | gate | ALL (S2-C1…S2-C8) | n/a | **GROUP-E** (sequential gate) |

Dispatch order: **GROUP-A → GROUP-B → GROUP-C → GROUP-D → GROUP-E.** Chunks inside a group are parallel-eligible (disjoint `file_outputs`, zero shared state). Commit points: after L001's chunks (S2-C4 + S2-C5) commit #1; after S2-C6 commit #2; after S2-C7 + S2-C8 commit #3 — staging uses the explicit per-feature file lists in S2-C9, so commits are correct even if GROUP-B executed in parallel. When in doubt, execute sequentially.

---

## Chunks

---

### S2-C1 — `src/types/likha.ts`: LIKHA module interfaces + agent definitions

```json
{
  "chunk_id": "S2-C1",
  "feature_id": "L001+L002+L003 (shared module types)",
  "chunk_type": "setup",
  "name": "LIKHA types — LikhaAgentOutput, ArchivedOrdinance, AgentDecision, upload/pipeline contracts, LIKHA_AGENT_DEFS",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/types/likha.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW file `src/types/likha.ts` — the LIKHA module type file (PRP-LIKHA `Types` section, narrowed to `module: 'likha'`, built ON TOP of the Sprint-1 generics in `@/types/agentic`). It must compile under `strict: true`, import types ONLY from `@/types/agentic`, contain NO runtime imports (no db/llm/fetch), and contain the token `linaw` ZERO times. Write exactly this content (you may add JSDoc, nothing else):

```ts
// src/types/likha.ts
// Sprint 2 — LIKHA module interfaces (PRP-LIKHA Types section, module-narrowed).
// Builds on the Sprint-1 shared generics in @/types/agentic. Pure types + static
// agent definitions: safe to import from BOTH server code and client components.

import type {
  AgentOutputBase,
  AgentState,
  HitlItem,
  AgentDecisionRecord,
} from './agentic';

// ── Agent definitions (WORKFLOW-LIKHA.json — all 6; agents 4–6 stay idle until Sprints 3–4) ──

export interface LikhaAgentDef {
  id: number;
  name: string;
  description: string;
  functionName: string;
  color: string;      // hex, e.g. '#F59E0B'
  glowClass: string;  // e.g. 'glow-amber'
  delayMs: number;    // UI simulation delay
  outputLabel: string;
}

export const LIKHA_AGENT_DEFS: LikhaAgentDef[] = [
  { id: 1, name: 'Ingestor',          description: 'Validates uploads, computes file hashes, stores raw file records', functionName: 'ingestFiles',      color: '#F59E0B', glowClass: 'glow-amber',   delayMs: 1000, outputLabel: 'Files validated & hashed' },
  { id: 2, name: 'OCR Extractor',     description: 'Extracts text from PDFs/images via module-owned OpenRouter wrapper', functionName: 'extractText',    color: '#10B981', glowClass: 'glow-emerald', delayMs: 1600, outputLabel: 'Text extracted' },
  { id: 3, name: 'Metadata Parser',   description: 'Parses ordinance number, series year, title, section count', functionName: 'parseMetadata',    color: '#8B5CF6', glowClass: 'glow-violet',  delayMs: 1400, outputLabel: 'Metadata parsed' },
  { id: 4, name: 'Subject Classifier', description: 'Suggests subject categories with confidence scores', functionName: 'classifySubject',  color: '#0EA5E9', glowClass: 'glow-sky',     delayMs: 1200, outputLabel: 'Subjects suggested' },
  { id: 5, name: 'Legal Validator',   description: 'Flags low-confidence extractions; raises HITL gates', functionName: 'validateExtraction', color: '#F43F5E', glowClass: 'glow-rose',   delayMs: 1200, outputLabel: 'Validation complete' },
  { id: 6, name: 'Archiver',          description: 'Publishes verified records and updates the BM25 index', functionName: 'publishToArchive', color: '#6366F1', glowClass: 'glow-indigo', delayMs: 1000, outputLabel: 'Published to archive' },
];

// ── Outputs ──

export interface LikhaAgentOutput extends AgentOutputBase {
  fileHash?: string;
  originalFilename?: string;
  mimeType?: string;
  rawText?: string;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  sectionCount?: number;
  confidence?: number;
  confidenceByField?: MetadataConfidence;
  subjects?: Array<{ label: string; confidence: number }>;
}

export type LikhaAgentState = AgentState<'likha', LikhaAgentOutput>;

/** HITL item narrowed to LIKHA gates. The gate UI is built in Sprint 3 — type only for now. */
export type LikhaHitlItem = HitlItem<'likha', LikhaAgentOutput> & {
  gate: 'low_confidence_metadata' | 'low_confidence_classification';
};

export type LikhaAgentDecision = AgentDecisionRecord & { module: 'likha' };

// ── Domain entities (PRP-LIKHA Types) ──

export interface MetadataConfidence {
  ordinanceNumber: number;
  seriesYear: number;
  title: number;
  sectionCount: number;
}

export interface ParsedMetadata {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  sectionCount: number;
  confidence: MetadataConfidence;
}

export interface ArchivedOrdinance {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
  summary?: string;
  subjectTags: string[];
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  archiveStatus: 'processing' | 'pending_review' | 'published' | 'flagged';
  sourceType?: string;
  originalFilename?: string;
  scanFilePath?: string;
  fileHash?: string;
  extractionConfidence?: MetadataConfidence;
  uploadedById: string;
  verifiedById?: string;
  createdAt: string;
  updatedAt: string;
}

/** Snake_case row shape as stored in SQLite (mapper lives in agents.ts). */
export interface ArchivedOrdinanceRow {
  id: string;
  ordinance_number: number;
  series_year: number;
  title: string;
  content: string;
  summary: string | null;
  subject_tags: string;
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
  source_type: string;
  original_filename: string | null;
  scan_file_path: string | null;
  file_hash: string | null;
  archive_status: 'processing' | 'pending_review' | 'published' | 'flagged';
  uploaded_by_id: string;
  verified_by_id: string | null;
  extraction_confidence: string | null;
  dilg_submitted: number;
  dilg_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Upload + pipeline contracts (L001–L003) ──

export type LikhaUploadFileStatus = 'queued' | 'ingesting' | 'ocr' | 'parsing' | 'verifying' | 'published' | 'error';

export interface LikhaUploadFileResult {
  originalFilename: string;
  status: 'accepted' | 'rejected' | 'duplicate';
  recordId?: string;
  fileHash?: string;
  mimeType?: string;
  sizeBytes: number;
  error?: string;
  existingRecordId?: string; // duplicate → link to the existing archive record
}

export interface LikhaUploadResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  files: LikhaUploadFileResult[];
}

export interface LikhaPipelineFileInput {
  recordId: string;
  originalFilename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  scanFilePath: string;
  fileHash: string;
}

export interface LikhaPipelineFileResult {
  recordId: string;
  originalFilename: string;
  ok: boolean;
  duplicate?: boolean;
  failedAgent?: number;           // 2 = OCR, 3 = Metadata Parser
  error?: string;
  rawTextLength?: number;
  metadata?: ParsedMetadata;
  archiveStatus: 'processing' | 'pending_review' | 'flagged';
}

export interface LikhaPipelineResponse {
  batchId: string;
  pipelineId: string;
  processed: number;
  failed: number;
  files: LikhaPipelineFileResult[];
}
```

Boundary rules: imports types from `./agentic` ONLY; zero runtime dependencies; zero `linaw` tokens; zero forbidden-module imports.

**acceptance_criteria:**

1. File compiles under `strict: true`; exports all types/interfaces/const above.
2. `LIKHA_AGENT_DEFS` matches WORKFLOW-LIKHA.json exactly (names, colors, glow classes, delays 1000/1600/1400/1200/1200/1000, output labels).
3. `LikhaAgentState`/`LikhaHitlItem` narrow the Sprint-1 generics to `module: 'likha'`.
4. No runtime imports, no `linaw` token, no forbidden imports.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/types/likha.ts
# expected: no output, exit code 1 (zero hits)

grep -ic "linaw" src/types/likha.ts
# expected: 0

grep -c "delayMs: 1000\|delayMs: 1600\|delayMs: 1400\|delayMs: 1200\|delayMs: 1000" src/types/likha.ts
# expected: 6  (the six agent delays; note 1200 appears twice and 1000 twice)
```

---

### S2-C2 — Additive shared-primitive edits: logger writer, middleware path, .gitignore

```json
{
  "chunk_id": "S2-C2",
  "feature_id": "L001 (shared additive edits)",
  "chunk_type": "integration",
  "name": "logModuleEvent in logger.ts + '/likha' in PROTECTED_PATHS + data/uploads/ gitignore",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["src/lib/logger.ts", "src/middleware.ts", ".gitignore"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Make THREE additive-only edits to existing shared files. No existing line may be modified or removed in any of them (diff must show additions only).

**(a) `src/lib/logger.ts`** — the file currently exports `ensureParticipantSession`, `logChatMessage`, `logObraDraft`, `logObraReview`, `getWorkshopSessionId`. APPEND at the END of the file (before nothing — after the last export) this module-neutral generic writer, following the exact pattern of the existing writers (try/catch + `console.error('[logger] …')`):

```ts
/**
 * Generic module-scoped write-event logger (additive, Sprint 2).
 * Used by standalone modules (LIKHA now, other modules later) whose events do
 * not fit the chat/obra-specific writers. Inserts into interaction_logs with
 * the caller's module tag; ensures workshop + participant session rows exist.
 */
export function logModuleEvent(params: {
  module: string;
  interactionType: string;
  content?: string;
  ipAddress: string;
  participantName?: string;
  participantSessionId?: string;
}): void {
  try {
    const db = getDb();
    const workshopSessionId = getWorkshopSessionId();
    const sessionId =
      params.participantSessionId || `${params.module}-${Date.now()}`;

    ensureParticipantSession({
      sessionId,
      workshopSessionId,
      module: params.module,
      ipAddress: params.ipAddress,
      participantName: params.participantName,
    });

    db.prepare(
      `INSERT INTO interaction_logs
         (participant_session_id, workshop_session_id, module,
          interaction_type, role, content)
       VALUES (?, ?, ?, ?, null, ?)`
    ).run(
      sessionId,
      workshopSessionId,
      params.module,
      params.interactionType,
      params.content ?? null
    );
  } catch (err) {
    console.error("[logger] logModuleEvent failed:", err);
  }
}
```

LIKA callers (later chunks) will invoke it as `logModuleEvent({ module: 'likha', interactionType: 'likha_upload' | 'likha_pipeline', content: …, ipAddress: …, participantName: …, participantSessionId: 'likha-<userId>' })`. Do NOT change the `'ella' | 'yala'` typing of `logChatMessage` or any existing function.

**(b) `src/middleware.ts`** — change ONLY the `PROTECTED_PATHS` array literal from `["/ella", "/obra", "/yala"]` to `["/ella", "/obra", "/yala", "/likha"]`. Nothing else in the file changes. (This puts the `/likha` page behind the same portal cookie gate as ella/obra/yala; API routes are additionally protected by `withUserAuth`.)

**(c) `.gitignore`** — immediately AFTER the existing SQLite block:

```
# SQLite database
data/*.db
data/*.db-wal
data/*.db-shm
```

APPEND:

```
# LIKHA uploaded scans (binary, never committed — stored outside public/)
data/uploads/
```

**acceptance_criteria:**

1. `logModuleEvent` exists, is generic (`module: string`), writes to `interaction_logs`, and existing exports/typing are untouched.
2. `PROTECTED_PATHS` now includes `"/likha"`; ella/obra/yala entries byte-identical.
3. `.gitignore` ignores `data/uploads/`; the SQLite block is untouched.
4. All three diffs show additions only (plus the single array-literal line replacement in middleware.ts).

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "export function logModuleEvent" src/lib/logger.ts
# expected: 1

grep -n '"/likha"' src/middleware.ts
# expected: 1 match, inside the PROTECTED_PATHS array

grep -c '"/ella", "/obra", "/yala"' src/middleware.ts
# expected: 1  (the original three entries still present in the same literal)

grep -c "^data/uploads/$" .gitignore
# expected: 1

git diff --unified=0 -- src/lib/logger.ts .gitignore | grep -c '^-[^-]'
# expected: 0  (append-only in these two files)

git diff --unified=0 -- src/middleware.ts | grep -c '^-[^-]'
# expected: 1  (only the replaced PROTECTED_PATHS line)
```

---

### S2-C3 — Test harness: runner scripts, fixture files, auth/bootstrap helper

```json
{
  "chunk_id": "S2-C3",
  "feature_id": "test harness (supports L001–L003)",
  "chunk_type": "setup",
  "name": "node:test via tsx — package.json scripts, tests/fixtures/likha/*, tests/helpers/likha-test-util.ts",
  "parallel_group": "GROUP-A",
  "dependencies": [],
  "file_outputs": ["package.json", "tests/fixtures/likha/sample-ordinance.pdf", "tests/fixtures/likha/sample-scan.png", "tests/helpers/likha-test-util.ts"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

The repo has NO test runner (scripts: dev/build/start/lint/ingest). Node is v24 (`node:test` built in) and `tsx` ^4.19 is already a devDependency. Set up the minimal harness:

**(a) `package.json`** — add TWO scripts inside `"scripts"` (keep all existing scripts byte-identical; explicit file lists avoid shell-glob differences on Windows):

```json
"test": "tsx --test tests/unit/likha-ocr.test.ts tests/integration/likha-metadata.test.ts",
"test:integration": "tsx --test tests/integration/likha-upload.test.ts"
```

(`test` = hermetic, no server needed; `test:integration` = API-level against a running `npm run dev` server, per SPRINT_PLAN Sprint 2 integration notes. The referenced test files are created in S2-C4/S2-C6/S2-C7 — this chunk only lands the harness.)

**(b) Fixture files** — create `tests/fixtures/likha/sample-ordinance.pdf` with EXACTLY this minimal one-page PDF (plain ASCII; it carries real ordinance-looking text so future real-model runs have something to read; Sprint-2 tests never parse it):

```
%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 150 >> stream
BT /F1 16 Tf 72 720 Td (Republic of the Philippines - Municipality of Pitogo, Quezon) Tj ET
BT /F1 14 Tf 72 696 Td (Ordinance No. 05, Series of 2023) Tj ET
BT /F1 12 Tf 72 672 Td (An ordinance revising the schedule of business permit fees) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R /Size 6 >>
%%EOF
```

Create `tests/fixtures/likha/sample-scan.png` as a 1×1 PNG by base64-decoding this string (e.g. `node -e "require('fs').writeFileSync('tests/fixtures/likha/sample-scan.png', Buffer.from('<B64>','base64'))"`):

```
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
```

**(c) `tests/helpers/likha-test-util.ts`** — shared helper for server-based integration tests. Uses ONLY Node built-ins + `better-sqlite3` (already a dependency) with RELATIVE imports (tests must not rely on the `@/` alias). Implement and export:

- `export const BASE_URL = process.env.LIKHA_TEST_BASE_URL || 'http://localhost:3000';`
- `export async function assertServerReachable(): Promise<void>` — `fetch(BASE_URL + '/api/health')`; on failure throw an Error whose message is exactly `SKIP-FAIL: start the dev server first (npm run dev) — integration tests run API-level per SPRINT_PLAN`.
- `export function seedApprovedUser(dbFile?: string): { userId: string; sessionId: string; cookie: string; cleanup: () => void }` — opens the DB (default `data/workshop.db` relative to `process.cwd()`; `dbFile` overrides for hermetic tests) with `better-sqlite3`, then:
  - INSERT into `users` (id, email, password_hash, full_name, lgu_name, lgu_type, province, status) values: id = `crypto.randomUUID()`, email = `likha-test-${Date.now()}@example.com`, password_hash = `'test-not-used'`, full_name = `'Likha Integration Test'`, lgu_name = `'Municipality of Pitogo'`, lgu_type = `'municipality'`, province = `'Quezon'`, status = `'approved'`.
  - INSERT into `user_sessions` (id, user_id, expires_at) values: id = `crypto.randomUUID()`, expires_at = `new Date(Date.now() + 3600_000).toISOString()`.
  - Returns `cookie: 'pillar_user_session=' + sessionId` and a `cleanup()` that deletes both rows and closes the DB.
- `export function readFixture(name: 'sample-ordinance.pdf' | 'sample-scan.png'): Buffer` — reads from `tests/fixtures/likha/` relative to `process.cwd()`.
- `export function tempDbPath(): string` — returns a fresh path under `os.tmpdir()` (`pillar-likha-test-<rand>.db`) for hermetic in-process tests; callers set `process.env.DB_PATH` to it BEFORE importing `@/lib/db`-dependent modules (use dynamic `import()`).

The helper must contain zero references to any module except LIKHA test scaffolding; no `linaw` token.

**acceptance_criteria:**

1. `npm run test` and `npm run test:integration` are valid scripts (they may report "no tests found / file missing" until S2-C4/C6/C7 land the files — that is expected at this chunk's end; `npx tsx --test` itself must resolve).
2. Both fixture files exist and are non-empty; the PDF starts with `%PDF-1.4`; the PNG starts with the PNG magic bytes (`89 50 4E 47`).
3. Helper compiles under `strict: true`, uses relative imports only, and `seedApprovedUser` matches the real `users`/`user_sessions` schemas (all NOT NULL columns supplied).

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

head -c 8 tests/fixtures/likha/sample-ordinance.pdf
# expected: %PDF-1.4

node -e "const b=require('fs').readFileSync('tests/fixtures/likha/sample-scan.png'); console.log(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47 ? 'PNG OK' : 'PNG BAD')"
# expected: PNG OK

node -e "const p=require('./package.json'); console.log(p.scripts.test.includes('tsx --test') && p.scripts['test:integration'].includes('tsx --test') ? 'SCRIPTS OK' : 'SCRIPTS BAD')"
# expected: SCRIPTS OK

grep -ic "linaw" tests/helpers/likha-test-util.ts
# expected: 0
```

---

### S2-C4 — L001: `POST /api/likha/upload` route + API-level contract test (TDD)

```json
{
  "chunk_id": "S2-C4",
  "feature_id": "L001",
  "chunk_type": "api_route",
  "name": "Batch upload route — multipart ≤10 files PDF/JPG/PNG ≤20MB, MIME validation, SHA-256 before OCR, duplicate-hash detection, rows persisted archive_status='processing'",
  "parallel_group": "GROUP-B",
  "dependencies": ["S2-C1", "S2-C2", "S2-C3"],
  "file_outputs": ["src/app/api/likha/upload/route.ts", "tests/integration/likha-upload.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement L001 with TDD.

**RED — write the failing test FIRST:** create `tests/integration/likha-upload.test.ts` using `node:test` (`import { test } from 'node:test'; import assert from 'node:assert/strict';`) with RELATIVE imports of `../helpers/likha-test-util`. It runs API-level against a running dev server (`npm run dev`, default `http://localhost:3000`, override `LIKHA_TEST_BASE_URL`). Structure: `test('likha upload suite', async (t) => { await assertServerReachable(); const { cookie, cleanup } = seedApprovedUser(); t.after(cleanup); … subtests via t.test(...) })`. Build multipart bodies with global `FormData` + `Blob`/`File` (Node 24). Subtests:

1. **happy path:** POST `BASE_URL + '/api/likha/upload'` with headers `{ cookie }`, FormData containing 2 files (`sample-ordinance.pdf` as `application/pdf`, `sample-scan.png` as `image/png`) under field name `files`. Expect status 200, JSON body with `batchId` (string), `accepted === 2`, `duplicates === 0`, `files` length 2, each `status === 'accepted'` with `recordId` + 64-char hex `fileHash`.
2. **duplicate-hash warning:** POST the SAME `sample-ordinance.pdf` again in a new request → expect 200, the file entry `status === 'duplicate'`, `existingRecordId` equal to subtest 1's recordId, and `duplicates === 1`.
3. **11th file rejected:** FormData with 11 tiny PNG files → expect 400 and body `{ error, code: 'TOO_MANY_FILES' }`.
4. **oversize rejected:** one `File` of 21 × 1024 × 1024 zero bytes typed `application/pdf` → 400, `code: 'FILE_TOO_LARGE'`.
5. **bad MIME rejected:** one `File` with `type: 'text/plain'` → 400, `code: 'UNSUPPORTED_TYPE'`.
6. **auth required:** POST with no cookie → 401, body `{ error: 'Authentication required', code: 'NO_SESSION' }`.
7. **DB side effects** (open the dev DB via the helper's better-sqlite3 path `data/workshop.db`): for subtest 1's recordIds, `SELECT` from `archived_ordinances` asserts `archive_status='processing'`, `file_hash` matches the response, `uploaded_by_id` = seeded userId, `scan_file_path LIKE 'data/uploads/likha/%'`; AND `SELECT COUNT(*) FROM agent_decisions WHERE module='likha' AND pipeline_id='<batchId>' AND agent_id=1` ≥ 2 (start + complete rows); AND `SELECT COUNT(*) FROM interaction_logs WHERE module='likha' AND interaction_type='likha_upload'` ≥ 1. Cleanup: delete the created `archived_ordinances` rows + their `agent_decisions` rows + the files under `data/uploads/likha/` for those recordIds in `t.after`.

**GREEN — implement `src/app/api/likha/upload/route.ts`** until all subtests pass. Contract (exact):

- `'use server'` is NOT needed; plain route file. Imports allowed ONLY: `next/server` (`NextRequest`, `NextResponse`), `node:fs`, `node:path`, `node:crypto`, `@/lib/db`, `@/lib/logger` (`logModuleEvent`), `@/lib/user-auth-middleware` (`withUserAuth`), `@/types/likha` (types only).
- `export const POST = withUserAuth(async (request: NextRequest, { user }) => { … })`.
- `const form = await request.formData(); const files = form.getAll('files').filter((f): f is File => typeof File !== 'undefined' && f instanceof File);`
- **Validate the whole batch BEFORE writing anything** (all-or-nothing): 0 files → 400 `{ error: 'No files provided', code: 'NO_FILES' }`; `files.length > 10` → 400 `TOO_MANY_FILES`; any `file.size > 20 * 1024 * 1024` → 400 `FILE_TOO_LARGE`; any `file.type` not in `['application/pdf', 'image/jpeg', 'image/png']` → 400 `UNSUPPORTED_TYPE`. Error envelope: `NextResponse.json({ error: <message>, code: <CODE>, files: [{ originalFilename, error }] }, { status: 400 })`.
- `const batchId = crypto.randomUUID();`
- For each file (in order): `const buffer = Buffer.from(await file.arrayBuffer());` → `const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');` (**hash computed before any OCR — always**). Duplicate check: `SELECT id FROM archived_ordinances WHERE file_hash = ?` → if found: result entry `{ originalFilename, status: 'duplicate', sizeBytes, existingRecordId, fileHash }`, do NOT write the file, do NOT insert a row, continue.
- Otherwise: `const recordId = crypto.randomUUID();` sanitize filename (`file.name.replace(/[^a-zA-Z0-9._-]/g, '_')`); `const relPath = 'data/uploads/likha/' + recordId + '__' + sanitized;` `fs.mkdirSync(path.join(process.cwd(), 'data', 'uploads', 'likha'), { recursive: true });` `fs.writeFileSync(path.join(process.cwd(), relPath), buffer);`
- INSERT (decision D6 placeholders — real metadata arrives in L003): `INSERT INTO archived_ordinances (id, ordinance_number, series_year, title, content, source_type, original_filename, scan_file_path, file_hash, archive_status, uploaded_by_id) VALUES (?, ?, 0, ?, '', 'scan', ?, ?, ?, 'processing', ?)` with `ordinance_number = -crypto.randomInt(1, 2_000_000_000)` and `title = 'Processing — ' + file.name`. On the (astronomically unlikely) `UNIQUE(ordinance_number, series_year)` collision, retry once with a fresh random number.
- Agent-1 audit rows: `INSERT INTO agent_decisions (id, module, pipeline_id, agent_id, agent_name, action, input_snapshot, output_snapshot) VALUES (?, 'likha', ?, 1, 'Ingestor', ?, ?, ?)` — one `'start'` row before the loop (`input_snapshot` = JSON `{fileCount}`) and one `'complete'` row after (`output_snapshot` = JSON `{accepted, duplicates, fileHashes:[…]}`).
- Logging: `logModuleEvent({ module: 'likha', interactionType: 'likha_upload', content: JSON.stringify({ batchId, accepted, duplicates }), ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1', participantName: user.user.full_name, participantSessionId: 'likha-' + user.user.id })`.
- Success response 200: `{ batchId, accepted, duplicates, rejected: 0, files: [<per-file results>] }` matching `LikhaUploadResponse` from `@/types/likha`.
- Wrap the body in try/catch → 500 `{ error: 'Upload failed' }` on unexpected errors (log via `logModuleEvent` with `interactionType: 'likha_upload_error'`).

**REFACTOR:** extract validation into a small local function if it aids clarity; keep every import inside the allow-list; zero `linaw` tokens; do NOT touch the kit, db.ts, or any other file.

**acceptance_criteria:**

1. All 7 test subtests pass against the dev server (`npm run test:integration` with `npm run dev` running).
2. Route is wrapped in `withUserAuth`; uploader id = `user.user.id`; 401 envelope matches the middleware exactly.
3. SHA-256 computed BEFORE persistence/OCR; duplicates return `existingRecordId` and skip both file write and insert.
4. Rows land in `archived_ordinances` with `archive_status='processing'`; agent 1 start+complete rows in `agent_decisions` (`module='likha'`); `interaction_logs` row with `module='likha'`.
5. Files stored under `data/uploads/likha/` (decision D1), NOT under `public/`.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "withUserAuth" src/app/api/likha/upload/route.ts
# expected: >= 1

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/app/api/likha/upload/route.ts tests/integration/likha-upload.test.ts
# expected: no output, exit code 1 (zero hits)

grep -ic "linaw" src/app/api/likha/upload/route.ts tests/integration/likha-upload.test.ts
# expected: 0 and 0

# Live contract (dev server running in another terminal):
npm run test:integration
# expected: all likha-upload subtests pass (7/7), exit code 0
```

---

### S2-C5 — L001: `src/components/likha/upload-dropzone.tsx`

```json
{
  "chunk_id": "S2-C5",
  "feature_id": "L001",
  "chunk_type": "frontend_component",
  "name": "UploadDropzone — drag-drop + browse, client-side MIME/count/size validation, per-file status rows, inline duplicate warning",
  "parallel_group": "GROUP-B",
  "dependencies": ["S2-C1"],
  "file_outputs": ["src/components/likha/upload-dropzone.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Create a NEW client component `src/components/likha/upload-dropzone.tsx` (`'use client';`) — LIKHA's batch upload input (PRP-LIKHA "Upload Dropzone"). Allowed imports: `react`, `lucide-react` (`UploadCloud`, `FileText`, `AlertTriangle`, `CheckCircle2`, `Loader2`), `@/lib/utils` (`cn`), types from `@/types/likha`. NO `getDb`, NO server imports, NO kit modifications.

Props:

```ts
interface UploadDropzoneProps {
  disabled?: boolean;                       // true while a pipeline run is active
  onBatchAccepted?: (result: LikhaUploadResponse) => void;
  onError?: (message: string) => void;
  className?: string;
}
```

Behavior contract:

1. **Drop area:** dashed-border panel (`border-2 border-dashed border-[#283147] rounded-xl bg-[#1E293B] p-8 text-center`), drag-over state highlights border `#22D3EE`; click + hidden `<input type="file" multiple accept="application/pdf,image/jpeg,image/png">` for browse; copy: "DRAG & DROP SCAN FILES" / "PDF / JPG / PNG — up to 10 files, 20 MB each" / `[ Browse files... ]` button (DESIGN.md §2.2). Touch target ≥44px (`min-h-11` on the button).
2. **Client-side validation BEFORE upload** (mirror the server rules): >10 files → inline error "Maximum 10 files per batch" and reject the batch; any file >20 MB → inline error naming the file; any MIME outside `application/pdf|image/jpeg|image/png` → inline error. Errors render as rose (`#F87171`) text with `AlertTriangle`; invalid files are never sent.
3. **Upload:** one `fetch('/api/likha/upload', { method: 'POST', body: formData })` with field name `files` (credentials same-origin). While in flight, per-file rows show status `ingesting` with a batch progress bar (indeterminate → server response). Non-200 → parse `{error}` and call `onError`.
4. **Per-file status rows** (below the dropzone): name (truncate), size (KB/MB), status chip — `queued` (muted) → `ingesting` (cyan `Loader2` spin) → `accepted` (green `CheckCircle2`, shows short hash `fileHash.slice(0,12)…`) → `duplicate` (yellow `AlertTriangle`, inline warning "Already archived — existing record <existingRecordId>" per PRP exception rule) → `error` (rose). Rows use the PRP status union `LikhaUploadFileStatus` where applicable.
5. On success call `onBatchAccepted(result)` and clear the selection (keep the result rows visible until the next selection).
6. Disabled state: opacity-50, input + drop handlers inert, caption "Pipeline running — upload disabled".
7. Styling stays foundation-compatible: dark tokens (`#0F1729`/`#1E293B`/`#283147`/`#94A3B8`), no gradients/shadows beyond the existing glow utilities. Responsive: rows stack cleanly at 360px.
8. Zero `linaw` tokens; zero forbidden imports; component is self-contained state (`useState` only).

Export `export default function UploadDropzone(props: UploadDropzoneProps)`.

**acceptance_criteria:**

1. Component compiles under `strict: true` and is `'use client'`.
2. Client validation mirrors the server contract (10 files / 20 MB / 3 MIME types) and blocks the POST when violated.
3. Duplicate results surface inline with `existingRecordId`; success surfaces per-file rows + hash preview.
4. No server-only imports; no kit edits; DESIGN.md §2.2 copy present.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -c "'use client'" src/components/likha/upload-dropzone.tsx
# expected: 1

grep -REn "from ['\"]@/(lib/db|lib/ai|app/api)" src/components/likha/upload-dropzone.tsx
# expected: no output, exit code 1 (client component — no server imports)

grep -c "application/pdf" src/components/likha/upload-dropzone.tsx && grep -c "20 \* 1024 \* 1024\|20MB\|20 MB" src/components/likha/upload-dropzone.tsx
# expected: each >= 1

grep -ic "linaw" src/components/likha/upload-dropzone.tsx
# expected: 0
```

---

### S2-C6 — L002: `src/lib/likha/ocr.ts` module-owned OCR wrapper + mocked contract test (TDD)

```json
{
  "chunk_id": "S2-C6",
  "feature_id": "L002",
  "chunk_type": "library",
  "name": "OCR wrapper — direct OpenRouter fetch, gemini-2.5-flash (PDF) / qwen3.7-plus (image), temp 0, 60s timeout, one retry, zero sibling imports",
  "parallel_group": "GROUP-B",
  "dependencies": ["S2-C1", "S2-C3"],
  "file_outputs": ["src/lib/likha/ocr.ts", "tests/unit/likha-ocr.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement L002 with TDD. Background (inspected, do not re-derive): `src/lib/ai/llm.ts` is text-only and single-model, so this wrapper calls OpenRouter DIRECTLY via global `fetch` (decision D2). It reads the same `OPENROUTER_API_KEY` env var `llm.ts` uses. NO other project import is allowed (Node built-ins only) — especially ZERO imports from obra/ella/yala or any sibling module, and none from `@/lib/ai/llm`.

**RED — write the failing test FIRST:** `tests/unit/likha-ocr.test.ts` with `node:test` + `node:assert/strict`, importing the wrapper by RELATIVE path `../../src/lib/likha/ocr` (tests avoid the `@/` alias). The wrapper's `fetcher` is injectable — mock it; ZERO network, ZERO `OPENROUTER_API_KEY` needed (set `process.env.OPENROUTER_API_KEY = 'test-key'` in the test). Subtests:

1. **model selection:** call `extractText({ fileBuffer: Buffer.from('%PDF-fake'), mimeType: 'application/pdf', fetcher: mockOk })` → captured request body `model === 'google/gemini-2.5-flash'`; same with `mimeType: 'image/png'` → `model === 'qwen/qwen3.7-plus'`; both bodies have `temperature === 0` and an Authorization header `Bearer test-key`; PDF content part is `{ type: 'file', file: { filename, file_data: 'data:application/pdf;base64,…' } }`, image content part is `{ type: 'image_url', image_url: { url: 'data:image/png;base64,…' } }`.
2. **timeout is applied:** call with `timeoutMs: 50` and a fetcher that returns a Promise which only rejects when its `init.signal` aborts (i.e. honors the AbortSignal) → the call rejects within ~500ms with `OcrTimeoutError`; assert `signal` was passed in request init.
3. **one retry on timeout:** fetcher rejects once with an abort-style error then succeeds → result `attempts === 2`, text returned.
4. **gives up after one retry:** fetcher always rejects → throws `OcrTimeoutError` after exactly 2 attempts.
5. **retries 5xx once:** first response `status: 502`, second `200` with valid body → succeeds, `attempts === 2`. Non-retryable 4xx (e.g. 401) → throws `OcrError` immediately after 1 attempt.
6. **missing API key:** delete the env var → throws `OcrError` mentioning `OPENROUTER_API_KEY` before any fetch.

Mock success body: `{ choices: [{ message: { content: 'ORDINANCE TEXT' } }] }`.

**GREEN — implement `src/lib/likha/ocr.ts`** until all pass. Exact public API:

```ts
export type LikhaOcrMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export class OcrError extends Error { constructor(message: string, readonly status?: number) { super(message); this.name = 'OcrError'; } }
export class OcrTimeoutError extends OcrError { constructor(message = 'OCR timed out after retry') { super(message); this.name = 'OcrTimeoutError'; } }

export interface OcrOptions {
  fileBuffer: Buffer;
  mimeType: LikhaOcrMimeType;
  filename?: string;
  timeoutMs?: number;              // default 60_000
  fetcher?: typeof fetch;          // DI for tests; default global fetch
}

export interface OcrResult { text: string; model: string; attempts: number; }

export async function extractText(options: OcrOptions): Promise<OcrResult>;
```

Behavior: model = `'google/gemini-2.5-flash'` for PDF, `'qwen/qwen3.7-plus'` for JPEG/PNG. Endpoint `https://openrouter.ai/api/v1/chat/completions`. Request body: `{ model, temperature: 0, max_tokens: 8192, messages: [ { role: 'system', content: 'You are a precise document transcription engine for Philippine LGU legislative records. Transcribe the provided document verbatim. Output plain text only — no commentary, no markdown fences.' }, { role: 'user', content: [ <file-or-image part>, { type: 'text', text: 'Transcribe this scanned ordinance document completely and verbatim.' } ] } ] }` where the media part is `{ type: 'file', file: { filename: filename || 'upload', file_data: 'data:' + mimeType + ';base64,' + fileBuffer.toString('base64') } }` for PDF and `{ type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + … } }` for images. Each attempt gets a FRESH `AbortSignal.timeout(timeoutMs)`; pass it as `signal` in the fetch init. Retry policy: at most 2 attempts total; retry ONLY on timeout/abort errors, network failures, or HTTP ≥ 500; throw `OcrTimeoutError` if both attempts time out, `OcrError` otherwise (include HTTP status). Parse `json.choices[0]?.message?.content || ''`; empty content → `OcrError('OCR returned empty text')`. No logging to console; no DB; no other module code.

**REFACTOR:** extract a `callOpenRouter(body, signal, fetcher)` helper inside the same file if it aids clarity. Keep the file dependency-free (Node built-ins + global fetch only).

**acceptance_criteria:**

1. All 6 contract subtests pass hermetically: `npm test` runs them with zero network and exit code 0 (S2-C7's metadata test also runs in the same command — at this chunk's end it may not exist yet; run `npx tsx --test tests/unit/likha-ocr.test.ts` alone).
2. Zero imports except Node built-ins; zero `linaw` tokens; models/temperature/timeout/retry exactly per PRP-LIKHA data rules.
3. `OPENROUTER_API_KEY` is read lazily per call (same env var as `llm.ts`); missing key → `OcrError` before fetch.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

grep -REn "^import|from ['\"]" src/lib/likha/ocr.ts | grep -v "node:" | grep -c .
# expected: 0  (no non-Node imports at all)

grep -c "google/gemini-2.5-flash" src/lib/likha/ocr.ts && grep -c "qwen/qwen3.7-plus" src/lib/likha/ocr.ts && grep -c "temperature: 0" src/lib/likha/ocr.ts
# expected: 1, 1, >= 1

grep -ic "linaw\|obra\|ella\|yala" src/lib/likha/ocr.ts
# expected: 0

npx tsx --test tests/unit/likha-ocr.test.ts
# expected: pass 6, fail 0, exit code 0
```

---

### S2-C7 — L003: prompts, pipeline runner (agents 1–3), pipeline route, confidence migration, persistence test (TDD)

```json
{
  "chunk_id": "S2-C7",
  "feature_id": "L003",
  "chunk_type": "library + api_route",
  "name": "Metadata Parser — prompts.ts (JSON extraction prompt + robust parser), agents.ts server runner (agents 1–3), POST /api/likha/pipeline, extraction_confidence migration, agent_decisions audit",
  "parallel_group": "GROUP-C",
  "dependencies": ["S2-C1", "S2-C2", "S2-C3", "S2-C4", "S2-C6"],
  "file_outputs": ["src/lib/likha/prompts.ts", "src/lib/likha/agents.ts", "src/app/api/likha/pipeline/route.ts", "src/lib/db.ts", "tests/integration/likha-metadata.test.ts"],
  "tdd_steps": ["RED", "GREEN", "REFACTOR"],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Implement L003 with TDD. This chunk completes the SERVER side of agents 1–3 (Ingestor already runs inside the upload route; here its audit convention is reused for agents 2–3) and persists parsed metadata + per-field confidence to `archived_ordinances`. NO HITL pause/resume, NO verification panel, NO publish logic — Sprint 3 territory. Agents 4–6 are NOT executed.

**RED — write the failing test FIRST:** `tests/integration/likha-metadata.test.ts` (`node:test`, `node:assert/strict`, relative imports). Hermetic (no server, no network): set `process.env.DB_PATH = tempDbPath()` (from `../helpers/likha-test-util`) BEFORE dynamically importing the runner — `const { runLikhaPipeline } = await import('../../src/lib/likha/agents');` (dynamic import is REQUIRED because `db.ts` reads `DB_PATH` at module load). Seed via the test-process `getDb()` (imported the same dynamic way from `../../src/lib/db`): one `users` row (approved, all NOT NULL fields) and two `archived_ordinances` rows in `archive_status='processing'` with placeholder values (per D6: negative ordinance_number, series_year 0, `content=''`), file_hash set, `scan_file_path='tests/fixtures/likha/sample-ordinance.pdf'`. Subtests:

1. **parse + persist:** call `runLikhaPipeline({ pipelineId: 'p1', userId, files: [file1, file2], ocr: stubOcr, extractMetadata: stubExtract })` where `stubOcr` returns `{ text: 'FAKE RAW TEXT', model: 'stub', attempts: 1 }` and `stubExtract` returns `{ ordinanceNumber: 5, seriesYear: 2023, title: 'An ordinance revising business permit fees', sectionCount: 12, confidence: { ordinanceNumber: 0.92, seriesYear: 0.95, title: 0.9, sectionCount: 0.88 } }`. Assert: both rows now have `content='FAKE RAW TEXT'`, `ordinance_number=5`, `series_year=2023`, parsed `title`, `archive_status='pending_review'`, `extraction_confidence` JSON whose `ordinanceNumber` = 0.92, `updated_at` changed.
2. **audit trail:** `SELECT * FROM agent_decisions WHERE module='likha' AND pipeline_id='p1' ORDER BY created_at` contains rows for `agent_id` 2 and 3, each with BOTH actions `'start'` and `'complete'`, correct `agent_name` ('OCR Extractor' / 'Metadata Parser'), and `output_snapshot` JSON carrying the parsed fields (agent 3 row also carries `confidence` = average of the four field confidences ±0.01).
3. **OCR failure flags the row:** rerun with `ocr` stub that throws `new Error('boom')` on a fresh processing row → result entry `ok: false, failedAgent: 2`; the row's `archive_status='flagged'`; an `agent_decisions` row with `action='error'` for agent 2 exists.
4. **UNIQUE conflict flags:** seed a row whose stub-parsed `(5, 2023)` collides with an existing published row → runner does not throw; the colliding row ends `archive_status='flagged'` and its result carries `error` mentioning the conflict.
5. **prompts unit-asserts** (import `../../src/lib/likha/prompts`): `parseMetadataResponse('```json\n{…valid…}\n```')` strips fences and returns the typed object; garbage input returns all-zero confidences and `ordinanceNumber: 0` without throwing; confidences are clamped to [0,1].

**GREEN — implement** in this order:

**(a) `src/lib/db.ts` (additive migration, decision D7):** inside `initSchema()`, AFTER the three existing `interaction_logs` ALTER-migration try/catch blocks, append ONE more block in the identical style:

```ts
  // Migration (Sprint 2, L003): per-field extraction confidence for LIKHA metadata parsing
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN extraction_confidence TEXT`);
  } catch {
    // Column already exists — ignore
  }
```

Do NOT touch the Sprint-1 `CREATE TABLE` block or anything else in the file.

**(b) `src/lib/likha/prompts.ts`:** exports (no imports except types from `@/types/likha`):
- `export const METADATA_SYSTEM_PROMPT: string` — gov-domain prompt: "You are a precise metadata extraction engine for Philippine LGU ordinances (Sangguniang Bayan records). Read the transcribed ordinance text and return ONLY a JSON object — no prose, no markdown fences — with exactly this shape: {\"ordinanceNumber\": number, \"seriesYear\": number, \"title\": string, \"sectionCount\": number, \"confidence\": {\"ordinanceNumber\": number, \"seriesYear\": number, \"title\": number, \"sectionCount\": number}}. Ordinance numbers are the numeric part of 'Ordinance No. X'; seriesYear is the 'Series of YYYY' year; title is the full 'An ordinance …' enactment clause; sectionCount is the number of numbered sections. Confidence values are 0–1 self-estimates; use 0 when a field cannot be found."
- `export function buildMetadataUserPrompt(rawText: string): string` — truncates to 12_000 chars and asks for the JSON.
- `export function parseMetadataResponse(llmText: string): ParsedMetadata` — strips ``` fences, finds the first `{…}` JSON span, `JSON.parse` in try/catch; coerces numbers (`Number()`, integers, defaults `ordinanceNumber: 0`, `seriesYear: 0`, `title: ''`, `sectionCount: 0`); clamps every confidence to `[0, 1]`, defaulting missing/NaN to `0`. NEVER throws.

**(c) `src/lib/likha/agents.ts`:** SERVER-only module. Imports allowed: `@/lib/db`, `@/lib/logger`, `@/lib/ai/llm` (`chatCompletion` ONLY), `@/lib/likha/ocr`, `@/lib/likha/prompts`, `@/types/likha`, `node:crypto`, `node:fs`, `node:path`. Public API:

```ts
export interface RunLikhaPipelineOptions {
  pipelineId: string;
  userId: string;
  files: LikhaPipelineFileInput[];
  /** DI seams for tests — defaults are the real implementations. */
  ocr?: (opts: { fileBuffer: Buffer; mimeType: LikhaOcrMimeType; filename?: string }) => Promise<{ text: string; model: string; attempts: number }>;
  extractMetadata?: (rawText: string) => Promise<ParsedMetadata>;
}

export async function runLikhaPipeline(opts: RunLikhaPipelineOptions): Promise<LikhaPipelineResponse>;
```

Defaults: `ocr` = `extractText` from `./ocr`; `extractMetadata` = `async (rawText) => parseMetadataResponse(await chatCompletion(METADATA_SYSTEM_PROMPT, buildMetadataUserPrompt(rawText), { temperature: 0, maxTokens: 1024 }))`. Per file, sequentially: load the row (skip missing rows); read the scan file from `scan_file_path` (resolve against `process.cwd()`); agent 2 — insert `agent_decisions` start row (`module='likha'`, `pipeline_id`, `agent_id=2`, `agent_name='OCR Extractor'`, `action='start'`, `input_snapshot` = JSON `{recordId, fileHash, mimeType}`), run OCR, insert complete row (`output_snapshot` = JSON `{rawTextLength, model, attempts}`); agent 3 — start row, run extraction, then `UPDATE archived_ordinances SET ordinance_number=?, series_year=?, title=?, content=?, extraction_confidence=?, archive_status='pending_review', updated_at=datetime('now') WHERE id=?` with `extraction_confidence` = `JSON.stringify(parsed.confidence)`; insert complete row with `confidence` = average of the four field confidences and `output_snapshot` = JSON of the parsed metadata. On ANY per-file error: catch, insert an `action='error'` row for the failing agent (`reason` = error message), set that row `archive_status='flagged'`, continue with the next file (never crash the batch). On `SQLITE_CONSTRAINT_UNIQUE` from the metadata UPDATE specifically: set `archive_status='flagged'` and result `error: 'duplicate (ordinance_number, series_year)'`. Also call `logModuleEvent({ module: 'likha', interactionType: 'likha_pipeline', … })` once per run. Return `LikhaPipelineResponse` (processed = rows reaching `pending_review`, failed = flagged/errored). NOTE: NO `setTimeout` delays here — delays are the CLIENT's UI simulation (decision D9).

**(d) `src/app/api/likha/pipeline/route.ts`:** `export const POST = withUserAuth(async (request, { user }) => { … })`. Body JSON `{ batchId?: string; fileIds?: string[]; pipelineId?: string }` — when `fileIds` absent, select ALL rows with `archive_status='processing'` AND `uploaded_by_id = user.user.id`. Build `LikhaPipelineFileInput[]` from rows (validate `archive_status='processing'`), `pipelineId = body.pipelineId || crypto.randomUUID()`, call `runLikhaPipeline({ pipelineId, userId: user.user.id, files })`, respond 200 with the `LikhaPipelineResponse`. Import allow-list as in (c) plus `next/server` and `@/lib/user-auth-middleware`.

**REFACTOR:** keep the audit-row insert in one local helper `recordDecision(db, {agentId, agentName, action, inputSnapshot?, outputSnapshot?, confidence?, reason?})` bound to the run's `pipelineId`. Zero `linaw` tokens across all five files.

**acceptance_criteria:**

1. All 5 test groups pass hermetically: `npx tsx --test tests/integration/likha-metadata.test.ts` exit 0.
2. Metadata persists to `archived_ordinances` with per-field confidence JSON (`extraction_confidence` column from the D7 migration); rows end `pending_review` on success, `flagged` on OCR error or UNIQUE conflict.
3. `agent_decisions` rows: agents 2+3, start+complete (+error paths), `module='likha'`, correct pipeline id.
4. `chatCompletion` is called with `temperature: 0`; prompts return strict JSON; parser never throws.
5. db.ts diff shows ONLY the appended migration block; the Sprint-1 DDL block is byte-identical.
6. No S3 features: no HITL pause, no verification, no publish, no BM25, agents 4–6 untouched.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

git diff --unified=0 -- src/lib/db.ts | grep -c '^+[^+]'
# expected: >= 4 (the migration block) — and:
git diff --unified=0 -- src/lib/db.ts | grep -c '^-[^-]'
# expected: 0  (no removed lines; Sprint-1 DDL untouched)

grep -c "chatCompletion" src/lib/likha/agents.ts && grep -c "temperature: 0" src/lib/likha/agents.ts
# expected: >= 1 each

grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" src/lib/likha src/app/api/likha/pipeline
# expected: no output, exit code 1 (zero hits)

grep -REin "linaw" src/lib/likha src/app/api/likha
# expected: no output, exit code 1 (zero hits)

npx tsx --test tests/integration/likha-metadata.test.ts
# expected: all subtests pass, exit code 0
```

---

### S2-C8 — `src/app/likha/page.tsx`: replace placeholder with the real Upload & Digitize tab

```json
{
  "chunk_id": "S2-C8",
  "feature_id": "L003 (UI wiring; hosts L001 dropzone)",
  "chunk_type": "frontend_page",
  "name": "LIKHA portal page — tabs (Archive Browser stub / Upload & Digitize live / Classification stub), dropzone + pipeline + activity feed wired to real agent state",
  "parallel_group": "GROUP-D",
  "dependencies": ["S2-C1", "S2-C5", "S2-C7"],
  "file_outputs": ["src/app/likha/page.tsx"],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

REPLACE `src/app/likha/page.tsx` wholesale (the Sprint-1 placeholder is explicitly scheduled for replacement). `'use client';` page. Allowed imports: `react`, `lucide-react`, `@/lib/utils` (`cn`), the shared kit (`@/components/agent-pipeline`, `@/components/activity-feed` — props ONLY, never modified), `@/components/likha/upload-dropzone`, `@/types/likha` (incl. `LIKHA_AGENT_DEFS`), `@/types/agentic` (types). NO `getDb`, NO `@/lib/likha/*` imports (server-only), NO kit edits.

Structure:

1. **Shell — foundation-compatible styling:** keep the placeholder's token base: `min-h-screen bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))] px-6 py-10`, inner `mx-auto max-w-6xl space-y-8`. H1 `L.I.K.H.A.` (`text-3xl font-black tracking-widest`) + subtitle "Legislative Insight & Knowledge Hub for Archives — Digitization & Archive of Sangguniang Bayan ordinances" (`text-xs text-[hsl(var(--pillar-muted))]`).
2. **Tabs:** three buttons — `Archive Browser`, `Upload & Digitize` (DEFAULT active), `Classification` — styled as chips; active tab: `bg-[#0038A8] text-white` (accent-primary, 9.9:1 per DESIGN.md), inactive: bordered muted. Keyboard-operable (native buttons).
   - **Archive Browser tab:** stub panel "Search and browse land in Sprint 3 (L004–L006)." inside a `bg-[#1E293B]` card.
   - **Classification tab:** stub panel "AI subject classification lands in Sprint 4 (L007)."
   - **Upload & Digitize tab:** the live content below.
3. **State** (per PRP State Management, narrowed): `agents: LikhaAgentState[]` initialized from `LIKHA_AGENT_DEFS` (all 6 cards; agents 1–3 wired this sprint, 4–6 render `idle`), `activities: ActivityItem<LikhaAgentOutput>[]`, `isProcessing: boolean`, `pipelineComplete: boolean`, plus the last `LikhaUploadResponse`.
4. **Orchestration — `runDigitizationRun(batch: LikhaUploadResponse)`** (client-side UI simulation delays + real async work, per PRP Interactive Behaviors):
   - Reset all 6 agents to `idle` (clear `output`), `isProcessing = true`, `pipelineComplete = false`.
   - Agent 1 (Ingestor): `onAgentStart` → status `processing`; `await sleep(1000)` (the real ingest/hash work already happened in the upload route); complete with `output = { preview: 'Files validated & hashed', fileHash: <first hash>, success: true }`.
   - Agent 2 (OCR Extractor): status `processing`; fire `const serverRun = fetch('/api/likha/pipeline', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ batchId: batch.batchId, fileIds: <accepted recordIds> }) })` NON-blocking; `await Promise.race`-style sequencing: `await sleep(1600)`; if `serverRun` is still pending the card KEEPS its spinner (PRP: "UI shows spinner on the active agent while work continues") — i.e. do not complete agent 2 until BOTH the delay elapsed AND the response arrived; then complete with `preview: 'Text extracted'` + aggregated `rawText` length.
   - Agent 3 (Metadata Parser): status `processing`; `await sleep(1400)` (server work already done in the same response); complete with `preview: 'Metadata parsed'` and the first file's parsed `ordinanceNumber`/`seriesYear` if present.
   - Agents 4–6 remain `idle`. `pipelineComplete = true`, `isProcessing = false`.
   - **Activity feed items:** one `success` item per accepted file ("Digitized: <filename> — pending human review (Sprint 3)"), one `warning` item per duplicate ("Skipped duplicate: <filename> — already archived (record <existingRecordId>)"), one `error` item per failed file from the pipeline response (`failedAgent` named). Timestamps ISO. Items this sprint are informational: pass `onConfirm/onEdit/onReject` as no-op-logged handlers ONLY if the feed shows pending actions — to avoid implying S3 HITL, add feed items with `status: 'confirmed'` for successes and `status: 'pending'` is NOT used this sprint (Confirm/Edit persistence is Sprint 3).
   - Server errors (non-200 from `/api/likha/pipeline`): set the failing agent to `error`, add an `error` activity, `isProcessing = false`.
5. **Layout of the live tab:** `<UploadDropzone disabled={isProcessing} onBatchAccepted={runDigitizationRun} onError={…} />` → section label "AGENT PIPELINE" → `<AgentPipeline agents={agents} isProcessing={isProcessing} pipelineComplete={pipelineComplete} />` (all 6 cards render; wrap responsively per kit) → section label "ACTIVITY FEED" → `<ActivityFeed activities={activities} />`.
6. No `linaw` token; no dead imports; the page must still render all six agent NAMES (Sprint-1 regression smoke greps for them).

**acceptance_criteria:**

1. Page compiles, replaces the placeholder entirely, and keeps the `--pillar-*` shell tokens (foundation-compatible).
2. Upload → agent 1 glow/pulse (1000ms) → agent 2 spinner held until the server responds (≥1600ms) → agent 3 (1400ms) → Database bookend glows green; agents 4–6 idle.
3. Activity feed shows success/duplicate/error items from the REAL response; no S3 HITL wiring (no pause, no rose gate, no verification dialog).
4. Kit is consumed props-only; `npm run build` lists `/likha`.

**verification_commands:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run build
# expected: build succeeds; route table includes /likha

grep -c "LIKHA_AGENT_DEFS" src/app/likha/page.tsx
# expected: >= 1

grep -REn "from ['\"]@/(lib/likha|lib/db|app/api)" src/app/likha/page.tsx
# expected: no output, exit code 1 (client page — no server imports)

grep -REn "verification-panel|Approve & Publish|onHitlRequired" src/app/likha/page.tsx
# expected: no output, exit code 1 (no S3 features)

grep -ic "linaw" src/app/likha/page.tsx
# expected: 0
```

---

### S2-C9 — Sprint 2 final gate: boundary greps, full test battery, regression (Sprint 1 re-run), commits (no new files)

```json
{
  "chunk_id": "S2-C9",
  "feature_id": "gate",
  "chunk_type": "testing",
  "name": "Boundary verification (SPRINT_PLAN Sprint 2 greps) + integration suite + Sprint-1 regression smoke + 3 feature commits",
  "parallel_group": "GROUP-E (sequential gate)",
  "dependencies": ["S2-C1", "S2-C2", "S2-C3", "S2-C4", "S2-C5", "S2-C6", "S2-C7", "S2-C8"],
  "file_outputs": [],
  "tdd_steps": [],
  "__super_prime_enrichment__": true
}
```

**instruction_prompt (verbatim, self-contained):**

Run the Sprint 2 gate battery exactly as listed, from the repo root (Git Bash). No code changes here; failures go back to the responsible chunk (C1 types · C2 shared edits · C3 harness · C4 upload · C5 dropzone · C6 OCR · C7 metadata · C8 page). Record every output as SPRINT_REVIEW evidence. THEN create the three feature commits (decision D8) using the explicit staging lists — correct regardless of GROUP-B execution order.

**A. Static gates:**

```bash
npx tsc --noEmit
# expected: no output, exit code 0

npm run lint
# expected: no errors. Zero findings in Sprint-2 files mandatory
# (src/types/likha.ts, src/lib/likha/*, src/app/api/likha/**, src/components/likha/*,
#  src/app/likha/page.tsx, tests/**). Pre-existing warnings elsewhere tolerated.

npm run build
# expected: "Compiled successfully"; route table includes /likha, /api/likha/upload, /api/likha/pipeline
```

**B. Boundary greps (SPRINT_PLAN Sprint 2 boundary verification, both directions):**

```bash
grep -REn "from ['\"]@/(app/api/(obra|chat|linaw)|lib/(ai/(prompts|obra-export)|linaw)|components/(ella|obra|yala|linaw))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (ZERO forbidden imports)

grep -REn "(FROM|INTO|UPDATE|TABLE)[[:space:]]+(linaw_ordinances|codification_records|ordinance_relationships|code_volumes)\b" \
  src/lib/likha src/app/api/likha
# expected: no output, exit code 1 (ZERO LINAW table reads)

grep -REin "linaw" src/lib/likha src/app/api/likha src/components/likha src/app/likha/page.tsx src/types/likha.ts tests
# expected: no output, exit code 1 (zero linaw references in ANY Sprint-2 file)

grep -REn "from ['\"]@/(app/(ella|obra|yala)|components/(ella|obra|yala))" \
  src/lib/likha src/app/api/likha src/components/likha src/app/likha src/types/likha.ts
# expected: no output, exit code 1 (zero ELLA/OBRA/YALA imports)
```

**C. Integration suite (first sprint WITH integration tests — this becomes the regression baseline):**

```bash
npm run dev &   # background; wait for "Ready" on http://localhost:3000
sleep 8

npm run test
# expected: hermetic suite passes — OCR contract (6 subtests) + metadata persistence (5 groups), exit 0

npm run test:integration
# expected: upload contract passes — happy path, duplicate-hash warning, 11th file 400,
# >20MB 400, bad MIME 400, 401 unauthenticated, DB side effects (7 subtests), exit 0

kill %1
```

**D. Regression — re-run Sprint 1 gates (adapted to the replaced page):**

```bash
# Kit neutrality (S1-C9.4) — kit files untouched in Sprint 2:
grep -REn "archived_ordinances|linaw_ordinances|ordinanceNumber|codification" \
  src/components/agent-pipeline.tsx src/components/agent-card.tsx \
  src/components/activity-feed.tsx src/types/agentic.ts
# expected: no output, exit code 1

# Schema still intact + idempotent (S1-C9.5 — run TWICE):
npx tsx -e "import {getDb} from './src/lib/db'; const db=getDb(); const names=db.prepare(\"SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'\").all().map(r=>r.name); const need=['archived_ordinances','classifications','amendment_links','linaw_ordinances','codification_records','ordinance_relationships','code_volumes','agent_decisions','agent_decisions','idx_arch_ord_year','idx_arch_ord_status','idx_arch_ord_astat','idx_agent_dec_pipeline','idx_agent_dec_module']; const missing=need.filter(n=>!names.includes(n)); if(missing.length){console.error('FAIL missing:',missing); process.exit(1);} const cols=db.prepare('PRAGMA table_info(archived_ordinances)').all().map(c=>c.name); if(!cols.includes('extraction_confidence')){console.error('FAIL: extraction_confidence missing'); process.exit(1);} console.log('SCHEMA OK: foundation tables + Sprint-2 migration present');"
# expected (both runs): SCHEMA OK: foundation tables + Sprint-2 migration present

# Kit render smoke (S1-C9.7 adapted — real agent names now):
npm run dev & sleep 8
curl -s http://localhost:3000/likha | grep -oE "Ingestor|OCR Extractor|Metadata Parser|Subject Classifier|Legal Validator|Archiver" | sort -u | wc -l
# expected: 6
curl -s http://localhost:3000/likha | grep -c "DRAG & DROP SCAN FILES"
# expected: >= 1 (dropzone renders)
curl -s http://localhost:3000/likha | grep -c "ACTIVITY FEED"
# expected: >= 1
kill %1
```

**E. Feature commits (exact messages, explicit staging — decision D8):**

```bash
git add src/types/likha.ts src/lib/logger.ts src/middleware.ts .gitignore package.json \
        src/app/api/likha/upload/route.ts src/components/likha/upload-dropzone.tsx \
        tests/helpers/likha-test-util.ts tests/fixtures/likha/sample-ordinance.pdf \
        tests/fixtures/likha/sample-scan.png tests/integration/likha-upload.test.ts
git commit -m "feat: implement L001 batch upload of scanned ordinance PDFs/images pillar-likha-linaw-20260809"

git add src/lib/likha/ocr.ts tests/unit/likha-ocr.test.ts
git commit -m "feat: implement L002 module-owned OCR wrapper pillar-likha-linaw-20260809"

git add src/lib/db.ts src/lib/likha/prompts.ts src/lib/likha/agents.ts \
        src/app/api/likha/pipeline/route.ts src/app/likha/page.tsx \
        tests/integration/likha-metadata.test.ts
git commit -m "feat: implement L003 auto-parse ordinance metadata pillar-likha-linaw-20260809"

git log --oneline -3
# expected: exactly these 3 commits, in this order, with these exact messages
git status --porcelain
# expected: empty (everything staged into the three feature commits)
```

Tag `v0.2.0-sprint-2` is cut ONLY after SPRINT_REVIEW passes (SPRINT_PLAN §3.6) — do not tag in this chunk.

**acceptance_criteria:**

1. Sections A–D all produce their expected outputs; C's integration results are captured as the regression baseline for Sprint 3.
2. Exactly 3 commits with the exact `feat: implement [Feature] pillar-likha-linaw-20260809` messages; working tree clean afterward.
3. All evidence (command outputs, test counts, commit SHAs) recorded for SPRINT_REVIEW and the cumulative quality score.

---

## Sprint 2 Definition of Done (mirrors SPRINT_PLAN.md §5 — Sprint 2)

- [ ] **L001–L003 acceptance per PRD-LIKHA §11:** upload enforces ≤10 files / ≤20 MB / PDF-JPG-PNG with per-file progress + duplicate-hash warning (S2-C4, S2-C5); OCR via module-owned wrapper ≤60s with one retry, correct model per media type (S2-C6); metadata (ordinance number / series year / title / section count) persisted to `archived_ordinances` WITH per-field confidence (S2-C7)
- [ ] **Pipeline UI shows agents 1–3 processing** with delays 1000/1600/1400ms + glow/pulse; spinner held on agent 2 while real OCR work continues; batch completes end-to-end to `archive_status='pending_review'`; agents 4–6 idle (S2-C8)
- [ ] **All writes logged** via `src/lib/logger.ts` with `module='likha'` (`interaction_logs`); agent starts/completes/errors logged to `agent_decisions` with `module='likha'` (S2-C4, S2-C7)
- [ ] **`withUserAuth` on both routes**; uploader id from the session; 401 envelope matches the shared middleware (S2-C4, S2-C7)
- [ ] **Boundary grep clean, both directions:** zero forbidden imports, zero LINAW table reads, zero `linaw` tokens in any Sprint-2 file, zero ELLA/OBRA/YALA imports (S2-C9.B)
- [ ] **lint + `tsc --noEmit` + `next build` clean** (S2-C9.A)
- [ ] **Integration suite green** — upload happy path + limit violations (11th file, >20 MB, bad MIME) + duplicate-hash warning + auth + DB side effects; OCR contract with mocked OpenRouter; metadata persistence with audit trail — this suite is the regression baseline for Sprint 3+ (S2-C9.C)
- [ ] **Regression:** Sprint 1 gates re-run and green — kit neutrality grep, schema assertions (+ new `extraction_confidence` column), kit render smoke (6 agent names, dropzone, feed), nav/build intact (S2-C9.D)
- [ ] **Per-feature commits:** exactly 3, format `feat: implement [Feature] pillar-likha-linaw-20260809` (S2-C9.E)
- [ ] **No Sprint-3 scope leaked:** no verification panel, no HITL pause/resume, no approve/reject routes, no publish/BM25 (confidence values and flags are STORED only)
- [ ] Tag `v0.2.0-sprint-2` after SPRINT_REVIEW passes; cumulative quality score recorded

**Integration/Regression notes (SPRINT_PLAN):** this is the FIRST sprint with integration tests. New suite = API-level against the dev server (upload contract incl. limit violations and duplicate-hash warning) + hermetic OCR contract + metadata persistence. Sprint 1 smoke is re-checked as regression. From Sprint 3 onward, THIS suite re-runs as part of every sprint's regression battery.

---

## Flagged for SPRINT_REVIEW

1. **D2 — OCR bypasses `llm.ts` primitives (direct OpenRouter `fetch`).** Justified by inspection: `chatCompletion`/`streamChatResponse` are text-only, single-model (`LLM_MODEL` env), no timeout — incapable of L002's multimodal + per-media model + 60s-timeout contract. Same `OPENROUTER_API_KEY` env var reused; `llm.ts` unmodified. `chatCompletion` IS reused where it fits (agent-3 metadata extraction).
2. **D7 — Schema extension beyond the frozen Sprint-1 DDL:** additive idempotent `ALTER TABLE archived_ordinances ADD COLUMN extraction_confidence TEXT`, using the repo's existing migration pattern. The Sprint-1 DDL and PRP Types contain no confidence home, while PRD §11 requires persisted per-field confidence.
3. **D6 — Placeholder metadata at insert time** (negative random `ordinance_number`, `series_year=0`, title `Processing — <filename>`) required by the frozen NOT NULL + UNIQUE schema; replaced by L003. UNIQUE conflicts at parse time resolve to `archive_status='flagged'` — the human resolution path arrives with S3 verification.
4. **D4 — `src/middleware.ts` `PROTECTED_PATHS` gained `"/likha"`** (additive shared-file edit, ella/obra/yala precedent) to honor "Route path: /likha under the existing portal auth".
5. **D5 — New test infrastructure:** `test` / `test:integration` scripts (node:test via `tsx --test`), `tests/` tree, fixtures. `test:integration` REQUIRES a running `npm run dev` and seeds an approved user directly into `data/workshop.db` (cleaned up after).
6. **D1 — Uploads live at `data/uploads/likha/`** (gitignored), not `public/` — gov scans must not be publicly servable; `scan_file_path` stores the repo-relative path.
7. **Real OpenRouter calls** (demo/manual verification) require `OPENROUTER_API_KEY` in the dev environment; ALL Sprint-2 automated tests are hermetic (mocked fetch / injected stubs) and never hit the network. Model-output accuracy (≥80% metadata) is a SYSTEM_TEST/pilot-batch concern per SPRINT_PLAN risk 7, not a Sprint-2 gate.
8. **Path mapping reaffirmed:** PRP's `src/app/(portal)/likha/page.tsx` → actual `src/app/likha/page.tsx` (Sprint-1 decision, still correct — placeholder replaced in place).

**Handoff:** Sprint 3 (LIKHA Verification, Archive Publish & Search — L004/L005/L006, PRP-LIKHA only) builds on `pending_review` rows with stored confidence, the agents-1–3 runner, and this sprint's regression suite.

---

*Prepared by @instruct_agent (Super PRIME variant) — BUILD phase, Expanded mode, per-sprint instruction sets · session pillar-likha-linaw-20260809 · Sprint 2 of 7*
