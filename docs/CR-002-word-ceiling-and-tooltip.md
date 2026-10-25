# CR-002 — Word Ceiling Adjustment + Hover Tooltip

**Date:** 2026-10-25
**Requested by:** Emil (user)
**Status:** Building
**Framework:** hackathon-prime MAINTAIN phase

---

## INTAKE — Problem

Post-CR-001 (Model-Calibrated Response Budget), users reported that AI answers on ELLA/YALA appear **cut off** or **inconclusive** — particularly in Brief mode. Live UAT evidence:

| Mode | Cap | Actual | Symptom |
|------|-----|--------|---------|
| Brief | 150 | 173 with visible "…" | Feels truncated mid-thought |
| Standard | 300 | 283 | Model exhausted tokens before reaching cap |
| Detailed | 500 | 459 | OK — only mode where answers feel complete |

Root causes:
1. 150 words is too thin for legal analysis after reserving ~40-60 words for required citations
2. Soft-stop renders as bare "…" — signals "cut off" even when close to natural end
3. Prompt suffix says "approximately" which permits the model to err short

## IMPACT — Scope

**Modified files (4):**
- `src/lib/ai/response-mode.ts` — word limits + prompt suffix
- `src/app/api/chat/route.ts` — soft-stop rendering (no more ellipsis)
- `src/components/pillar/response-mode-toggle.tsx` — hover tooltip
- `docs/MAINTENANCE.md` — CR-002 section

**Isolation:** No changes to calibration engine, circuit-breaker, OBRA/LIKHA/LINAW, or booking system.

## WORK PACKAGES

**WP-1 — Word ceiling adjustments**
- Brief: 150 → **250** (rule + application + one actionable recommendation)
- Standard: 300 → **500** (full analysis with contextual citations)
- Detailed: 500 → **800** (comprehensive with precedent, exceptions, procedure)
- maxTokens safety caps: 400 → 600, 600 → 900, 1000 → 1600 (legacy fields, not used at runtime)
- Derived per-model budgets auto-recalibrate via `deriveMaxTokens()` — no code change needed in `model-calibration.ts`

**WP-2 — Prompt suffix rewrite**
- New language: "at least {wordLimit} words, self-contained, must include rule + application + actionable recommendation + citations"
- Eliminates the "inconclusive" complaint by requiring an action statement

**WP-3 — Soft-stop rendering**
- Remove the "…" ellipsis emit
- On soft-stop trigger: close stream silently after last successfully-enqueued delta
- Users see the model's natural stopping point, not a truncation marker

**WP-4 — Hover tooltip**
- Replace native `title` attribute with PILLAR-styled custom tooltip
- Positioned above the toggle, appears on hover over each mode button
- Shows: mode label, word cap, derived token budget for current primary model
- Matches existing Brain-icon tooltip pattern already in the footer

## ACCEPTANCE CRITERIA

Given a user in ELLA or YALA and a question like "What is an ordinance?":
1. Brief mode: response reads as a complete answer (rule + application + recommendation), no "…" visible
2. Standard mode: response is 400-500 words, ends cleanly
3. Detailed mode: response is 700-800 words, comprehensive
4. Hovering over each toggle button shows a styled tooltip with word count and token budget
5. All existing tests pass, no regressions on OBRA/LIKHA/LINAW
6. Circuit-breaker fallback works with recalibrated budgets at the new ceiling

## DEPLOYMENT

Sandbox verify (TypeScript + next build) → commit → push GitHub → ECS tar-pipe → docker compose rebuild → UAT sweep on public URL → MAINTENANCE.md log.

## ROLLBACK

`git revert HEAD~1..HEAD` + `docker compose up -d --build --force-recreate esangguni` — 2 minutes.
