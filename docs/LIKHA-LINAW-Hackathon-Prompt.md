# Hackathon SUPER PRIME Prompt — LIKHA + LINAW Agentic Modules

## Session Setup
- **Working Directory:** `C:\Users\Emil V. Capino\DATA\QWork\PILLAR` (PILLAR-pilot repository — the only target)
- **Framework:** Hackathon SUPER PRIME v3.2 (57 agents, 62 rules, 77 skills, 8 packs)
- **Domain Pack:** `gov-pack` (LGU/government services)
- **Archetype:** `agentic-workflow` (multi-agent orchestration with HITL gates)
- **Reference Files to Read (repo-relative, inside the working directory):**
  - `docs/LIKHA-Module-Plan.md`
  - `docs/LINAW-Module-Plan.md`
  - `docs/PILLAR-Architecture-Reference.docx`

## Version Baseline & Fallback to v1

This build is anchored to a **v1 baseline** stored in a private GitHub repository:

- **Repo:** `onipace/qoder-hackathon-plugin-v1` (https://github.com/onipace/qoder-hackathon-plugin-v1)
- **Contents:** This prompt (`docs/LIKHA-LINAW-Hackathon-Prompt.md`), the LIKHA plan, the LINAW plan, the PILLAR Architecture Reference, and a `FALLBACK-POLICY.md`.
- **Created:** 2026-08-08, before the agentic build session began.

**Code baseline:** The PILLAR repository itself is anchored at git tag **`v1-pre-likha-linaw`** (commit `ac2b773`, created 2026-08-08). This is the last known-good state of the entire PILLAR-pilot working tree as deployed on the VPS, committed immediately before this build. The tag is also pushed to the private remote **`onipace/pillar-pilot-repo-v1`** (https://github.com/onipace/pillar-pilot-repo-v1), so the baseline survives even if the local PILLAR folder is lost.

**Fallback rule:** If the agentic build in the next QoderWork session produces broken, regressed, or unrecoverable output (failed sprints, corrupted schema, unresolvable conflicts), STOP and restore from v1:

```
# Restore the build inputs (plans + prompt)
git clone https://github.com/onipace/qoder-hackathon-plugin-v1.git

# Restore the PILLAR codebase to the known-good baseline
cd "C:\Users\Emil V. Capino\DATA\QWork\PILLAR"
git reset --hard v1-pre-likha-linaw

# If the local PILLAR folder is missing/corrupted, re-clone it instead:
# git clone https://github.com/onipace/pillar-pilot-repo-v1.git
# cd pillar-pilot-repo-v1 && git checkout v1-pre-likha-linaw
```

The repo's `docs/` folder contains the exact v1 inputs used to launch the build; the tag restores the code. Restarting from these two anchors — rather than from the degraded working tree — is the sanctioned recovery path. Do not attempt heroic in-place repairs over a corrupted build; fall back to v1 and re-run.

**Checkpoint trail:** Every completed sprint during the build SHOULD be committed back to this repo under `progress/` (e.g. `progress/sprint-1.md`) so the baseline evolves into a v1.1 checkpoint trail without altering the original v1 anchor commit.

---

## Starter Prompt (copy from here)

Invoke `hackathon-prime:hackathon-orchestrator` with archetype=`agentic-workflow`, domain=`gov`, mode=`Expanded` for a two-module deliverable.

Read the three reference files listed above before starting. They contain the module plans (LIKHA, LINAW) and the platform architecture. Do not proceed to IDEATE until you have absorbed all three.

### Mission

Build two new **standalone, agentic modules** for the PILLAR-pilot Smart Legislation platform. PILLAR-pilot is fully independent — no eSANGGUNI dependency:

1. **L.I.K.H.A.** — Legislative Insight & Knowledge Hub for Archives
2. **L.I.N.A.W.** — Legislative Indexing for Normalized & Accessible Wisdom

Both modules must be architected as **independent, self-contained modules** with zero runtime dependency on ELLA, OBRA, or YALA. Each module owns its own OCR wrapper, database tables, API routes, retrieval pipeline, and UI. Shared infrastructure (OpenRouter API key, SQLite instance via better-sqlite3, LightRAG service, nginx routing) is allowed; application-level coupling to other modules is not.

### Architectural Principles

1. **Standalone by design.** LIKHA and LINAW must not import from `/api/obra/*`, `/api/chat/*`, or any ELLA/OBRA/YALA-owned code paths. Each module owns its full vertical slice: UI → API → services → data. If a capability (e.g., OCR extraction) is needed, wrap it inside the module's own service layer rather than depending on OBRA's route.

2. **Agentic orchestration.** Each module is implemented as a coordinated system of specialized agents, not a single monolithic LLM call. Each agent has a defined role, inputs, outputs, and tools. Agents coordinate through an orchestrator with explicit state transitions and human-in-the-loop gates.

3. **Human-in-the-loop is mandatory at legal decision points.** AI proposes; humans decide. This is non-negotiable for LINAW's codification decisions (amendment/repeal/conflict rulings) and for LIKHA's publication gate.

4. **Progressive autonomy with audit trails.** Every agent action is logged with agent name, decision, confidence score, and either human-confirmed or awaiting-confirmation status. The system can be audited retrospectively to trace any codification decision back to its evidence.

5. **Reuse platform infrastructure, not platform code.** OpenRouter LLM client (`src/lib/ai/llm.ts`), SQLite via better-sqlite3 (`src/lib/db.ts`), LightRAG service (soft dependency with BM25 fallback), BM25 indexing library — these are shared platform primitives that both new modules use directly. But do not import functions from `src/lib/ai/obra/*` or similar module-owned code.

### Agent Roster to Design

**LIKHA Agents:**
- `IngestionPlannerAgent` — Analyzes uploaded file (PDF/image/scan), chooses extraction strategy, sets processing parameters
- `OCRExtractorAgent` — Runs OCR via OpenRouter multimodal call (own wrapper, not OBRA's)
- `MetadataParserAgent` — Extracts ordinance number, series year, title, sections from raw text
- `ClassificationAgent` — Proposes subject tags with confidence scores
- `VerificationAgent` — Cross-checks parsed metadata against document content for consistency
- `PublicationGateAgent` — Presents proposed record to human for approve/edit/reject decision

**LINAW Agents:**
- `InventoryAgent` — Scans LIKHA archive, identifies gaps and duplicates
- `SubjectClassifierAgent` — Assigns Title/Chapter/Article placement in the Code structure
- `CrossReferenceScannerAgent` — Reads every ordinance to detect references to other ordinances
- `RelationshipDetectorAgent` — Categorizes references as amends/repeals/partial_repeal/supersedes/extends/implements
- `ConflictAnalyzerAgent` — Detects contradictory provisions across ordinances
- `LegalReasonerAgent` — Judges detected conflicts, proposes resolutions with legal reasoning
- `SummaryGeneratorAgent` — Produces plain-language summaries for each ordinance
- `CodeAssemblerAgent` — Builds the hierarchical Code of Ordinances structure with TOC
- `ApprovalGateAgent` — Orchestrates multi-step human review workflow (staff → member → admin)

### Pipeline Phases (follow the full PRIME v3.2 arc)

1. **IDEATE** — Validate the two-module scope against gov-pack persona (Sangguniang Bayan Secretary, SB Member, LGU legal officer). Score MoSCoW features. Confirm scope aligns with DILG MC 2026-041 (e-Legis Reference System) and RA 12254 (E-Governance Act).

2. **ARCHITECT** — Produce PRD with archetype=agentic-workflow. Design agent topology, tool definitions, orchestrator state machine, HITL gate specifications. Include audit trail schema.

3. **DESIGN** — Two-module UI: LIKHA dashboard (archive browser + upload + classification) and LINAW dashboard (inventory + relationships + code assembly). ASCII wireframes for each screen. WCAG-validated palette that matches PILLAR-pilot's existing indigo/emerald/amber theme.

4. **SPEC** — Generate PRP with TypeScript interfaces for every agent, tool schemas, better-sqlite3 table definitions (`archived_ordinances`, `classifications`, `amendment_links`, `codification_records`, `ordinance_relationships`, `code_volumes`, `agent_decisions`), and API route contracts.

5. **BUILD** — Expanded mode. Sprint-based implementation:
   - Sprint 1: SQLite schema migrations (idempotent CREATE TABLE + indexes in `src/lib/db.ts` init), database setup
   - Sprint 2: LIKHA agent implementations (Ingestion, OCR, MetadataParser, Verification)
   - Sprint 3: LIKHA UI (upload, browser, viewer, classification)
   - Sprint 4: LINAW inventory + classification agents and UI
   - Sprint 5: LINAW relationship + conflict detection agents
   - Sprint 6: LINAW code assembly agent + export
   - Sprint 7: Integration testing across both modules
   - TDD enforced throughout; git commit per feature.

6. **TEST** — Unit tests for every agent, integration tests for orchestrator state transitions, E2E tests for the full digitization workflow (upload → OCR → verify → publish) and the codification workflow (inventory → classify → detect → assemble → approve).

7. **DEPLOY** — Deploy to Hostinger VPS (72.60.104.187:2222) via vps-devops-orchestrator. Add to existing docker-compose.vps.yml or create sibling service. Verify against DILG MC 2026-041 export format.

8. **UAT** — Browser-automated User Acceptance Testing against acceptance criteria from PRD. Simulate uploading a scanned 1995 ordinance, running through digitization, then including it in a Code assembly. Capture screenshot evidence.

9. **DOCUMENT** — Module usage guide (Filipino + English), API documentation, demo script.

10. **PRESENT** — Pitch deck framing the compliance angle (DILG MC 2026-041), the flywheel effect (LIKHA feeds LINAW), and the agentic architecture as differentiation.

11. **SECURITY** — Run the SECURITY phase (v3.1). STRIDE threat model on document upload paths, PII handling for uploaded scans, injection risks in metadata parsing, rate limiting for OCR endpoints (they hit paid OpenRouter API).

12. **LAUNCH** — Enable modules in the sidebar navigation, add dashboard cards, run migrations, verify live workflow.

### Constraints & Guardrails

- **No OBRA/ELLA/YALA imports.** If you find yourself importing from `src/app/api/obra/extract/route.ts` or `src/lib/ai/prompts.ts`, stop and refactor. Each new module owns its own equivalent.
- **SQLite migrations must be additive.** Do not modify existing tables (users, sessions, chat_sessions, chat_messages, ordinance_drafts, activity_log). Add new tables via idempotent `CREATE TABLE IF NOT EXISTS` in the DB init only.
- **Sidebar and dashboard changes are additive.** Add LIKHA and LINAW nav items; do not modify existing ELLA/OBRA/YALA entries.
- **Cost consciousness.** OCR is expensive. Cache extraction results by file hash; do not re-OCR unchanged documents. Add per-user rate limits.
- **Audit everything.** Every agent decision must be traceable through an `agent_decisions` audit table with fields: agent_name, decision, confidence, input_hash, output_hash, human_reviewed, human_decision, timestamp.
- **Filipino-first UX.** Module labels, tooltips, and user-facing errors must be bilingual (Filipino + English). This is a Philippine LGU tool.

### Success Criteria

- Both modules deployed and accessible at `/portal/likha` and `/portal/linaw`
- Zero runtime imports from `obra/`, `ella/`, or `yala/` code paths
- Every long-running task (OCR, batch classification, relationship detection) uses an agent with checkpointing
- Full audit trail queryable via admin dashboard
- 349 Pitogo ordinance corpus classified and inventoried
- Code assembly generates a valid PDF and DOCX export
- DILG submission format export ready
- UAT PASS rate ≥ 90% on acceptance criteria

### First Deliverable Before Coding

Before writing any code, produce a **Modular Independence Audit** — a 1-page document that lists every proposed cross-module boundary, confirms zero forbidden imports, and identifies the minimal set of shared infrastructure primitives (LLM client, SQLite DB handle via `src/lib/db.ts`, LightRAG client, auth middleware) that both modules will use. Present this for approval before proceeding to ARCHITECT.

---

Begin with `hackathon-prime:hackathon-orchestrator`. Confirm archetype selection, domain pack, and mode, then start IDEATE.
