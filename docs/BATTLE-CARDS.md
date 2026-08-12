# PILLAR — Q&A Battle Cards

**Project:** PILLAR — Smart Legislation Platform
**Team:** Emil V. Capino | BayanAIhan
**Use:** Anticipate judge/investor questions. Deliver crisp, evidence-backed answers.

---

## Battle Card 1: "How is PILLAR different from Google Drive / SharePoint?"

**Question:** Why can't we just use Google Drive or SharePoint to manage our ordinances?

**Answer:**
Generic document management systems store files. PILLAR understands legislation.

- **Auto-OCR:** Upload a scanned ordinance and PILLAR extracts text, metadata, and subject classification automatically. Google Drive stores the PDF.
- **Cross-reference detection:** PILLAR scans every ordinance for amendments, repeals, and references. SharePoint has no legislative intelligence.
- **Conflict flagging:** When two ordinances contradict each other on the same subject, PILLAR flags the conflict with a confidence score. A file folder cannot do this.
- **Codified code assembly:** PILLAR takes classified, cross-referenced ordinances and assembles them into codified code volumes. No generic DMS offers this workflow.

**One-liner close:** "Google Drive stores documents. PILLAR codifies law."

**Supporting data:**
- 349 ordinances digitized and classified — zero before PILLAR
- 100% cross-reference precision on test fixtures
- Built specifically for Philippine LGU legislative workflows

---

## Battle Card 2: "Why not just manually digitize the ordinances?"

**Question:** Can't we hire staff to manually type out and organize the ordinances?

**Answer:**
Manual digitization of 349 ordinances would take months. PILLAR processes a 10-file batch in under 2 minutes.

- **Speed:** AI OCR processes each document in 14 seconds (LIKHA). A batch of 10 files completes in under 2 minutes including metadata extraction and classification.
- **Accuracy:** Manual transcription introduces human error at scale. PILLAR's AI OCR extracts text with high fidelity, and mandatory HITL ensures a human reviews every classification before publication.
- **Cost:** Hiring staff to manually process 35 years of ordinances costs tens of thousands of pesos — and the work never ends as new ordinances arrive. PILLAR scales without adding headcount.
- **Consistency:** Manual processes produce inconsistent metadata. PILLAR applies uniform classification across every ordinance.

**One-liner close:** "Months of manual work. Minutes with PILLAR."

**Supporting data:**
- 14s OCR latency per document
- 10-file batch in under 2 minutes
- 97.6% UAT pass rate validates accuracy
- Built in ~24 hours — the architecture is proven

---

## Battle Card 3: "What if the AI makes a mistake in classification?"

**Question:** How do we know the AI won't misclassify ordinances and create legal problems?

**Answer:**
PILLAR enforces mandatory Human-in-the-Loop (HITL) at every legal decision point. The AI suggests. A human decides.

- **Classification review:** After AI classifies an ordinance by subject, a human reviewer must approve or reclassify before it publishes.
- **Cross-reference confirmation:** LINAW detects potential cross-references and conflicts, but a human must confirm each relationship before code assembly proceeds.
- **Code assembly approval:** The assembled codified volumes go through human review by municipal lawyers before finalization.
- **Track record:** UAT showed a 97.6% pass rate with a GO verdict. The system works — and the HITL gates catch what the AI misses.

**One-liner close:** "The AI suggests. A human approves. Every time."

**Supporting data:**
- Mandatory HITL at classification, cross-reference, and code assembly stages
- 97.6% UAT pass rate
- GO verdict from human testers
- Zero autonomous publication — no AI output reaches production without human sign-off

---

## Battle Card 4: "How does PILLAR handle conflicting ordinances?"

**Question:** What happens when two ordinances say different things about the same topic?

**Answer:**
LINAW's conflict detection module scans all ordinances for same-subject contradictions and presents them for human resolution.

- **Automated scanning:** LINAW cross-references every ordinance against the full corpus, identifying relationships (amendments, repeals, references) and contradictions.
- **Confidence scores:** Each detected conflict carries a confidence score, so reviewers prioritize high-certainty conflicts first.
- **Side-by-side review:** Conflicting ordinances display side-by-side for human comparison. The reviewer decides which provision prevails or whether both should be flagged for the council.
- **Gate before assembly:** Relationships must be confirmed by a human before code assembly proceeds. No conflict goes into a codified volume unreviewed.

**One-liner close:** "PILLAR finds the conflicts. Humans resolve them."

**Supporting data:**
- 100% cross-reference precision on test fixtures — zero false positives
- Conflict detection with confidence scoring
- Mandatory HITL before code assembly
- BM25 search across full corpus in <1ms

---

## Battle Card 5: "What's the business model for scaling to other LGUs?"

**Question:** How does PILLAR become a sustainable business beyond the Pitogo pilot?

**Answer:**
SaaS subscription per LGU, powered by regulatory demand and data portability.

- **Regulatory pull:** DILG Memorandum Circular 2026-041 and RA 12254 mandate digitization and codification. Every LGU in the Philippines faces the same compliance pressure that SB Pitogo faced.
- **SaaS model:** Monthly or annual subscription per LGU. No heavy upfront infrastructure cost. PILLAR runs as a web platform — access it from any browser.
- **L1 interchange standard:** PILLAR's L1 standard enables data portability between LGUs. Ordinances classified in one LGU can inform classification in another, reducing onboarding time.
- **Pilot validation:** The SB Pitogo pilot proves the model works — 349 ordinances, 35 years of archives, 97.6% UAT pass rate. The reference case sells itself to neighboring LGUs.
- **Expansion path:** Start with Quezon Province LGUs, expand regionally, then nationally. Each LGU onboarded strengthens the classification model and the interchange network.

**One-liner close:** "Every LGU in the Philippines has the same problem. PILLAR is the compliance-ready answer."

**Supporting data:**
- 1,488 LGUs in the Philippines (potential market)
- DILG MC 2026-041 creates regulatory demand
- Pilot validated: 349 ordinances, 97.6% UAT pass, GO verdict
- L1 interchange standard enables cross-LGU data portability
- Built in ~24 hours — low engineering cost per deployment

---

## Quick Reference: Objection → Response Matrix

| Objection | Response |
|---|---|
| "We already have Google Drive" | Drive stores files. PILLAR codifies law. |
| "We'll just hire staff" | Months of work. Minutes with PILLAR. |
| "AI can't be trusted with law" | The AI suggests. A human approves. Every time. |
| "Conflicts will cause problems" | PILLAR finds them. Humans resolve them. |
| "We can't afford it" | DILG compliance is mandatory. PILLAR is subscription-priced. |
| "We need to see it work" | pillar.bayanaihan.net — try it now, free. |
