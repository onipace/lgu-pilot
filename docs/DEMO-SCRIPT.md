# Demo Script: PILLAR — Smart Legislation Platform

**Total Duration:** 2 minutes 30 seconds  
**Frameworks:** PAS (Problem-Agitation-Solution) + AIDA (Attention-Interest-Desire-Action)  
**Live URL:** [pillar.bayanaihan.net](https://pillar.bayanaihan.net)  
**Session:** pillar-likha-linaw-20260809

---

## 1. ATTENTION / INTRODUCTION (0:00 - 0:15) — 15 seconds

**[Show: PILLAR landing page — hero section with tagline]**

> "349 ordinances. 35 years. Zero digitized.
>
> Hi, we're the PILLAR team. I'm Emil, and we built PILLAR to turn a municipality's entire paper archive into searchable, codified law — with AI doing the heavy lifting and humans keeping it legal."

**Key message:** Specificity hook — "349 ordinances, 35 years" creates immediate scale awareness.

---

## 2. INTEREST / PROBLEM (0:15 - 0:45) — 30 seconds

**[Show: Photo of physical ordinance archives / problem visualization slide]**

### PAS Framework

**PROBLEM:**
> "The Sangguniang Bayan of Pitogo, Quezon has 349 ordinances spanning from 1989 to 2025 — all on paper. When Secretary Maria needs to check if Ordinance 2024-015 contradicts something from 2003, she physically pulls three binders and reads them side by side."

**AGITATION:**
> "No search. No cross-references. No way to detect conflicts. DILG compliance? Manual compilation from paper records. Codification under RA 12254? Impossible at this scale. And when Maria retires next year, 35 years of institutional knowledge walks out the door. This is not just a Pitogo problem — every small municipality in the Philippines drowns in the same paper crisis."

**SOLUTION (bridge):**
> "PILLAR changes this. Two AI modules — LIKHA digitizes and publishes, LINAW classifies and codifies. Together, they turn paper into codified law in minutes, not months."

**[Transition: Click into the LIKHA module]**

---

## 3. DESIRE / SOLUTION + FEATURES (0:45 - 2:00) — 75 seconds

### LIKHA Demo (0:45 - 1:10) — 25 seconds

**[Show: LIKHA upload page]**

> "Let me show you LIKHA in action. I have a batch of 5 scanned ordinances here."

**[Action: Upload 5 PDF files via batch upload]**

> "I upload them all at once — up to 10 files, 20 megabytes each. PILLAR hashes every file with SHA-256 before anything else — duplicates are caught instantly."

**[Show: Pipeline processing — OCR in progress]**

> "Now the pipeline runs. Gemini 2.5 Flash extracts text from the PDFs. The AI parses metadata — ordinance number, year, title, section count — with confidence scores on every field."

**[Show: Verification queue with pending_review items]**

> "Here's the critical part. Every single record lands in the verification queue. Maria reviews the extracted metadata, checks the scan side-by-side with the text, and either approves, edits, or rejects. **No AI decision becomes law without a human signing off.**"

**[Action: Approve one record — show status change to 'published']**

> "She approves. The record is published, indexed in BM25 search, and instantly findable. She can also let AI classify it into subject categories — or override the classification herself."

---

### LINAW Demo (1:10 - 1:35) — 25 seconds

**[Transition: Switch to LINAW module]**

> "Now those published ordinances flow into LINAW — either automatically through the L1 interchange, or Maria imports them directly."

**[Show: LINAW inventory dashboard]**

> "The inventory dashboard shows the entire library at a glance — how many ordinances, their status, classification progress."

**[Action: Run classification]**

> "She runs classification. The AI assigns each ordinance to its correct Title, Chapter, and Article in the municipal code. If the AI is wrong, Maria overrides it with a reason — and that reason is logged."

**[Action: Run detect-relationships]**

> "Now the powerful part — cross-reference detection. PILLAR scans all ordinances and finds amendments, repeals, and references automatically. It also detects conflicts — contradictory provisions with evidence excerpts highlighted."

**[Show: Conflict list with evidence]**

> "Every detected relationship requires human confirmation. Maria confirms or rejects each one. The law stays in human hands."

**[Action: Run code assembly]**

> "Finally, she runs the code assembler. PILLAR generates a complete table of contents for the municipal code — organized by Title, Chapter, Article — ready for publication. The municipal code that RA 12254 requires, built in minutes instead of months."

---

### Differentiators (1:35 - 2:00) — 25 seconds

**[Show: Export options / DILG package / L1 interchange]**

> "Three things make PILLAR different from any document management system out there."

> "**First: Mandatory human-in-the-loop.** At every legal decision point — verification, classification override, relationship confirmation — a human must act. The AI suggests, the human decides. This is non-negotiable for legislation."

> "**Second: L1 Interchange format.** LIKHA and LINAW are standalone modules, but they communicate through a portable, hashable interchange format. Export from LIKHA, import into LINAW. Or export to any compatible system. No vendor lock-in."

> "**Third: DILG compliance built in.** One click exports published ordinances in the exact format DILG MC 2026-041 requires. No more manual compilation from paper binders."

---

## 4. ACTION / CLOSE (2:00 - 2:30) — 30 seconds

**[Show: Landing page with QR code overlay + live URL]**

> "The results speak for themselves. 41 test cases, 40 passed — 97.6% pass rate. Zero critical defects. A GO verdict from our UAT."

> "PILLAR is live right now at **pillar.bayanaihan.net**. Scan the QR code, try it yourself."

> "For the judges: the code is open, the architecture is documented, and every design decision is traceable back to a real need from a real Sangguniang Bayan."

> "We built PILLAR because we believe every municipality deserves access to its own laws — searchable, organized, and codified. Not buried in paper binders. Not locked in someone's head. But right there, at their fingertips."

> "**PILLAR — from paper to codified law, one ordinance at a time.**"

> "Thank you. We're the PILLAR team — Emil, and BayanAIhan. We'd love your questions."

---

## Demo Checklist

### Pre-Demo Setup
- [ ] Verify live site is accessible at pillar.bayanaihan.net
- [ ] Have 5 sample scanned ordinances ready (PDF format, mixed quality)
- [ ] Pre-load LIKHA with at least 10 published ordinances for LINAW demo
- [ ] Ensure OpenRouter API is responsive (check /api/health)
- [ ] Have QR code slide ready with pillar.bayanaihan.net
- [ ] Test browser zoom level (1080p recommended for screen share)

### During Demo
- [ ] Keep mouse movements deliberate and slow
- [ ] Pause 1-2 seconds after each status change for audience to register
- [ ] If OCR takes time, fill with narration about the AI model being used
- [ ] If any step fails, skip to the next — do not debug live

### Backup Plan
- [ ] Have pre-recorded screenshots of each step as fallback
- [ ] If live site is down, use local dev server (localhost:3000)
- [ ] If AI is slow, show already-processed records and explain the pipeline

### Timing Guide
| Section | Target | Hard Stop |
|---------|--------|-----------|
| Attention | 15s | 0:15 |
| Problem (PAS) | 30s | 0:45 |
| LIKHA Demo | 25s | 1:10 |
| LINAW Demo | 25s | 1:35 |
| Differentiators | 25s | 2:00 |
| Close (AIDA) | 30s | 2:30 |

---

## Q&A Battle Cards

### "How is this different from Google Drive + OCR?"
> "Google Drive OCRs text. PILLAR understands legislation. It extracts ordinance-specific metadata, classifies by subject, detects legal conflicts between ordinances, and assembles codified volumes. No generic tool does that."

### "What if the AI makes a mistake?"
> "That's exactly why we built mandatory human-in-the-loop. Every AI output — metadata, classification, conflict detection — requires human approval before it becomes part of the legal record. The AI suggests, the human decides."

### "Can this work for cities, not just municipalities?"
> "The architecture is LGU-class-agnostic. The database supports multi-tenancy through lgu_id scoping. A component city or HUC can deploy their own instance with the same codebase."

### "What about data privacy and sovereignty?"
> "All data is stored in the Philippines on our Hostinger VPS. No data leaves the country. AI calls go to OpenRouter for OCR processing, but the ordinance text is processed and stored locally. Session cookies expire in 24 hours. Passwords are scrypt-hashed."

### "How does the L1 interchange work?"
> "It's a JSON package format with a manifest, records, and a SHA-256 package hash. LIKHA exports published ordinances; LINAW imports them. The format is versioned and documented — any system can implement the spec to interoperate with PILLAR."

### "What's your business model?"
> "PILLAR is designed for 4th-to-6th class municipalities. We're exploring a SaaS model with token-based AI metering — LGUs pay for what they use. A pricing calculator is built into the platform."
