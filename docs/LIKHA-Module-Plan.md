# L.I.K.H.A. — Legislative Insight & Knowledge Hub for Archives

## Module Plan Document

**Platform:** PILLAR — Presiding with Integrity and Legislative Leadership Action Reform
**Deployment Target:** pillar-pilot (standalone Next.js app)
**Module Code:** LIKHA
**Route:** `/likha` (following the existing `/ella`, `/obra`, `/yala` pattern)
**Version:** 1.1 (Corrected — standalone, no external platform dependencies)
**Date:** August 8, 2026

---

## 1. Executive Summary

L.I.K.H.A. transforms the municipality's paper-bound legislative records into a secure, searchable digital archive. It addresses the critical risk of losing decades of municipal legislative history to physical deterioration — fire, flood, termites, and simple aging — while simultaneously creating the digital foundation required by DILG Memorandum Circular No. 2026-041 (e-Legis Reference System) and Republic Act No. 12254 (E-Governance Act).

### The Problem

The Municipality of Pitogo has 349 ordinances dating from 1989 to 2025, stored primarily in physical ledgers. These records are:
- Fragile and deteriorating (paper, ink fading, water damage)
- Unindexed and difficult to search
- Vulnerable to total loss from a single disaster event
- Non-compliant with the new DILG digital submission requirement (MC 2026-041)

### The Solution

LIKHA provides a three-part solution built as a **standalone module inside pillar-pilot**:
1. **Digitization Pipeline** — Upload scanned ordinance pages, auto-extract text via OCR, parse structural metadata
2. **Searchable Archive Browser** — Full-text search, filter by year/subject/status, browse digital copies
3. **Metadata Tagging & Classification** — AI-assisted subject classification, status tracking (active/amended/repealed), and human review workflow

---

## 2. Deployment Context

LIKHA is developed and deployed as part of the **pillar-pilot** application — a fully self-contained Next.js 15.3.8 app that owns its entire AI pipeline end-to-end. Verification (code audit, August 8, 2026) confirms pillar-pilot has zero runtime application-level dependencies on any external platform: all LLM calls go directly to OpenRouter, all retrieval is local (BM25) or to LightRAG (a peer Docker service with graceful BM25 fallback).

LIKHA inherits this standalone architecture. It does not depend on, call, or import from any other application.

---

## 3. Legal Basis & Regulatory Alignment

### DILG Memorandum Circular No. 2026-041 (August 2026)
The DILG's newly launched **e-Legis Reference System** requires all LGUs to submit digital copies of ordinances, resolutions, and other legislative measures. LIKHA directly enables compliance by digitizing the municipal ordinance archive and generating export-ready digital copies in the format required for DILG submission.

### Republic Act No. 12254 — E-Governance Act (2025)
Institutionalizes the digitization of government records and services. Provides the legal mandate for LGUs to convert paper records to electronic format and establishes the framework for interoperable government information systems.

### Republic Act No. 7160 — Local Government Code (1991)
Sections 455-456 define the Sangguniang Bayan's legislative powers including ordinance enactment. Section 57 mandates the preservation of official records. LIKHA operationalizes this preservation duty in digital form.

### Republic Act No. 9470 — National Archives Act (2007)
Establishes standards for the preservation and management of government records. Provides archival best practices that inform LIKHA's metadata schema and retention policies.

---

## 4. Feature Specification

### 4.1 Digitization Pipeline

**Purpose:** Convert scanned paper ordinance pages into structured, searchable digital records.

**Workflow:**

```
[Scan/Upload] → [OCR Extraction] → [Auto-Parse Metadata] → [Human Verify] → [Publish to Archive]
```

**Detailed Steps:**

1. **Upload Interface**
   - Accept batch uploads (multiple pages per ordinance)
   - Supported formats: PDF, JPG, PNG, TIFF, WEBP
   - Max file size: 20 MB per file (configurable)
   - Drag-and-drop with progress indicator
   - Optional: "Scan with device camera" for mobile capture

2. **OCR Extraction** — **module-owned, self-contained**
   - New file: `src/lib/likha/ocr.ts` — encapsulates the OpenRouter multimodal call
   - PDF files → `google/gemini-2.5-flash` (native PDF input)
   - Image files → `qwen/qwen3.7-plus` (visual reasoning)
   - Temperature: 0 (deterministic extraction)
   - Prompt optimized for legislative document structure
   - Does **not** import from `src/app/api/obra/extract/*` — LIKHA owns its own OCR wrapper for full modular independence

3. **Auto-Parse Metadata**
   - Ordinance number (e.g., "Ordinance No. 05, S. 2023")
   - Series year
   - Title (from WHEREAS or title clause)
   - Section count
   - Enacting authority (Sangguniang Bayan)
   - Approval date (if present)
   - Effective date (if present)

4. **Human Verification**
   - Side-by-side view: original scan vs. extracted text
   - Editable metadata fields with auto-populated values
   - Flag low-confidence extractions for manual review
   - "Approve" / "Edit & Save" / "Reject" actions

5. **Publish to Archive**
   - Assign archive ID and status
   - Generate BM25 index entry for full-text search (LIKHA's own index namespace)
   - Optionally ingest into LightRAG knowledge graph (soft dependency; falls back to BM25-only if unavailable)

**Technical Notes:**
- New API route: `POST /api/likha/upload`
- Processing queue for batch uploads (prevent timeout on large batches)
- Stores original scan files alongside extracted text for audit trail
- Storage location: mounted Docker volume at `/data/likha-archive/` (separate directory from SQLite DB)

### 4.2 Searchable Archive Browser

**Purpose:** Allow authorized users to browse, search, and retrieve digitized ordinances.

**Features:**

1. **Full-Text Search**
   - BM25 keyword search across all archived ordinances
   - Search by: ordinance number, title, section content, keyword
   - Highlighted search results with context snippets
   - Fuzzy matching for misspelled ordinance numbers

2. **Filter & Browse**
   - Filter by: year range, subject category, status (active/amended/repealed)
   - Sort by: date enacted, ordinance number, relevance
   - Timeline view showing ordinances by year
   - Card grid or list view toggle

3. **Document Viewer**
   - Full text display with section navigation
   - Original scan image viewer (if available)
   - Metadata panel: number, title, date, status, subject tags
   - Related documents: amendments, repeals (when LINAW links exist)

4. **Access Control**
   - Admin: full access to all records + edit metadata
   - Approved User: view and search only
   - Uses pillar-pilot's existing `pillar_user_session` cookie-based auth (1-hour sliding window)

### 4.3 Metadata Tagging & Classification

**Purpose:** Organize the archive with consistent, searchable metadata.

**Features:**

1. **AI-Assisted Subject Classification**
   - Auto-suggest subject categories based on content analysis
   - Categories (configurable):
     - Taxation & Revenue
     - Health & Sanitation
     - Public Order & Safety
     - Zoning & Land Use
     - Business Regulation
     - Environment & Natural Resources
     - Social Services & Welfare
     - Infrastructure & Public Works
     - Education & Culture
     - Administrative & Personnel
     - Appropriations & Budget
     - General & Miscellaneous
   - Human override: admin can reclassify any ordinance
   - Multi-tag support: an ordinance can belong to multiple categories

2. **Status Tracking**
   - Statuses: `active`, `amended`, `repealed`, `superseded`, `expired`
   - AI detects potential status changes when new ordinances reference existing ones
   - Manual status override with reason logging
   - Status history audit trail

3. **Tag Management**
   - Custom tags beyond the fixed subject categories
   - Tag cloud visualization in the browser
   - Bulk tagging for batch classification

---

## 5. Data Model (SQLite Schema Addition)

pillar-pilot uses `better-sqlite3`. LIKHA adds three new tables to the existing SQLite database at `/data/pillar-pilot.db`. Migrations run at startup via the existing `src/lib/db.ts` initialization pattern.

```sql
CREATE TABLE IF NOT EXISTS archived_ordinances (
  id                TEXT PRIMARY KEY,
  ordinance_number  INTEGER NOT NULL,
  series_year       INTEGER NOT NULL,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  summary           TEXT,
  subject_tags      TEXT DEFAULT '[]',  -- JSON array
  status            TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')),
  source_type       TEXT DEFAULT 'scan',
  original_filename TEXT,
  scan_file_path    TEXT,
  archive_status    TEXT DEFAULT 'processing' CHECK(archive_status IN ('processing','pending_review','published','flagged')),
  uploaded_by_id    TEXT NOT NULL,
  verified_by_id    TEXT,
  dilg_submitted    INTEGER DEFAULT 0,
  dilg_submitted_at TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(ordinance_number, series_year),
  FOREIGN KEY(uploaded_by_id) REFERENCES users(id),
  FOREIGN KEY(verified_by_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_arch_ord_year   ON archived_ordinances(series_year);
CREATE INDEX IF NOT EXISTS idx_arch_ord_status ON archived_ordinances(status);
CREATE INDEX IF NOT EXISTS idx_arch_ord_astat  ON archived_ordinances(archive_status);

CREATE TABLE IF NOT EXISTS classifications (
  id           TEXT PRIMARY KEY,
  ordinance_id TEXT NOT NULL,
  category     TEXT NOT NULL,
  confidence   REAL,
  assigned_by  TEXT NOT NULL,       -- 'ai' or user id
  created_at   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS amendment_links (
  id                 TEXT PRIMARY KEY,
  amending_id        TEXT NOT NULL,
  amended_id         TEXT NOT NULL,
  relationship_type  TEXT NOT NULL,  -- amends, repeals, supersedes, extends
  detected_by        TEXT NOT NULL,
  confirmed          INTEGER DEFAULT 0,
  created_at         TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(amending_id) REFERENCES archived_ordinances(id),
  FOREIGN KEY(amended_id)  REFERENCES archived_ordinances(id)
);
```

---

## 6. API Endpoints

All routes live under `src/app/api/likha/*` and are protected by pillar-pilot's `withUserAuth` middleware (existing pattern from OBRA/ELLA/YALA routes).

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/likha/upload` | Upload scanned ordinance files |
| GET | `/api/likha/archive` | List/search archived ordinances |
| GET | `/api/likha/archive/:id` | Get single ordinance detail |
| PUT | `/api/likha/archive/:id` | Update metadata / verify |
| DELETE | `/api/likha/archive/:id` | Soft-delete (admin only) |
| POST | `/api/likha/classify` | Run AI classification |
| PUT | `/api/likha/status/:id` | Update ordinance status |
| GET | `/api/likha/stats` | Archive statistics |
| POST | `/api/likha/export-dilg` | Generate DILG submission package |

---

## 7. UI Layout

### Page Structure: `/likha`

Follows the existing pillar-pilot page pattern (see `src/app/ella/page.tsx`, `src/app/obra/page.tsx`, `src/app/yala/page.tsx`).

**Top Bar:**
- Module title: "L.I.K.H.A. — Legislative Insight & Knowledge Hub for Archives"
- Stats: Total archived | Published | Pending review | Flagged
- Action buttons: "Upload New" | "Run Classification" | "Export DILG Package"

**Main Content (tabbed):**
- **Tab 1: Archive Browser** — Search bar, filters, card grid/list of ordinances
- **Tab 2: Upload & Digitize** — Drag-drop zone, processing queue, verification panel
- **Tab 3: Classification** — Subject category overview, unclassified items, bulk tagging

**Sidebar (right panel, contextual):**
- Document viewer (when an ordinance is selected)
- Metadata editor
- Original scan preview

**Brain icon in footer:** shows the LLM model being used (matching the ELLA/OBRA/YALA footer pattern).

---

## 8. Integration Points (Within pillar-pilot Only)

| pillar-pilot Component | LIKHA Integration |
|---|---|
| `src/lib/ai/llm.ts` | LIKHA uses shared OpenRouter client for classification LLM calls |
| `src/lib/db.ts` | LIKHA adds its three new tables via the shared migration entry point |
| `src/lib/ai/lightrag.ts` | LIKHA optionally ingests published ordinances into the local LightRAG service |
| `src/lib/user-auth-middleware.ts` | LIKHA API routes use `withUserAuth` for authentication |
| `src/lib/logger.ts` | LIKHA logs operations (upload, verify, classify) to `interaction_logs` with `module='likha'` |
| Navigation header | Add LIKHA link alongside ELLA/OBRA/YALA in the app header |
| `src/lib/data/search-index.json` | LIKHA maintains a separate namespace within (or a sibling file alongside) the shared BM25 index |

**No cross-module code imports.** LIKHA does not import from `src/app/api/obra/*`, `src/app/api/chat/*`, or any ELLA/OBRA/YALA-owned application code. It reuses shared platform primitives only.

---

## 9. Phased Rollout

### Phase 1: Digitization Pipeline (Weeks 1-3)
- Upload interface with batch support
- Own OCR wrapper (`src/lib/likha/ocr.ts`)
- Auto-parse ordinance metadata
- Human verification workflow
- Store to SQLite

### Phase 2: Archive Browser (Weeks 4-5)
- Full-text search (BM25)
- Filter by year, status, subject
- Document viewer with scan preview
- Role-based access control

### Phase 3: Classification & Tagging (Weeks 6-7)
- AI subject classification
- Status tracking
- Custom tagging
- Bulk operations

### Phase 4: DILG Compliance Export (Week 8)
- Generate DILG submission package
- Track submission status
- Align with MC 2026-041 format requirements

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Ordinances digitized | 349 (full corpus) within 3 months |
| OCR accuracy | >95% text extraction accuracy |
| Classification accuracy | >80% correct subject assignment |
| Search response time | <500ms |
| DILG compliance | 100% digital copies ready for submission |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor scan quality (faded, damaged pages) | Low OCR accuracy | Flag low-confidence extractions for manual review; allow re-scan |
| Large batch uploads timeout | Failed processing | Queue-based processing with progress tracking |
| Misclassification | Incorrect subject tags | AI suggests, human confirms; easy re-classification |
| Storage growth | Disk space | Compress scans; archive originals to cold storage after verification |
| DILG format changes | Export incompatibility | Modular export adapter; monitor MC updates |
| LightRAG unavailability | Reduced retrieval quality | Graceful fallback to BM25-only (existing pillar-pilot pattern) |
