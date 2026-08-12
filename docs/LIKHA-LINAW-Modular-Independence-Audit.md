# Modular Independence Audit v2 — LIKHA + LINAW

**Project:** PILLAR-pilot Smart Legislation Platform  
**Modules:** L.I.K.H.A. (Legislative Insight & Knowledge Hub for Archives) + L.I.N.A.W. (Legislative Indexing for Normalized & Accessible Wisdom)  
**Date:** August 9, 2026 (session pillar-likha-linaw-20260809) — **v2 supersedes v1**  
**Archetype:** agentic-workflow  
**Domain:** gov (Philippine LGU)  
**Mode:** Expanded (Super PRIME v3.3)

---

## 1. Purpose

This audit verifies that LIKHA and LINAW are designed as **fully standalone modules with zero dependency in both directions** — no code imports and no shared-table/data reads between them — and zero forbidden imports from ELLA/OBRA/YALA. It is produced (and revised) before any code is written.

**v2 change (user directive, 2026-08-09):** v1 permitted LINAW → LIKHA data-layer reads. That permission is **withdrawn**. Each module owns its own ordinance store, ingestion, verification, and search. Rationale: independent SKUs — an LGU may buy LIKHA alone, LINAW alone, or both; bundling at the data layer would destroy the standalone commercial case for each.

## 2. Forbidden Boundaries (Confirmed Zero)

| Forbidden Source | Status | Evidence / Rationale |
|---|---|---|
| `src/app/api/obra/*` | **CLEAN** | Neither module imports from OBRA routes or services. |
| `src/app/api/chat/*` | **CLEAN** | No ELLA/YALA chat routes; modules call `src/lib/ai/llm.ts` directly. |
| `src/lib/ai/prompts.ts` (OBRA/ELLA/YALA prompts) | **CLEAN** | Module-owned prompts: `src/lib/likha/prompts.ts`, `src/lib/linaw/prompts.ts`. |
| `src/lib/ai/obra-export.ts` | **CLEAN** | Module-owned export logic: `src/lib/likha/export.ts`, `src/lib/linaw/export.ts`. |
| ELLA/OBRA/YALA UI components | **CLEAN** | Only shared platform UI primitives from `src/components/ui/*`. |
| **`src/app/api/likha/*` and LIKHA tables, read by LINAW** | **CLEAN (v2)** | LINAW never imports LIKHA routes/services AND never queries `archived_ordinances`, `classifications`, `amendment_links`, or LIKHA's BM25 namespace. |
| **`src/app/api/linaw/*` and LINAW tables, read by LIKHA** | **CLEAN (v2)** | LIKHA never imports LINAW routes/services and never queries `linaw_ordinances`, `codification_records`, `ordinance_relationships`, `code_volumes`, or LINAW's BM25 namespace. |

## 3. Permitted Shared Infrastructure Primitives

Both modules reuse these platform-level primitives only:

| Primitive | Path | Usage |
|---|---|---|
| OpenRouter LLM client | `src/lib/ai/llm.ts` | Non-multimodal LLM calls (classification, reasoning, summarization). |
| Multimodal OCR **pattern** | `src/lib/ai/llm.ts` + direct fetch | Each module owns its own wrapper — `src/lib/likha/ocr.ts` and `src/lib/linaw/ocr.ts` — mirroring the platform pattern without sharing code. Pattern duplication is deliberate (independence over DRY). |
| SQLite database handle | `src/lib/db.ts` | Additive table creation via idempotent `CREATE TABLE IF NOT EXISTS`. |
| Auth middleware | `src/lib/user-auth-middleware.ts` | Route protection via `withUserAuth`. |
| Logger | `src/lib/logger.ts` | Audit logging to `interaction_logs` with `module='likha'` or `module='linaw'`. |
| LightRAG client | `src/lib/ai/lightrag.ts` | Soft dependency for optional ingestion; BM25 fallback preserved. |
| BM25 search index | `src/lib/data/search-index.json` or sibling index | **Each module maintains its own namespace**; no cross-reads. |

## 4. Module Boundary: LIKHA ⟂ LINAW (v2)

| Direction | Relationship | Implementation |
|---|---|---|
| LINAW → LIKHA | **NONE** | LINAW operates exclusively on its own `linaw_ordinances` library, populated by its own ingestion (scan upload + module-owned OCR, bulk text import, manual entry). |
| LIKHA → LINAW | **NONE** | LIKHA never references LINAW tables, routes, services, or index namespaces. |
| Interoperability (optional, post-MVP) | **File interchange only** | User-triggered, hashed JSON export/import packages (LIKHA archive package; LINAW codification package). No runtime coupling; consumed later by the LINYA upgrade edition. Schemas frozen in this build as Should-have exports (L1). |

## 5. New Module-Owned Files (Proposed)

### LIKHA
- `src/app/(portal)/likha/page.tsx`
- `src/app/api/likha/upload/route.ts`
- `src/app/api/likha/archive/route.ts`
- `src/app/api/likha/classify/route.ts`
- `src/app/api/likha/export-dilg/route.ts`
- `src/app/api/likha/export-package/route.ts` *(L1 interchange, Should)*
- `src/lib/likha/ocr.ts`
- `src/lib/likha/agents.ts`
- `src/lib/likha/prompts.ts`
- `src/lib/likha/export.ts`
- `src/lib/likha/search.ts` (own BM25 namespace)

### LINAW
- `src/app/(portal)/linaw/page.tsx`
- `src/app/api/linaw/upload/route.ts` *(scan ingestion)*
- `src/app/api/linaw/import/route.ts` *(bulk text import: JSON/CSV/DOCX)*
- `src/app/api/linaw/library/route.ts` *(own ordinance library CRUD)*
- `src/app/api/linaw/inventory/route.ts`
- `src/app/api/linaw/classify/route.ts`
- `src/app/api/linaw/detect-relationships/route.ts`
- `src/app/api/linaw/assemble/route.ts`
- `src/app/api/linaw/export/route.ts`
- `src/app/api/linaw/export-package/route.ts` *(L1 interchange, Should)*
- `src/lib/linaw/ocr.ts`
- `src/lib/linaw/agents.ts`
- `src/lib/linaw/prompts.ts`
- `src/lib/linaw/export.ts`
- `src/lib/linaw/search.ts` (own BM25 namespace)

## 6. Database Additions (Additive Only)

No existing tables (`users`, `user_sessions`, `admin_users`, `admin_sessions`, `workshop_sessions`, `participant_sessions`, `interaction_logs`, `kb_documents`, `kb_index_runs`, `ecs_instances`, `lgu_deployments`) will be modified.

LIKHA-owned:
- `archived_ordinances`
- `classifications`
- `amendment_links`

LINAW-owned:
- `linaw_ordinances` *(own codification library: full text, metadata, provenance scan|import|manual, library_status processing|pending_review|ready, file hash, verification trail)*
- `codification_records` *(FK → `linaw_ordinances`)*
- `ordinance_relationships` *(FKs → `linaw_ordinances`)*
- `code_volumes`

Shared (module-scoped by column, not by coupling):
- `agent_decisions` *(rows carry `module='likha'|'linaw'`; each module writes only its own rows)*

## 7. Sidebar / Navigation Additions (Additive Only)

New nav items for LIKHA and LINAW will be appended; existing ELLA/OBRA/YALA entries remain untouched. Each module's nav item is independently licensable.

## 8. Audit Verdict

**MODULAR INDEPENDENCE (BIDIRECTIONAL): PASS**

LIKHA and LINAW reuse only shared platform primitives. There are no forbidden imports from ELLA/OBRA/YALA, and **no dependency of any kind between LIKHA and LINAW** — no code imports, no shared-table reads, no cross-index reads, in either direction. Each module ships, runs, and is sold standalone. Optional interoperability is limited to user-triggered file interchange (post-MVP), which introduces no runtime coupling.

## 9. Approval Gate

This audit (v2) must be approved before BUILD begins. Approved with the no-dependency directive of 2026-08-09; revision round re-presented for confirmation alongside the revised IDEA-REPORT/PRD/PRP.

---

*Prepared by QoderWork — PILLAR Likha + Linaw PRIME v3.3 Engagement*
