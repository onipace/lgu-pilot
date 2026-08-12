# PILLAR — From Paper Archives to Codified Law in Minutes

**Turn centuries of paper-bound ordinances into searchable, classified, and codified law — with AI doing the heavy lifting and humans keeping it legal.**

Live: [pillar.bayanaihan.net](https://pillar.bayanaihan.net)

---

## The Problem

The Sangguniang Bayan of Pitogo, Quezon manages **349 ordinances spanning 35 years** (1989-2025) — all stored in physical archives. No digitization. No search. No cross-references. No way to know if a new ordinance contradicts an old one.

The result?

- **DILG compliance is manual and error-prone** — officers flip through paper binders to verify submissions against MC 2026-041
- **Codification is impossible at scale** — RA 12254 requires organized codes, but no LGU in Quezon has completed theirs
- **Institutional knowledge lives in people's heads** — when a secretary retires, 30 years of legislative memory walks out the door
- **Conflicting ordinances go undetected** — new laws accidentally repeal old ones without anyone noticing

This is not just a Pitogo problem. Every 4th-to-6th class municipality in the Philippines faces the same crisis.

---

## Our Solution

PILLAR delivers two standalone AI-powered modules that work independently or together:

### LIKHA — Digitize & Publish
**Legislative Insight & Knowledge Hub for Archives**

LIKHA transforms scanned ordinance PDFs into a searchable, classified, published digital archive. Upload a batch of 10 files and watch them get OCR'd, metadata-extracted, AI-classified, and published — in under 2 minutes. Every legal decision requires mandatory human-in-the-loop approval before publication.

### LINAW — Classify & Codify
**Legislative Indexing for Normalized & Accessible Wisdom**

LINAW takes your ordinance library, classifies each into code titles/chapters/articles, detects cross-references and conflicts between ordinances, and assembles them into published code volumes — the municipal code that RA 12254 demands.

Together, they close the loop: **paper goes in, codified law comes out**.

---

## Key Features

### LIKHA — Digitization & Archive

| Feature | What It Does For You |
|---------|---------------------|
| **Batch Upload (L001)** | Upload up to 10 PDFs/images at once (20 MB each) — SHA-256 deduplication catches duplicates before they waste your time |
| **OCR Wrapper (L002)** | Gemini 2.5 Flash extracts text from PDFs; Qwen 3.7 Plus handles scanned images — both tuned for Philippine ordinance formats |
| **Metadata Parsing (L003)** | AI extracts ordinance number, series year, title, and section count with per-field confidence scores so you know what to verify |
| **Human Verification (L004)** | Every record requires your approve/edit/reject decision before it moves forward — no AI publishes without your sign-off |
| **Publish + BM25 Search (L005)** | Approved records go live in a full-text BM25 search index with self-healing rebuild — find any ordinance in milliseconds |
| **Archive Browser (L006)** | Browse, filter by year/status/subject, and view scan images side-by-side with extracted text in a verification queue |
| **AI Classification (L007)** | Automatic subject-tag classification with confidence scores — override any classification with one click |

### LINAW — Codification & Indexing

| Feature | What It Does For You |
|---------|---------------------|
| **Inventory Dashboard (N001)** | See your entire ordinance library at a glance — counts by status, year, classification progress, and relationship coverage |
| **Code Classification (N002)** | AI assigns each ordinance to its correct Title/Chapter/Article in the municipal code — override with a reason when the AI is wrong |
| **Cross-Reference Scanner (N003)** | Automatically detects amendments, repeals, and references between ordinances — no more manual cross-checking |
| **Conflict Detection (N004)** | Identifies contradictory provisions with evidence excerpts — surface legal conflicts before they become compliance failures |
| **Relationship Confirmation (N005)** | Every AI-detected relationship requires human confirmation or rejection — the law stays in human hands |
| **Code Assembly (N006)** | Generates a complete table of contents for the municipal code from classified, confirmed ordinances — ready for publication |
| **Summaries (N007)** | AI-generated plain-language summaries for each ordinance — make the law accessible to non-lawyers |
| **Bulk Import (N013)** | Import ordinances in JSON, CSV, or DOCX format — up to 500 records per batch with automatic duplicate detection |
| **Scan Upload + OCR (N014)** | Upload scanned ordinance images directly into LINAW's library with built-in OCR — no need to go through LIKHA first |

### Interchange & Compliance

| Feature | What It Does For You |
|---------|---------------------|
| **DILG MC 2026-041 Export (L010)** | One-click export of published ordinances in DILG submission format — compliant JSON attachment ready for upload |
| **LIKHA L1 Interchange (L013)** | Export LIKHA records in the L1 interchange format to transfer to LINAW or any compatible system |
| **LINAW L1 Interchange (N015)** | Export LINAW's classified library as an L1 package — portable, hashable, interoperable |

---

## Who Is This For?

**Maria, the SB Secretary** — Processes ordinances daily. Needs to digitize, classify, and publish without learning complex software. PILLAR gives her a verification queue, not a command line.

**DILG Compliance Officers** — Need to verify that LGU submissions match MC 2026-041 requirements. The DILG export package eliminates manual compilation.

**Municipal Lawyers** — Need to detect conflicting ordinances and build the municipal code. Cross-reference scanning and conflict detection surface issues before they reach the Sanggunian floor.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15.3.8, TypeScript 5, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes (Node.js runtime) |
| **Database** | better-sqlite3 (WAL mode, foreign keys) |
| **AI/OCR** | OpenRouter — google/gemini-2.5-flash (PDF OCR), qwen/qwen3.7-plus (image OCR) |
| **Search** | BM25 (per-module namespaces with self-healing rebuild) |
| **Auth** | scrypt-hashed passwords, session cookies (24h expiry), role-based access |
| **Deployment** | Docker on Hostinger VPS (pillar.bayanaihan.net) |

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- An OpenRouter API key (for AI/OCR features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/pillar.git
cd pillar

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database seed (creates default admin)
npm run dev
```

### Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-...          # OpenRouter API key for AI/OCR
DEFAULT_ADMIN_PASSWORD=...             # Initial super_admin password (seeded on first run)

# Optional
DB_PATH=./data/workshop.db            # SQLite database path (default: data/workshop.db)
NEXT_PUBLIC_APP_URL=https://pillar.bayanaihan.net
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Docker
docker compose up -d
```

---

## Project Structure

```
pillar/
  src/
    app/
      api/
        auth/              # Admin + user authentication
          login/           # Admin login (session creation)
          logout/          # Admin logout (session destruction)
          me/              # Admin session validation
          register/        # Admin user registration
          user/
            login/         # LGU user login
            logout/        # LGU user logout
            me/            # LGU user session check
        likha/             # LIKHA module endpoints
          archive/         # List/search + detail/verification
            [id]/
              scan/        # Authenticated scan streaming
          classify/        # Batch classification + admin override
            [id]/          # Per-record classification override
          export-dilg/     # DILG MC 2026-041 export package
          export-package/  # L1 interchange export
          pipeline/        # OCR + metadata extraction pipeline
          stats/           # Archive statistics
          upload/          # Batch file upload (multipart)
        linaw/             # LINAW module endpoints
          assemble/        # Code assembly (N006)
          classify/        # Code classification (N002)
            [id]/          # Classification override
          code/            # Code volume list
            [id]/          # Code volume detail (TOC)
          conflicts/       # Conflict list (N004)
          detect-relationships/  # Cross-ref + conflict detection
          export-package/  # L1 interchange export (N015)
          import/          # Bulk import (JSON/CSV/DOCX)
          inventory/       # Inventory dashboard (N001)
          library/         # Library list + manual entry
            [id]/          # Library detail + verification
              scan/        # Authenticated scan streaming
        health/            # System health check
      admin/               # Admin dashboard pages
      (module pages)/      # LIKHA + LINAW UI pages
    lib/
      auth.ts              # Admin authentication (scrypt + sessions)
      user-auth.ts         # LGU user authentication
      auth-middleware.ts    # withAuth() wrapper for admin routes
      user-auth-middleware.ts  # withUserAuth() wrapper for module routes
      db.ts                # SQLite schema + connection (better-sqlite3)
      likha/               # LIKHA business logic (agents, search, export)
      linaw/               # LINAW business logic (agents, import, export)
      ai/                  # LLM integration (OpenRouter, prompts, RAG)
    types/                 # TypeScript interfaces
  data/                    # SQLite DB + uploaded files
  tests/                   # Unit + integration tests
  docs/                    # Documentation
  docker-compose.vps.yml   # Production Docker Compose
  Dockerfile               # Container build
```

---

## API Overview

Full API documentation: [docs/API.md](docs/API.md)

### Quick Reference

| Module | Endpoint | Method | Purpose |
|--------|----------|--------|---------|
| Auth | `/api/auth/user/login` | POST | LGU user login |
| Auth | `/api/auth/user/logout` | POST | LGU user logout |
| Auth | `/api/auth/user/me` | GET | Session check |
| LIKHA | `/api/likha/upload` | POST | Batch file upload |
| LIKHA | `/api/likha/pipeline` | POST | OCR + metadata extraction |
| LIKHA | `/api/likha/archive` | GET | List/search archives |
| LIKHA | `/api/likha/archive/:id` | GET/PUT | Detail + verification |
| LIKHA | `/api/likha/archive/:id/scan` | GET | Scan image stream |
| LIKHA | `/api/likha/classify` | POST | Batch classification |
| LIKHA | `/api/likha/classify/:id` | PUT | Classification override |
| LIKHA | `/api/likha/stats` | GET | Archive statistics |
| LIKHA | `/api/likha/export-dilg` | POST | DILG export package |
| LIKHA | `/api/likha/export-package` | POST | L1 interchange export |
| LINAW | `/api/linaw/import` | POST | Bulk import (JSON/CSV/DOCX) |
| LINAW | `/api/linaw/library` | GET/PUT | Library list + manual entry |
| LINAW | `/api/linaw/library/:id` | GET/PUT | Detail + verification |
| LINAW | `/api/linaw/library/:id/scan` | GET | Scan image stream |
| LINAW | `/api/linaw/inventory` | GET | Inventory dashboard |
| LINAW | `/api/linaw/classify` | POST | Code classification |
| LINAW | `/api/linaw/classify/:id` | PUT | Classification override |
| LINAW | `/api/linaw/detect-relationships` | POST | Cross-ref + conflict detection |
| LINAW | `/api/linaw/conflicts` | GET | Conflict list |
| LINAW | `/api/linaw/assemble` | POST | Code assembly |
| LINAW | `/api/linaw/code` | GET | Code volume list |
| LINAW | `/api/linaw/code/:id` | GET | Code volume detail |
| LINAW | `/api/linaw/export-package` | POST | L1 interchange export |
| Health | `/api/health` | GET | System health check |

---

## Testing & Quality

### UAT Results

| Metric | Result |
|--------|--------|
| **Test Cases** | 41 |
| **Passed** | 40 |
| **Failed** | 1 (cosmetic, non-blocking) |
| **Pass Rate** | 97.6% |
| **Critical Defects** | 0 |
| **Verdict** | **GO** |

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration
```

---

## Compliance

- **DILG MC 2026-041** — Export format matches the memorandum circular's submission requirements
- **RA 12254** — Codification workflow produces code volumes organized by Title/Chapter/Article
- **Data Sovereignty** — All data stored in the Philippines (Hostinger VPS, Singapore region available)
- **Human-in-the-Loop** — Every AI decision at a legal gate requires human approval before persistence

---

## Team

**PILLAR Smart Legislation Team** — BayanAIhan

- **Emil V. Capino** — Team Lead, Architecture & Development
- **BayanAIhan** — AI Engineering & LGU Domain Expertise

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>PILLAR</strong> — Presiding with Integrity and Legislative Leadership Action Reform<br>
  Built for the Sangguniang Bayan of Pitogo, Quezon<br>
  <a href="https://pillar.bayanaihan.net">pillar.bayanaihan.net</a>
</p>
