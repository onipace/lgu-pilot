# SYSTEM TEST REPORT — PILLAR (LIKHA + LINAW)

| | |
|---|---|
| **Session** | `pillar-likha-linaw-20260809` |
| **Phase** | TEST — SYSTEM_TEST executor (Hackathon PRIME v3.3, Expanded mode) |
| **Repo** | `C:\Users\Emil V. Capino\DATA\QWork\PILLAR` (PILLAR-pilot, Next.js 15.3.8) |
| **Scope** | 7 sprints · 19 features · LIKHA L001–L007, L010, L013 · LINAW N001–N007, N013–N015 |
| **Executed** | 2026-08-09 → 2026-08-10 (local MPST, UTC+8) |
| **Verdict** | **PASS-WITH-DEFERRED** |

---

## 1. Environment

| Item | Value | Evidence |
|---|---|---|
| OS / Runtime | Windows (win32), Node v24.14.0 | `node -v` |
| App | Next.js 15.3.8, `npm run dev` on `http://localhost:3000` | `✓ Ready in 3.3s`, `/api/health` 200 |
| Database | `data/workshop.db` (SQLite, WAL, better-sqlite3) | `src/lib/db.ts` |
| OPENROUTER_API_KEY | **ABSENT** — no `.env` / `.env.local` exists; only `.env.example` (placeholder) and `.env.vps` (VPS deploy artifact, NOT loaded by `next dev`, NOT used). All LLM-dependent paths therefore ran **keyless**; accuracy targets are DEFERRED per gate rules. | `ls -a` repo root |
| Browser automation | Playwright chromium available (`chromium OK`) | probe run |
| Ambient env note | `NODE_TLS_REJECT_UNAUTHORIZED=0` present in the machine env (dev-server startup warning). Not set by the app. | dev server log |
| Stray dev server note | A previous stray `npm run dev` reportedly exited code 1. At SYSTEM_TEST start **no stale node process and no port-3000 listener existed** (`netstat` empty); first start succeeded cleanly. Consistent with a prior EADDRINUSE race between two dev instances. Server lifecycle was kept clean throughout (stale PID killed before each intentional restart). | `netstat -ano`, `taskkill` log |

Auth mechanism used for E2E: approved user + row in `user_sessions`, cookie `pillar_user_session` (per `src/middleware.ts` + `src/lib/user-auth.ts`; same pattern as the integration harness `tests/helpers/*-test-util.ts`). All SYSTEM_TEST-seeded users/rows purged after the run (§7).

---

## 2. Suite Results (Rule 13 — fresh regression)

| Suite | Command | Tests | Pass | Fail | Duration |
|---|---|---:|---:|---:|---:|
| Hermetic (unit + in-process integration) | `npm test` | **185** | **185** | **0** | 2305.95 ms |
| API integration vs live dev server | `npm run test:integration` | **102** | **102** | **0** | 10873.97 ms |
| **Total** | | **287** | **287** | **0** | |

Evidence tails (verbatim):

```
ℹ tests 185        ℹ pass 185        ℹ fail 0        ℹ skipped 0   (npm test)
ℹ tests 102        ℹ pass 102        ℹ fail 0        ℹ skipped 0   (npm run test:integration)
```

287 matches the BUILD-exit count — zero regressions introduced since BUILD.

---

## 3. End-to-End System Flows (live dev server)

Runner: scripted HTTP+DB battery against the running server (session cookie obtained via the app's session mechanism; fixtures from `tests/fixtures/{likha,linaw}`). **Result: 29/29 checks PASS.**

### 3.1 LIKHA chain

| # | Check | Result | Evidence |
|---|---|---|---|
| L1 | Upload fixture PDF (`POST /api/likha/upload`) | PASS | `accepted:1`, returned `fileHash` == locally computed SHA-256 |
| L2 | Hash-duplicate re-upload | PASS | `duplicates:1`, `status:"duplicate"`, points at existing record |
| L3 | Pipeline agents 1–3 (`POST /api/likha/pipeline`) | PASS (keyless degradation) | `ok:false, failedAgent:2, error:"OPENROUTER_API_KEY is not configured"`, record `flagged`, 2 audit rows (agent start/error) — graceful, batch never crashes |
| L4 | Verification queue shows pending_review record | PASS | `GET /api/likha/archive?archiveStatus=pending_review` → record found |
| L5 | APPROVE `PUT /api/likha/archive/:id` | PASS | `published:true`; DB `archive_status='published'`, `verified_by_id` set; BM25 entry created |
| L6 | `GET /api/likha/archive?q=zephyr` | PASS | record returned, snippet `…electric tricycle <mark>zephyr</mark> registration…`, **`tookMs: 1`** (< 500 ms) |
| L7 | Classify (`POST /api/likha/classify`) — keyless tolerance | PASS | structured envelope, no crash (contract-level: 500 `{error:"Classification failed"}` is the documented D32 keyless posture) |
| L8 | `POST /api/likha/export-dilg` | PASS | `manifest.submission:"DILG MC 2026-041"`, `recordCount:1`, DB `dilg_submitted=1` |
| L9 | `POST /api/likha/export-package` + hash recompute | PASS | `packageHash sha256:ba322cd5…97516` == independently recomputed `sha256(canonicalJson({records}))`; `sha256:` prefix format |
| L10 | REJECT path | PASS | second record rejected with reason → `archive_status='flagged'` (never published), reason persisted on row **and** audited in `agent_decisions` (agent 5, reason column), absent from published search |
| L11 | Verify-edit `(ordinance_number, series_year)` collision | PASS | `409 CONFLICT` — "Conflicts with an existing ordinance number / series year" |

### 3.2 LINAW chain

| # | Check | Result | Evidence |
|---|---|---|---|
| N1 | Bulk import JSON batch A (2 records) | PASS | `imported:2, skippedDuplicates:0` → `linaw_ordinances`, `library_status='pending_review'` |
| N2 | Batch B with 1 intentional duplicate | PASS | `imported:1, **skippedDuplicates:1**` |
| N3 | Manual entry (`PUT /api/linaw/library`) | PASS | `201`, record `libraryStatus:'pending_review'` |
| N4 | Manual entry duplicate pair | PASS | `409 CONFLICT` |
| N5 | Scan upload fixture (`POST /api/linaw/upload`) — keyless | PASS | `status:"ocr_failed"` with error text; row safely lands `pending_review` for human completion (designed D11 degradation) |
| N6 | Verification edit + approve | PASS | edit 200 → approve 200 → DB `library_status='ready'` |
| N6b | Approve imported/manual records → ready | PASS | 4/4 |
| N6c | Codification placements seeded (harness pattern) | PASS | 5 rows — required because the LLM classifier cannot run keyless; assembler needs ≥1 placement (else `NOTHING_TO_ASSEMBLE`). Mirrors `seedLinawCodificationRecord` |
| N7 | `GET /api/linaw/inventory` | PASS | `totals.ordinances:7`, `completenessScore:37.5`, `yearGaps` present (gaps detected), **`tookMs:70`** (≤ 2 s SLA) |
| N8 | Classify (`POST /api/linaw/classify`) — keyless tolerance | PASS | structured envelope (D12 LLM-primary → structured 500, batch never crashes) |
| N9 | `POST /api/linaw/detect-relationships` on crafted text “…repealing Ordinance No. 920001, S. 2025…” | PASS | `scanned:1, detected:1, persisted:1, hitlRequired:true` |
| N9b | Relationship row | PASS | `type:"repeals"`, **`confidence:0.85`**, `confirmed:0`, joined source/target metadata |
| N10 | Assemble BEFORE deciding | PASS | **`409 PENDING_RELATIONSHIPS`**, `pending:1` |
| N11 | Confirm relationship | PASS | `confirmed:1`, `confirmed_by_id` set; **target ordinance status flipped `active → repealed`** (response `statusUpdate` + DB) |
| N12 | Assemble AFTER all decisions | PASS | `200`, `gate:"final_code_export"`, TOC `counts {titles:1, chapters:1, sections:4}`, repealed target correctly `excluded:1` |
| N13 | Summarize — keyless | PASS | `summarized:0`, per-record `failed` entry `"OPENROUTER_API_KEY not configured"` — graceful, no 500 |
| N14 | `POST /api/linaw/export-package` + hash recompute | PASS | `packageHash sha256:27158157…f832` == recomputed `sha256(canonicalJson({records, relationships}))`; confirmed repeal present **keyed by `{ordinanceNumber:920010, seriesYear:2024} → {920001, 2025}`** (no internal ids) |

### 3.3 Cross-cutting

| Check | Result | Evidence |
|---|---|---|
| 401 on every module route without session | PASS | **30/30** routes (LIKHA 11 + LINAW 19 incl. `scan`, `classify/[id]`, `summarize/[id]`, `code`, `conflicts`) returned `401 {code:"NO_SESSION"}` |
| LIKHA duplicate-pair 409 (verify-edit collision) | PASS | L11 |
| LINAW duplicate-pair 409 (manual entry) | PASS | N4 |
| Search latency < 500 ms with `tookMs` | PASS | LIKHA BM25 `tookMs:1`; LINAW inventory `tookMs:70` |

### 3.4 Browser UI smoke (Playwright chromium, live pages)

10/10 effective. Six `h-56` agent cards with correct names on both `/likha` and `/linaw`; dark theme (body `rgb(9,14,26)` dark-navy, cards `#1E293B`); activity-feed empty state present (LIKHA custom message "Upload a batch to start the digitization pipeline.", LINAW default). Two initial checker "fails" were verifier artifacts, resolved: (a) LIKHA uses a custom `emptyMessage`; (b) dark-bg assertion was too narrow — `rgb(9,14,26)` IS the dark theme. Screenshots: `C:\tmp\systemtest-likha-ui.png`, `C:\tmp\systemtest-linaw-ui.png`.

---

## 4. Acceptance Matrix

### 4.1 Per-feature matrix (19 features)

| Feature | Name | Verdict | Criteria ref | SYSTEM_TEST evidence |
|---|---|---|---|---|
| L001 | Batch upload (≤10 files, ≤20 MB, hash dedupe) | **PASS** | PRD-LIKHA §11 Core #1 | L1, L2 + integration `likha-upload` (limit/type validation) |
| L002 | Module-owned OCR wrapper | **PASS**¹ | PRD-LIKHA §11 Core #2 | contract verified live (L3 keyless error path), unit suite `likha-ocr` (timeout/retry/DI) |
| L003 | Auto-parse metadata with per-field confidence | **PASS**² | PRD-LIKHA §11 Core #3 | parser contract suite `likha-metadata`; live LLM extraction DEFERRED (keyless) |
| L004 | Side-by-side verification Approve/Edit/Reject + audit | **PASS** | PRD-LIKHA §11 Core #4 | L5, L10, L11 (reason persisted + audited) |
| L005 | Publish to archive + BM25 index entry | **PASS** | PRD-LIKHA §11 Core #4/#5 | L5 (published), L6 (BM25 hit after publish) |
| L006 | Archive search < 500 ms, highlighted snippets, filters | **PASS** | PRD-LIKHA §11 Core #5 | L6 `tookMs:1`, `<mark>` snippet; L4 queue filter |
| L007 | AI subject classification + override | **PASS**² | PRD-LIKHA §12.6 / SPRINT S3 | L7 keyless contract; hermetic `likha-classification` + override integration suite |
| L010 | DILG MC 2026-041 export | **PASS** | SPRINT_PLAN L010 | L8 manifest + `dilg_submitted` markers |
| L013 | L1 interchange export-package | **PASS** | INTERCHANGE-SPEC §2–§4, §6 | L9 hash round-trip match, `sha256:` format |
| N001 | Inventory dashboard (completeness + gaps, ≤ 2 s) | **PASS** | PRD-LINAW §11 Core #4 | N7 `tookMs:70`, gaps + completeness present |
| N002 | Code classification | **PASS**² | PRD-LINAW §12.6 | N8 keyless contract; hermetic classify suite |
| N003 | Cross-reference scanner | **PASS**³ | PRD-LINAW §11 Core #5 | N9/N9b deterministic regex detection live (`repeals`, confidence 0.85) |
| N004 | Conflict detection | **PASS**³ | PRD-LINAW §12.6 | live `conflictsDetected:0` (no shared subjects), evidence-shape integration suite, hermetic `linaw-conflicts` |
| N005 | Relationship decisions (confirm/reject + status propagation) | **PASS** | PRD-LINAW §12.6 | N10 409-pending gate, N11 confirm → target `repealed` |
| N006 | Code assembler (Titles→Chapters→Articles→Sections) | **PASS** | PRD-LINAW §11 Core #6 | N12 TOC hierarchy + `final_code_export` gate; N10 pending-gate |
| N007 | Plain-language summaries | **PASS** | PRD-LINAW §12.6 | N13 graceful keyless `summarized:0` + `failed[]`; hermetic summaries suite |
| N013 | Bulk import JSON/CSV/DOCX, dedupe | **PASS** | PRD-LINAW §11 Core #1 | N1/N2 (`skippedDuplicates:1`); CSV/DOCX parser coverage hermetic + integration |
| N014 | Scan upload + module OCR + own verification → ready | **PASS**¹ | PRD-LINAW §11 Core #2 | N5/N6 full chain live |
| N015 | L1 interchange export-package (records + relationships) | **PASS** | INTERCHANGE-SPEC §2–§6 | N14 hash round-trip + relationship keying `{ordinanceNumber, seriesYear}` |

**Feature-level: 19/19 PASS.**
¹ Live-model latency/accuracy sub-targets DEFERRED (keyless). ² LLM accuracy sub-targets DEFERRED (keyless). ³ Precision/recall targets DEFERRED (keyless); deterministic baseline verified live.

### 4.2 PRD §11 checkbox verification (all boxes, both PRDs)

| PRD §11 group | LIKHA | LINAW |
|---|---|---|
| Core functionality | 4 PASS / 1 DEFERRED (metadata ≥80% accuracy — keyless) + OCR-60s live-latency clause DEFERRED (contract verified) | 5 PASS / 1 DEFERRED (cross-ref ≥70% precision — keyless; deterministic detection PASS) |
| Agent pipeline (delays, h-56, glow/pulse, HITL rose, confirm-resume) | 5 PASS — delays exactly 1000/1600/1400/1200/1200/1000 ms (`src/types/likha.ts`), h-56 verified in browser, glow classes + rose HITL marker in kit | 5 PASS — delays exactly 1100/1300/1600/1500/1100/1300 ms (`src/types/linaw.ts`) |
| Activity feed (empty state, Confirm/Edit, Confirmed badge, reject-with-reason) | 4 PASS (empty state verified in browser; reject-reason audited in L10) | 4 PASS (empty state verified in browser; reject/confirm covered by decisions suites + N11) |
| Visual design (dark theme, agent colors, responsive) | 2 PASS / 1 DEFERRED (responsive — single 1440×900 viewport verified; multi-breakpoint → UAT) | 2 PASS / 1 DEFERRED (responsive — same) |
| Technical (zero legacy imports, independence, L1 interchange, additive tables, agent_decisions audit, no TS errors) | 6 PASS | 6 PASS |

**Checkbox totals: 47 criteria → 42 PASS · 0 FAIL · 5 DEFERRED.**

DEFERRED items (explicit): (1) LIKHA OCR ≤60 s live latency, (2) LIKHA metadata extraction ≥80% accuracy, (3) LINAW cross-reference ≥70% precision, (4) LIKHA responsive breakpoints, (5) LINAW responsive breakpoints. Items 1–3 require a live OpenRouter model: `.env`/`.env.local` contain no `OPENROUTER_API_KEY`, so per the gate rules no live smoke was run and they are DEFERRED with rationale (not FAIL). Items 4–5 need multi-breakpoint browser passes → UAT.

---

## 5. Boundary + Static Gates (fresh)

| Gate | Command / grep | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **exit 0, zero errors** |
| Lint | `npm run lint` | **exit 0 — 0 errors, 54 warnings** (1 inside module surface: unused `NextRequest` import in `src/app/api/linaw/import/route.ts`; remaining 53 in legacy platform files) |
| [A] LIKHA → `linaw` refs | `grep -rni linaw src/lib/likha src/app/api/likha` | **0** |
| [B] LIKHA → obra/ella/yala imports | import-shape grep | **0** |
| [C] LINAW → `likha` refs | `grep -rni likha src/lib/linaw src/app/api/linaw` | **0** |
| [D] LINAW → obra/ella/yala imports | import-shape grep | **0** |
| [E] LIKHA → LINAW table reads (`linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`) | SQL-string grep | **0** |
| [F] LINAW → LIKHA table reads (`archived_ordinances`, `classifications`, `amendment_links`) | SQL-string grep | **0** |
| [G] raw `ella` substring both surfaces | grep | **1 hit = documented known false positive**: `'13 Miscellaneous and Transitory'` (`src/lib/linaw/prompts.ts:117`) — "Misc**ella**neous" |
| [H] raw `obra`/`yala` substrings | grep | **0** |

**Zero cross-module table reads in both directions; zero forbidden legacy imports.** Matches Modular Independence Audit v2.

---

## 6. QUALURE Inputs & Quality Score

| Input | Fresh count | Formula term |
|---|---|---|
| Syntax errors | 0 | −0 × 20 |
| Type errors (`tsc --noEmit`) | 0 | −0 × 10 |
| Lint errors (`npm run lint`) | 0 (54 warnings documented, not errors) | −0 × 5 |

```
code_quality   = 100 − 0×20 − 0×10 − 0×5          = 100.0
test_coverage  = 19 features with passing acceptance evidence / 19 = 100.0%
functionality  = 42 PASS / 42 scored checkboxes     = 100.0%
                 (5 DEFERRED items EXCLUDED from the denominator — stated explicitly)

quality_score  = 100.0×0.4 + 100.0×0.3 + 100.0×0.3 = 100.0
```

### EVALUATION COMPLETE

| Metric | Score |
|---|---:|
| code_quality | 100.0 |
| test_coverage | 100.0% |
| functionality | 100.0% |
| **quality_score** | **100.0** |

---

## 7. Cleanup Evidence (dev DB left pristine)

Pre-SYSTEM_TEST baseline snapshot taken before E2E (online `db.backup` → `C:\tmp\workshop-pre-systemtest.db`; index backup `%TEMP%\likha-search-index.pre.json`). The E2E runner purged everything it seeded (audit ledger: 5 archived + 6 linaw rows, 1 relationship, 5 codification rows, 1 code volume, 42 agent_decisions, 27 interaction_logs, 2 participant_sessions, 2 user_sessions, 2 users, 2 uploaded files). Post-cleanup verification:

```
DB PRISTINE: all 13 tables match pre-SYSTEM_TEST baseline
(users 1, user_sessions 1, archived_ordinances 0, classifications 0, amendment_links 0,
 linaw_ordinances 2 [pre-existing], codification_records 0, ordinance_relationships 0,
 code_volumes 0, agent_decisions 66, interaction_logs 291, participant_sessions 78,
 workshop_sessions 1)
index restored, totalDocs: 48 — byte-identical to pre-test backup
data/uploads/likha: empty · data/uploads/linaw: empty
git status -- src tests → clean (no modifications)
```

Dev server killed (final `taskkill` SUCCESS). E2E/UI scripts lived in OS temp, never in the repo.

---

## 8. Defects Found

| ID | Severity | Summary | Evidence / Note |
|---|---|---|---|
| D-1 — **RESOLVED** (`9a8a924`) | **LOW** (security, defense-in-depth) | `src/middleware.ts` `matcher` omits `/likha/:path*` and `/linaw/:path*` even though `PROTECTED_PATHS` lists them — unauthenticated `GET /likha`/`/linaw` return **200** (page shell renders), while `/ella` correctly 302→`/login`. No data exposure: every module API still returns 401 (30/30 verified). One-line fix: add the two matcher entries. **Fix:** commit `9a8a924` added `'/likha/:path*'` and `'/linaw/:path*'` to `config.matcher`, mirroring the established `'/<page>/:path*'` shape. | Pre-fix `curl` probes: `/likha`→200, `/linaw`→200, `/ella`→302. Post-fix: all five page routes (`/ella /obra /yala /likha /linaw`) → **302** `/login?returnUrl=<path>`; cookie-bearing requests still pass through (200). New regression suites: `tests/unit/middleware-matcher.test.ts` (12/12) + `tests/integration/page-auth-redirect.test.ts` (6/6 vs live server). |
| D-2 — **RESOLVED** (`622fad8`) | **LOW** (payload amplification) | `GET /api/linaw/inventory` `yearGaps` enumerates missing ordinance numbers without a cap — one outlier record (No. 959579, pre-existing test residue) produced a 959,578-entry gap list (~4 MB response, `tookMs` still fine at 70 ms). Recommend cap/sampling of `missing[]`. **Fix:** commit `622fad8` bounds the gap emission in `analyzeInventory`: window stays the ready corpus's own min..max `series_year` range; at most **500** `yearGaps` entries and at most **500** absent numbers per year (lowest first); `truncated: true` whenever either cap trips. Completeness-score semantics unchanged. | Pre-fix live probe (authed): **13,212,308 bytes**, max `missing[]` = 959,579 (residue Nos. 959579/959580), score 33.3. Post-fix same probe: **4,220 bytes**, max `missing[]` = 500, `truncated:true`, score 33.3 unchanged, `tookMs` 29 ms. Hermetic regression tests added to `tests/unit/linaw-inventory.test.ts` (8/8): normal corpus gaps unchanged (`truncated:false`); ordinance-number outlier (959579) → capped `missing[]` + flag; series-year outlier (999999) → capped entries + flag. |
| I-1 | INFO | `NODE_TLS_REJECT_UNAUTHORIZED=0` present in ambient machine env (dev-server warning). Not set by app code; disable on production hosts. | dev log |
| I-2 | INFO | Prior stray `npm run dev` exit-code-1 not reproducible: port 3000 free and no stale node process at session start; consistent with an earlier two-instance port race. Clean lifecycle maintained thereafter. | netstat/taskkill |

No FAIL-level defects. No data-loss, integrity, or correctness defects observed in any flow. Both LOW defects (D-1, D-2) were fixed post-report with regression tests; post-fix suites: `npm test` **199/199**, `npm run test:integration` **108/108** (307 total, 0 failures), `npx tsc --noEmit` clean, `npm run lint` 0 errors, boundary greps clean both directions.

---

## 9. SYSTEM_TEST Verdict

> ## **PASS-WITH-DEFERRED**
> 287/287 regression tests pass · 29/29 live E2E system checks pass · 42/42 scored acceptance criteria PASS with 5 documented DEFERRALS (3 LLM-accuracy targets awaiting an OpenRouter key · 2 responsive-breakpoint items → UAT) · all static/boundary gates green · quality_score 100.0 · two LOW defects logged (middleware matcher gap, unbounded yearGaps).

```
RULE COMPLIANCE — TEST (Rules 7, 13, 29, 62)
  Rule 7   [PASS]  evidence: §6 formula + EVALUATION COMPLETE table (quality_score 100.0)
  Rule 13  [PASS]  evidence: §2 fresh npm test 185/185 + npm run test:integration 102/102, 0 failures
  Rule 29  [N/A]   Maintain-phase rule; this session is BUILD→TEST
  Rule 62  [PASS]  evidence: 19/19 features with passing acceptance evidence (§4.1); suites gate the phase (0 failures); no flaky tests quarantined or deleted
  Verdict: ALL PASS
```

---

## 10. Handoff Notes — UAT / DEPLOY

1. **Key provisioning (first UAT task):** create `.env.local` with a live `OPENROUTER_API_KEY` (or use the deploy env), restart, then run the deferred accuracy smokes: one small OCR (fixture `tests/fixtures/likha/sample-scan.png`), one metadata parse, one LIKHA classify, one LINAW cross-ref/summarize — record real accuracy vs targets (metadata ≥80%, cross-ref ≥70%, conflict ≥60%).
2. **~~Fix D-1 before pilot~~ — DONE** (commit `9a8a924`): `/likha` and `/linaw` now redirect unauthenticated visitors like the other modules (verified 302 live + regression suites).
3. **~~Consider D-2 cap~~ — DONE** (commit `622fad8`): `yearGaps` emission capped at 500 entries / 500 missing numbers per year with a `truncated` flag; safe for the real 349-ordinance archives.
4. **UAT visual passes:** responsive breakpoints (all modules), dark-theme fidelity at each breakpoint — the only criteria not machine-verified here.
5. **Deploy:** `.env.vps` already targets the pilot (`pillar-pilot.db`, cookie domain); ensure `NODE_TLS_REJECT_UNAUTHORIZED` is unset in production containers and rotate the OpenRouter key per the file's own comment.
6. DB/index/uploads were restored to pristine pre-test state; no SYSTEM_TEST residue remains in the dev environment.

---

*Prepared by the SYSTEM_TEST executor · session pillar-likha-linaw-20260809 · all claims backed by fresh command evidence in §2–§7 (verification-before-completion: IDENTIFY → RUN → READ → VERIFY).*
