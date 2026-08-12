# DEFECT — UAT-005 / DEF-002: Metadata Parser parses sectionCount but never persists it

| Field | Value |
|---|---|
| **ID** | DEF-002 (surfaced by UAT-005) |
| **Title** | `section_count` never written by agent 3 — verification panel shows empty Sections field; observed metadata accuracy 3/4 (0.75) on fixture |
| **Severity** | Medium (degraded secondary behavior; core fields correct) |
| **Priority** | P2 |
| **Module** | LIKHA L003 Metadata Parser persistence (src/lib/likha/agents.ts) |
| **Environment** | PRODUCTION https://pillar.bayanaihan.net (deployed commit) |

## Steps to reproduce
1. Upload a clear ordinance PDF (fixture contains 4 numbered SECTION lines).
2. Pipeline completes; `POST /api/likha/pipeline` response `files[].metadata.sectionCount = 4` with confidence 1.
3. Open the verification panel for the record.

## Expected
Sections field populated with 4 (PRD-LIKHA §11 Core #3: "section count" among extracted metadata; UAT-005 expected result lists it).

## Actual
Sections input is empty/0. Root cause: the agent-3 persistence statement in `src/lib/likha/agents.ts` (~line 307) updates `ordinance_number, series_year, title, content, extraction_confidence` but omits `section_count`, although `parsed.sectionCount` is available and the column exists (`ALTER TABLE archived_ordinances ADD COLUMN section_count`). The only writer of `section_count` is the human edit path (line ~656). Consequently UAT-005 field accuracy = 3/4 = 0.75 < 0.80 target on the fixture.

## Screenshot / evidence
- `docs/uat-screenshots/UAT-005-step-1.png` (panel with empty Sections field)
- `uat-run/likha-timeline.json` → pipelineJson.files[].metadata.sectionCount = 4 (parsed, not persisted)

## Possible root cause
Sprint-2 persistence SQL predates the additive `section_count` column (added via ALTER at db.ts ~line 329); the UPDATE was never extended.

## Recommended fix
Add `section_count = ?` with `parsed.sectionCount` to the agent-3 UPDATE in `runLikhaPipeline`; add an integration assertion that the panel shows the parsed value.
