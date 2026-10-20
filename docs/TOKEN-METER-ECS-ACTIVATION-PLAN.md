## eSANGGUNI Token Metering — ECS Activation Plan

### Current state (baseline)

Every LLM call in ELLA, YALA, and OBRA already fires a fire-and-forget POST to `http://token-meter:3084/api/record` from `src/lib/ai/token-meter.ts`. The admin dashboard at `/admin/tokens` proxies to the same URL for stats, per-user, per-module, timeseries, cost, budget, pricing, and CSV/JSON export.

But eSANGGUNI prod runs on Alibaba ECS (`8.220.189.33`, container `esangguni-pilot`, network `esangguni_esangguni-network`), and its `docker-compose.yml` defines only `postgres`, `esangguni`, `nginx`, `certbot`. There is no `token-meter` container on ECS and no `TOKEN_METER_URL` set, so the DNS name does not resolve, the metering POST fails silently, and `/admin/tokens` returns 503 with a "Token Meter Unavailable" page. The metering service lives only in the PILLAR repo and runs only on the Hostinger VPS.

Consequences for your questions today: per-user token tracing is not captured, and `demo@q101.ai` (or any user) has no retrievable conversation-usage record through this module.

### Goal

Bring the proven PILLAR token-meter service onto the same ECS host and wire it into eSANGGUNI's existing code so the `/admin/tokens` dashboard goes live and every user's conversations become traceable — with no changes to the eSANGGUNI app code (the integration is already written and tested on PILLAR).

### Approach: sidecar on ECS (matches the previous / PILLAR version)

This reuses the exact pattern already running in production for PILLAR: a `token-meter` container sharing eSANGGUNI's Docker network, reached by hostname. The eSANGGUNI code already expects `http://token-meter:3084`. We are not reinventing — we are deploying the same meter next to eSANGGUNI.

### Steps

1. Vendor the meter into the eSANGGUNI repo.
   Copy `PILLAR/token-meter/` (Dockerfile, package.json, src/) into `ESANGGUNI/lgu-pilot-platform/token-meter/` so it deploys with this project and no longer depends on the VPS. The PILLAR Dockerfile is a self-contained node:20-alpine build with a healthcheck on `/health` — it works as-is.

2. Add the service to `docker-compose.yml` (the ECS file).
   Define a `token-meter` service: `build: ./token-meter`, `container_name: token-meter`, volume `token-meter-data:/data`, env `DB_PATH=/data/token-meter.db`, and join `esangguni-network` (the same network `esangguni` uses). Do NOT publish port 3084 to the host — eSANGGUNI reaches it by container name over the internal network, exactly like postgres. Only bind `127.0.0.1:3084:3084` if you later want host-level curl debugging.

3. Point the app at the meter.
   In the `esangguni` service, add environment `TOKEN_METER_URL=http://token-meter:3084`. Because both containers share `esangguni-network`, Docker DNS resolves `token-meter`. This is the only wiring needed — no code edit.

4. Deploy on ECS.
   tar + scp the repo (excluding node_modules, .next, .git, data/*.db*), then `docker compose -f docker-compose.yml up -d --build token-meter esangguni`. Restarting `esangguni` picks up the new env var; the meter comes up with a fresh empty SQLite DB at `/data/token-meter.db`.

5. Verify the loop end to end (the "production-tested, visual proof" bar).
   Log in as `demo@q101.ai`, send 2-3 ELLA chats and run one OBRA draft. Then open `/admin/tokens`. Expect: Top Users shows `demo@q101.ai` with token counts + cost, per-module shows ella/obra split, timeseries shows today's points. Capture before (503 page) and after (populated dashboard) screenshots. Confirm `docker exec token-meter curl -s localhost:3084/api/by-user` returns the user row.

### What this gives the monitoring module on this version

Once active, `/admin/tokens` exposes: aggregate token stats; breakdown by module (ella/obra/yala/likha/linaw); by route; Top Users (name, total tokens, call count, avg tokens/call, cost USD); a timeseries trend; cost rollup against model pricing; budget thresholds (display); model pricing editor; and CSV/JSON export. That directly answers your tracing question — you filter the Top Users list (or export) to analyze `demo@q101.ai`'s conversations by volume, module, and cost.

### Known gaps this plan does NOT close (flagged, not silent)

Budget enforcement is display-only; no LLM call is blocked when a user exceeds a limit. The meter is a single-node SQLite sidecar (fine for this scale; note it for backup alongside the compose volume). And user hard-deletion still does not exist — the admin panel only approve/reject/deactivate. If you want per-user conversation content (not just token counts) retained and queryable, that is a separate follow-on: the app would need to persist chat transcripts keyed by `user_id` and expose a per-user transcript view. Say the word and I will scope that as Phase 2.

### Fallback if a same-host sidecar is undesirable

Set `TOKEN_METER_URL` to the VPS meter over the internet. Requires exposing the VPS meter beyond `127.0.0.1` and securing it — not recommended. The same-host sidecar above is the cleaner, self-contained choice.
