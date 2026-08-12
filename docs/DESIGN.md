# DESIGN — PILLAR LIKHA + LINAW

**Project:** PILLAR-pilot Smart Legislation Platform
**Session:** pillar-likha-linaw-20260809
**Inputs:** docs/PRD.md (§5 color system, §6 components, §10 responsive), docs/WORKFLOW-DEFINITION.json (ui_specs)
**Mode:** Expanded (page-cro injection N/A — Polish-only)
**Date:** August 9, 2026

---

## 1. Design System Overview

LIKHA and LINAW inherit the existing PILLAR-pilot portal shell (dark government-grade theme, header navigation, footer model indicator) and add one new visual language layer: the **agentic pipeline** — glowing agent cards, arrow connectors, and rose-bordered human-in-the-loop (HITL) gates. Design principles:

1. **Legal gravitas:** dark, calm surfaces; no decorative noise — the documents are the content.
2. **Visible AI, visible control:** every agent action is seen; every legal decision pauses in rose until a human acts.
3. **Consistency with ELLA/OBRA/YALA:** same header, footer brain icon, card patterns — the modules feel native to PILLAR, not bolted on.
4. **Accessibility first:** WCAG 2.1 AA contrast on all text pairs; full keyboard navigation through HITL forms.

## 2. Wireframes (ASCII)

### 2.1 LIKHA — Archive Browser (Tab 1)

```
+=========================================================================+
|  PILLAR   ELLA  OBRA  YALA  [LIKHA]  LINAW                    [user]   |
+-------------------------------------------------------------------------+
| L.I.K.H.A. — Legislative Insight & Knowledge Hub for Archives           |
| Archived: 349 | Published: 312 | Pending review: 30 | Flagged: 7        |
| [ Upload New ]  [ Run Classification ]  [ Export DILG Package ]         |
+-------------------------------------------------------------------------+
| [Archive Browser]  Upload & Digitize  Classification                    |
+-------------------------------------------------------------------------+
| Search: [ "business permit fees________________" ]  [Search]            |
| Filters: Year [1989]-[2025]  Status [All v]  Subject [All v]  [Clear]  |
+-------------------------------------------------------------------------+
| RESULTS (312)                                                           |
| +--------------------------------------------------------------------+ |
| | Ordinance No. 05, S. 2023            [ACTIVE]   Taxation & Revenue | |
| | "An ordinance revising the schedule of business permit fees..."    | |
| | ...revising the schedule of <mark>business permit fees</mark>...   | |
| | Enacted 2023-03-14 | 12 sections                    [View] [PDF]   | |
| +--------------------------------------------------------------------+ |
| +--------------------------------------------------------------------+ |
| | Ordinance No. 11, S. 2019            [AMENDED] Business Regulation | |
| | ...                                                                | |
| +--------------------------------------------------------------------+ |
|                                              [ < 1 2 3 ... 16 > ]       |
+-------------------------------------------------------------------------+
| Right panel (on select): Document viewer | Metadata | Scan preview      |
+-------------------------------------------------------------------------+
| (footer) brain icon: qwen/qwen3.7-plus | BM25 index: 312 records        |
+=========================================================================+
```

### 2.2 LIKHA — Upload & Digitize (Tab 2, pipeline running)

```
+=========================================================================+
| [Archive Browser]  [Upload & Digitize]  Classification                  |
+-------------------------------------------------------------------------+
| +--------------------------------------------------------------------+ |
| |                      DRAG & DROP SCAN FILES                        | |
| |              PDF / JPG / PNG — up to 10 files, 20 MB each          | |
| |                       [ Browse files... ]                          | |
| +--------------------------------------------------------------------+ |
|  Batch B-004 (3 files)                                                |
|  ord-05-s2023-p1.pdf   [############----] OCR...    68%               |
|  ord-05-s2023-p2.pdf   [####------------] queued    20%               |
|  ord-11-s2019.jpg      [################] verified  100%              |
+-------------------------------------------------------------------------+
|  AGENT PIPELINE                                                         |
|  (brain) > [1 Ingestor] > [2 OCR Extractor] > [3 Metadata Parser]      |
|         > [4 Subject Classifier] > [5 Legal Validator] > [6 Archiver]   |
|         > (database)                                                    |
|                                                                         |
|  +--[2 OCR Extractor]---+   status: PROCESSING (glow + pulse)           |
|  |  (bot icon, emerald) |   "Extracting text via gemini-2.5-flash..."   |
|  +----------------------+                                               |
+-------------------------------------------------------------------------+
|  ACTIVITY FEED                                                          |
|  | (rose)  REVIEW REQUIRED — Ordinance No. 05 S. 2023 low confidence    |
|  |         number field (0.62)            [ Review ] [ Reject ]         |
|  | (green) Published: Ordinance No. 11, S. 2019       [Confirmed v]    |
+=========================================================================+
```

### 2.3 LIKHA — Human Verification (HITL side-by-side)

```
+============================ DIALOG (90% width) ========================+
| VERIFY EXTRACTION — ord-05-s2023-p1.pdf                      [ X close]|
+----------------------------------+--------------------------------------+
| ORIGINAL SCAN                    | EXTRACTED TEXT (editable)            |
| +------------------------------+ | Ordinance No.  [ 05      ]           |
| |                              | | Series Year    [ 2023    ]           |
| |   [ scanned page image ]     | | Title                                |
| |   Republic of the Philippines| | [An ordinance revising the schedule ]|
| |   Municipality of Pitogo     | | [of business permit fees...________]|
| |   Ordinance No. 05, S. 2023  | | Sections       [ 12 ]                |
| |                              | | Subjects  [x] Taxation  [ ] Business |
| +------------------------------+ | Confidence: number 0.62 (rose)       |
|  [zoom -] [zoom +] [rotate]      | title 0.91  sections 0.88            |
+----------------------------------+--------------------------------------+
| Agent note (Legal Validator): "Ordinance number confidence below 0.7 —  |
| please confirm against the scan."                                       |
| Decision reason (required on reject): [________________________]        |
|            [ Reject ]   [ Edit & Save ]   [ Approve & Publish ]         |
+=========================================================================+
```

### 2.4 LINAW — Inventory Dashboard (Tab 1)

```
+=========================================================================+
| L.I.N.A.W. — Legislative Indexing for Normalized & Accessible Wisdom    |
| Classified: 289/349 | Relationships: 64 detected | Code: DRAFT          |
| [ Run Classification ] [ Detect Relationships ] [ Assemble Code ]       |
+-------------------------------------------------------------------------+
| [Inventory]  Classification  Relationships  Code Assembly               |
+-------------------------------------------------------------------------+
| COMPLETENESS  94.6%  [===========================-----]                 |
| +----------------+ +----------------+ +---------------------------+    |
| | BY STATUS      | | BY SUBJECT     | | YEAR GAPS (missing)       |    |
| | active    251  | | Taxation   62  | | 1995: No. 12, 13          |    |
| | amended    48  | | Health     41  | | 2001: No. 04              |    |
| | repealed   39  | | Zoning     38  | | 2008: No. 21-23           |    |
| | superseded 11  | | ...            | | completeness 94.6%        |    |
| +----------------+ +----------------+ +---------------------------+    |
| ORDINANCES PER YEAR (bar chart, 1989-2025)                              |
| 1989 ##  1995 ######  2001 #######  ...  2025 #########                 |
+=========================================================================+
```

### 2.5 LINAW — Relationships (Tab 3) with HITL review

```
+=========================================================================+
| [Inventory]  Classification  [Relationships]  Code Assembly             |
+-------------------------------------------------------------------------+
| Filter: Type [All v]  Status [Pending v]           [ Re-run scanner ]   |
+-------------------------------------+-----------------------------------+
| DETECTED RELATIONSHIPS (64)         | EVIDENCE — side-by-side           |
| ! ORD 05-2023 --amends--> ORD 11-2019| +---------------+ +-----------+  |
|   confidence 0.87        [Review]    | | ORD 11-2019   | | ORD 05-2023|  |
| ! ORD 02-2024 --repeals--> ORD 09-2016| "Sec. 4... fee | | "Sec. 1... |  |
|   confidence 0.79        [Review]    | | of P500..."   | | amended to |  |
| ? ORD 14-2015 --conflict-- ORD 03-2022| |              | | P750..."   |  |
|   confidence 0.64        [Review]    | +---------------+ +-----------+  |
| + confirmed (green check) items collapse to bottom of list              |
+-------------------------------------+-----------------------------------+
| REVIEW DIALOG (on [Review]):                                            |
| Relationship: ORD 05-2023 AMENDS ORD 11-2019 (Sec. 4)                   |
| [ Confirm ]  [ Edit type/sections v ]  [ Reject ]  Reason: [________]   |
+=========================================================================+
```

### 2.6 LINAW — Code Assembly (Tab 4, TOC preview)

```
+=========================================================================+
| [Inventory]  Classification  Relationships  [Code Assembly]             |
+-------------------------------------+-----------------------------------+
| CODE STRUCTURE (drag to reorder)    | TOC PREVIEW                       |
| v TITLE I — General Provisions      | Municipal Code of Pitogo, Quezon  |
|   v Chapter 1 — Scope & Policy      | 2026 Edition (DRAFT)              |
|     - ORD 01-1989 (Sec. 1-3)        | Title I. General Provisions       |
| v TITLE III — Taxation & Revenue    |   Ch. 1. Scope and Policy.........1|
|   v Chapter 1 — Business Fees       | Title III. Taxation and Revenue   |
|     - ORD 11-2019 (AMENDED)         |   Ch. 1. Business Fees............4|
|     - ORD 05-2023 (current)         |     Sec. 4. Schedule of Fees......5|
|   v Chapter 2 — Market Fees         | ...                               |
| + Add Title/Chapter                 | [ Export JSON ] [ Export PDF* ]   |
+-------------------------------------+-----------------------------------+
| AI SUMMARIES queue: 289 generated | 12 need human edit  [Review queue]  |
| * PDF/DOCX export = Should-Have N009 (post-MVP toggle)                  |
+=========================================================================+
```

Auth screens: **reused as-is** from existing PILLAR login (`pillar_user_session` cookie); no new auth UI. Landing page: existing portal dashboard; LIKHA/LINAW are reached via header nav + module pages above.

## 3. Color Palette (WCAG 2.1 AA validated)

Ratios computed against WCAG relative-luminance formula; normal text requires ≥4.5:1, large text/UI ≥3:1.

### 3.1 Core surfaces & text

| Token | Hex | Use | Contrast pair | Ratio | Verdict |
|---|---|---|---|---|---|
| `--bg-primary` | #0F1729 | Page background | — | — | — |
| `--bg-secondary` | #1E293B | Cards, panels | — | — | — |
| `--text-primary` | #FFFFFF | Headings, body | on #0F1729 | 17.9:1 | PASS AAA |
| `--text-secondary` | #94A3B8 | Muted text, labels | on #0F1729 | 7.0:1 | PASS AA |
| `--text-secondary` | #94A3B8 | Muted text on cards | on #1E293B | 5.7:1 | PASS AA |
| White | #FFFFFF | Card body text | on #1E293B | 14.6:1 | PASS AAA |
| `--accent-primary` | #0038A8 | Primary buttons, active tabs | white text on it | 9.9:1 | PASS AA |
| `--accent-ai` | #22D3EE | AI indicators, brain glow | on #0F1729 | 9.9:1 | PASS AA |

### 3.2 Agent colors (pipeline)

| Agent role | Hex | On dark bg (text) | Verdict | Text-safe variant |
|---|---|---|---|---|
| Amber (Ingestor / Inventory) | #F59E0B | 8.3:1 | PASS AA | as-is |
| Emerald (OCR / Scanner) | #10B981 | 7.1:1 | PASS AA | as-is |
| Violet (Parser / Code Classifier) | #8B5CF6 | 4.2:1 | FAIL normal / PASS large+icons | #A78BFA (6.6:1) for text |
| Sky (Subject Classifier) | #0EA5E9 | 6.5:1 | PASS AA | as-is |
| Rose (Validator / Conflict, HITL) | #F43F5E | 4.9:1 | PASS AA | as-is |
| Indigo (Archiver / Assembler) | #6366F1 | 4.0:1 | FAIL normal / PASS large+icons | #A5B4FC (9.0:1) for text |

**Rule:** glow, borders, badges, and icons may use the raw agent hex; any agent-colored *text* uses the text-safe variant. HITL states always use rose border + rose Hand icon.

### 3.3 Semantic colors

| Meaning | Hex | On dark bg | Verdict |
|---|---|---|---|
| Success | #22C55E | 7.8:1 | PASS |
| Warning | #FACC15 | 13.2:1 | PASS |
| Error | #F87171 | 6.4:1 | PASS |
| Info | #22D3EE | 9.9:1 | PASS |
| HITL / review-required | #F43F5E | 4.9:1 | PASS |

## 4. Typography

| Element | Family | Size / line-height | Weight | Notes |
|---|---|---|---|---|
| H1 (module title) | Inter, system-ui | 1.5rem / 2rem | 700 | One per module page |
| H2 (section) | Inter | 1.125rem / 1.75rem | 600 | Tab/section headers |
| H3 (card title) | Inter | 0.9375rem / 1.25rem | 600 | Ordinance numbers, agent names |
| Body | Inter | 0.875rem / 1.375rem | 400 | Lists, metadata |
| Caption | Inter | 0.75rem / 1rem | 400 | Timestamps, confidence labels |
| Legal text / ordinance excerpts | Georgia, 'Times New Roman', serif | 0.9375rem / 1.5rem | 400 | Distinguishes law text from UI |
| Ordinance numbers, hashes | ui-monospace, 'JetBrains Mono' | 0.8125rem | 500 | Tabular alignment |

Inter ships with the existing PILLAR front-end; serif stack and ui-monospace are system fallbacks (zero new font downloads — VPS-friendly). Filipino diacritics are covered by Inter.

## 5. Component Library

**shadcn/ui** (already in pillar-pilot) + **lucide-react** icons, extended with module-owned agentic components:

| Component | Source | Usage |
|---|---|---|
| Button, Input, Select, Dialog, Tabs, Badge, Progress, Table, ScrollArea, Tooltip | shadcn/ui | All CRUD surfaces |
| `agent-pipeline.tsx`, `agent-card.tsx`, `activity-feed.tsx` | new shared (src/components/) | Both module pipelines |
| `upload-dropzone.tsx`, `verification-panel.tsx`, `archive-browser.tsx`, `classification-editor.tsx` | new LIKHA | LIKHA tabs |
| `inventory-dashboard.tsx`, `relationship-review.tsx`, `conflict-panel.tsx`, `code-assembly.tsx` | new LINAW | LINAW tabs |

Customization approach: Tailwind CSS variables from §3 (no per-component color overrides); agent glow/pulse utilities in globals.css per PRD §9; all components client-side (`'use client'`) where state is interactive.

## 6. Responsive Breakpoints

| Breakpoint | Range | Layout behavior |
|---|---|---|
| Mobile | < 640px | Single column; tabs become scrollable chips; pipeline cards stack vertically with down-arrows; verification dialog goes full-screen stacked (scan above text); activity feed below pipeline |
| Tablet | 640–1024px | 2 columns (list + detail); pipeline wraps to 2 rows; side-by-side verification at 50/50 |
| Desktop | > 1024px | Full shell: header nav, main tabs, contextual right panel (360px); pipeline horizontal single row |

**Touch targets:** minimum 44×44px on all interactive elements below 1024px (Confirm/Edit/Reject buttons expand to full-width rows on mobile). **Keyboard:** HITL dialogs trap focus; Approve/Reject reachable via Tab+Enter; visible focus rings (#22D3EE, 2px). **Motion:** glow/pulse respect `prefers-reduced-motion` (animations disabled, status shown via icons only).

## 7. Mobile-Specific Considerations

- Upload via file input with `capture` attribute support (feeds Could-have L011 later without redesign).
- Search results collapse to cards with 2-line snippets; filters in a bottom sheet.
- HITL decisions on mobile require reason field visible without scrolling the dialog (decision bar pinned to bottom).
- Archive document viewer uses native pinch-zoom on scan images.

---

## 8. Completion Gate Evidence

| Gate item | Evidence | Status |
|---|---|---|
| ASCII wireframes for all key screens | §2.1–2.6 (6 screens) + auth/landing reuse note | x |
| Color palette with hex values | §3 tables | x |
| WCAG contrast validated & documented | §3 ratios (computed; 2 text-safe variants mandated) | x |
| Typography selected | §4 | x |
| Component library selected | §5 | x |
| Responsive breakpoints defined | §6 | x |
| Touch targets specified (≥44px) | §6 | x |
| docs/DESIGN.md created | this file | x |
| Session state updated | session.json design → completed | x |
| page-cro (Polish only) | N/A — Expanded mode | N/A |

---

*Prepared by QoderWork — PILLAR Likha + Linaw, Super PRIME v3.3 (Expanded, agentic, gov domain)*
