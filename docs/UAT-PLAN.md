# UAT PLAN — PILLAR (LIKHA + LINAW)

| | |
|---|---|
| **Project** | PILLAR-pilot Smart Legislation Platform — LIKHA (Digitization & Archive) + LINAW (Codification) |
| **Session** | `pillar-likha-linaw-20260809` |
| **Phase** | UAT Phase 7 Step 1 — TEST_PLANNER (Hackathon PRIME v2.5 UAT / Super PRIME v3.3) |
| **Quality mode** | **Expanded** — all built features (16 Must + 3 Should), target ≈95% criteria coverage |
| **Author** | @test_planner (UAT Test Planning & Traceability Agent) |
| **Date** | 2026-08-10 (MPST, UTC+8) |
| **Inputs** | docs/PRD-LIKHA.md (§11, §6.7, §12, §13) · docs/PRD-LINAW.md (§11, §6.8, §12, §13) · docs/IDEA-REPORT.md (§7–§10 MoSCoW) · docs/SYSTEM-TEST-REPORT.md (PASS-WITH-DEFERRED, 5 DEFERRED items) · docs/INTERCHANGE-SPEC.md (§11) |
| **Companion reports** | SYSTEM-TEST verdict: PASS-WITH-DEFERRED — 287/287 regression, 29/29 E2E, 42/42 scored criteria PASS, 5 DEFERRED → picked up by UAT-004/005/014/020/024/034 |

---

## 1. UAT Scope

### 1.1 In scope (MoSCoW)

| Tier | Features | Source |
|---|---|---|
| **Must (16)** | LIKHA: L001 batch upload, L002 OCR wrapper, L003 metadata parse, L004 human verification, L005 publish + BM25, L006 archive browser, L007 AI classification · LINAW: N001 inventory dashboard, N002 code classification, N003 cross-reference scanner, N004 conflict detection, N005 relationship confirmation, N006 code assembly, N007 summaries, N013 bulk import, N014 scan upload + own OCR | IDEA-REPORT §8–9 |
| **Should (3)** | L010 DILG MC 2026-041 export (`/api/likha/export-dilg`) · L013 LIKHA L1 interchange export (`/api/likha/export-package`) · N015 LINAW L1 interchange export (`/api/linaw/export-package`) | IDEA-REPORT §8; INTERCHANGE-SPEC §11 |
| **Cross-cutting** | Authentication & 401/302 protection, audit trail (`agent_decisions`), module independence / additive schema / TypeScript gates, responsive breakpoints, cleanup verification | PRD §11 Technical + §13 NFR; SYSTEM-TEST-REPORT §4.2 |

Critical gates receiving dedicated happy-path **and** edge/error cases: HITL approve/reject paths, duplicate rejection, 409 gates (`PENDING_RELATIONSHIPS`, `NOTHING_TO_ASSEMBLE`, duplicate conflicts), 401 protection, HITL pause/resume, Archiver gating (rejected data never published), assembler PENDING gate, `final_code_export` gate, L1 package-hash round-trip from the downloaded payload.

### 1.2 SYSTEM_TEST DEFERRED items picked up by this UAT

| # | Deferred item | UAT pick-up | Evidence type |
|---|---|---|---|
| 1 | LIKHA OCR ≤60 s live latency | UAT-004 (also UAT-020 for LINAW's own OCR) | Live-model timing on 1 small scan each |
| 2 | LIKHA metadata ≥80% accuracy | UAT-005 | Observed field accuracy on fixture first pages |
| 3 | LINAW cross-reference ≥70% precision | UAT-024 | Observed precision on 3 crafted records |
| 4 | LIKHA responsive breakpoints | UAT-014 | 1920×1080 / 768 / 360 viewports + touch-target spot checks |
| 5 | LINAW responsive breakpoints | UAT-034 | Same |

Accuracy targets (2, 3) are **observed-evidence cases** in UAT: the observed value on the small fixtures is recorded against the target, with the explicit caveat that statistical validation requires the LGU pilot batch (349 ordinances).

### 1.3 Out of scope

- **Could-Have features** (excluded per MoSCoW): L009 tag cloud, L011 mobile camera upload, L012 LightRAG ingestion, N010 dependency graph, N012 DILG codification export.
- **Won't-Have**: N011 code versioning.
- **Not built in this MVP** (Should backlog, deferred per build scope): L008 status tracking UI, N008 multi-step approval, N009 PDF/DOCX code-volume download (the `final_code_export` gate itself IS exercised in UAT-029).
- **L1 import** endpoints — post-MVP (INTERCHANGE-SPEC §9, belongs to LINYA engagement).
- Load/stress testing, penetration testing beyond the specified auth checks, WCAG contrast certification, multi-LGU tenancy, public FOI portal.
- Statistical validation of accuracy targets (fixtures are too small — see §1.2 caveat).

---

## 2. Test Environment

| Item | Value |
|---|---|
| **Target** | **PRODUCTION** — https://pillar.bayanaihan.net (deployed 2026-08-10; container healthy; `/api/health` 200 verified in pre-flight) |
| **Automation** | Playwright + Chromium, scripts executed locally against the live site (`uat_mode: automated`) |
| **Default viewport** | 1920×1080 unless a case states otherwise |
| **Screenshot convention** | `uat-screenshots/UAT-XXX-step-N.png` at 1920×1080; responsive cases use `UAT-XXX-vp-{1920x1080|768x1024|360x640}.png` |
| **Auth** | Dedicated UAT user `uat-likha-linaw@bayanaihan.net` bootstrapped directly in the production `users` table (scrypt password hash, `status='approved'`); login through the `/login` page (email/password → `POST /api/auth/user/login` → cookie `pillar_user_session`); **user row deleted after UAT** (UAT-041) |
| **Live AI** | OpenRouter key IS present in production → live paths (OCR, classification, cross-reference, summaries) are exercised with the bounded smoke in §4 |
| **Fixtures** | `tests/fixtures/likha/sample-ordinance.pdf`, `tests/fixtures/likha/sample-scan.png`, `tests/fixtures/linaw/sample-ordinance.pdf`, `tests/fixtures/linaw/sample-scan.png`, plus the crafted UAT-PROBE text fixtures defined in §5 |
| **DB evidence** | Read-only `sqlite3` queries on the VPS via SSH by the operator (production DB is not reachable from the tester's machine). Steps marked **[DB-SSH]** require the operator. |
| **Operator machine hygiene** | `NODE_TLS_REJECT_UNAUTHORIZED` MUST be unset in the local runner environment so TLS to production is properly validated (SYSTEM-TEST-REPORT I-1) |

### 2.1 Pre-flight (before UAT-001)

1. `GET https://pillar.bayanaihan.net/api/health` returns 200.
2. UAT user exists in production `users` with `status='approved'` **[DB-SSH]**.
3. **Baseline snapshot** **[DB-SSH]**: record row counts of `users, user_sessions, archived_ordinances, classifications, amendment_links, linaw_ordinances, codification_records, ordinance_relationships, code_volumes, agent_decisions, interaction_logs`; record BM25 index `totalDocs`; record file counts in `data/uploads/likha` and `data/uploads/linaw`. Store as `uat-baseline.json`.

---

## 3. Data-Handling & Cleanup Protocol (MANDATORY for every data-creating case)

1. **Prefix rule.** Every record, file name, title, or free-text field created by UAT MUST contain the marker `UAT-PROBE` (e.g., title `UAT-PROBE Test Ordinance 01`, filename `UAT-PROBE-scan-01.png`). Ordinance identifiers use reserved series years **2090–2099** and numbers **9901–9999** (outside the 1989–2025 pilot range) to avoid collisions with real data.
2. **Manifest.** Every created row/file/index entry is appended to `uat-probe-manifest.json` at creation time (table, id, file path, pipeline_id).
3. **Per-case cleanup.** Each data-creating case below carries an explicit cleanup step: purge its own rows via **[DB-SSH]** `DELETE` by manifest id, remove its uploaded files, remove its BM25 index entries — immediately after verification, unless the case feeds a later case (declared in its "Feeds" line).
4. **Session-end cleanup (UAT-041).** Anything still present is purged in bulk from the manifest; the UAT user and its sessions are deleted; counts are re-verified against `uat-baseline.json`.
5. **Never modify** any non-`UAT-PROBE` row. All destructive SQL is `DELETE ... WHERE id IN (<manifest ids>)` — no `UPDATE`/`TRUNCATE` on production data.

---

## 4. Bounded Live-Model Smoke (cost guard)

Live AI calls in this UAT are capped at:

| Call | Max |
|---|---|
| LIKHA OCR (1 small scan) | 1 |
| LINAW OCR (1 small scan) | 1 |
| LIKHA metadata parse / classify | parse within the 1 OCR run + classify ≤2 records |
| LINAW classify | ≤3 records |
| LINAW detect-relationships | ≤3 records |
| LINAW summarize | ≤2 records |

Retry rule: on an OpenRouter error/timeout, retry **once**. If it fails again, the model-quality sub-target is marked `BLOCKED-LIVE-MODEL` (not FAIL); the graceful-degradation contract (structured error, batch never crashes — SYSTEM-TEST-REPORT L3/L7/N5/N8/N13 posture) is what is then scored.

---

## 5. UAT-PROBE Fixtures (crafted data)

| Fixture | Content (exact) |
|---|---|
| **FX-IMPORT-A.json** | 3 records: (9901, 2090) "UAT-PROBE Solid Waste Management Ordinance", content includes `"...amending Ordinance No. 9902, S. 2091..."`, subject `environment`; (9902, 2091) "UAT-PROBE Tricycle Registration Ordinance", content includes `"...repealing Ordinance No. 9901, S. 2090..."`, subject `transport`; (9903, 2092) "UAT-PROBE Market Fee Ordinance", no references, subject `revenue` |
| **FX-IMPORT-B.json** | 2 records: (9901, 2090) exact duplicate of record 1 above; (9904, 2093) "UAT-PROBE Fire Safety Ordinance" |
| **FX-CONFLICT** | manual-entry pair, same subject `transport`: (9905, 2094) "UAT-PROBE Tricycle Franchise Ordinance" — "All tricycles operating in the municipality **must** be registered and display a franchise sticker."; (9906, 2095) "UAT-PROBE Tricycle Deregulation Ordinance" — "Tricycle operation in the municipality **shall not require** any registration or franchise sticker." |
| **Ground truth (UAT-005)** | Known first-page values of `tests/fixtures/likha/sample-ordinance.pdf` (ordinance number, series year, title, section count) as documented in `tests/fixtures/likha/` — executor reads the fixture's expected-metadata sidecar before scoring |
| **Ground truth (UAT-024)** | True relationships in FX-IMPORT-A: 9901→9902 (amends-style reference) and 9902→9901 (repeals). Record 9903 has none. Precision = correct detections ÷ total detections |

---

## 6. Test Cases

**Classification rules (apply to every case):**

- **PASS** — every Expected Result is observed and the listed evidence is captured.
- **FAIL** — any Expected Result is not met. Severity: **Critical** = auth bypass / unauthorized data access, rejected or bad data published, duplicate records accepted as new, package hash mismatch, data loss, or crash of a core flow; **High** = a critical gate misbehaves but no data corruption; **Medium** = degraded secondary behavior; **Low** = cosmetic.
- **BLOCKED** — precondition cannot be established in this environment (state conflict, live-model outage after one retry, missing operator access). Reason MUST be recorded; `BLOCKED-ENV` and `BLOCKED-LIVE-MODEL` are sub-labels. A BLOCKED case is re-attempted once at the end of its group before the verdict is finalized. BLOCKED ≠ PASS.
- Steps written as user actions; API-level probes (explicitly marked **[API]**) are executed with the authenticated session cookie via the Playwright request context.

### 6.1 Group A — LIKHA (UAT-001 … UAT-016)

---

#### UAT-001 — LIKHA batch upload happy path with per-file progress

| Field | Value |
|---|---|
| Feature/Module | L001 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 Core #1; L001 |
| Priority / Severity | Must / Critical |
| Preconditions | Logged in as UAT user (UAT-036); fixtures copied to runner temp as `UAT-PROBE-ordinance-01.pdf` (copy of sample-ordinance.pdf) and `UAT-PROBE-scan-01.png` (copy of sample-scan.png) |
| Test Data | The 2 files above |

**Steps / Expected:**
1. Open `/likha`. → LIKHA module loads: upload dropzone, 6 agent cards, activity feed visible. Screenshot `UAT-001-step-1.png`.
2. Drag both files into the dropzone. → Both files are accepted; a per-file progress indicator appears for each file. Screenshot `UAT-001-step-2.png`.
3. Wait for ingestion to finish (≤2 min). → Upload completes without browser timeout; response **[API]** `GET /api/likha/archive?archiveStatus=pending_review` lists 2 `UAT-PROBE` records with `processing/pending_review` status; batch accepted count = 2, each file has a hash. Screenshot `UAT-001-step-3.png`.
4. Record both record ids + file hashes in `uat-probe-manifest.json`. → Manifest updated.

**Evidence:** `UAT-001-step-1.png`, `UAT-001-step-2.png`, `UAT-001-step-3.png`; manifest entries.
**Cleanup:** None here — records feed UAT-003/004/005/006/007. Declared **Feeds: UAT-003 → UAT-007**.

---

#### UAT-002 — LIKHA upload enforces limits (file count, type, size)

| Field | Value |
|---|---|
| Feature/Module | L001 — LIKHA (edge/error) |
| Requirement Ref | PRD-LIKHA §11 Core #1; L001 |
| Priority / Severity | Must / High |
| Preconditions | Logged in; runner temp contains 12 tiny `UAT-PROBE-bulk-NN.png` files, one `UAT-PROBE-notes.txt`, one `UAT-PROBE-big.pdf` (21 MB) |

**Steps / Expected:**
1. Attempt to drop all 12 PNG files at once. → The 11th+ files are refused with a clear "maximum 10 files" message; no crash. Screenshot `UAT-002-step-1.png`.
2. Drop `UAT-PROBE-notes.txt`. → Rejected with an unsupported-type message naming PDF/JPG/PNG. Screenshot `UAT-002-step-2.png`.
3. Drop `UAT-PROBE-big.pdf`. → Rejected with a size-limit message (20 MB). Screenshot `UAT-002-step-3.png`.
4. **[API]** `GET /api/likha/archive?q=UAT-PROBE-bulk` → zero new records from the refused files. → No partial rows created.

**Evidence:** `UAT-002-step-1..3.png`; API response bodies.
**Cleanup:** Delete local temp files; no DB rows expected (verify count unchanged vs manifest).

---

#### UAT-003 — LIKHA duplicate scan re-upload is detected by hash (duplicate rejection gate)

| Field | Value |
|---|---|
| Feature/Module | L001 — LIKHA (critical gate: duplicate rejection) |
| Requirement Ref | PRD-LIKHA §11 Core #1; L001 dedupe; SYSTEM-TEST L2 |
| Priority / Severity | Must / Critical |
| Preconditions | UAT-001 records exist; original `UAT-PROBE-ordinance-01.pdf` available |

**Steps / Expected:**
1. **[API]** Re-upload the identical `UAT-PROBE-ordinance-01.pdf` via `POST /api/likha/upload`. → Response marks the file `status:"duplicate"` (duplicates: 1) and points at the existing record; no error crash. 
2. **[DB-SSH]** `SELECT COUNT(*) FROM archived_ordinances WHERE title LIKE '%UAT-PROBE%'` → unchanged from after UAT-001. → No second row created.
3. Screenshot `UAT-003-step-1.png` of the upload UI state if surfaced in the feed.

**Evidence:** Upload response JSON; DB count before/after; screenshot.
**Cleanup:** None (nothing created).

---

#### UAT-004 — LIKHA live OCR returns text within 60 seconds (DEFERRED pick-up #1)

| Field | Value |
|---|---|
| Feature/Module | L002 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 Core #2; L002; SYSTEM-TEST DEFERRED #1 |
| Priority / Severity | Must / High |
| Preconditions | UAT-001's `UAT-PROBE-scan-01.png` record exists in `pending_review/processing`; production OpenRouter key live |

**Steps / Expected:**
1. Start the LIKHA pipeline for the batch containing the scan (UI "Run pipeline" or **[API]** `POST /api/likha/pipeline` with the batch/record id). Record start timestamp. → Pipeline starts; OCR Extractor agent activates.
2. Wait for the OCR Extractor agent to complete; record completion timestamp. → Elapsed OCR time **≤ 60 seconds**; extracted text is non-empty and corresponds to the scan's content (contains recognizable ordinance words). Record observed latency in the case result.
3. If OpenRouter fails twice (per §4 retry rule): verify the batch degrades gracefully — record flagged with a structured error, pipeline does not crash → mark sub-target `BLOCKED-LIVE-MODEL`, score graceful degradation instead.

**Evidence:** `UAT-004-step-2.png` (pipeline mid-OCR); timing log entry `ocr_latency_s=<observed>`; extracted-text snippet saved to `uat-probe-manifest.json`.
**Cleanup:** Record feeds UAT-005/006 — no purge yet.

---

#### UAT-005 — LIKHA metadata extraction accuracy ≥80% on fixture first pages (DEFERRED pick-up #2)

| Field | Value |
|---|---|
| Feature/Module | L003 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 Core #3; L003; SYSTEM-TEST DEFERRED #2 |
| Priority / Severity | Must / High |
| Preconditions | UAT-004 OCR text exists for the PDF-derived record; ground-truth first-page values for `sample-ordinance.pdf` documented (ordinance number, series year, title, section count) |

**Steps / Expected:**
1. Open the record's extracted metadata (archive detail / verification view). → Ordinance number, series year, title, and section count fields are populated by the parser. Screenshot `UAT-005-step-1.png`.
2. Score each of the 4 fields against ground truth (exact match for number/year/section count; title = substantial match). → Field accuracy = correct ÷ 4. **Expected ≥80%** (i.e., at least 4/4 or, with a documented near-miss, ≥3.2/4). Record `metadata_accuracy_observed=<value>`.
3. Note in the case result: *statistical validation of the ≥80% target requires the LGU pilot batch; this is observed evidence on 1 fixture.*

**Evidence:** `UAT-005-step-1.png`; field-by-field comparison table in the case result.
**Cleanup:** Record feeds UAT-006 — no purge yet.

---

#### UAT-006 — HITL pause → side-by-side Approve-with-edit → pipeline resumes → published (Archiver gating, HITL pause/resume)

| Field | Value |
|---|---|
| Feature/Module | L004 + L005 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 Core #4; Agent Pipeline #4, #5; Activity Feed #2, #3; L004/L005; §12.4 HITL gates |
| Priority / Severity | Must / Critical |
| Preconditions | Pipeline run from UAT-004/005 reaches a HITL gate (low-confidence metadata or classification) on the UAT-PROBE record |

**Steps / Expected:**
1. Observe the pipeline when the gate fires. → Pipeline **pauses**; a **rose-bordered** "Review Required" card appears in the activity feed with **Confirm** and **Edit** buttons. Screenshot `UAT-006-step-1.png`.
2. Click Review/Edit and open the side-by-side view. → Original scan on the left, extracted text on the right; metadata fields editable. Screenshot `UAT-006-step-2.png`.
3. Edit the title to append `[verified]` (keep `UAT-PROBE` prefix), then Confirm/Approve the item. → Decision accepted; pipeline **resumes**; upstream agents reset to idle, downstream agents continue to completion. Screenshot `UAT-006-step-3.png`.
4. After completion, confirm the record state via **[API]** `GET /api/likha/archive/:id`. → `archive_status='published'`, `verified_by_id` = UAT user id, file hash cached, and a **Confirmed** badge shows on the activity card.
5. **[DB-SSH]** `SELECT action,user_id,reason,created_at FROM agent_decisions WHERE module='likha' AND pipeline_id='<run>' AND action IN ('hitl','confirm')` → confirm row exists with the UAT user id and a timestamp. → Audit logged.

**Evidence:** `UAT-006-step-1..3.png`; archive detail response; agent_decisions rows (record IDs in manifest).
**Cleanup:** Published record feeds UAT-008/012/015/016 — purge at UAT-041.

---

#### UAT-007 — HITL Reject path: rejected record never published, reason audited (Archiver gating)

| Field | Value |
|---|---|
| Feature/Module | L004 — LIKHA (critical gate: reject path) |
| Requirement Ref | PRD-LIKHA §11 Core #4; Activity Feed #4; L004; SYSTEM-TEST L10 |
| Priority / Severity | Must / Critical |
| Preconditions | A second UAT-PROBE record (the PDF record from UAT-001 if not published, else re-run pipeline on it) is at a HITL gate or in review |

**Steps / Expected:**
1. Open the record's review view and choose **Reject** with reason `UAT-PROBE reject: illegible fixture scan`. → Rejection accepted with the reason captured. Screenshot `UAT-007-step-1.png`.
2. **[API]** `GET /api/likha/archive/:id` → `archive_status='flagged'` (or rejected-equivalent), never `published`.
3. **[API]** `GET /api/likha/archive?q=UAT-PROBE` → the rejected record is **absent** from published search results. → No bad data published (Archiver gating).
4. **[DB-SSH]** `SELECT reason,user_id,created_at FROM agent_decisions WHERE module='likha' AND action='reject' ORDER BY created_at DESC LIMIT 1` → reason text matches, user_id = UAT user, timestamp present. Screenshot `UAT-007-step-4.png` of the DB result (operator).

**Evidence:** `UAT-007-step-1.png`, `UAT-007-step-4.png`; API + DB outputs.
**Cleanup:** Purge this record now: **[DB-SSH]** delete the `archived_ordinances` row, its `classifications` rows, its uploaded file, and its BM25 index entry (if any); update manifest.

---

#### UAT-008 — BM25 archive search <500 ms with highlighted snippets and filters

| Field | Value |
|---|---|
| Feature/Module | L006 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 Core #5; L006; SYSTEM-TEST L6 |
| Priority / Severity | Must / Critical |
| Preconditions | ≥1 published UAT-PROBE record from UAT-006 |

**Steps / Expected:**
1. In the archive browser, search a term known to exist in the published UAT-PROBE record (e.g., a distinctive content word). → Results return with the term **highlighted** (`<mark>`) in the snippet. Screenshot `UAT-008-step-1.png`.
2. Inspect response timing (**[API]** `GET /api/likha/archive?q=<term>` returns `tookMs`). → `tookMs` < 500. Record observed value.
3. Apply filters: year range (2090–2099), status, subject. → Result list narrows accordingly; the UAT-PROBE record appears under its filters; removing filters restores the list. Screenshot `UAT-008-step-3.png`.

**Evidence:** `UAT-008-step-1.png`, `UAT-008-step-3.png`; `tookMs` value in case result.
**Cleanup:** None (published record persists until UAT-041 by design — feeds exports).

---

#### UAT-009 — LIKHA pipeline visual: 6 agents sequential, delays, h-56 cards, glow/pulse

| Field | Value |
|---|---|
| Feature/Module | LIKHA agent pipeline presentation |
| Requirement Ref | PRD-LIKHA §11 Agent Pipeline #1, #2, #3 |
| Priority / Severity | Must / Medium |
| Preconditions | A pipeline run can be started on a UAT-PROBE record |

**Steps / Expected:**
1. Start a pipeline run and capture mid-run screenshots at ~1.5 s intervals. → Agents activate **sequentially** 1→6 (Ingestor → OCR Extractor → Metadata Parser → Subject Classifier → Legal Validator → Archiver), each showing color-matched **glow + opacity pulse** while processing. Evidence `UAT-009-step-1.png` … `UAT-009-step-4.png`.
2. Measure per-agent active durations from the run log/timestamps. → Delays approximate **1000/1600/1400/1200/1200/1000 ms** (±20% tolerance for live-network agents; exact base delays also confirmed in `src/types/likha.ts`).
3. Inspect rendered agent cards (**[API]** Playwright `boundingBox` on the 6 cards). → All six have uniform height **224 px (h-56)**. Record measured heights.

**Evidence:** `UAT-009-step-1..4.png`; measured heights + delay log.
**Cleanup:** Use a record already scheduled for later purge; no new rows.

---

#### UAT-010 — LIKHA activity feed: empty state, Confirm/Edit buttons, Confirmed badge

| Field | Value |
|---|---|
| Feature/Module | LIKHA activity feed |
| Requirement Ref | PRD-LIKHA §11 Activity Feed #1, #2, #3 |
| Priority / Severity | Must / Medium |
| Preconditions | Logged in |

**Steps / Expected:**
1. Open `/likha` in a fresh browser context (no activities yet in this context's feed view, or view before running any pipeline). → Empty-state message displays (LIKHA custom message: "Upload a batch to start the digitization pipeline." or equivalent). Screenshot `UAT-010-step-1.png`.
2. Run a batch that produces a HITL item (reuse UAT-006 flow timing or its evidence). → HITL/pending activity card shows **Confirm** and **Edit** buttons. (Covered by `UAT-006-step-1.png` if reused — cross-reference.)
3. After confirming, revisit the feed. → **Confirmed** badge displays on the item. (Cross-reference `UAT-006-step-3.png` or capture `UAT-010-step-3.png`.)

**Evidence:** `UAT-010-step-1.png` (+ cross-referenced or fresh `step-3`).
**Cleanup:** None.

---

#### UAT-011 — LIKHA verify-edit duplicate collision returns 409 (409 gate)

| Field | Value |
|---|---|
| Feature/Module | L004 — LIKHA (critical gate: 409 conflict) |
| Requirement Ref | PRD-LIKHA §11 Core #4 (edge); §12.6 PUT archive 409; SYSTEM-TEST L11 |
| Priority / Severity | Must / High |
| Preconditions | Two UAT-PROBE records exist (create a second via fresh single-file upload `UAT-PROBE-ordinance-02.pdf` if UAT-007's was purged) |

**Steps / Expected:**
1. Open record B in edit mode and change its (ordinance_number, series_year) to record A's values. Submit. → The UI surfaces a conflict error; **[API]** `PUT /api/likha/archive/:id` returns **409** with a message about conflicting ordinance number/series year. Screenshot `UAT-011-step-1.png`.
2. **[API]** `GET /api/likha/archive/:id` for record B → its number/series unchanged. → No overwrite occurred.

**Evidence:** `UAT-011-step-1.png`; 409 response body.
**Cleanup:** Purge record B (row + file + index entry) if it was created solely for this case; update manifest.

---

#### UAT-012 — LIKHA AI subject classification live + admin override

| Field | Value |
|---|---|
| Feature/Module | L007 — LIKHA |
| Requirement Ref | PRD-LIKHA §11 via §6.7 feature 7; L007; §12.6 `/api/likha/classify` |
| Priority / Severity | Must / High |
| Preconditions | ≥1 published UAT-PROBE record (from UAT-006) |

**Steps / Expected:**
1. **[API]** `POST /api/likha/classify` with the record id (live model). → Response contains **≥1 subject category with a confidence score** for the record. Record the suggested category + confidence.
2. Override the category in the UI (or **[API]**) to a different valid category. → Override accepted.
3. **[DB-SSH]** `SELECT category,confidence,assigned_by FROM classifications WHERE ordinance_id='<id>' ORDER BY created_at DESC LIMIT 1` → row shows the overridden category with `assigned_by` = UAT user id (not 'ai'). → Override stored with provenance.

**Evidence:** classify response JSON; `UAT-012-step-2.png` (override UI); DB row.
**Cleanup:** Delete classifications rows for the record (manifest); record itself persists to UAT-041.

---

#### UAT-013 — LIKHA dark theme + agent color fidelity

| Field | Value |
|---|---|
| Feature/Module | LIKHA visual design |
| Requirement Ref | PRD-LIKHA §11 Visual Design #1, #2 |
| Priority / Severity | Must / Low |
| Preconditions | Logged in; desktop viewport 1920×1080 |

**Steps / Expected:**
1. Open `/likha`; capture computed background colors. → Page body is dark-theme (dark-navy, e.g., `rgb(9,14,26)`-class), cards dark-slate (`#1E293B`-class), text light — matching the PRD §5 palette. Screenshot `UAT-013-step-1.png`.
2. Inspect the 6 agent cards' accent colors. → Colors match §6.6 spec: Ingestor `#F59E0B`, OCR Extractor `#10B981`, Metadata Parser `#8B5CF6`, Subject Classifier `#0EA5E9`, Legal Validator `#F43F5E`, Archiver `#6366F1`; all visually distinct.

**Evidence:** `UAT-013-step-1.png`; computed color values in case result.
**Cleanup:** None.

---

#### UAT-014 — LIKHA responsive breakpoints + touch targets (DEFERRED pick-up #4)

| Field | Value |
|---|---|
| Feature/Module | LIKHA responsive design |
| Requirement Ref | PRD-LIKHA §11 Visual Design #3; §10 breakpoint table; SYSTEM-TEST DEFERRED #4 |
| Priority / Severity | Must / Medium |
| Preconditions | Logged in; ≥1 record present so lists are non-empty |

**Steps / Expected:**
1. Viewport **1920×1080**: full layout (sidebar + pipeline + activity feed + detail panel). → No horizontal scroll; all panels visible. Evidence `UAT-014-vp-1920x1080.png`.
2. Viewport **768×1024** (tablet): verification panels 2-column, pipeline wraps horizontally. → Layout adapts per §10; no clipped controls. Evidence `UAT-014-vp-768x1024.png`.
3. Viewport **360×640** (mobile): agent cards stack vertically, simplified filters, hamburger sidebar. → All content reachable; no overflow. Evidence `UAT-014-vp-360x640.png`.
4. At 360×640, measure primary interactive targets (menu button, upload button, Confirm/Edit buttons, search input). → Each ≥ **44×44 px** (spot check; record measurements).

**Evidence:** 3 viewport screenshots + touch-target measurement table.
**Cleanup:** None.

---

#### UAT-015 — LIKHA DILG MC 2026-041 export package

| Field | Value |
|---|---|
| Feature/Module | L010 — LIKHA (Should) |
| Requirement Ref | IDEA-REPORT L010; PRD-LIKHA §6.7 Should + §12.6 `/api/likha/export-dilg`; SYSTEM-TEST L8 |
| Priority / Severity | Should / Medium |
| Preconditions | ≥1 published UAT-PROBE record |

**Steps / Expected:**
1. **[API]** `POST /api/likha/export-dilg` with the UAT-PROBE record id(s). → Download succeeds; payload manifest contains `submission:"DILG MC 2026-041"` (or equivalent) and `recordCount` ≥1 covering exactly the selected records.
2. **[DB-SSH]** `SELECT dilg_submitted FROM archived_ordinances WHERE id='<id>'` → flag set (1). → Submission marker recorded.

**Evidence:** Downloaded package saved as `UAT-015-export-dilg.json`; DB flag.
**Cleanup:** `dilg_submitted` flag reset only by row purge at UAT-041 (row is already manifest-owned).

---

#### UAT-016 — LIKHA L1 interchange export + SHA-256 round-trip from downloaded payload

| Field | Value |
|---|---|
| Feature/Module | L013 — LIKHA (Should, L1) |
| Requirement Ref | PRD-LIKHA §11 Technical L1; INTERCHANGE-SPEC §11 #1, #3, #4, #5; SYSTEM-TEST L9 |
| Priority / Severity | Should / High |
| Preconditions | ≥1 published UAT-PROBE record; local Node available for hash recompute |

**Steps / Expected:**
1. **[API]** `POST /api/likha/export-package` with body `{ "ordinanceIds": ["<uat-record-id>"] }`. → Response is a JSON download (`Content-Disposition: attachment`); saved as `UAT-016-package-filtered.json`.
2. Validate against INTERCHANGE-SPEC §2–§4: `manifest.schemaVersion="1.0.0"`, `manifest.module="likha"`, `interchangeLevel="L1"`, `exportedById`=UAT user, `source.recordCount == records.length`, each record has `ordinanceNumber, seriesYear, title, content, status, sourceType, fileHash, sourceRecordId`; `relationships` omitted or `[]`. → All fields conform.
3. Recompute the hash locally from the downloaded payload: `sha256(canonicalJson({ records }))` (keys sorted lexicographically, no insignificant whitespace) and compare with `packageHash`. → **Exact match**, and `packageHash` has the `sha256:` prefix. Record both values.
4. **[API]** Repeat with empty body (all eligible records) → package includes all published records; filtered package is a strict subset. → Filter and all-eligible behaviors both correct.
5. Verify export was logged: **[DB-SSH]** logger/interaction rows show module `likha` + UAT user id for the export action (or the audit evidence the route exposes).

**Evidence:** `UAT-016-package-filtered.json`, `UAT-016-package-all.json`; hash comparison output.
**Cleanup:** Downloaded files kept as evidence; no DB changes beyond manifest-tracked records.

---

### 6.2 Group B — LINAW (UAT-017 … UAT-035)

---

#### UAT-017 — LINAW bulk JSON import happy path → pending_review

| Field | Value |
|---|---|
| Feature/Module | N013 — LINAW |
| Requirement Ref | PRD-LINAW §11 Core #1; N013; §6.5; SYSTEM-TEST N1 |
| Priority / Severity | Must / Critical |
| Preconditions | Logged in; FX-IMPORT-A.json (§5) on disk |

**Steps / Expected:**
1. In the LINAW module, use Bulk Import with FX-IMPORT-A.json (or **[API]** `POST /api/linaw/import`). → Response `imported: 3, skippedDuplicates: 0`; per-record validation report returned without errors. Screenshot `UAT-017-step-1.png`.
2. **[API]** `GET /api/linaw/library?q=UAT-PROBE` → 3 records listed, all `library_status='pending_review'`, `source_type='import'`.
3. Record the 3 ids in the manifest.

**Evidence:** `UAT-017-step-1.png`; import response JSON.
**Cleanup:** Records feed UAT-020…029 — purge at UAT-041. **Feeds: UAT-018 → UAT-029.**

---

#### UAT-018 — LINAW import rejects duplicates on (ordinance_number, series_year) (duplicate rejection gate)

| Field | Value |
|---|---|
| Feature/Module | N013 — LINAW (critical gate: duplicate rejection) |
| Requirement Ref | PRD-LINAW §11 Core #1; N013; SYSTEM-TEST N2 |
| Priority / Severity | Must / Critical |
| Preconditions | UAT-017 imported (9901, 2090); FX-IMPORT-B.json on disk |

**Steps / Expected:**
1. Import FX-IMPORT-B.json. → Response `imported: 1, skippedDuplicates: 1`; the validation report names (9901, 2090) as the rejected duplicate. Screenshot `UAT-018-step-1.png`.
2. **[DB-SSH]** `SELECT COUNT(*) FROM linaw_ordinances WHERE ordinance_number=9901 AND series_year=2090` → exactly 1. → No duplicate row.
3. **[DB-SSH]** Confirm the new (9904, 2093) row exists with `library_status='pending_review'`. → Non-duplicate record accepted.

**Evidence:** `UAT-018-step-1.png`; response JSON; DB counts.
**Cleanup:** 9904 feeds later cases; purge at UAT-041.

---

#### UAT-019 — LINAW manual entry + duplicate 409 (409 gate)

| Field | Value |
|---|---|
| Feature/Module | LINAW manual entry |
| Requirement Ref | PRD-LINAW §11 Core #3; §6.5 manual entry; SYSTEM-TEST N3/N4 |
| Priority / Severity | Must / High |
| Preconditions | Logged in |

**Steps / Expected:**
1. Create a manual library entry via the LINAW form: ordinance 9905, series 2094, title/content from FX-CONFLICT (§5). → Created; `source_type='manual'`, `library_status='pending_review'`. Screenshot `UAT-019-step-1.png`.
2. Attempt a second manual entry with the same (9905, 2094). → **[API]** `PUT /api/linaw/library` returns **409 CONFLICT**; UI shows the conflict message; no second row (**[DB-SSH]** count = 1).
3. Repeat step 1 for 9906/2095 (second FX-CONFLICT record). → Created successfully.
4. Record both ids in the manifest.

**Evidence:** `UAT-019-step-1.png`; 409 response body; DB counts.
**Cleanup:** Records feed UAT-025 — purge at UAT-041.

---

#### UAT-020 — LINAW scan upload + module-owned OCR ≤60 s + own verification → ready

| Field | Value |
|---|---|
| Feature/Module | N014 — LINAW |
| Requirement Ref | PRD-LINAW §11 Core #2; N014; §6.5; SYSTEM-TEST N5/N6 |
| Priority / Severity | Must / Critical |
| Preconditions | `UAT-PROBE-linaw-scan.png` (copy of tests/fixtures/linaw/sample-scan.png) on disk; OpenRouter key live |

**Steps / Expected:**
1. Upload the scan via the LINAW upload dropzone (or **[API]** `POST /api/linaw/upload`). Record start time. → Upload accepted; row created `library_status='processing'`.
2. Wait for OCR completion (≤60 s expected; retry-once rule §4). → Extracted text returned within 60 s (record `linaw_ocr_latency_s`); row transitions to `pending_review`. If OCR fails twice: row still lands `pending_review` for human completion (graceful degradation) and the latency sub-target is `BLOCKED-LIVE-MODEL`.
3. Open LINAW's **own** verification panel (side-by-side scan vs extracted text where source exists). → Panel renders scan and extracted text; fields editable; Approve/Edit/Reject buttons present. Screenshot `UAT-020-step-3.png`.
4. Edit if needed, then **Approve**. → **[DB-SSH]** `library_status='ready'`, `verified_by_id`=UAT user. Screenshot `UAT-020-step-4.png`.
5. **[DB-SSH]** Audit: `agent_decisions`/decision log row for the approval carries user id + timestamp.

**Evidence:** `UAT-020-step-3.png`, `UAT-020-step-4.png`; latency value; DB rows.
**Cleanup:** Record feeds pipeline cases — purge at UAT-041.

---

#### UAT-021 — LINAW library verification reject path (bad data never enters pipeline)

| Field | Value |
|---|---|
| Feature/Module | N014 — LINAW (edge: reject) |
| Requirement Ref | PRD-LINAW §11 Core #2 + Activity Feed #4; §6.5 lifecycle; N014 |
| Priority / Severity | Must / High |
| Preconditions | One `pending_review` UAT-PROBE record available (use imported 9903 from FX-IMPORT-A) |

**Steps / Expected:**
1. Open 9903 in the verification panel and **Reject** with reason `UAT-PROBE reject: fixture control record`. → Rejection accepted. Screenshot `UAT-021-step-1.png`.
2. **[DB-SSH]** `SELECT library_status FROM linaw_ordinances WHERE id='<9903>'` → `rejected`.
3. **[API]** Run/refresh the pipeline-eligible view (`GET /api/linaw/library?libraryStatus=ready`). → The rejected record is **absent** from the ready set. → No bad data reaches the agents.
4. **[DB-SSH]** Decision log row carries reason + user id + timestamp.

**Evidence:** `UAT-021-step-1.png`; DB + API outputs.
**Cleanup:** Purge 9903 row + its decision rows now; update manifest.

---

#### UAT-022 — LINAW inventory dashboard ≤2 s with gaps + completeness, live refresh

| Field | Value |
|---|---|
| Feature/Module | N001 — LINAW |
| Requirement Ref | PRD-LINAW §11 Core #4; N001; SYSTEM-TEST N7 |
| Priority / Severity | Must / High |
| Preconditions | UAT-PROBE library records exist (from UAT-017/018) |

**Steps / Expected:**
1. Open the LINAW inventory dashboard. → Totals, counts by year/status/subject, year gaps, and completeness score display. Screenshot `UAT-022-step-1.png`.
2. **[API]** `GET /api/linaw/inventory` → response includes `totals`, `yearGaps`, `completenessScore`, and `tookMs` ≤ **2000**. Record observed `tookMs`.
3. Approve one more pending UAT-PROBE record (or create a manual one and approve it), then re-open/re-query the dashboard immediately. → Totals reflect the change within 2 seconds. Screenshot `UAT-022-step-3.png`.

**Evidence:** `UAT-022-step-1.png`, `UAT-022-step-3.png`; `tookMs` values.
**Cleanup:** Newly approved record joins manifest; purge at UAT-041.

---

#### UAT-023 — LINAW AI code classification live (≤3 records) + human override

| Field | Value |
|---|---|
| Feature/Module | N002 — LINAW |
| Requirement Ref | PRD-LINAW §6.8 feature 2; N002; §12.6 classify routes; SYSTEM-TEST N8 |
| Priority / Severity | Must / High |
| Preconditions | ≥2 `ready` UAT-PROBE records (9901, 9902, 9904, scan record) |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/classify` with the ids of 3 ready UAT-PROBE records (live model; §4 bound). → Each record receives a Title/Chapter (and Article where applicable) placement **with confidence score**; structured response, no crash.
2. For one record, override the placement via the UI or **[API]** `PUT /api/linaw/classify/:id` with a reason `UAT-PROBE override`. → Override accepted (200).
3. **[DB-SSH]** `SELECT title_number,chapter_number,human_override,cod_status,reviewed_by_id FROM codification_records WHERE ordinance_id='<id>'` → human override persisted, `cod_status` advanced (reviewed/approved), reviewer id = UAT user.

**Evidence:** classify response JSON; `UAT-023-step-2.png` (override UI); DB rows.
**Cleanup:** Codification rows are manifest-owned; purge at UAT-041.

---

#### UAT-024 — LINAW cross-reference detection, observed precision ≥70% (DEFERRED pick-up #3)

| Field | Value |
|---|---|
| Feature/Module | N003 — LINAW |
| Requirement Ref | PRD-LINAW §11 Core #5; N003; §6.6; SYSTEM-TEST DEFERRED #3 + N9/N9b |
| Priority / Severity | Must / High |
| Preconditions | Ready UAT-PROBE records 9901, 9902 (with explicit mutual references) and 9903-alternative control 9904 (no references); ground truth per §5 |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/detect-relationships` with the ids of the 3 records (live where the model path applies; deterministic regex baseline also acceptable). → Response `scanned: 3`, detections persisted, `hitlRequired: true` if relationships found. Screenshot `UAT-024-step-1.png` of the relationships UI queue.
2. **[API]** `GET /api/linaw/relationships?status=pending` → list detected relationships with type, section_ref, confidence, source/target metadata.
3. Score against ground truth: expected true refs = 9902→9901 (`repeals`, explicit "repealing Ordinance No. 9901, S. 2090") and 9901→9902 (amends-style "amending Ordinance No. 9902, S. 2091"); 9904 must yield none. **Precision = correct detections ÷ total detections ≥ 0.70.** Record `crossref_precision_observed=<value>`. Note: *statistical validation requires the LGU pilot batch; observed evidence only.*
4. Detected rows must be `confirmed: 0` (pending human decision). → HITL gate honored.

**Evidence:** `UAT-024-step-1.png`; detection response; precision computation table in case result.
**Cleanup:** Relationships feed UAT-026…029 — purge at UAT-041.

---

#### UAT-025 — LINAW conflict detection on same-subject contradiction

| Field | Value |
|---|---|
| Feature/Module | N004 — LINAW |
| Requirement Ref | PRD-LINAW §6.8 feature 4; N004; §6.6 exception rules |
| Priority / Severity | Must / High |
| Preconditions | FX-CONFLICT pair 9905/9906 (same subject `transport`, contradictory provisions) approved to `ready` (approve via verification panel if still pending) |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/detect-relationships` with 9905 + 9906 ids. → Detection completes without crash.
2. **[API]** `GET /api/linaw/conflicts` → **≥1 conflict flagged** between 9905 and 9906 with a confidence score and evidence (the opposing provisions) suitable for a side-by-side view. Screenshot `UAT-025-step-2.png` of the conflict UI.
3. If the live model flags 0 conflicts on this deliberately contradictory pair: record observed result and mark FAIL (model-quality observation) with the fixture evidence attached; do not waive silently.

**Evidence:** `UAT-025-step-2.png`; conflicts response JSON.
**Cleanup:** Conflict rows + 9905/9906 records manifest-owned; purge at UAT-041.

---

#### UAT-026 — LINAW confirm relationship → status propagation (HITL approve path)

| Field | Value |
|---|---|
| Feature/Module | N005 — LINAW (critical gate: HITL approve) |
| Requirement Ref | PRD-LINAW §6.8 feature 5; N005; §12.4 "Detected relationship" gate; SYSTEM-TEST N11 |
| Priority / Severity | Must / Critical |
| Preconditions | UAT-024 produced a pending `repeals` relationship 9902→9901 |

**Steps / Expected:**
1. Open the relationship queue; confirm the 9902→9901 `repeals` relationship (reason optional: `UAT-PROBE confirm`). → Confirmation accepted. Screenshot `UAT-026-step-1.png`.
2. **[DB-SSH]** `SELECT confirmed, confirmed_by_id FROM ordinance_relationships WHERE id='<rel>'` → `confirmed=1`, `confirmed_by_id`=UAT user.
3. **[DB-SSH]** `SELECT status FROM linaw_ordinances WHERE ordinance_number=9901 AND series_year=2090` → status flipped `active → repealed`. → Confirmed repeal propagates to the source/target ordinance status.
4. **[DB-SSH]** Decision audit row for the confirmation carries user id + timestamp.

**Evidence:** `UAT-026-step-1.png`; DB rows before/after.
**Cleanup:** Rows manifest-owned; purge at UAT-041.

---

#### UAT-027 — LINAW reject relationship with reason (HITL reject path)

| Field | Value |
|---|---|
| Feature/Module | N005 — LINAW (critical gate: HITL reject) |
| Requirement Ref | PRD-LINAW §6.8 feature 5; N005; Activity Feed #4 |
| Priority / Severity | Must / High |
| Preconditions | A second pending relationship exists (the 9901→9902 detection from UAT-024, or a conflict-derived item from UAT-025) |

**Steps / Expected:**
1. Reject the relationship with reason `UAT-PROBE reject: fixture pair under separate review`. → Rejection accepted. Screenshot `UAT-027-step-1.png`.
2. **[DB-SSH]** Row shows not confirmed (confirmed=0 / rejected state) and **no status change** on either ordinance. → Rejected relationship does not alter legal status.
3. **[DB-SSH]** Decision audit row carries the reason, user id, and timestamp.

**Evidence:** `UAT-027-step-1.png`; DB rows.
**Cleanup:** Rows manifest-owned; purge at UAT-041.

---

#### UAT-028 — Code assembler PENDING gate (409 while relationships await decision)

| Field | Value |
|---|---|
| Feature/Module | N006 — LINAW (critical gate: assembler PENDING) |
| Requirement Ref | PRD-LINAW §11 Core #6 (edge); §12.6 assemble; SYSTEM-TEST N10 |
| Priority / Severity | Must / Critical |
| Preconditions | **Execute immediately after UAT-024 and BEFORE UAT-026/027**, while ≥1 relationship is still pending |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/assemble` with body `{ "edition": "UAT-PROBE-2090s" }`. → Returns **409** with `code:"PENDING_RELATIONSHIPS"` and `pending: <n ≥ 1>`. Assembly is blocked. 
2. **[DB-SSH]** `SELECT COUNT(*) FROM code_volumes WHERE title LIKE '%UAT-PROBE%' OR edition LIKE '%UAT-PROBE%'` → 0. → No volume built while decisions are outstanding.
3. (Secondary probe) If at any point the eligible set is empty (no ready records with placements — e.g., in a fresh namespace), `POST /api/linaw/assemble` returns **409** `NOTHING_TO_ASSEMBLE`. If the environment always has eligible records, record this sub-check as `BLOCKED-ENV` with reason — not counted as FAIL.

**Evidence:** 409 response bodies saved to case result; DB count.
**Cleanup:** None (nothing created).

---

#### UAT-029 — Code assembly happy path: hierarchy + final_code_export gate

| Field | Value |
|---|---|
| Feature/Module | N006 — LINAW (critical gate: final_code_export) |
| Requirement Ref | PRD-LINAW §11 Core #6; N006; §12.4 "Final code export" gate; SYSTEM-TEST N12 |
| Priority / Severity | Must / Critical |
| Preconditions | All UAT-PROBE relationships decided (UAT-026/027 done); ≥1 codification placement exists (UAT-023); repealed record 9901 present |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/assemble` `{ "edition": "UAT-PROBE-2090s" }`. → Returns **200** with the TOC: hierarchy **Titles → Chapters → Articles → Sections** with counts, and response carries `gate: "final_code_export"` — signaling the volume is gated behind human approval before export. Record the TOC counts.
2. Verify the repealed ordinance (9901) is **excluded** from the assembled active text (excluded count/flag or absence from sections). → Repealed law not codified as active.
3. **[API]** `GET /api/linaw/code/:id` (volume id from step 1) → persisted structure parses back into the TOC; volume `status` is draft/under_review (not published). Screenshot `UAT-029-step-3.png` of the code preview UI.
4. **[DB-SSH]** `SELECT id,title,edition,status,generated_by_id FROM code_volumes WHERE id='<vol>'` → row exists, `generated_by_id`=UAT user. Add volume id to manifest.

**Evidence:** `UAT-029-step-3.png`; assemble response JSON; DB row.
**Cleanup:** Volume manifest-owned; purge at UAT-041.

---

#### UAT-030 — LINAW plain-language summaries live + human edit

| Field | Value |
|---|---|
| Feature/Module | N007 — LINAW |
| Requirement Ref | PRD-LINAW §6.8 feature 7; N007; §12.6 summarize; SYSTEM-TEST N13 |
| Priority / Severity | Must / Medium |
| Preconditions | ≥2 ready UAT-PROBE records; OpenRouter key live |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/summarize/:id` (or batch equivalent) for 2 records (§4 bound). → Each returns a **2–3 sentence plain-language summary**; `summarized` count ≥1. If keyless/error fallback appears (structured `failed[]`), retry once, else `BLOCKED-LIVE-MODEL` with graceful-degradation scored.
2. Edit one summary via the UI (or **[API]** `PUT /api/linaw/library/:id` with the summary field), appending ` [UAT-PROBE edited]`. → Edit persists (re-fetch shows edited text). Screenshot `UAT-030-step-2.png`.

**Evidence:** `UAT-030-step-2.png`; summarize response JSON.
**Cleanup:** Records manifest-owned; purge at UAT-041.

---

#### UAT-031 — LINAW pipeline visual: 6 agents sequential, delays, h-56 cards, glow/pulse

| Field | Value |
|---|---|
| Feature/Module | LINAW agent pipeline presentation |
| Requirement Ref | PRD-LINAW §11 Agent Pipeline #1, #2, #3 |
| Priority / Severity | Must / Medium |
| Preconditions | A LINAW pipeline run can be triggered on UAT-PROBE records |

**Steps / Expected:**
1. Start the pipeline; capture mid-run screenshots at ~1.5 s intervals. → Agents activate sequentially 1→6 (Inventory Analyst → Code Classifier → Cross-Reference Scanner → Conflict Detector → Relationship Reviewer → Code Assembler) with color-matched glow + opacity pulse. Evidence `UAT-031-step-1.png` … `UAT-031-step-4.png`.
2. Measure active durations. → Delays approximate **1100/1300/1600/1500/1100/1300 ms** (±20% tolerance; exact bases in `src/types/linaw.ts`); total ≈7.9 s for the presentation layer.
3. Measure the 6 cards' rendered heights. → All **224 px (h-56)**.

**Evidence:** `UAT-031-step-1..4.png`; measurements.
**Cleanup:** None beyond manifest-tracked records.

---

#### UAT-032 — LINAW activity feed + HITL rose cards: pause/resume, buttons, badges

| Field | Value |
|---|---|
| Feature/Module | LINAW activity feed + HITL presentation |
| Requirement Ref | PRD-LINAW §11 Agent Pipeline #4, #5; Activity Feed #1, #2, #3 |
| Priority / Severity | Must / High |
| Preconditions | LINAW run that produces HITL items (UAT-024-style detection) available |

**Steps / Expected:**
1. Open `/linaw` in a fresh context before any activity. → Empty-state message displays. Screenshot `UAT-032-step-1.png`.
2. During/after a detection run, observe the feed. → HITL cards render with **rose borders**; pipeline shows paused at the Relationship Reviewer stage; cards expose **Confirm** and **Edit** buttons. Screenshot `UAT-032-step-2.png`.
3. Confirm one item (cross-reference UAT-026 if same item). → Agents reset to idle, downstream agents resume, and a **Confirmed** badge appears on the card. Screenshot `UAT-032-step-3.png`.

**Evidence:** `UAT-032-step-1..3.png`.
**Cleanup:** None.

---

#### UAT-033 — LINAW dark theme + agent color fidelity

| Field | Value |
|---|---|
| Feature/Module | LINAW visual design |
| Requirement Ref | PRD-LINAW §11 Visual Design #1, #2 |
| Priority / Severity | Must / Low |
| Preconditions | Logged in; desktop viewport |

**Steps / Expected:**
1. Open `/linaw`; capture computed colors. → Dark theme consistent with PRD §5 palette (dark-navy body, dark-slate cards). Screenshot `UAT-033-step-1.png`.
2. Inspect the 6 agent accents. → Match §6.7: Inventory `#F59E0B`, Code Classifier `#8B5CF6`, Cross-Reference `#10B981`, Conflict Detector `#F43F5E`, Relationship Reviewer `#22D3EE`, Code Assembler `#6366F1`; all distinct.

**Evidence:** `UAT-033-step-1.png`; computed color table.
**Cleanup:** None.

---

#### UAT-034 — LINAW responsive breakpoints + touch targets (DEFERRED pick-up #5)

| Field | Value |
|---|---|
| Feature/Module | LINAW responsive design |
| Requirement Ref | PRD-LINAW §11 Visual Design #3; §10; SYSTEM-TEST DEFERRED #5 |
| Priority / Severity | Must / Medium |
| Preconditions | Logged in; library non-empty |

**Steps / Expected:**
1. Viewport **1920×1080** → full layout, no horizontal scroll. Evidence `UAT-034-vp-1920x1080.png`.
2. Viewport **768×1024** → 2-column verification panels, pipeline wraps. Evidence `UAT-034-vp-768x1024.png`.
3. Viewport **360×640** → stacked agent cards, simplified filters, hamburger sidebar; no overflow. Evidence `UAT-034-vp-360x640.png`.
4. At 360×640, spot-check primary targets (menu, import/upload buttons, Confirm/Edit, relationship decision buttons). → Each ≥ **44×44 px**; record measurements.

**Evidence:** 3 viewport screenshots + measurement table.
**Cleanup:** None.

---

#### UAT-035 — LINAW L1 interchange export + SHA-256 round-trip + confirmed relationships

| Field | Value |
|---|---|
| Feature/Module | N015 — LINAW (Should, L1) |
| Requirement Ref | PRD-LINAW §11 Technical L1; INTERCHANGE-SPEC §11 #2, #3, #4, #5; SYSTEM-TEST N14 |
| Priority / Severity | Should / High |
| Preconditions | ≥1 ready UAT-PROBE record; ≥1 **confirmed** relationship (from UAT-026) |

**Steps / Expected:**
1. **[API]** `POST /api/linaw/export-package` with `{ "ordinanceIds": [<ready record ids>] }` → download saved as `UAT-035-package-filtered.json`; `Content-Disposition: attachment`.
2. Validate INTERCHANGE-SPEC §2–§5: manifest fields (`schemaVersion 1.0.0`, `module linaw`, `interchangeLevel L1`, `recordCount == records.length`); records conform to §4; **`relationships` array includes the confirmed repeal keyed by `{ordinanceNumber, seriesYear}` pairs — never internal ids**, with `type`, `confidence`, `confirmedById`.
3. Recompute `sha256(canonicalJson({ records, relationships }))` from the downloaded payload; compare to `packageHash`. → **Exact match** with `sha256:` prefix. Record both values.
4. **[API]** Repeat with empty body → all eligible (ready) records included; filtered package is a subset. → Filter behavior correct.
5. Verify export logging (module `linaw` + UAT user id) via the audit evidence the route exposes **[DB-SSH]**.

**Evidence:** `UAT-035-package-filtered.json`, `UAT-035-package-all.json`; hash comparison output.
**Cleanup:** Downloaded files kept as evidence.

---

### 6.3 Group C — Cross-cutting (UAT-036 … UAT-041)

---

#### UAT-036 — Auth bootstrap verification + login happy path

| Field | Value |
|---|---|
| Feature/Module | Authentication (both modules) |
| Requirement Ref | PRD-LIKHA/LINAW §12.6 (all routes `withUserAuth`) + §13 Security; SYSTEM-TEST-REPORT §1 auth mechanism |
| Priority / Severity | Must / Critical |
| Preconditions | UAT user bootstrapped in production `users` (scrypt hash, `status='approved'`, email `uat-likha-linaw@bayanaihan.net`); runner environment has `NODE_TLS_REJECT_UNAUTHORIZED` unset |

**Steps / Expected:**
1. **[DB-SSH]** Confirm the user row exists with `status='approved'`. → Bootstrap verified; record user id in manifest.
2. Open `https://pillar.bayanaihan.net/login`; enter the UAT email + password; submit. → `POST /api/auth/user/login` succeeds; browser lands on the authenticated app (dashboard/home); cookie `pillar_user_session` is set (HttpOnly). Screenshot `UAT-036-step-2.png`.
3. Open `/likha` and `/linaw`. → Both module pages render (200) for the authenticated user. Screenshot `UAT-036-step-3.png`.
4. Persist the session cookie/storage state to `uat-auth-state.json` for the remaining automated cases.

**Evidence:** `UAT-036-step-2.png`, `UAT-036-step-3.png`; auth state file.
**Cleanup:** None (user deleted in UAT-041).

---

#### UAT-037 — Login failure with wrong credentials + logout

| Field | Value |
|---|---|
| Feature/Module | Authentication (error path) |
| Requirement Ref | PRD §13 Security; §12.6 auth |
| Priority / Severity | Must / Critical |
| Preconditions | Fresh browser context (no session) |

**Steps / Expected:**
1. On `/login`, submit the UAT email with a **wrong** password. → Clear error message; no session cookie set; user remains unauthenticated. Screenshot `UAT-037-step-1.png`.
2. Submit with an empty email field. → Validation error; no request-induced session. 
3. Log in correctly, then use the app's logout. → Session cleared; a subsequent `/likha` visit redirects to `/login`. Screenshot `UAT-037-step-3.png`.

**Evidence:** `UAT-037-step-1.png`, `UAT-037-step-3.png`.
**Cleanup:** Re-login restores `uat-auth-state.json`.

---

#### UAT-038 — 401 protection on all module APIs + page redirects (unauthenticated)

| Field | Value |
|---|---|
| Feature/Module | Cross-cutting security gate |
| Requirement Ref | PRD-LIKHA/LINAW §12.6 + §13 Security; SYSTEM-TEST cross-cutting 401 matrix (30/30) + D-1 fix |
| Priority / Severity | Must / Critical |
| Preconditions | Fresh browser context with **no** session cookie; run before login or after logout |

**Steps / Expected:**
1. **[API]** Without a session cookie, probe every LIKHA route (`upload, archive, archive/:id, pipeline, classify, stats, export-dilg, export-package` + GET/PUT variants) and every LINAW route (`upload, import, library, library/:id, inventory, classify, classify/:id, detect-relationships, relationships, relationships/:id, conflicts, assemble, code/:id, summarize/:id, export-package`) — 30 routes. → **Every route returns 401** with `{ code: "NO_SESSION" }` (or equivalent JSON error); zero 200s. Record the 30-route result table.
2. Without a cookie, request pages `/likha`, `/linaw`, `/ella`, `/obra`, `/yala`. → Each returns **302 → /login?returnUrl=<path>** (D-1 middleware fix verified in production). Screenshot `UAT-038-step-2.png` of one redirect capture.
3. With cookie, repeat one probe → 200. → Auth gate is session-driven, not a blanket block.

**Evidence:** 30-route status table in case result; `UAT-038-step-2.png`.
**Cleanup:** None.

---

#### UAT-039 — Audit trail completeness: agent_decisions carries user id + timestamp

| Field | Value |
|---|---|
| Feature/Module | Cross-cutting auditability |
| Requirement Ref | PRD-LIKHA §11 Technical (audit) + PRD-LINAW §11 Technical (audit); §12.3 schema both PRDs |
| Priority / Severity | Must / High |
| Preconditions | UAT pipeline runs with human decisions exist (UAT-006, UAT-007, UAT-026, UAT-027 done) |

**Steps / Expected:**
1. **[DB-SSH]** For each UAT pipeline_id (manifest): `SELECT action, agent_name, user_id, reason, created_at FROM agent_decisions WHERE pipeline_id='<id>' ORDER BY created_at`. → Rows exist for agent actions (`start`/`complete`/`hitl`/`error`) and for every human decision (`confirm`/`reject`); human-decision rows have **non-null user_id** (= UAT user) and **non-null created_at**; reject/override rows carry the reason text.
2. **[DB-SSH]** `SELECT COUNT(*) FROM agent_decisions WHERE module IN ('likha','linaw') AND pipeline_id IN (<uat runs>) AND (created_at IS NULL OR (action IN ('confirm','reject') AND user_id IS NULL))` → **0**. → No audit holes.

**Evidence:** Query outputs saved in case result (operator screenshots acceptable).
**Cleanup:** Audit rows purged with the rest at UAT-041.

---

#### UAT-040 — Module independence, additive schema, zero legacy imports, TypeScript gate

| Field | Value |
|---|---|
| Feature/Module | Cross-cutting technical gates |
| Requirement Ref | PRD-LIKHA §11 Technical #1, #2, #4, #6; PRD-LINAW §11 Technical #1, #2, #4, #6; SYSTEM-TEST §5 gates A–H |
| Priority / Severity | Must / High |
| Preconditions | Local repo checked out at the **deployed commit** (the commit running on pillar.bayanaihan.net) |

**Steps / Expected:**
1. `grep -rni linaw src/lib/likha src/app/api/likha` → **0 hits**; `grep -rni likha src/lib/linaw src/app/api/linaw` → **0 hits** (cross-module references).
2. Import-shape grep for `obra|ella|yala` inside `src/lib/likha`, `src/app/api/likha`, `src/lib/linaw`, `src/app/api/linaw` → **0 real imports** (the documented false positive `Miscellaneous` in `src/lib/linaw/prompts.ts` may appear for raw `ella` substring — verify it is the only one).
3. SQL-string grep: no LIKHA surface reads `linaw_ordinances|codification_records|ordinance_relationships|code_volumes`; no LINAW surface reads `archived_ordinances|classifications|amendment_links` → **0 hits each**.
4. Inspect `src/lib/db.ts` → all LIKHA/LINAW tables use `CREATE TABLE IF NOT EXISTS` (additive); no ALTER/drop of pre-existing tables.
5. `npx tsc --noEmit` at the deployed commit → **exit 0, zero errors**.

**Evidence:** Command outputs recorded verbatim in the case result.
**Cleanup:** None.

---

#### UAT-041 — End-of-session cleanup verification + UAT user deletion

| Field | Value |
|---|---|
| Feature/Module | Cross-cutting data-handling protocol |
| Requirement Ref | This plan §3 (data-handling & cleanup protocol) |
| Priority / Severity | Must / Critical |
| Preconditions | All other cases finished; `uat-probe-manifest.json` complete; `uat-baseline.json` from pre-flight available |

**Steps / Expected:**
1. **[DB-SSH]** Purge every manifest-owned row: `archived_ordinances`, `classifications`, `amendment_links`, `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, plus `agent_decisions` and `interaction_logs` rows created by UAT pipeline runs — each `DELETE ... WHERE id IN (<manifest ids>)` (or pipeline_id-scoped for audit tables). → All deletes succeed.
2. **[DB-SSH]** `SELECT COUNT(*) FROM archived_ordinances WHERE title LIKE '%UAT-PROBE%'` and equivalents on every table for the 2090–2099 / 9901–9999 marker ranges → **0 across all tables**.
3. Remove uploaded fixture files from `data/uploads/likha` and `data/uploads/linaw` (by manifest file hashes); remove UAT-PROBE entries from the BM25 search index; confirm a `q=UAT-PROBE` search returns zero hits on both modules' search endpoints.
4. **[DB-SSH]** Delete the UAT user: remove `users` row for `uat-likha-linaw@bayanaihan.net` and its `user_sessions` rows. → `SELECT COUNT(*) FROM users WHERE email='uat-likha-linaw@bayanaihan.net'` = 0.
5. **[DB-SSH]** Re-count all 11 baseline tables + index `totalDocs` + uploads file counts; diff against `uat-baseline.json`. → **Zero residue** (counts equal to baseline; any unavoidable delta explained and documented).
6. Archive evidence: move `uat-screenshots/`, `uat-probe-manifest.json`, downloaded packages into the UAT evidence bundle.

**Evidence:** Before/after count table; zero-residue query outputs; user-deletion confirmation.
**Cleanup:** This case IS the cleanup.

---

## 7. Requirements Traceability Matrix (RTM)

**Criteria key:** PRD-LIKHA §11 = LK-… · PRD-LINAW §11 = LN-… · INTERCHANGE-SPEC §11 = IX-… (53 criteria total: 23 LIKHA + 24 LINAW + 6 interchange).

### 7.1 PRD-LIKHA §11

| Req ID | Acceptance Criterion (abridged) | MoSCoW | Test Case IDs | Status |
|---|---|---|---|---|
| LK-C1 | Upload accepts 1–10 files ≤20 MB, per-file progress | Must | UAT-001, UAT-002, UAT-003 | Covered |
| LK-C2 | OCR wrapper returns text ≤60 s (supported types) | Must | UAT-004 | Covered (DEFERRED pick-up #1) |
| LK-C3 | Metadata extraction ≥80% accuracy on clear first pages | Must | UAT-005 | Covered (DEFERRED pick-up #2) |
| LK-C4 | Side-by-side verification Approve/Edit/Reject + audit logging | Must | UAT-006, UAT-007, UAT-011, UAT-039 | Covered |
| LK-C5 | BM25 search <500 ms with highlighted snippets | Must | UAT-008 | Covered |
| LK-P1 | 6 agents sequential with delays 1000/1600/1400/1200/1200/1000 ms | Must | UAT-009 | Covered |
| LK-P2 | Agent cards uniform h-56 (224 px) | Must | UAT-009 | Covered |
| LK-P3 | Color-matched glow + opacity pulse during processing | Must | UAT-009 | Covered |
| LK-P4 | HITL gates pause pipeline; rose-bordered activity cards | Must | UAT-006, UAT-010 | Covered |
| LK-P5 | Confirm resets agents to idle, resumes downstream | Must | UAT-006 | Covered |
| LK-A1 | Activity feed empty-state message | Must | UAT-010 | Covered |
| LK-A2 | Confirm and Edit buttons on HITL/pending activities | Must | UAT-006, UAT-010 | Covered |
| LK-A3 | Confirmed badge after confirmation | Must | UAT-006, UAT-010 | Covered |
| LK-A4 | Rejected items logged with reason; bad data never published | Must | UAT-007 | Covered |
| LK-V1 | Dark theme matches palette spec | Must | UAT-013 | Covered |
| LK-V2 | Agent colors distinct + match color system | Must | UAT-013 | Covered |
| LK-V3 | Responsive layout at all breakpoints | Must | UAT-014 | Covered (DEFERRED pick-up #4) |
| LK-T1 | Zero imports from obra/ella/yala | Must | UAT-040 | Covered |
| LK-T2 | Module independence (grep-verified, no cross-table reads) | Must | UAT-040 | Covered |
| LK-T3 | L1 interchange export per INTERCHANGE-SPEC (Should) | Should | UAT-016 | Covered |
| LK-T4 | All new tables additive; existing untouched | Must | UAT-040 | Covered |
| LK-T5 | All agent decisions logged with user id + timestamp | Must | UAT-007, UAT-039 | Covered |
| LK-T6 | No TypeScript errors | Must | UAT-040 | Covered |

### 7.2 PRD-LINAW §11

| Req ID | Acceptance Criterion (abridged) | MoSCoW | Test Case IDs | Status |
|---|---|---|---|---|
| LN-C1 | Bulk import JSON/CSV/DOCX ≤500 → pending_review; duplicates rejected on (number, series_year) | Must | UAT-017, UAT-018 | Covered |
| LN-C2 | Scan upload ≤10 files ≤20 MB; module OCR ≤60 s; own verification → ready | Must | UAT-020 | Covered |
| LN-C3 | Manual entry creates record with source_type='manual' | Must | UAT-019 | Covered |
| LN-C4 | Inventory dashboard updates within 2 s | Must | UAT-022 | Covered |
| LN-C5 | Cross-reference scanner ≥70% precision on explicit refs | Must | UAT-024 | Covered (DEFERRED pick-up #3) |
| LN-C6 | Code assembler produces valid Titles→Chapters→Articles→Sections | Must | UAT-028, UAT-029 | Covered |
| LN-P1 | 6 agents sequential with delays 1100/1300/1600/1500/1100/1300 ms | Must | UAT-031 | Covered |
| LN-P2 | Agent cards uniform h-56 (224 px) | Must | UAT-031 | Covered |
| LN-P3 | Color-matched glow + opacity pulse | Must | UAT-031 | Covered |
| LN-P4 | HITL gates pause pipeline; rose-bordered cards | Must | UAT-032 | Covered |
| LN-P5 | Confirm resets agents to idle, resumes downstream | Must | UAT-032 | Covered |
| LN-A1 | Empty-state message | Must | UAT-032 | Covered |
| LN-A2 | Confirm and Edit buttons on HITL/pending activities | Must | UAT-032 | Covered |
| LN-A3 | Confirmed badge after confirmation | Must | UAT-032 | Covered |
| LN-A4 | Rejected items logged with reason; bad data never published | Must | UAT-021, UAT-027 | Covered |
| LN-V1 | Dark theme matches palette spec | Must | UAT-033 | Covered |
| LN-V2 | Agent colors distinct + match color system | Must | UAT-033 | Covered |
| LN-V3 | Responsive layout at all breakpoints | Must | UAT-034 | Covered (DEFERRED pick-up #5) |
| LN-T1 | Zero imports from obra/ella/yala | Must | UAT-040 | Covered |
| LN-T2 | Module independence (grep-verified, no cross-table reads) | Must | UAT-040 | Covered |
| LN-T3 | L1 interchange export per INTERCHANGE-SPEC (Should) | Should | UAT-035 | Covered |
| LN-T4 | All new tables additive; existing untouched | Must | UAT-040 | Covered |
| LN-T5 | All agent decisions logged with user id + timestamp | Must | UAT-026, UAT-027, UAT-039 | Covered |
| LN-T6 | No TypeScript errors | Must | UAT-040 | Covered |

### 7.3 INTERCHANGE-SPEC §11 (export acceptance)

| Req ID | Acceptance Criterion (abridged) | MoSCoW | Test Case IDs | Status |
|---|---|---|---|---|
| IX-1 | `/api/likha/export-package` returns package per §2–§4, §6 (manifest + hash) | Should | UAT-016 | Covered |
| IX-2 | `/api/linaw/export-package` returns package per §2–§6 incl. confirmed relationships | Should | UAT-035 | Covered |
| IX-3 | packageHash recomputation from downloaded payload succeeds (round-trip) | Should | UAT-016, UAT-035 | Covered |
| IX-4 | ordinanceIds filters records; omitted → all eligible records | Should | UAT-016, UAT-035 | Covered |
| IX-5 | Exports logged with module + user id; routes require authentication | Should | UAT-016, UAT-035, UAT-038 | Covered |
| IX-6 | No cross-module table/route references in package building | Should | UAT-040 | Covered |

### 7.4 Coverage summary

| Tier | Criteria | Covered | Coverage |
|---|---:|---:|---:|
| Must (PRD §11 both modules) | 45 | 45 | **100%** |
| Should (LK-T3, LN-T3 + INTERCHANGE §11) | 8 | 8 | **100%** |
| **OVERALL** | **53** | **53** | **100% mapped** |

**Coverage gaps: 0. Blockers: 0.** (Feature-level scope note: built-in-scope features = 19 (16 Must + 3 Should); Could/Won't/unbuilt Should features excluded per §1.3 — consistent with Expanded-mode ≈95% feature coverage of the IDEA-REPORT catalog.)

---

## 8. Execution Order (Must first, dependency-ordered)

| Order | Case | Rationale |
|---:|---|---|
| 1 | UAT-036 | Auth bootstrap + login — everything depends on it |
| 2 | UAT-037 | Login failure/logout (fresh context, before state is established) |
| 3 | UAT-038 | 401/302 unauthenticated matrix (must run cookie-free) |
| 4 | UAT-001 → UAT-003 | LIKHA create path: upload happy → limits → duplicate gate |
| 5 | UAT-004 → UAT-005 | LIKHA live OCR latency + metadata accuracy (needs UAT-001 records) |
| 6 | UAT-009 | LIKHA pipeline visuals captured during the run |
| 7 | UAT-006 → UAT-010 → UAT-007 | LIKHA HITL: approve-with-edit → feed states → reject gate |
| 8 | UAT-008 | Search needs the published record from UAT-006 |
| 9 | UAT-011 → UAT-012 | LIKHA 409 collision, then live classification + override |
| 10 | UAT-013 → UAT-014 | LIKHA visuals: dark theme, then responsive viewports |
| 11 | UAT-015 → UAT-016 | LIKHA Should: DILG export, then L1 package + hash round-trip |
| 12 | UAT-017 → UAT-019 | LINAW create path: bulk import, duplicate batch, manual entry |
| 13 | UAT-020 → UAT-021 | LINAW scan+OCR→ready, then library reject path |
| 14 | UAT-022 | Inventory dashboard (needs created records) |
| 15 | UAT-023 | Live classification ≤3 records + override |
| 16 | UAT-024 | Cross-reference detection + observed precision |
| 17 | UAT-028 | **Assembler PENDING gate — must run while relationships are still pending** |
| 18 | UAT-026 → UAT-027 | Relationship confirm (status propagation), then reject |
| 19 | UAT-025 | Conflict detection on FX-CONFLICT pair |
| 20 | UAT-029 | Assembly happy path + final_code_export gate (after all decisions) |
| 21 | UAT-030 | Summaries live + edit |
| 22 | UAT-031 → UAT-032 | LINAW pipeline visuals + activity feed/HITL presentation |
| 23 | UAT-033 → UAT-034 | LINAW visuals: dark theme, then responsive viewports |
| 24 | UAT-035 | LINAW Should: L1 package + hash round-trip (needs confirmed relationship) |
| 25 | UAT-039 → UAT-040 | Audit trail completeness, then static/independence gates |
| 26 | UAT-041 | **Final cleanup + user deletion — always last** |

---

## 9. Exit Criteria & Go/No-Go Rules

### 9.1 Exit criteria (all must hold to close UAT)

1. Every case executed to a terminal status (PASS / FAIL with severity / BLOCKED with documented reason + one retry).
2. All 5 SYSTEM_TEST DEFERRED items have recorded observed evidence (latency/accuracy values or BLOCKED-LIVE-MODEL rationale).
3. All screenshots and downloaded packages archived in the evidence bundle; manifest fully purged (UAT-041 zero-residue check PASS).
4. UAT user deleted from production.

### 9.2 Go/No-Go

| Verdict | Rule |
|---|---|
| **GO** | **0 open Critical defects AND pass rate ≥ 90%** (PASS ÷ (PASS+FAIL), BLOCKED excluded from denominator but each justified), 100% Must criteria covered by executed evidence |
| **CONDITIONAL GO** | 0 open Critical; pass rate ≥ 90%; remaining High/Medium defects have documented workarounds and owner sign-off |
| **NO-GO** | Any open Critical defect (auth bypass, rejected/bad data published, duplicate accepted, hash mismatch, data loss, core-flow crash) **or** pass rate < 90% |

Severity classes for FAILs are defined in §6 classification rules. Any Critical FAIL halts execution of remaining non-dependent cases until triaged.

---

## 10. Risks & Assumptions

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | UAT runs against **production** — test rows touch the live DB | Data contamination of pilot archive/library | UAT-PROBE prefix + reserved identifiers (9901–9999 / 2090–2099), creation manifest, per-case + session-end purge, baseline-diff verification (UAT-041) |
| R2 | Live OpenRouter model latency/instability during the smoke | Cases could hang or error | §4 bounded call budget, 60 s expectations per PRD, retry-once rule, BLOCKED-LIVE-MODEL classification scores graceful degradation instead |
| R3 | Accuracy targets (metadata ≥80%, cross-ref ≥70%) measured on 1–3 fixtures are **not statistically valid** | Over/under-statement of model quality | Explicitly recorded as observed-evidence only; statistical validation deferred to the LGU pilot batch (349 ordinances) |
| R4 | Pre-existing production/demo records affect counts, gaps, and search assertions | False FAILs on absolute assertions | All assertions use relative deltas (before/after, manifest-scoped queries, UAT-PROBE filters), never absolute corpus counts |
| R5 | DB-level evidence requires SSH access to the VPS | [DB-SSH] steps could be blocked | Operator with VPS credentials executes read-only queries; if unavailable mid-run, affected evidence steps are BLOCKED-ENV (case logic still scored on API/UI evidence) |
| R6 | Session cookie expiry during a long automated run | Mid-run 401 cascade | `uat-auth-state.json` + automatic re-login helper before each group; UAT-036 re-runnable |
| R7 | Tester machine env may carry `NODE_TLS_REJECT_UNAUTHORIZED=0` | TLS to production not properly validated | Pre-flight check: variable must be unset in the runner environment (SYSTEM-TEST-REPORT I-1) |
| R8 | NOTHING_TO_ASSEMBLE sub-check needs an empty eligible set that production may not provide | Sub-check unexecutable | Declared BLOCKED-ENV (not FAIL) when eligible records exist; primary PENDING gate check still scored |

**Assumptions:** production container remains healthy through the run (deployed 2026-08-10); the deployed commit matches the local repo state used for UAT-040; fixtures under `tests/fixtures/` accurately represent clear first-page scans.

---

*Prepared by @test_planner — UAT Phase 7 Step 1, session pillar-likha-linaw-20260809 (Expanded mode). This plan is authoritative for @test_executor; every case is traceable to PRD §11 / INTERCHANGE-SPEC §11 via the RTM (§7).*
