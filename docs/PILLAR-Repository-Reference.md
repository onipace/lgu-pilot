# PILLAR-pilot Repository Reference & Sync Guidelines

**Date:** 2026-08-08 · **Owner:** BayanAIhan Engineering · **Scope:** All GitHub repositories under `onipace` that relate to PILLAR-pilot

This document is the single reference for which repositories hold what, and the rules for when each one must be updated. Every session that modifies PILLAR-pilot code or its build documents must follow the sync rules below.

---

## 1. Repository Inventory

### 1.1 onipace/pillar-pilot-repo-v1 — the CODE repo

- **URL:** https://github.com/onipace/pillar-pilot-repo-v1
- **Visibility:** Private
- **Role:** Source-of-truth mirror of the PILLAR-pilot codebase. It mirrors the local working folder `C:\Users\Emil V. Capino\DATA\QWork\PILLAR`.
- **Default branch:** `master`
- **Contents:** The full application — Next.js source (`src/`), the `pricing-calculator` sub-app, deployment configs (`docker-compose.vps.yml`, `deploy-vps.sh`), docs, walkthrough demo assets, and UAT evidence, exactly as committed in the v1 baseline.
- **Anchor tag:** `v1-pre-likha-linaw` at commit `ac2b773` — the last known-good state before the LIKHA + LINAW agentic build.
- **Commit history (as of 2026-08-08):** `f18e60c` (initial) → `ac2b773` (tagged baseline) → `cc14615` → `839980c` (docs).

### 1.2 onipace/qoder-hackathon-plugin-v1 — the DOCS / FALLBACK repo

- **URL:** https://github.com/onipace/qoder-hackathon-plugin-v1
- **Visibility:** Private
- **Role:** Holds the v1 build inputs, the fallback policy, and the per-sprint checkpoint trail for the LIKHA + LINAW agentic build. It is the sanctioned recovery anchor.
- **Default branch:** `main`
- **Contents:**

  | Path | Purpose |
  | --- | --- |
  | `docs/LIKHA-LINAW-Hackathon-Prompt.md` | Starter prompt that launches the build (contains the fallback section). |
  | `docs/LIKHA-Module-Plan.md` | L.I.K.H.A. module plan. |
  | `docs/LINAW-Module-Plan.md` | L.I.N.A.W. module plan. |
  | `docs/PILLAR-Architecture-Reference.docx` | Corrected container & LLM architecture reference. |
  | `docs/PILLAR-Repository-Reference.md` | This document. |
  | `FALLBACK-POLICY.md` | When and how to fall back to v1. |
  | `progress/` | Per-sprint checkpoint commits added during the build (v1.1 trail). |

### 1.3 Related onipace repositories — context only, do NOT conflate

These are separate deployments/products. They are **not** mirrors of the PILLAR-pilot codebase and must never be used as its restore point:

- `onipace/pitogo-pillar-spoke` — Pitogo PILLAR Spoke deployment (separate codebase).
- `onipace/pillar-quezon-hub` — Quezon Provincial PILLAR Hub (separate codebase).
- `onipace/pitogo-esangguni` — the eSANGGUNI platform. PILLAR-pilot is fully independent of it.

---

## 2. When to Update Each Repo

### 2.1 pillar-pilot-repo-v1 (code)

Update this repo whenever the PILLAR-pilot code or its committed documentation changes. Concretely:

1. **After any verified feature, fix, or refactor.** Make a local commit in `DATA/QWork/PILLAR`, then push. Do not let verified work sit only on the local disk.
2. **Before deploying to the VPS.** Push first, deploy second. GitHub must always hold a restorable copy of whatever is running in production.
3. **Before any high-risk operation** (schema migration, bulk refactor, dependency upgrade). Tag the pre-change state first (e.g. `v1-pre-<change>`), so there is always a rollback anchor.
4. **At the end of every working session.** Push outstanding commits so the remote never lags the local tree.

Commit-message convention: short imperative summary on line one (`feat: …`, `fix: …`, `docs: …`, `chore: …`), optional body explaining why.

### 2.2 qoder-hackathon-plugin-v1 (docs / fallback)

This repo changes far less often. Update it only in these cases:

1. **Sprint checkpoints.** After each completed LIKHA/LINAW sprint, add `progress/sprint-N.md` describing what was built and whether it is a passing checkpoint. Commit and push.
2. **Plan or policy revisions.** If a module plan, the hackathon prompt, or `FALLBACK-POLICY.md` genuinely changes, commit the update with a clear message.
3. **Never rewrite the v1 anchor.** The four v1 documents are the immutable baseline. If content must evolve, add new versioned material rather than silently altering the anchor's meaning, and record the change in the commit message.

### 2.3 Keeping the two in sync

The four v1 documents exist in **three** places that must stay byte-identical:

- `DATA/QWork/PILLAR/docs/` (read by build sessions)
- `qoder-hackathon-plugin-v1/docs/` (the recovery anchor)
- The QoderWork session outputs folder (shareable copies)

Whenever one copy is edited, copy it to the other two and verify with an MD5 comparison before committing. This rule exists because a stale cross-reference previously pointed a starter prompt at the wrong location.

---

## 3. What Must NEVER Be Committed

- `.env.vps` and any real `.env` — already gitignored; contains the live OpenRouter key and VPS credentials.
- `*.pem`, `*.key` private keys and certificates — gitignored.
- Real API keys or passwords anywhere. `.env.example` must contain placeholders only.
- Files over 100MB (GitHub hard limit). Build caches under `.next/` are gitignored and must stay that way.
- Secrets inside screenshots, logs, or demo JSON. Sweep new artifacts before committing.

---

## 4. Restore Procedures (summary)

Full detail lives in `FALLBACK-POLICY.md` in the docs repo. Quick reference:

**Restore the build inputs (plans + prompt):**

```
git clone https://github.com/onipace/qoder-hackathon-plugin-v1.git
```

**Restore the PILLAR codebase to the known-good baseline:**

```
cd "C:\Users\Emil V. Capino\DATA\QWork\PILLAR"
git reset --hard v1-pre-likha-linaw
```

**If the local PILLAR folder is missing or corrupted, re-clone it:**

```
git clone https://github.com/onipace/pillar-pilot-repo-v1.git
cd pillar-pilot-repo-v1 && git checkout v1-pre-likha-linaw
```

---

## 5. Quick Reference

| Repo | Holds | Branch | Update when… |
| --- | --- | --- | --- |
| `pillar-pilot-repo-v1` | PILLAR-pilot code | `master` | Any verified code/doc change; before every VPS deploy; before high-risk ops (tag first) |
| `qoder-hackathon-plugin-v1` | v1 docs + fallback policy + sprint checkpoints | `main` | A sprint completes; a plan/policy genuinely changes |
