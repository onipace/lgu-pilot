# DEFECT — UAT-001 / DEF-001: Production container cannot persist LIKHA/LINAW uploads or BM25 index (EACCES)

| Field | Value |
|---|---|
| **ID** | DEF-001 (surfaced by UAT-001; also blocks UAT-003, UAT-004, UAT-006 publish, UAT-020 until operator workaround) |
| **Title** | Upload route 500s in production: `EACCES mkdir '/app/data/uploads/likha'`; BM25 index write path has the same defect |
| **Severity** | Critical (deployment) |
| **Priority** | P1 — blocks the entire LIKHA/LINAW create path on any fresh deploy |
| **Module** | LIKHA L001 / LINAW N014 upload + L005/N006 BM25 persistence (deployment config) |
| **Environment** | PRODUCTION https://pillar.bayanaihan.net, container pillar-pilot (image pillar-pilot:latest, deployed 2026-08-10), app user `nextjs` (uid 1001), `/app` root-owned, persistent volume mounted at `/data` only |

## Steps to reproduce
1. Log in as an approved user.
2. Upload any PDF/PNG via `/likha` dropzone (or `POST /api/likha/upload`).
3. Observe `500 {"error":"Upload failed"}` and per-file "Upload failed" in the UI.

## Expected
Upload accepted; rows created with `archive_status='processing'`; files stored under the persistent volume.

## Actual
Container log:
```
[likha/upload] Unexpected error: Error: EACCES: permission denied, mkdir '/app/data/uploads/likha'
  errno: -13, code: 'EACCES', syscall: 'mkdir', path: '/app/data/uploads/likha'
```
Root cause: upload code uses `path.join("data","uploads","likha")` relative to `process.cwd()` (= `/app`), while the Docker volume is mounted at `/data` and `/app` is not writable by `nextjs`. The same pattern affects `src/lib/likha/search.ts` / `src/lib/linaw/search.ts` (BM25 index written to `<cwd>/src/lib/data/*.json` with `mkdirSync(recursive)`) — publish would 500 on a pristine container too.

## Screenshot / evidence
- `docs/uat-screenshots/UAT-001-step-2.png` (both files "Upload failed")
- `docker logs pillar-pilot` EACCES entries (captured 2026-08-10T00:09Z)

## Possible root cause
Deployment/code path mismatch: the Dockerfile creates and owns only `/data` (`ENV DB_PATH`), but runtime file paths (uploads, search index) are cwd-relative and were only ever exercised in dev where `./data` and `./src/lib/data` exist and are writable.

## Recommended fix
1. Point runtime paths at the volume: add `LIKHA_SEARCH_INDEX_PATH=/data/index/likha-search-index.json`, `LINAW_SEARCH_INDEX_PATH=/data/index/linaw-search-index.json` to compose env, and introduce an `UPLOAD_ROOT=/data/uploads` env honored by `src/app/api/likha/upload/route.ts`, `src/lib/linaw/ingest.ts`, and the scan-serving routes; or
2. `RUN mkdir -p /app/data/uploads/likha /app/data/uploads/linaw /app/src/lib/data && chown -R nextjs:nodejs /app/data /app/src` in the Dockerfile runner stage (quick fix; still non-persistent across rebuilds).

## Operator workaround applied during UAT (2026-08-10T00:10Z)
`docker exec -u root pillar-pilot sh -c 'mkdir -p /app/data/uploads/likha /app/data/uploads/linaw /app/src/lib/data && chown -R nextjs:nodejs /app/data /app/src'`
This unblocked UAT execution; the defect remains OPEN for the release decision (uploads/index are not on the persistent volume and a fresh deploy recreates the failure).
