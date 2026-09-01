# LIKHA / LINAW Change Log (for later PILLAR reverse-sync)

**Purpose:** LIKHA (Archive Digitizer) and LINAW (Ordinance Codifier) exist only in eSANGGUNI
(`lgu-pilot-platform`). PILLAR also carries `src/lib/likha/*` and `src/lib/linaw/*` agent
libraries, so any edit to those shared files can conflict on a future PILLAR sync. Every change
made to LIKHA/LINAW — pages, components, routes, lib, types, tests — MUST be appended below with
date, file(s), and a one-line rationale, so it can be reverse-synced into PILLAR later.

**Rule:** copy-forward tested code where possible; log every divergence here.

---

## Baseline

- 2026-08-13 — Baseline recorded at git tag `v-post-pillar-sync` (commit after PILLAR sync).
  LIKHA/LINAW untouched by the PILLAR sync except mechanical `chatCompletion` `.content`
  adaptations in `src/lib/likha/agents.ts`, `src/lib/linaw/agents.ts`, `src/lib/linaw/ingest.ts`.

## Entries

<!-- Append new entries below this line. Format:
- YYYY-MM-DD — <file(s)> — <what changed and why> (author: eSANGGUNI-polish)
-->
- 2026-08-13 — `src/components/likha/camera-scanner.tsx` — Redesigned Scan Document from one
  full-width camera card + a transient scan card below, into a two-pane scanner: LEFT card = live
  camera view (with "① Live Camera" header + Live badge), RIGHT card = "② Scanned Document" that
  shows the cinematic ScanEffect while scanning and then PERSISTS the captured document (green
  SCANNED stamp + capture time) until the next scan. Added `lastCapture` state (object URL, revoked
  on replace) set in `handleScanComplete`. UI-only; no shared `lib/likha` logic touched.
  (author: eSANGGUNI-polish)
- 2026-08-13 — `src/components/likha/scan-effect.tsx`, `src/components/likha/camera-scanner.tsx` —
  Restyled the scanned-document output from green to light grey (user polish direction): scan
  enhancement filter now `grayscale(1) contrast(1.35) brightness(1.28)` (light-grey paper render,
  was `contrast(1.45) brightness(1.12) saturate(0.25)`), tint overlay #E0F7FA→#E2E8F0, scan-complete
  flash/label #22C55E→#E2E8F0; captured card border #22C55E/40→#94A3B8/40, SCANNED stamp now
  light-grey bg (#CBD5E1/90) with dark text, Captured badge grey (#94A3B8/#CBD5E1). UI-only.
  (author: eSANGGUNI-polish)
- 2026-08-13 — `src/components/likha/camera-scanner.tsx`, `src/components/likha/scan-effect.tsx` —
  Vertical "paper document" cards (user polish direction): both scanner cards now aspect-[3/4]
  portrait; pair centered via grid `mx-auto max-w-[920px] gap-6` (no longer full-bleed); video /
  MJPEG img / scan canvas / captured img all `h-full w-full` + object-contain (letterboxed inside
  the paper frame); idle overlay made `absolute inset-0` so Start Camera stays clickable in the
  fixed-aspect box; removed the yellow "OpenCV.js unavailable" banner and the cvError state
  (OpenCV load fix deferred — console.warn retained). UI-only. (author: eSANGGUNI-polish)
- 2026-08-13 — `src/components/agent-card.tsx`, `src/types/likha.ts`, `src/lib/likha/agents.ts`,
  `src/components/likha/verification-panel.tsx` — Compacted AGENT PIPELINE cards h-56→h-44 (cuts
  the empty middle band; shared AgentCard also affects LINAW — height only, LINAW names untouched)
  and shortened LIKHA labels to single words per user direction: Extractor / Parser / Classifier /
  Validator (Ingestor, Archiver unchanged); AGENT_NAMES audit map + one audit literal + HITL panel
  "Agent note" label renamed to match so pipeline, activity feed and audit stay consistent.
  Descriptions (hover tooltips) unchanged. (author: eSANGGUNI-polish)
- 2026-08-13 — `src/components/agent-card.tsx`, `src/components/agent-pipeline.tsx` — Removed the
  dead band under the agent labels (user polish: "just want to see the icon and label"): dropped
  fixed card height + flex-1 spacer (cards auto-size), output row now renders ONLY on completion
  with a preview (idle card = badge + icon + label), pipeline row switched items-center→
  items-stretch with self-center on bookends/arrows and `self-center md:self-stretch` on cards so
  heights stay uniform per row (shared with LINAW). (author: eSANGGUNI-polish)
- 2026-08-13 — `src/components/likha/camera-scanner.tsx` — Moved the "Available Cameras" device
  list from the page bottom (idle-only) to a collapsible card at the very top of the scanner —
  directly under the scanner-mode tab card and just above the device selector bar (user polish:
  "misplaced"); collapsed by default with a count badge + chevron toggle; list + USB/Wireless
  tags + tip render only when expanded; now visible in all scanner states, not just idle.
  (author: eSANGGUNI-polish)
- 2026-08-13 — `src/lib/likha/search.ts`, `src/app/api/likha/archive/route.ts`,
  `src/app/api/likha/stats/route.ts`, `.dockerignore` — Ghost-duplicate fix (user report: 27
  duplicate "Business permits" results): root cause was the gitignored runtime BM25 index
  (src/lib/data/likha-search-index.json, stale 54-doc workshop artifact) being shipped inside
  deploy tarballs while the old self-heal only rebuilt an EMPTY index. Added
  `ensureLikhaIndexFresh()` (rebuild whenever index doc count ≠ DB published count) called by the
  archive search + stats routes (rebuilds audited via logModuleEvent), and excluded the runtime
  index from .dockerignore/tarballs so images can never bake it again. (author: eSANGGUNI-polish)
- 2026-08-13 — `src/lib/likha/search.ts` — Prefix-tolerant BM25 term matching (demo-search
  polish): `termMatches()` returns {freq, idfTerm}; exact token wins, else mutual-prefix terms
  (min 4 chars) contribute frequency and the matched corpus term supplies the idf — so user
  plurals ("permits", "fees") hit real ordinance singulars ("permit", "fee"). (author: eSANGGUNI-polish)
- 2026-08-13 — `src/types/linaw.ts`, `src/lib/linaw/agents.ts` — Renamed LINAW agent 3
  "Cross-Reference Scanner" → "Cross-Referencer" (display def + audit names map; user polish).
  LINAW demo seed (data, not code): linaw_ordinances populated via INSERT..SELECT from
  archived_ordinances WHERE archive_status='published' with library_status='ready',
  source_type='likha-import' so the Codification tabs run over the same real Pitogo ordinances.
  (author: eSANGGUNI-polish)
