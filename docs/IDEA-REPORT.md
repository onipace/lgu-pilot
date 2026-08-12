# IDEA-REPORT — PILLAR LIKHA + LINAW

**Project:** PILLAR-pilot Smart Legislation Platform
**Session:** pillar-likha-linaw-20260809
**Version:** Super PRIME v3.3 | Mode: Expanded | Agentic: yes | Archetype: agentic | Domain: gov
**Agents executed:** @problem_agent (super), @requirements_agent (super)
**Date:** August 9, 2026

---

## 1. Problem Statement & Validation

> The Sangguniang Bayan (SB) of the Municipality of Pitogo, Quezon holds 349 ordinances (1989–2025) in unindexed, deteriorating paper ledgers. Staff cannot quickly retrieve laws, cannot trace amendments or conflicts, face disaster-loss exposure, and must now comply with DILG MC 2026-041 (e-Legis Reference System) and RA 12254 (E-Governance Act). PILLAR needs two standalone modules — LIKHA (digitize + archive) and LINAW (classify + codify) — that use agentic AI with mandatory human-in-the-loop approval at every legal decision point.

**Validation checks:** Length 187+ chars (≥20) — PASS. Target users identified (SB Secretary, SB Member/Legal Officer, citizens) — PASS. Pain point specific (unindexed deteriorating records, compliance burden) — PASS. Desired outcome measurable (searchable archive + codified Code of Ordinances) — PASS.

**Legal basis:** DILG MC 2026-041 (e-Legis), RA 12254 (E-Governance Act), RA 7160 §§455-456 & 57 (SB legislative powers; records preservation), RA 9470 (National Archives Act).

## 2. Competitive Landscape

| Category | Player | Weakness we exploit |
|---|---|---|
| National registry | DILG e-Legis / AI-powered ordinance database (Aug 2026) | Top-down submission registry; gives municipalities no self-service digitization/codification tooling |
| Commercial codifiers | Municode (CivicPlus), enCodePlus | US-centric law structures, service-based pricing unaffordable for 3rd-class municipalities, no Filipino/PH templates |
| Gov document digitization | Generic AI-archive vendors (Allerin-class), legal OCR tooling | Horizontal tools; no SB workflow, no amendment-chain detection, no HITL legal governance |
| Local practice | Manual codification via law firms / Vice Mayors' League templates | Years of manual work; restarts every Sanggunian term; no tooling |
| Adjacent PH gov systems | e-LGU (838 LGUs), DILG issuances portals | Revenue/permit-centric; no legislative archive or codification |

**Gap:** No municipal-grade, AI-assisted archive + codification tool exists for Philippine LGUs. Academic studies (LGU Motiong paperless-readiness; records-management studies) confirm SB offices lack digital legislation infrastructure.

**Sources:** [Tribune — DILG AI database](https://tribune.net.ph/2026/08/04/dilg-rolls-out-ai-powered-database-for-local-laws) · [PIA](https://pia.gov.ph/press-release/dilg-urges-lgus-to-support-ai-powered-database-of-local-ordinances/) · [BATASnatin MC 2026-041](https://batasnatin.com/laws/mc-2026-041) · [CivicPlus Municode](https://www.civicplus.com/municode-codification-software/) · [enCodePlus](https://www.encodeplus.com/code-ordinances/) · [Allerin gov archives](https://www.allerin.com/blog/transforming-government-archives-with-ai-powered-historical-document-digitization-and-preservation/) · [LlamaIndex legal OCR](https://www.llamaindex.ai/insights/best-legal-ocr-software) · [Kefron](https://kefron.com/information-management/news/local-government-document-management-best-practices) · [IJFMR records management](https://www.ijfmr.com/papers/2025/3/45853.pdf) · [RSIS Motiong](https://rsisinternational.org/journals/ijriss/articles/towards-digital-legislation-readiness-of-the-sangguniang-bayan-of-lgu-motiong-for-paperless-sessions/) · [Aloysian Garchitorena](https://journals.aloysianpublications.com/index.php/articles/article/view/682) · [PNA e-LGU 838](https://www.facebook.com/pnagovph/posts/the-e-lgu-system-is-now-accessed-by-838-local-government-units-as-of-december-20/1035372788639175/) · [DICT EGMP](https://ictstatistics.dict.gov.ph/wp-content/uploads/2026/04/EGMP_Abridged-Version.pdf) · [TechTribe 2026](https://techtribe.media/digital-transformation-philippine-local-government-2026/) · [PIDS e-governance](https://www.pids.gov.ph/publication/discussion-papers/relevance-of-e-governance-in-revenue-generation-among-philippine-cities) · [DILG](https://www.dilg.gov.ph/)

## 3. Personas

### Primary — Maria, 42, Sangguniang Bayan Secretary (Pitogo, Quezon)
- **Pain points:** 349 unindexed ordinances; hours lost per retrieval; manual DILG encoding; fear of flood/fire/termite loss.
- **Goals:** Digitize everything, searchable text, status tracking, DILG-ready exports, seconds-not-hours retrieval.
- **JTBD:** "When a council session or DILG deadline arrives, I want to find and submit the exact ordinance instantly, so I can keep the Sanggunian running and stay compliant." Functional: locate/export records. Emotional: confidence, no panic during sessions. Social: seen as competent, modern records officer. Hiring criteria: upload-a-box-and-go simplicity, human verification she can trust, Filipino-friendly UI.

### Secondary — Atty. Jose, 51, SB Member / Legal Officer
- **Pain points:** Cannot detect conflicts before deliberation; amendment chains untraceable; codification takes years; distrusts unreviewed AI legal output.
- **Goals:** Relationship visualization, Code of Ordinances assembly, final human authority over every AI suggestion, print-ready code.
- **JTBD:** "When drafting or reviewing legislation, I want to see every amendment, repeal, and conflict with evidence, so I can advise the council with legal certainty." Functional: trace legal status. Emotional: professional confidence in AI-assisted work. Social: credited for delivering the municipal code. Hiring criteria: HITL gates at every legal decision, full audit trail, side-by-side evidence.

### Tertiary — Elena, 35, Municipal Citizen
- **Pain points:** Ordinances not publicly searchable; must visit municipal hall.
- **Goals:** Search active ordinances, plain-language understanding.

## 4. Opportunity Score

Formula: `(market × 0.3) + (pain × 0.3) + (gap × 0.25) + (timing × 0.15)`

| Component | Score | Basis |
|---|---|---|
| Market | 82 | 1,600+ PH LGUs; only ~838 on e-LGU; every SB has the same mandate |
| Pain | 92 | Disaster-loss exposure + legal compliance risk + hours of manual work |
| Gap | 88 | Zero municipal-grade AI archive/codification tools in the PH |
| Timing | 95 | DILG MC 2026-041 rolled out Aug 2026; RA 12254 freshly in force |
| **TOTAL** | **88/100** | (24.6 + 27.6 + 22.0 + 14.25) |

## 5. Solution Approaches Explored (brainstorming)

| Approach | Pros | Cons | Selected |
|---|---|---|---|
| A. Standalone modules inside pillar-pilot | Reuses auth/DB/LLM/BM25; fastest; matches module plans; modular independence auditable | Adds to monolith size | **YES** |
| B. Separate microservices | Clean isolation, independent scaling | Duplicates auth/DB, DevOps overhead, slower | No |
| C. Extend OBRA with archive tabs | Less code initially | Violates modular independence; couples legislative archive to procurement module | No |

**Rationale (selected_approach = A):** Highest feasibility within hackathon time, strongest differentiation (agentic + HITL + audit trail on an existing proven platform), full modular independence verifiable by audit.

**v2 revision (2026-08-09, no-dependency directive):** Approach A is strengthened, not changed — LIKHA and LINAW are **fully standalone in both directions**: zero code imports AND zero shared-table/data reads between them. LINAW owns its own ordinance library (`linaw_ordinances`) and its own ingestion (bulk text import, scan upload with module-owned OCR, manual entry). Each module ships, runs, and is sold independently; optional interoperability is limited to user-triggered file interchange (post-MVP, consumed by the LINYA upgrade edition). See Modular Independence Audit v2.

**YAGNI cuts at problem level:** multi-LGU tenancy, public FOI portal, e-signatures, payment integration, native mobile app — none address the core pain of archive + codification for one pilot municipality.

## 6. Success Metrics

| # | Metric | Target |
|---|---|---|
| 1 | Pilot batch digitized end-to-end during demo | 100% of 20-ordinance pilot batch |
| 2 | Archive search latency | < 500 ms |
| 3 | First-page metadata extraction accuracy (clear scans) | ≥ 80% |
| 4 | Cross-reference detection precision | ≥ 70% |
| 5 | HITL coverage on legal decisions | 100% logged human confirmation |
| 6 | Full corpus digitization (post-launch) | 349 ordinances within 3 months |

---

## 7. Feature Generation + YAGNI Filter (@requirements_agent)

Quality mode: Expanded → feature limit = Polish tier (max 7 MVP features per module baseline; LINAW carries 9 because the no-dependency rule requires its own standalone ingestion — total MVP = 16).

### YAGNI Challenge Table (all generated features)

| Feature | Core pain? | Demo-critical? | MVP works without? | Verdict |
|---|---|---|---|---|
| L001 Batch upload | Yes | Yes | No | KEEP |
| L002 OCR wrapper | Yes | Yes | No | KEEP |
| L003 Metadata parsing | Yes | Yes | No | KEEP |
| L004 Human verification | Yes | Yes | No | KEEP |
| L005 Publish + BM25 index | Yes | Yes | No | KEEP |
| L006 Archive browser | Yes | Yes | No | KEEP |
| L007 AI classification | Yes | Yes | No | KEEP |
| L008 Status tracking | Partial | No | Yes | KEEP (Should) |
| L009 Custom tags/tag cloud | No | No | Yes | KEEP (Could) |
| L010 DILG export package | Partial | Partial | Yes | KEEP (Should) |
| L011 Mobile camera upload | No | Partial | Yes | KEEP (Could) |
| L012 LightRAG ingestion | No | No | Yes | KEEP (Could) |
| N001 Inventory dashboard | Yes | Yes | No | KEEP |
| N002 Code classification | Yes | Yes | No | KEEP |
| N003 Cross-reference scanner | Yes | Yes | No | KEEP |
| N004 Conflict detection | Yes | Yes | No | KEEP |
| N005 Relationship confirmation | Yes | Yes | No | KEEP |
| N006 Code volume assembly | Yes | Yes | No | KEEP |
| N007 Plain-language summaries | Partial | Yes | No | KEEP |
| N013 Bulk text import (own ingestion) | Yes | Yes | No (standalone rule) | KEEP |
| N014 Scan upload + own OCR + verify (own ingestion) | Yes | Yes | No (standalone rule) | KEEP |
| N008 Multi-step approval | Partial | No | Yes | KEEP (Should) |
| N009 PDF/DOCX code export | Partial | Partial | Yes | KEEP (Should) |
| N010 Dependency graph viz | No | Partial | Yes | KEEP (Could) |
| N011 Code versioning | No | No | Yes | CUT → Won't |
| N012 DILG codification export | No | No | Yes | KEEP (Could) |
| N015 Codification interchange export (L1) | Partial | No | Yes | KEEP (Should) |
| L013 Archive interchange export (L1) | Partial | No | Yes | KEEP (Should) |

**yagni_cuts:** N011 Code versioning (post-launch maintenance concern, >1 sprint of build time, not demo-visible).

### Virality Scores (`demo×0.3 + fit×0.3 + uniqueness×0.2 + shareability×0.2`)

| ID | Feature | Score | Band |
|---|---|---|---|
| N006 | Code volume assembly + TOC | 87 | Must |
| N004 | Conflict detection | 84 | Must |
| L002 | Module-owned OCR wrapper | 83 | Must |
| N003 | Cross-reference scanner | 82 | Must |
| L003 | Metadata auto-parse | 82 | Must |
| N002 | Code classification | 81 | Must |
| L006 | Archive browser | 80 | Must |
| L010 | DILG submission export | 78 | Should |
| L001 | Batch upload | 77 | Must |
| L007 | AI subject classification | 77 | Must |
| N001 | Inventory dashboard | 76 | Must |
| N014 | Scan upload + own OCR (LINAW ingestion) | 76 | Must |
| L004 | Human verification panel | 75 | Must |
| N013 | Bulk text import (LINAW ingestion) | 74 | Must |
| N005 | Relationship confirmation | 74 | Must |
| N007 | Plain-language summaries | 74 | Must |
| L005 | Publish + BM25 entry | 73 | Must |
| N010 | Dependency graph visualization | 73 | Could |
| N009 | PDF/DOCX code export | 70 | Should |
| L013 | Archive interchange export (L1) | 70 | Should |
| N015 | Codification interchange export (L1) | 70 | Should |
| N012 | DILG codification export | 68 | Could |
| L008 | Status tracking | 63 | Should |
| N008 | Multi-step approval | 62 | Should |
| L012 | LightRAG ingestion | 60 | Could |
| L011 | Mobile camera upload | 59 | Could |
| L009 | Custom tags/tag cloud | 53 | Could |
| N011 | Code versioning | 52 | Won't |

## 8. MoSCoW (Post-Challenge)

### LIKHA
| ID | Feature | MoSCoW |
|---|---|---|
| L001 | Batch upload of scanned ordinance PDFs/images | Must |
| L002 | Module-owned OCR wrapper (`src/lib/likha/ocr.ts`) | Must |
| L003 | Auto-parse ordinance metadata | Must |
| L004 | Human verification side-by-side view | Must |
| L005 | Publish to archive with BM25 index entry | Must |
| L006 | Full-text archive browser with filters | Must |
| L007 | AI-assisted subject classification | Must |
| L008 | Status tracking (active/amended/repealed/superseded/expired) | Should |
| L010 | DILG MC 2026-041 submission package export | Should |
| L013 | Archive interchange export package (L1 — JSON bundle w/ manifest + hash, for future LINYA import) | Should |
| L009 | Custom tags and tag cloud | Could (downgraded from Should — judges won't ask; not demo-critical) |
| L011 | Mobile camera upload | Could |
| L012 | LightRAG knowledge graph ingestion | Could |

### LINAW
| ID | Feature | MoSCoW |
|---|---|---|
| N001 | Inventory dashboard with gap analysis | Must |
| N002 | AI subject classification into Code Titles/Chapters | Must |
| N003 | Cross-reference scanner for amendments/repeals | Must |
| N004 | Conflict detection across ordinances | Must |
| N005 | Relationship confirmation workflow (HITL) | Must |
| N006 | Code volume assembly with TOC | Must |
| N007 | AI-generated plain-language summaries | Must |
| N013 | Bulk text import — JSON/CSV/DOCX into LINAW's own library (`linaw_ordinances`), with pending_review → ready flow | Must |
| N014 | Scan upload + module-owned OCR (`src/lib/linaw/ocr.ts`) + own side-by-side verification | Must |
| N008 | Multi-step approval workflow (staff → member → admin) | Should |
| N009 | PDF/DOCX code export | Should |
| N015 | Codification interchange export package (L1 — JSON bundle w/ manifest + hash, for future LINYA import) | Should |
| N010 | Dependency graph visualization | Could |
| N012 | DILG codification submission export | Could |
| N011 | Code versioning | Won't (moved from Could — >1hr build, not demo-visible) |

**Brainstorming challenge results:** 2 priority changes — L009 Should→Could (fails "would a judge ask?" test); N011 Could→Won't (fails <1hr build and demo-visibility tests). L008 kept as Should with dependency-risk flag (depends on LINAW relationship confirmations). L010 kept as Should (strong compliance narrative, depends on published records + DILG format spec).

## 9. MVP Scope (Expanded: LIKHA 7 + LINAW 9 = 16 features)

**LIKHA MVP:** L001, L002, L003, L004, L005, L006, L007 — the complete end-to-end digitization pipeline plus search and classification. L010 deferred to Should because DILG's exact submission format is not yet published (YAGNI: don't build against an unknown spec).

**LINAW MVP:** N013, N014 (own standalone ingestion — bulk text import; scan upload with module-owned OCR and verification), then N001, N002, N003, N004, N005, N006, N007 — the complete codification chain operating exclusively on LINAW's own `linaw_ordinances` library. The +2 features over the per-module baseline are the direct cost of the no-dependency rule and are non-negotiable for standalone sale.

**L1 interchange (both modules, Should):** L013 + N015 export packages freeze the JSON schemas that the future LINYA upgrade edition will import — cheap now, avoids retrofit later.

## 10. Acceptance Criteria (SMART)

### LIKHA
| ID | Acceptance Criteria |
|---|---|
| L001 | Drag-and-drop up to 10 PDF/JPG/PNG files (max 20 MB each); per-file progress indicator; batch completes without browser timeout. |
| L002 | OCR wrapper at `src/lib/likha/ocr.ts` calls OpenRouter directly — `google/gemini-2.5-flash` for PDFs, `qwen/qwen3.7-plus` for images; returns extracted text within 60s; zero imports from `obra/`. |
| L003 | Extracts ordinance number, series year, title, section count from ≥80% of clearly scanned first pages; persisted to `archived_ordinances`. |
| L004 | Side-by-side view (original scan vs extracted text); editable metadata; Approve/Edit/Reject actions logged with user ID + timestamp to `interaction_logs` and `agent_decisions`. |
| L005 | On approval: status → `published`, file hash cached, BM25 index entry created/updated in LIKHA's own namespace. |
| L006 | Search results <500 ms; filters by year range, status, subject; matched terms highlighted in snippets. |
| L007 | ≥1 subject category suggested with confidence score; admin override; stored in `classifications` with `assigned_by`. |
| L013 | `POST /api/likha/export-package` produces a downloadable JSON bundle of published records (texts, metadata, status, hashes) with manifest + package hash; export logged with user ID. |

### LINAW
| ID | Acceptance Criteria |
|---|---|
| N013 | Bulk import accepts JSON/CSV/DOCX (≤500 records per batch); records land in `linaw_ordinances` as `pending_review`; per-record validation report; duplicates by (number, series_year) rejected with report entry. |
| N014 | Scan upload accepts ≤10 PDF/JPG/PNG (≤20 MB each); module-owned OCR (`src/lib/linaw/ocr.ts`, zero imports from `likha/` or `obra/`) extracts text ≤60s; own side-by-side verification panel with Approve/Edit/Reject logging; approved records become `ready`. |
| N001 | Dashboard shows total library ordinances, counts by year/status/subject, numbering gaps, completeness score; refreshes within 2s of data change; reads only `linaw_ordinances`. |
| N002 | Batch classification assigns each ordinance to Title/Chapter with confidence; human override; stored in `codification_records`. |
| N003 | Detects explicit references ("amending Ordinance No. X", "repealing Ordinance No. Y") with ≥70% precision; stored in `ordinance_relationships`. |
| N004 | Flags potential contradictions on the same subject with confidence score + side-by-side comparison view. |
| N005 | Staff/Member/Admin confirm or reject each relationship with reason; confirmed repeals update source ordinance status; all decisions audited. |
| N006 | Assembles Titles → Chapters → Articles → Sections with auto-numbering; JSON structure + TOC preview export. |
| N007 | 2–3 sentence plain-language summary per ordinance; human-editable; included in code export. |
| N015 | `POST /api/linaw/export-package` produces a downloadable JSON bundle (relationships, conflicts, code structure, summaries) with manifest + package hash; export logged with user ID. |

## 11. Technical Stack

Next.js 15.3.8 (App Router) · TypeScript 5 · Tailwind CSS · shadcn/ui + lucide-react · better-sqlite3 (`/data/pillar-pilot.db`, additive tables only) · OpenRouter via `src/lib/ai/llm.ts` (module-owned wrappers for OCR/prompts) · BM25 local search (own namespace) + LightRAG soft dependency · existing `withUserAuth` cookie auth · existing logger (`module='likha'|'linaw'`) · Hostinger VPS production target (`pillar.bayanaihan.net`).

---

## 12. Completion Gate Evidence

| # | Gate Item | Evidence | Status |
|---|---|---|---|
| 1 | @problem_agent banner displayed | This session, Phase 1 output | x |
| 2 | Problem statement validated | §1 checks (length/clarity/specificity) | x |
| 3 | ≥3 WebSearch queries documented | 5 queries, §2 with 16 sources | x |
| 4 | Primary persona defined | Maria, §3 | x |
| 5 | Secondary persona defined | Atty. Jose, §3 | x |
| 6 | ≥3 pain points ranked | §3 (disaster loss > compliance > retrieval time) | x |
| 7 | Competitive landscape mapped | §2 table | x |
| 8 | ≥3 success metrics with targets | §6 (6 metrics) | x |
| 9 | Opportunity score via formula | §4 = 88/100 | x |
| 10 | Context updated with findings | session.json ideate outputs | x |
| 11 | [SUPER] 2-3 approaches explored | §5 (A selected) | x |
| 12 | [SUPER] YAGNI applied, cuts documented | §5 cuts + §7 table (N011 cut) | x |
| 13 | [SUPER] Selected approach recorded | §5 rationale | x |
| 14 | [SUPER] JTBD enrichment (Enhanced) | §3 JTBD blocks | x |
| 15 | [SUPER] Marketing fields prepared | §1-§5 map to product-marketing-context | x |
| 16 | @requirements_agent banner displayed | This session, Phase 1 output | x |
| 17 | 5-7 features per module generated | 28 features, §7 (incl. N013/N014 ingestion + L013/N015 interchange) | x |
| 18 | Virality score per feature | §7 table | x |
| 19 | MoSCoW applied | §8 | x |
| 20 | MVP within mode limits | 7+9 = 16 (LINAW +2 mandated by no-dependency rule), §9 | x |
| 21 | SMART acceptance criteria per MVP feature | §10 (7+9) | x |
| 22 | Tech stack specified | §11 | x |
| 23 | [SUPER] Should/Could challenged | §8 challenge results (2 changes) | x |
| 24 | IDEA-REPORT.md created | docs/IDEA-REPORT.md | x |
| 25 | Session state updated | .qoder/context/hackathon/session.json | x |

---

*Prepared by QoderWork — PILLAR Likha + Linaw, Super PRIME v3.3 (Expanded, agentic, gov domain)*
