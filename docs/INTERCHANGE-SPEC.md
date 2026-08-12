# INTERCHANGE-SPEC — L1 File Interchange Contract
## PILLAR-pilot Smart Legislation Platform — Cross-Module Bridge Specification

**Version:** 1.0.0
**Date:** August 9, 2026
**Author:** QoderWork — PILLAR Smart Legislation Team
**Status:** Canonical bridge specification (single source of truth)
**Session:** pillar-likha-linaw-20260809
**Referenced by:** docs/PRD-LIKHA.md, docs/PRD-LINAW.md, docs/PRP-LIKHA.md, docs/PRP-LINAW.md · Future consumer: LINYA — Lineage of Ordinances (separate engagement)

---

## 1. Purpose and Principles

This specification defines the ONLY sanctioned interoperability mechanism between PILLAR modules. It exists because the modules are standalone SKUs with a bidirectional no-dependency rule (see docs/LIKHA-LINAW-Modular-Independence-Audit.md v2): zero code imports and zero shared-table reads between modules, in both directions.

**Principles:**

1. **File-based, user-triggered.** Interchange happens only when an authorized user explicitly exports a package. There is no live API integration, no scheduled sync, and no background data flow between modules.
2. **No shared database.** A package never grants access to another module's tables. Importing a package (post-MVP) writes into the importing module's OWN tables.
3. **Verifiable integrity.** Every package carries a manifest and a SHA-256 package hash so any receiver can verify completeness and detect tampering before ingestion.
4. **Versioned contract.** The schema is semver-versioned; exporters stamp it, importers check it.
5. **MVP scope: export only.** In the current build, modules implement the export side (Should-haves L013 and N015). Import endpoints are post-MVP and belong to the consuming engagement (LINYA).

---

## 2. Package Format

An interchange package is a single JSON document (delivered as a `.json` file download):

```json
{
  "manifest": { ... },
  "records": [ ... ],
  "relationships": [ ... ],
  "packageHash": "sha256:…"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `manifest` | object | yes | Metadata about the export (§3) |
| `records` | array | yes | Interchange records (§4); may be empty |
| `relationships` | array | LINAW only | Confirmed relationships (§5); omitted or `[]` for LIKHA packages |
| `packageHash` | string | yes | Integrity hash (§6) |

---

## 3. Manifest Schema

```json
{
  "schemaVersion": "1.0.0",
  "module": "likha | linaw",
  "interchangeLevel": "L1",
  "exportedAt": "ISO-8601 UTC timestamp",
  "exportedById": "user id of the exporter",
  "source": {
    "table": "archived_ordinances | linaw_ordinances",
    "recordCount": 0,
    "yearRange": [1989, 2025]
  },
  "exporter": {
    "platform": "pillar-pilot",
    "appVersion": "package.json version"
  }
}
```

Rules: `module` must match the exporting route; `recordCount` must equal `records.length`; `interchangeLevel` is `"L1"` for this contract.

---

## 4. Interchange Record Schema

Each record uses a canonical, module-neutral shape:

```json
{
  "ordinanceNumber": 12,
  "seriesYear": 2019,
  "title": "string",
  "content": "string (full text)",
  "summary": "string | null",
  "subjectTags": ["string"],
  "status": "active | amended | repealed | superseded | expired",
  "sourceType": "scan | import | manual",
  "fileHash": "sha256 of source file | null",
  "sourceRecordId": "id in the exporting module's own table"
}
```

**LIKHA record mapping** (`POST /api/likha/export-package`): `archived_ordinances` rows with `archive_status='published'` → interchange records; `sourceType` fixed to `"scan"` unless otherwise recorded; `summary` from the record; `subjectTags` from `subject_tags` JSON plus `classifications` rows.

**LINAW record mapping** (`POST /api/linaw/export-package`): `linaw_ordinances` rows with `library_status='ready'` → interchange records; `sourceType` from the row; `summary` from the row.

Selection: both routes accept an optional `{ "ordinanceIds": string[] }` body; when omitted, all eligible records are exported.

---

## 5. Relationships Array (LINAW packages)

LINAW packages include only **confirmed** relationships:

```json
{
  "sourceOrdinance": { "ordinanceNumber": 12, "seriesYear": 2019 },
  "targetOrdinance": { "ordinanceNumber": 3, "seriesYear": 2011 },
  "type": "amends | repeals | partial_repeal | supersedes | extends | implements",
  "sectionRef": "string | null",
  "confidence": 0.0,
  "confirmedById": "user id"
}
```

Relationships reference ordinances by (ordinanceNumber, seriesYear), never by internal table ids, so they remain meaningful to any importer.

---

## 6. Package Hash

`packageHash` = `"sha256:" + SHA-256(canonicalPayload)` where `canonicalPayload` is the canonical JSON serialization of `{ records, relationships? }` with object keys sorted lexicographically and no insignificant whitespace. The hash covers the payload only, never the manifest, so exporters can compute it deterministically. Importers MUST recompute and compare the hash before any ingestion (post-MVP).

---

## 7. Route Contracts

All routes are protected by `withUserAuth`. Errors follow `{ error: string, code?: string }`.

| Route | Method | Request | Response |
|-------|--------|---------|----------|
| `/api/likha/export-package` | POST | `{ "ordinanceIds"?: string[] }` | Package JSON per §2 (§4 LIKHA mapping); `Content-Disposition: attachment` |
| `/api/linaw/export-package` | POST | `{ "ordinanceIds"?: string[] }` | Package JSON per §2 incl. §5 relationships; `Content-Disposition: attachment` |

Both routes log the export action via `src/lib/logger.ts` with the module name and exporter user id.

---

## 8. Versioning and Compatibility

- `schemaVersion` follows semver. **Minor** bumps add optional fields only (additive, backward-compatible). **Major** bumps indicate breaking changes and require a new INTERCHANGE-SPEC revision approved at a phase gate.
- Exporters stamp the exact version implemented. Importers (post-MVP) MUST: (1) verify `schemaVersion` compatibility, (2) verify `packageHash`, (3) reject records colliding on `(ordinanceNumber, seriesYear)` within their own tables, and (4) write accepted records into their OWN tables — never into the exporter's tables.

---

## 9. Post-MVP: Import and LINYA

- Import endpoints (e.g., `POST /api/{module}/import-package`) are intentionally NOT part of the current MVP build; they will be specified in the consuming engagement.
- **LINYA — Lineage of Ordinances** (bundle-gated upgrade edition, separate sequential PRIME engagement) is the primary future consumer: it will import LIKHA packages (digital records) and LINAW packages (codified structure + confirmed relationships) to build lineage graphs. This spec's record + relationship shapes are frozen to serve as LINYA's input contract.
- Any new module consuming packages must preserve the no-dependency rule: importing a package creates records in the importer's own tables; it never establishes a runtime dependency on the exporter.

---

## 10. Non-Goals

- No live/scheduled synchronization between modules.
- No shared database tables, views, or cross-module queries.
- No cross-module authentication tokens; packages are plain files moved by users.
- No transformation or re-classification of records during export; packages are faithful snapshots.

---

## 11. Acceptance Criteria (verified in both module builds)

- [ ] `POST /api/likha/export-package` returns a package matching §2–§4 and §6 with a valid manifest and hash.
- [ ] `POST /api/linaw/export-package` returns a package matching §2–§6 including confirmed relationships.
- [ ] `packageHash` recomputation from the downloaded payload succeeds (round-trip test).
- [ ] Exporting with `ordinanceIds` filters records; without it, all eligible records are included.
- [ ] Exports are logged with module + user id; routes require authentication.
- [ ] No module code references the other module's tables or routes to build a package — mappings are defined locally per module.

---

*Canonical bridge specification — PILLAR LIKHA + LINAW, PRIME v3.3 Engagement (pillar-likha-linaw-20260809). Changes to this contract require a revision bump and re-approval at the phase gate.*
