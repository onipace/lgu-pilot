# eSANGGUNI ← PILLAR Sync Report

**Date:** 2026-08-13
**Source of truth:** `DATA\QWork\PILLAR` @ `16fe44b` (repo `onipace/pillar-pilot-repo-v1`, master)
**Target:** `DATA\Qoder\ESANGGUNI\lgu-pilot-platform` (deployed to ECS `8.220.189.33`, container `esangguni-pilot`)
**Git tags:** `v-pre-pillar-sync` (baseline `2bdfb54`) → `v-post-pillar-sync` (`71c723e`)
**DB backup:** `DATA\QWork\ESANGGUNI\esangguni-pre-sync.sql` (pg_dump, pre-migration)

---

## Per-file action

### Verbatim copies (from PILLAR)
| File | Action | Result |
|---|---|---|
| `src/lib/ai/response-mode.ts` | verbatim (already present from earlier fix; verified identical) | Brief/Standard/Detailed config + suffix |
| `src/lib/ai/token-meter.ts` | verbatim (new) | fire-and-forget `recordTokenUsage` |
| `src/lib/ai/citation-validator.ts` | REPLACE | two-arg `validateAllCitations(text, ragContext)` — the 0%-relevance fix |
| `src/lib/ai/llm.ts` | verbatim | `chatCompletion` returns `{content, usage}`; `streamChatResponse` accepts `{maxTokens}` |
| `src/components/pillar/response-mode-toggle.tsx` | verbatim (already present; verified identical) | Brief/Standard/Detailed toggle UI |
| `src/components/ella/chat-interface.tsx` | verbatim | thinking indicator, KB/LLM source badges, relevance dots, citation rating display |
| `src/components/ella/citation-viewer-modal.tsx` | verbatim | structured KB rendering, jurisprudence parsing |
| `src/components/yala/yala-chat.tsx` | verbatim | response-mode + ratings for YALA |
| `src/components/obra/draft-wizard.tsx` | verbatim | draggable/resizable export modal, applied-fixes tracking |
| `src/components/obra/draft-reviewer.tsx` | verbatim | PDF blob-URL preview fix |
| `src/app/yala/page.tsx` | verbatim | response-mode toggle wiring |
| `src/app/api/documents/[id]/route.ts` | verbatim | adds `sc-*` / `lo-*` ID patterns |
| `src/app/admin/tokens/page.tsx` | verbatim (new) | Token Meter dashboard (recharts) |
| `src/app/api/admin/tokens/[...proxy]/route.ts` | verbatim (new) | admin-gated meter proxy |
| `src/app/admin/citations/page.tsx` | verbatim (new) | citation review UI |

### Merges (targeted edits)
| File | Change |
|---|---|
| `src/app/admin/layout.tsx` | added `Gauge`/`FileCheck` imports + Token Meter + Citations nav items (after Users) |
| `src/app/api/obra/{draft,fix,review}/route.ts` | `withUserAuth(...,{user})`, destructure `{content, usage}`, `recordTokenUsage` block, two-arg validation (draft) |
| `src/app/api/chat/route.ts` | `{user}` ctx, usage capture from stream, two-arg `validateAllCitations`, citation mapping (`docId`/`displaySection`/`relevance_rating`/`source`), `captureLLMCitations`, `recordTokenUsage` |

### Adaptations (rewrites)
| File | Change |
|---|---|
| `src/lib/ai/citation-capture.ts` | Prisma/PostgreSQL rewrite (contract identical, fire-and-forget) |
| `src/app/api/admin/citations/route.ts` + `[id]/route.ts` | Prisma rewrite (list/filter/paginate/stats; get/update) |
| `prisma/schema.prisma` | added `LlmCitation` + `LlmCitationOccurrence` models |
| `prisma/migrations/20260813000000_add_llm_citations/migration.sql` | applied on ECS via psql |
| `src/types/index.ts` | `Citation` += `source`, `relevance_rating` |
| `src/lib/likha/agents.ts`, `src/lib/linaw/agents.ts`, `src/lib/linaw/ingest.ts` | mechanical `chatCompletion` `.content`/destructure adaptation (9 call sites) |
| `Dockerfile` | `NODE_OPTIONS=--max-old-space-size=8192` (build-worker OOM on ECS) |

### Not copied (per instructions)
`src/lib/db.ts`, `deploy-vps.sh`, `docker-compose.vps.yml`, `.env.vps`, pricing-calculator/WALKTHROUGH/screenshots/uat artifacts, package.json wholesale, `src/lib/data/` (checksum-matched, identical). SSO (`sso.ts`, `/api/auth/sso`) and `domain-config.ts` skipped (single-domain eSANGGUNI).

---

## Phase-6 evidence (response-level)

1. **ELLA citations (primary criterion):** SSE `citations` event contains non-empty `source` + `relevance_rating`, e.g. `{"section":"129",...,"source":"kb","relevance_rating":"high",...}`. UI shows "Legal Citations — 4 references found" with KB badges. **PASS**
2. **Response modes:** brief ≈433 words vs detailed ≈1049 words (differentiated; absolute targets are soft LLM guidance — calibration noted below). Toggle visible bottom-right. **PASS (mechanism)**
3. **SC/DILG docs:** `GET /api/documents/sc-sc-gr-182069` → 200 (full_text 26,496 chars); `/api/documents/lo-lo-022-s2018` → 200 (4,917 chars). **PASS**
4. **Token meter:** `TOKEN_METER_URL` left **unset** (VPS unreachable; option 2). Chat works; `/api/admin/tokens/*` → 503; tokens page shows graceful "Token Meter Unavailable". Decision recorded. **PASS (graceful)**
5. **Regression:** `/ella /obra /yala /likha /linaw` all 200; YALA streams Filipino; OBRA `/api/obra/draft` empty-body → 500 (alive, not 404); LIKHA/LINAW unchanged beyond mechanical adaptation. **PASS**
6. **Admin Citations:** captured LLM citation "G.R. No. 190809" (SC Case, Medium, Pending) end-to-end (chat → Prisma → review UI). **PASS**

## Quality gates
- `npx tsc --noEmit`: `src/` clean (remaining errors are pre-existing `tests/integration/*.test.ts` referencing old LIKHA API shapes — out of scope, not part of `next build`).
- `npx next lint`: zero Error-level findings.
- Grep audits: chat route uses two-arg `validateAllCitations`; no raw-string `chatCompletion` consumers.

## Known deviations / notes
- Response-mode word counts run ~2x the configured targets (model-dependent); ordering brief<standard<detailed is correct. Calibrate `RESPONSE_MODE_CONFIG` wordLimits/prompts later if strict lengths are required.
- Token meter not deployed on ECS (source not locatable on the unreachable Hostinger VPS). Re-enable later by deploying a meter instance and setting `TOKEN_METER_URL`.
- Build required raised Node heap (`NODE_OPTIONS`) due to recharts admin pages.

## Rollback
`git reset --hard v-pre-pillar-sync` → redeploy → `pg_restore` from `esangguni-pre-sync.sql` (only needed if the new tables must be dropped; they are additive and safe to leave).
