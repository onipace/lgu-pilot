# LINYA — Lineage of Ordinances
## PILLAR Upgrade Edition (Bundle-Gated: requires LIKHA + LINAW)

**Tagline:** *LIKHA creates the digital records, LINAW codifies them, LINYA traces the line between them.*
**Status:** Concept for scope decision — not yet in the current PRIME build
**Session:** pillar-likha-linaw-20260809 · Date: August 9, 2026

---

## 1. Vision

LINYA is not a third module — it is the **upgrade edition** that unlocks when an LGU owns both LIKHA and LINAW. It turns the archived records and the codified code into one explorable lineage graph: every ordinance, resolution, and codified provision as a node; every amendment, repeal, supersession, conflict, and shared subject as an edge. The Sanggunian stops reading laws as isolated documents and starts seeing the line between them — the legislative memory of the municipality, made visible.

## 2. Why an Upgrade Edition, Not a Third Module

- **Commercially:** a standalone graph SKU would be the weakest of three products on its own, and selling it separately would undercut the bundle incentive. As a dual-license unlock, LINYA becomes the reward for buying both and the single best argument FOR buying both.
- **Architecturally:** nothing changes from the no-dependency rule. LINYA consumes the same user-triggered, hashed interchange packages designed as the only sanctioned bridge between modules — zero imports, zero cross-table reads. The "upgrade" is a licensing and feed-presence gate, not code coupling.
- **Honesty check:** a graph alone is a nice-to-have. LINYA becomes a necessity only through the four workflow surfaces below — the product is sold on those, not on pretty pictures.

## 3. The Necessity Surfaces

### Surface 1 — Pre-Deliberation Conflict Check (governance gate)
*Jurisprudential evidence for all four surfaces: see [docs/LINYA-Necessity-Scenarios.md](LINYA-Necessity-Scenarios.md) (Magtajas v. Pryce, City of Manila v. Laguio, Moday v. CA, Drilon v. Lim, SJS v. Atienza; RA 7160 §§54–57; RA 9470; RA 12254; DILG MC 2026-041).*
Today someone *should* check a proposed measure against existing law before second reading; in practice they can't, because tracing takes hours. Adopted-but-conflicting ordinances are what get LGUs reversed in DILG review or embarrassed in court. With LINYA, the drafter opens the subject cluster and gets every related ordinance plus flagged conflicts in seconds — and prints a **signed conflict-check sheet** attached to the measure. Once the Sanggunian adopts a standing rule ("no measure proceeds to second reading without a LINYA conflict-check sheet"), the upgrade becomes mandatory legislative procedure.
**Feels the pain:** SB Secretary, authors. **Approves the budget:** the whole Sanggunian. **Artifact:** auditable conflict-check sheet per measure.

### Surface 2 — Chain of Validity (legal defense)
When an ordinance is challenged — court, DILG, citizen complaint — the legal officer must prove its lineage: what it amended, whether it was itself repealed, whether the chain is intact. Reconstructing that manually across 30+ years of records during an active dispute is slow and dangerous. LINYA renders the full chain with evidence links in one view and exports it as a PDF dossier.
**Feels the pain:** Legal Officer (Atty. Jose). **Artifact:** lineage dossier export.

### Surface 3 — Term-Transition Continuity (institutional memory)
Elections reset the Sanggunian every three years; incoming members inherit hundreds of ordinances and zero memory. LINYA is the explorable map that makes a new member productive in a day instead of weeks — the municipality's legal knowledge finally survives its people. This is the DILG good-governance / SGLG narrative.
**Feels the pain:** incoming SB members. **Sells to:** Mayor's office (continuity + legacy story).

### Surface 4 — Code Maintenance (protects the LINAW investment)
A code dies the day the next ordinance is enacted unless something keeps it mapped. LINYA shows where each new ordinance lands in the code and how it moves the graph — the living index that keeps LINAW's output from rotting. Sold this way, LINYA is not a luxury; it is **the maintenance system for the code the LGU already paid for**.
**Feels the pain:** everyone who paid for codification. **Reframe:** insurance on the codification investment.

### Bonus — Public Transparency Portal
A citizen-browsable, read-only graph of active ordinances (Quartz-generated static site). Politically, this is the ribbon-cutting showpiece; it is the feature the Mayor's office — the actual budget gatekeeper — shows visitors. FOI-aligned, SGLG-visible, first in the province.

## 4. Technology Research (Obsidian & open-source ecosystem)

- **Obsidian** is proprietary but **free for work/commercial use since 2025** ([announcement](https://obsidian.md/blog/free-for-work/), [license](https://obsidian.md/license), [analysis](https://preslav.me/2024/08/23/obsidian-license/)) — zero-cost viewing for the LGU, but closed-source, so it is an *optional* power-user viewer, never the foundation.
- An Obsidian vault is just a **folder of Markdown files** with `[[wikilinks]]` + YAML frontmatter — an open, tool-neutral format PILLAR generates itself. The LGU is never locked in; open-source alternatives abound ([Logseq class](https://www.atlasworkspace.ai/blog/logseq-alternatives), [2026 landscape](https://storyflow.so/blog/best-obsidian-alternatives-2026), [hands-on tests](https://medium.com/@kmhaneem00/i-tested-7-open-source-obsidian-alternatives-heres-my-top-pick-5c35d0a6a3c8), [AFFiNE](https://affine.pro/blog/obsidian-alternative)).
- **Quartz** (MIT) publishes vault-style Markdown as a static site with interactive graph + backlinks + search — the free alternative to Obsidian Publish, and our vehicle for the public portal ([Quartz](https://quartz.jzhao.xyz/), [community](https://www.reddit.com/r/ObsidianMD/comments/15wryj2/quartz_v4_a_free_obsidian_publish_alternative/), [example](https://www.ssp.sh/brain/quartz/), [multi-site pattern](https://rakshanshetty.in/blog/quartz-obsidian-multi-site-publishing)).
- **Cytoscape.js** (permissive OSS) powers the in-app graph explorer — nodes/edges, filters, expandable neighborhoods ([library](http://js.cytoscape.org/), [landscape](https://neo4j.com/blog/graph-visualization/neo4j-graph-visualization-tools/), [research use](https://ceur-ws.org/Vol-3773/paper2.pdf), [comparison](https://doc.linkurious.com/ogma/latest/compare/cytoscape.html)).

## 5. Architecture (No-Dependency Compliant)

```
LIKHA  ──[archive interchange package]────►  LINYA importer
       (texts, metadata, status, hashes;          │
        JSON bundle; user-triggered)              ▼
                                            LINYA vault builder
LINAW  ──[codification interchange package]─►    │
       (relationships, conflicts, code            ▼
        structure, summaries; JSON bundle)  /data/linya-vault/  (Markdown + index)
                                                │
                            ┌───────────────────┼───────────────────┐
                            ▼                   ▼                   ▼
                     T1 web explorer      T2 vault export     T3 public portal
                     (Cytoscape.js,       (Obsidian/Logseq    (Quartz static
                      inside /linya)       power users)         site, citizens)
```

Rules honored:
1. **Zero imports** from `likha/` or `linaw/` code; LINYA owns `src/app/(portal)/linya/page.tsx`, `src/app/api/linya/*`, `src/lib/linya/*`.
2. **Zero cross-table reads.** LINYA tables: `linya_imports` (package manifest, hash, imported_at/by), `linya_snapshots` (vault versions), `linya_annotations` (user pins/notes — the only human-authored content).
3. Packages are **user-triggered, hashed, audit-logged** (`agent_decisions`, `module='linya'`). Missing/stale feeds show explicit feed-status per source — no silent drift.
4. **Bundle gate:** the `/linya` nav item and vault builder activate only when both LIKHA and LINAW licenses are enabled AND both feeds have been imported at least once.

## 6. Vault Schema (generated artifact)

```
linya-vault/
├── Ordinances/
│   ├── ORD-005-S2023 — Revised Business Permit Fees.md
│   └── ...                       ← one note per ordinance/resolution
├── Code/
│   ├── Title III — Taxation and Revenue/
│   │   └── Chapter 1 — Business Fees.md   (Map of Content)
│   └── ...
├── Years/1989.md ... 2025.md     ← timeline hubs
├── Subjects/Taxation & Revenue.md ← subject hubs
├── Maps/
│   ├── Amendment Chains.md        ← curated lineage narratives
│   ├── Conflict Map.md
│   └── Orphan Watch.md            ← unreferenced, possibly obsolete
└── index.json                     ← machine-readable graph (nodes/edges)
```

Ordinance notes carry YAML frontmatter (number, series year, title, status, subjects, source module, package version) and **typed links** — `amends:: [[ORD-011-S2019]]`, `repealed_by:: [[ORD-002-S2024]]`, `conflicts_with:: [[ORD-003-S2022]]` — rendered as edges by all three viewer tiers.

## 7. Viewer Tiers

| Tier | What | Licensing | Audience |
|---|---|---|---|
| T1 (primary) | PILLAR-native explorer at `/linya`: Cytoscape.js graph, neighborhood/chain/conflict views, conflict-check sheet generator, lineage dossier export | Zero (our code + OSS libs) | All LGU users — default experience |
| T2 (power) | Vault folder export for Obsidian (free for work), Logseq, or any compatible tool | Zero cost; third-party apps optional | Legal officers/analysts wanting personal graph tooling |
| T3 (public) | Quartz-generated transparency portal: interactive graph, backlinks, search | MIT | Citizens, researchers, DILG assessors |

## 8. Differentiation

| Player | Offers | LINYA adds |
|---|---|---|
| DILG e-Legis | National submission registry | Municipal lineage intelligence, locally owned |
| Municode / enCodePlus | Flat hosted code text | Lineage navigation, conflict maps, open files |
| Generic legal-tech | Document search | Ordinance-to-ordinance network semantics |
| Nothing else in PH | — | The only product where an LGU's legal lineage is visible |

## 9. Commercial Mechanics

- **Unlock rule:** LIKHA license + LINAW license → LINYA available; enforced by license flags in pillar-pilot config plus the both-feeds-required technical gate.
- **Suggested shape:** premium bundle tier ("PILLAR Sanggunian Complete") rather than a priced standalone — maximizes attach pull.
- **Upsell line:** *"LIKHA alone archives. LINAW alone codifies. Together, they unlock LINYA — the lineage of your laws."*

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Perceived as nice-to-have | Sell the four surfaces (procedure, defense, continuity, maintenance), never "the graph" |
| Obsidian closed-source optics | Obsidian optional at T2 only; primary experience fully ours + OSS; vault files tool-neutral |
| Vault staleness | Package manifests carry hash + version; explorer shows feed freshness; one-click rebuild |
| Scale/density | Filtered default views (status/subject/year); full graph on demand |
| Interchange step is manual | MVP: user-triggered; later: scheduled generation (still file-based) |
| Scope creep now | Post-v1 delivery; current build only adds the interchange export schemas if approved (L1) |

## 11. Roadmap (post LIKHA + LINAW v1)

1. **L1 — Interchange standards:** freeze LIKHA archive-package and LINAW codification-package JSON schemas (cheap to design during the current build as Should-have exports — makes LINYA nearly free later).
2. **L2 — Vault builder + T1 explorer:** importer, vault generator, Cytoscape.js explorer, conflict-check sheet, lineage dossier export.
3. **L3 — T2 + T3:** vault folder export; Quartz public portal.
4. **L4 — Intelligence extras:** Orphan Watch, timeline lens, code cartography, scheduled rebuilds.

## 12. Open Questions

1. Approve adding the L1 interchange-package export schemas to the CURRENT build as LIKHA/LINAW Should-have features (recommended — low cost, preserves momentum)?
2. Is the public transparency portal (T3) desirable for the pilot LGU at launch, or internal-only first?
3. Deliver LINYA as a post-v1 phase of this engagement, or its own PRIME run after launch (recommended: own run)?

---

*Prepared by QoderWork — PILLAR Likha + Linaw, Super PRIME v3.3 engagement*
