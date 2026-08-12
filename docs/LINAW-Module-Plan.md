# L.I.N.A.W. — Legislative Indexing for Normalized & Accessible Wisdom

## Module Plan Document

**Platform:** PILLAR — Presiding with Integrity and Legislative Leadership Action Reform
**Deployment Target:** pillar-pilot (standalone Next.js app)
**Module Code:** LINAW
**Route:** `/linaw` (following the existing `/ella`, `/obra`, `/yala` pattern)
**Version:** 1.1 (Corrected — standalone, no external platform dependencies)
**Date:** August 8, 2026

---

## 1. Executive Summary

L.I.N.A.W. systematizes the codification of municipal ordinances — the process of collecting, inventorying, classifying, revising, and organizing all existing local laws into a single, cohesive Code of Ordinances. It transforms the 349 Pitogo ordinances (digitized via L.I.K.H.A.) from a disorganized collection into a structured, navigable legal code that the Sangguniang Bayan can reference, update, and maintain.

### The Problem

Philippine LGUs are expected to maintain a codified body of ordinances, yet most municipalities never complete the process because:
- It requires years of manual legal work to read, classify, and cross-reference hundreds of ordinances
- Amendment and repeal relationships are buried in text and difficult to trace
- Conflicting provisions across different ordinances go undetected
- There is no standardized template or tooling to assist the process
- Each new Sanggunian inherits the problem and often restarts from scratch

### The Solution

LINAW provides AI-assisted codification with human legal oversight, built as a **standalone module inside pillar-pilot**:
1. **Ordinance Inventory & Classification** — Auto-classify all ordinances by subject area with human override
2. **Amendment & Repeal Detection** — AI reads all ordinances to detect cross-references, amendments, repeals, and conflicts
3. **Code Volume Assembly** — Assemble the organized Code of Ordinances with table of contents, summaries, and proper legal structure
4. **Review & Approval Workflow** — Multi-step review before codification decisions are finalized

---

## 2. Deployment Context

LINAW is developed and deployed as part of the **pillar-pilot** application — a fully self-contained Next.js 15.3.8 app that owns its entire AI pipeline end-to-end. Verification (code audit, August 8, 2026) confirms pillar-pilot has zero runtime application-level dependencies on any external platform: all LLM calls go directly to OpenRouter, all retrieval is local (BM25) or to LightRAG (a peer Docker service with graceful BM25 fallback).

LINAW inherits this standalone architecture. Its only application-level dependency within pillar-pilot is on L.I.K.H.A. (which supplies the digitized ordinance corpus). LINAW does not depend on, call, or import from any other application.

---

## 3. Legal Basis & Regulatory Context

### DILG Codification Mandate
The DILG has long encouraged LGUs to codify their ordinances. While there is no single mandatory codification law, the DILG's oversight function (Section 29, RA 7160) and the Vice Mayors' League promote codification as a best practice for good governance. The new e-Legis Reference System (MC 2026-041) further incentivizes organized digital records.

### Codification Process (Standard Practice)
Based on DILG guidelines and established municipal practice, codification follows this sequence:

1. **Gather** — Collect all existing ordinances from the archive
2. **Inventory** — Take stock; identify missing, amended, repealed, or obsolete ordinances
3. **Classify** — Group ordinances by subject matter
4. **Revise** — Update language for clarity, remove obsolete provisions
5. **Supplement** — Add missing provisions where gaps exist
6. **Arrange** — Structure into a code with titles, chapters, articles, and sections

### Reference: Baguio City Code of Ordinances
The Baguio City Code serves as a structural reference for Philippine municipal codes, organizing ordinances into Titles (by subject), Chapters (by sub-topic), Articles (by provision type), and Sections (individual provisions). LINAW will follow this hierarchical structure.

### RA 7160 Sections 455-456
The Sangguniang Bayan's power to enact ordinances implies the duty to maintain them in an organized, accessible form. Section 57 further mandates preservation of official records.

---

## 4. Feature Specification

### 4.1 Ordinance Inventory & Classification

**Purpose:** Build a complete, classified inventory of all valid ordinances.

**Features:**

1. **Inventory Dashboard**
   - Total ordinances: count by year, by subject, by status
   - Missing ordinances: gaps in numbering sequence (e.g., Ordinance No. 12, S. 1995 not found)
   - Obsolete detection: ordinances likely superseded by newer laws
   - Completeness score: percentage of expected ordinances accounted for

2. **AI Subject Classification**
   - Analyze each ordinance's content and assign subject categories
   - Multi-label classification (an ordinance can span multiple subjects)
   - Confidence scoring with human override
   - Batch classification for initial corpus processing

3. **Classification Categories** (configurable per LGU):
   - Title I: General Provisions
   - Title II: Administration & Personnel
   - Title III: Taxation & Revenue
   - Title IV: Business Regulation & Licensing
   - Title V: Health & Sanitation
   - Title VI: Public Order & Safety
   - Title VII: Infrastructure & Public Works
   - Title VIII: Zoning & Land Use
   - Title IX: Environment & Natural Resources
   - Title X: Social Services & Welfare
   - Title XI: Education & Culture
   - Title XII: Appropriations & Budget
   - Title XIII: Miscellaneous & Final Provisions

### 4.2 Amendment & Repeal Detection

**Purpose:** Identify relationships between ordinances to determine which are still in force.

**Features:**

1. **Cross-Reference Scanner**
   - AI reads all ordinances and identifies references to other ordinances
   - Detects patterns: "amending Ordinance No. X", "repealing Ordinance No. Y", "pursuant to Ordinance No. Z"
   - Builds a directed graph of ordinance relationships

2. **Relationship Types:**
   - `amends` — modifies specific provisions
   - `repeals` — entirely voids
   - `partial_repeal` — voids specific sections only
   - `supersedes` — replaces with a newer comprehensive ordinance
   - `extends` — extends the effectivity period
   - `implements` — provides implementing details for a framework ordinance

3. **Conflict Detection**
   - Identify ordinances with contradictory provisions on the same subject
   - Flag potential conflicts with confidence scores
   - Present side-by-side comparison for human review

4. **Dependency Graph Visualization**
   - Visual graph showing amendment/repeal chains
   - Highlight "orphan" ordinances (no references, possibly obsolete)
   - Timeline view of how ordinances evolved over time

### 4.3 Code Volume Assembly

**Purpose:** Assemble the classified, verified ordinances into a structured Code of Ordinances.

**Features:**

1. **Code Structure Editor**
   - Drag-and-drop arrangement of ordinances into Titles, Chapters, Articles
   - Auto-suggest placement based on classification
   - Manual override for edge cases
   - Numbering: auto-generate section numbers within the code structure

2. **AI-Generated Summaries**
   - For each ordinance in the code: generate a 2-3 sentence plain-language summary
   - Summaries help non-lawyers navigate the code
   - Human review and edit before inclusion

3. **Table of Contents Generation**
   - Auto-generate hierarchical TOC from code structure
   - Include ordinance numbers, titles, and page references
   - Export-ready format

4. **Code Versioning**
   - Track changes to the code over time
   - When a new ordinance is enacted, suggest where it fits in the code
   - Amendment tracking: mark which code sections were modified

### 4.4 Review & Approval Workflow

**Purpose:** Ensure codification decisions have legal review before finalization.

**Features:**

1. **Multi-Step Review:**
   - Step 1: AI generates classification and relationship suggestions
   - Step 2: Staff reviews and corrects
   - Step 3: SB Member/Committee reviews legal accuracy
   - Step 4: Admin/SB Secretary approves for codification

2. **Approval Gates:**
   - Classification changes require staff confirmation
   - Amendment/repeal relationships require member confirmation
   - Final code assembly requires admin approval
   - All decisions logged with timestamp and user

3. **Audit Trail:**
   - Every classification change logged
   - Every relationship detection confirmed/rejected with reason
   - Complete history of code assembly decisions

---

## 5. Data Model (SQLite Schema Addition)

pillar-pilot uses `better-sqlite3`. LINAW adds three new tables to the existing SQLite database at `/data/pillar-pilot.db`. All tables reference LIKHA's `archived_ordinances` table for source data.

```sql
CREATE TABLE IF NOT EXISTS codification_records (
  id                TEXT PRIMARY KEY,
  ordinance_id      TEXT NOT NULL UNIQUE,
  title_number      INTEGER,      -- e.g., Title III = 3
  chapter_number    INTEGER,
  article_number    INTEGER,
  section_in_code   INTEGER,      -- position within the code
  cod_status        TEXT DEFAULT 'unclassified'
                    CHECK(cod_status IN ('unclassified','classified','reviewed','approved','codified')),
  ai_suggestion     TEXT,         -- JSON blob of AI's suggested classification
  human_override    TEXT,         -- JSON blob of human corrections
  reviewed_by_id    TEXT,
  approved_by_id    TEXT,
  approved_at       TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id),
  FOREIGN KEY(reviewed_by_id) REFERENCES users(id),
  FOREIGN KEY(approved_by_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ordinance_relationships (
  id                 TEXT PRIMARY KEY,
  source_id          TEXT NOT NULL,   -- the ordinance making the reference
  target_id          TEXT NOT NULL,   -- the ordinance being referenced
  relationship_type  TEXT NOT NULL,   -- amends, repeals, partial_repeal, supersedes, extends, implements
  section_ref        TEXT,            -- specific section affected
  confidence         REAL NOT NULL,   -- AI confidence 0-1
  confirmed          INTEGER DEFAULT 0,
  confirmed_by_id    TEXT,
  created_at         TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(source_id) REFERENCES archived_ordinances(id),
  FOREIGN KEY(target_id) REFERENCES archived_ordinances(id),
  FOREIGN KEY(confirmed_by_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ord_rel_source ON ordinance_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_ord_rel_target ON ordinance_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_ord_rel_type   ON ordinance_relationships(relationship_type);

CREATE TABLE IF NOT EXISTS code_volumes (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,           -- "Municipal Code of Pitogo, Quezon"
  edition        TEXT NOT NULL,           -- "2026 Edition"
  status         TEXT DEFAULT 'draft'
                 CHECK(status IN ('draft','under_review','published')),
  structure      TEXT NOT NULL,           -- hierarchical TOC JSON
  generated_at   TEXT,
  published_at   TEXT,
  generated_by_id TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(generated_by_id) REFERENCES users(id)
);
```

---

## 6. API Endpoints

All routes live under `src/app/api/linaw/*` and are protected by pillar-pilot's `withUserAuth` middleware.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/linaw/inventory` | Ordinance inventory with gaps |
| POST | `/api/linaw/classify` | Run AI classification batch |
| PUT | `/api/linaw/classify/:id` | Update classification |
| POST | `/api/linaw/detect-relationships` | Run amendment/repeal detection |
| GET | `/api/linaw/relationships` | List detected relationships |
| PUT | `/api/linaw/relationships/:id` | Confirm/reject relationship |
| GET | `/api/linaw/conflicts` | List detected conflicts |
| POST | `/api/linaw/assemble` | Assemble code volume |
| GET | `/api/linaw/code/:id` | Get code volume |
| PUT | `/api/linaw/code/:id/structure` | Edit code structure |
| POST | `/api/linaw/code/:id/export` | Export code (PDF/DOCX) |
| GET | `/api/linaw/stats` | Codification progress stats |

---

## 7. UI Layout

### Page Structure: `/linaw`

Follows the existing pillar-pilot page pattern.

**Top Bar:**
- Module title: "L.I.N.A.W. — Legislative Indexing for Normalized & Accessible Wisdom"
- Progress: X of Y ordinances classified | Z relationships detected | Code status
- Actions: "Run Classification" | "Detect Relationships" | "Assemble Code"

**Main Content (tabbed):**
- **Tab 1: Inventory** — Completeness dashboard, gap analysis, year-by-year breakdown
- **Tab 2: Classification** — Subject category tree, drag-and-drop assignment, unclassified queue
- **Tab 3: Relationships** — Amendment/repeal graph, conflict list, side-by-side comparison
- **Tab 4: Code Assembly** — Code structure editor, TOC preview, AI summaries, export

**Right Panel (contextual):**
- Ordinance detail viewer
- Relationship detail
- Code structure editor

**Brain icon in footer:** shows the LLM model being used.

---

## 8. Integration Points (Within pillar-pilot Only)

| pillar-pilot Component | LINAW Integration |
|---|---|
| L.I.K.H.A. (archived_ordinances table) | Source of all ordinances to codify |
| `src/lib/ai/llm.ts` | LINAW uses shared OpenRouter client for classification/detection LLM calls |
| `src/lib/db.ts` | LINAW adds its three new tables |
| `src/lib/ai/lightrag.ts` | LINAW optionally uses LightRAG for semantic relationship detection |
| `src/lib/user-auth-middleware.ts` | LINAW API routes use `withUserAuth` |
| `src/lib/logger.ts` | LINAW logs decisions to `interaction_logs` with `module='linaw'` |
| Navigation header | Add LINAW link alongside ELLA/OBRA/YALA/LIKHA |
| `src/lib/data/search-index.json` | LINAW reads (but does not modify) the shared BM25 index |

**No cross-module code imports.** LINAW does not import from `src/app/api/obra/*`, `src/app/api/chat/*`, or any ELLA/OBRA/YALA-owned application code. LINAW does import from `src/app/api/likha/*` because LIKHA is its data source dependency by design.

---

## 9. Phased Rollout

### Phase 1: Inventory & Classification (Weeks 1-3)
- Import all 349 ordinances from LIKHA archive
- AI subject classification with human override
- Completeness dashboard with gap detection
- Bulk classification workflow

### Phase 2: Relationship Detection (Weeks 4-6)
- AI cross-reference scanning across all ordinances
- Amendment/repeal/supersede detection
- Conflict identification with side-by-side comparison
- Relationship confirmation workflow

### Phase 3: Code Assembly (Weeks 7-9)
- Code structure editor (Titles → Chapters → Articles → Sections)
- AI-generated summaries per ordinance
- Table of contents generation
- Code versioning

### Phase 4: Review & Export (Weeks 10-12)
- Multi-step approval workflow
- Code volume export (PDF, DOCX)
- Print-ready formatting
- Publication workflow

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Classification coverage | 100% of ordinances classified |
| Classification accuracy | >85% correct subject assignment |
| Relationship detection | >90% of amendments/repeals identified |
| Conflict detection | >75% of true conflicts flagged |
| Code completeness | Full code volume assembled within 6 months |
| Review turnaround | <2 weeks per review cycle |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI misclassification | Wrong subject assignment | Human override always available; confidence scoring |
| Missed amendment references | Incorrect legal status | Multiple detection patterns; human review gate |
| Conflict false positives | Unnecessary review burden | Confidence threshold; batch review workflow |
| Code assembly complexity | Structural errors | Template-based assembly; preview before publish |
| Legal liability | Incorrect codification | AI assists, humans decide; mandatory review gates |
| Scope creep | Never-ending project | Phase-gated rollout; clear completion criteria |

---

## 12. Dependency: L.I.K.H.A. Must Come First

LINAW depends entirely on LIKHA for its source data. The 349 ordinances must be digitized, verified, and searchable before codification can begin. Recommended sequence:

1. Deploy LIKHA Phase 1-2 first (digitization + browser)
2. Begin LINAW Phase 1 (classification) once 80%+ of corpus is digitized
3. Run LIKHA and LINAW phases in parallel where possible

This dependency also means the LIKHA archive serves as the "single source of truth" for all legislative records inside pillar-pilot, and LINAW is the "organization layer" on top of it.
