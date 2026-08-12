# PILLAR — Pitch Presentation (5 Slides, AIDA Framework)

**Project:** PILLAR — Smart Legislation Platform
**Team:** Emil V. Capino | BayanAIhan
**Live URL:** https://pillar.bayanaihan.net
**Total Time:** ~2.5 minutes

---

## Slide 1: INTRODUCTION (Attention) — 15s

**Headline:** Paper Archives to Codified Law

**Sub-headline:** PILLAR turns 35 years of unsearchable ordinances into a searchable, codified digital archive — in minutes, not months.

**Speaker Notes:**
- Introduce yourself: "I'm Emil V. Capino, leading the PILLAR Smart Legislation Team at BayanAIhan."
- One-liner: "We built a platform that takes physical legislative archives — dusty, unsearchable, uncodified — and transforms them into structured, searchable, codified law."
- Set the hook: "349 ordinances. 35 years. Zero digitized until now."

---

## Slide 2: THE PROBLEM (Interest / PAS) — 30s

**Headline:** 349 Ordinances. Zero Digitized.

**Pain Points:**
- **No search.** SB Secretary Maria flips through physical binders to find a single ordinance. A routine query takes hours.
- **No cross-references.** Conflicting ordinances go undetected until a citizen complains or DILG audits.
- **No codification.** Assembling a code volume from scattered ordinances requires weeks of manual compilation.
- **Compliance risk.** DILG Memorandum Circular 2026-041 and RA 12254 mandate digitization and codification. Manual processes cannot keep up.

**Who Suffers:**
- Maria, the SB Secretary, spends her days wrestling paper archives instead of serving constituents.
- DILG compliance officers cannot verify LGU compliance without manual document review.
- Municipal lawyers have no reliable way to detect conflicting ordinances.

**Speaker Notes:**
- Anchor with the stat: "349 ordinances spanning 1989 to 2025. Not one was digitized before PILLAR."
- Make it personal: "Imagine being Maria. A council member asks for all ordinances related to market zoning. You spend the rest of the day flipping through binders."
- Authority frame: "DILG MC 2026-041 gives LGUs a compliance mandate. The current manual process makes compliance nearly impossible."

---

## Slide 3: OUR SOLUTION (Desire) — 30s

**Headline:** Two Modules. One Platform.

**Architecture:**
- **LIKHA** — Digitizes, OCRs, classifies, and publishes ordinances. Every AI decision requires mandatory human-in-the-loop approval before publication.
- **LINAW** — Imports classified ordinances, cross-references them, detects conflicts, and assembles codified code volumes automatically.

**Social Proof:**
- UAT: **97.6% pass rate** — GO verdict from testers.
- Built in **~24 hours** — proof of architecture simplicity and execution speed.

**Live URL:** pillar.bayanaihan.net

**Speaker Notes:**
- Walk through the flow: "LIKHA takes a physical ordinance, scans it, runs AI OCR, classifies it by subject, and publishes it — with a human approving every step."
- Then LINAW: "LINAW takes those classified ordinances, finds cross-references, flags conflicts, and assembles them into codified volumes."
- Drop the credibility stat: "We ran full UAT. 97.6% pass rate. The verdict was GO."
- Scarcity frame: "We built this in about 24 hours. The architecture is that clean."

---

## Slide 4: KEY FEATURES (Desire Deepened) — 45s

**Headline:** Built for Legislative Workflows

**Feature 1: Batch Upload + AI OCR**
- Upload 10 ordinance files. AI OCR processes the entire batch in under 2 minutes.
- Metadata extraction and subject classification happen automatically.
- **Metric:** 14-second OCR latency per document in LIKHA.

**Feature 2: Cross-Reference Detection**
- LINAW scans all ordinances for relationships — amendments, repeals, references.
- **Metric:** 100% precision on test fixtures. Zero false positives.
- Conflicts flagged with confidence scores for human review.

**Feature 3: Code Assembly**
- Classified, cross-referenced ordinances assemble into codified code volumes automatically.
- Municipal lawyers review and approve the assembled code before publication.
- **Metric:** BM25 search returns results in under 1ms across the full ordinance corpus.

**Mandatory HITL:**
- Every legal decision point — classification, cross-reference confirmation, code assembly — requires human approval. The AI suggests. A human decides.

**Speaker Notes:**
- Lead with speed: "10 files. Under 2 minutes. That's what used to take days."
- Precision matters: "100% cross-reference precision. In legislative work, a false positive means a bad legal reference. We engineered for zero tolerance."
- Search speed: "BM25 search returns in under 1 millisecond. Maria types a keyword and gets results before she finishes blinking."
- HITL is non-negotiable: "Every AI suggestion goes through a human gate. No AI publishes law. Humans do."

---

## Slide 5: LIVE DEMO + CTA (Action) — 30s

**Headline:** Try It Yourself

**Call to Action:**
- **Live URL:** pillar.bayanaihan.net
- **QR Code:** [Placeholder — generate QR for pillar.bayanaihan.net]

**Closing Message:**
- Tagline callback: "From paper to codified law, one ordinance at a time."
- Reciprocity: "Free to try at pillar.bayanaihan.net. No installation. No commitment."

**Speaker Notes:**
- Invite action: "Pull out your phone. Scan this QR code. Or go to pillar.bayanaihan.net right now."
- Run a quick live demo if time permits: upload a sample ordinance, show OCR, show classification, show cross-references.
- Close with the tagline: "PILLAR — from paper archives to codified law in minutes. We built it in 24 hours. We validated it with 97.6% UAT accuracy. Now it's your turn to try it."
- Final ask: "Talk to us about bringing PILLAR to your LGU."

---

## Appendix: Quick Reference Stats

| Metric | Value |
|---|---|
| Ordinances in pilot | 349 |
| Year span | 1989–2025 (35 years) |
| Features shipped | 19 (16 Must + 3 Should) |
| UAT pass rate | 97.6% |
| UAT verdict | GO |
| OCR latency (LIKHA) | 14s per document |
| OCR latency (LINAW) | 1s per document |
| Cross-reference precision | 100% |
| BM25 search latency | <1ms |
| Build time | ~24 hours |
| Live URL | pillar.bayanaihan.net |
