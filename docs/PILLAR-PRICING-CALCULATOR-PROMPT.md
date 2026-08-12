# PILLAR Pilot — LGU Pricing Calculator App

## Context Files

Read these documents from the project directory before starting any work:

1. `docs/PILLAR-Architecture-Reference.docx` — Complete container architecture, LLM integration via OpenRouter, retrieval pipeline, database schema, deployment topology, module descriptions (ELLA, OBRA, YALA), and infrastructure specifications. This is the source of truth for what PILLAR is and how it's deployed.

2. `docs/PILLAR-Token-Meter-Implementation-Plan.docx` — Token consumption tracking design, cost model with OpenRouter pricing per model, estimated monthly costs at various usage levels, and per-module cost breakdowns. Use the cost data here as input assumptions for token credit tiers.

3. `docs/TOKEN-METER-VPS-CONNECTIVITY.md` — Current VPS deployment details: Hostinger VPS specs (8 vCPU / 31 GB / 387 GB), Docker container inventory, port allocation, and resource limits. Use this to understand the current single-VPS deployment model and its constraints.

4. `docs/How-Token-Metering-Works.docx` — Plain-language explanation of token consumption with the three-councilor simulation scenario. Use the cost-per-module data and conversation history growth patterns to inform token credit tier sizing.

5. `docs/PILLAR-VPS-Deployment-Guide.md` — Deployment procedures and infrastructure patterns.

6. `docs/ALIBABA-CLOUD-ECS-PRICING-RESEARCH.md` — **Critical reference.** Alibaba Cloud ECS pricing data including: instance type specifications (g7, g8i, c7, c8i, r7 families), USD pricing per vCPU/GB, regional multipliers (Singapore/Manila at 1.00× baseline), bandwidth pricing (pay-by-traffic ~$0.123/GB, pay-by-bandwidth ~$7.60/Mbps/month), ESSD storage pricing ($0.07–$0.56/GB/month by performance level), commitment term discounts (1-year: -35%, 3-year: -56%, 5-year: -70%), and PILLAR-specific infrastructure sizing recommendations (dedicated g7.2xlarge at ~$328/mo, shared 5-LGU g7.8xlarge at ~$242/LGU/mo). Also documents the Alibaba Cloud Pricing Calculator UX pattern (sequential form: family → region → vCPU/RAM → quantity → billing mode → storage → bandwidth → calculate). Use this data as the cost basis for all infrastructure tier pricing in the calculator.

7. `docs/PILLAR-LGU-CLASS-TOKEN-SIZING-RESEARCH.md` — **Critical reference.** Philippine LGU classification under RA 11964 (5 classes: 1st=₱200M+, 2nd=₱160-200M, 3rd=₱130-160M, 4th=₱90-130M, 5th=below ₱90M; 6th class eliminated). City types: HUC (33), ICC (5), Component (~111). Legislative output estimates per LGU class (ordinances: 10-150+/year, resolutions: 40-400+/year). Token consumption per PILLAR workflow (full OBRA ordinance: ~48K tokens, ELLA 5-turn session: ~38K tokens, YALA session: ~5-8K tokens). Monthly token estimates by LGU class (5th class: ~254K tokens/$0.11/mo through HUC: ~10.65M tokens/$4.59/mo). Recommended token credit tiers: Barangay (500K), Municipal (1.5M), Provincial (3M), City (6M), Metro (12M), Metropolitan (25M), Unlimited. LGU class → pricing calculator mapping with pre-selected defaults for infrastructure, tokens, support, and modules.

## Work Directory

`C:\Users\Emil V. Capino\DATA\QWork\PILLAR`

## Starter Prompt

Read all attached context documents thoroughly first. They describe the PILLAR legislative AI platform — its three AI modules (ELLA, OBRA, YALA), its deployment architecture on Docker, its LLM integration via OpenRouter, and its current cost structure.

### What I Want Built

A **PILLAR Pilot LGU Pricing Calculator** — a web application that generates professional deployment quotations and configuration specifications for individual LGUs (Local Government Units) in the Philippines. Think of it as a product configurator similar to the Alibaba Cloud Pricing Calculator or AWS Pricing Calculator, but tailored to PILLAR Pilot's specific deployment model.

### The Business Context

PILLAR Pilot is being offered to Philippine municipalities and provinces as an AI-powered legislative platform. Each LGU deployment has variable costs depending on infrastructure choices, feature selection, support level, and AI usage volume. I need a tool that lets me (or a sales engineer) configure these parameters and instantly generate a professional quotation with itemized pricing, total cost of ownership, and a technical configuration spec.

### Configuration Parameters to Support

**0. LGU Class / City Type (Primary Sizing Parameter)**
This is the **first selection** in the calculator and drives recommended defaults for all other parameters. Based on RA 11964 (Automatic Income Classification of LGUs Act, 2023):

- **Municipality Classes** (by average annual regular income over 3 prior fiscal years):
  - 5th Class — Below ₱90M annual income
  - 4th Class — ₱90M to <₱130M
  - 3rd Class — ₱130M to <₱160M
  - 2nd Class — ₱160M to <₱200M
  - 1st Class — ₱200M and above

- **City Types**:
  - Component City — Part of province, ~111 exist
  - Independent Component City (ICC) — Independent from province, 5 exist
  - Highly Urbanized City (HUC) — Population 200K+, 33 exist

- **City Income Classes** (RA 11964): 5th (<₱500M), 4th (₱500-800M), 3rd (₱800M-1B), 2nd (₱1-1.3B), 1st (₱1.3B+)

**How LGU Class drives defaults** (all overridable):
- Selecting "5th Class Municipality" pre-selects: Shared ECS, Barangay token tier (500K/mo), Email support, ELLA + OBRA + KB modules
- Selecting "1st Class Municipality" pre-selects: Dedicated ECS, Provincial token tier (3M/mo), Email + Remote 8×5, Full suite
- Selecting "HUC" pre-selects: Dedicated ECS + HA, Metropolitan token tier (25M/mo), Dedicated support, Full suite + Hub + Custom

**Legislative volume basis** (from `docs/PILLAR-LGU-CLASS-TOKEN-SIZING-RESEARCH.md`):
- 5th Class: ~10-15 ordinances/year, ~40-60 resolutions/year → ~254K tokens/month
- 1st Class: ~30-50 ordinances/year, ~100-150 resolutions/year → ~2.32M tokens/month
- Component City: ~40-80 ordinances/year, ~120-250 resolutions/year → ~4.34M tokens/month
- HUC: ~80-150+ ordinances/year, ~200-400+ resolutions/year → ~10.65M tokens/month

The calculator should display the estimated legislative volume and token consumption for the selected LGU class, so the buyer understands why a particular token tier is recommended.

**1. Infrastructure Tier**
- **Dedicated ECS Instance** — One Alibaba Cloud ECS instance per LGU (full isolation, higher cost). Reference the current Hostinger VPS specs (8 vCPU / 31 GB / 387 GB) as the baseline for a dedicated instance.
- **Shared ECS Instance** — Up to 5 LGUs sharing one ECS instance (cost-efficient, shared resources). Each LGU gets a containerized deployment with resource limits.
- Consider also: Hostinger VPS (current pilot infrastructure) as a third option for budget-conscious LGUs.

**2. Bandwidth / Network Tier**
- **Low** — Basic usage: occasional chat queries, minimal file uploads. Estimate ~5 GB/month outbound.
- **Medium** — Regular usage: daily chat sessions, periodic document uploads, moderate RAG queries. Estimate ~20 GB/month outbound.
- **High** — Heavy usage: multiple concurrent users, frequent large PDF/image uploads for OBRA extraction, active workshop sessions. Estimate ~50 GB/month outbound.

**3. Solution Components (à la carte module selection)**
- **Landing Page** — Public-facing information page for the LGU
- **E.L.L.A.** (Executive & Legislative Legal Assistant) — Streaming legal research chat with hybrid RAG (LightRAG knowledge graph + BM25 search)
- **O.B.R.A.** (Ordinance Builder & Research Assistant) — Ordinance drafting, compliance review, AI fix application, document extraction (PDF/image OCR), DOCX/PDF export
- **Y.A.L.A.** (Your AI Legislative Assistant) — Citizen-facing municipal information chatbot
- **Public Chat Assistant** — General-purpose public chatbot (non-legislative)
- **Provincial Hub** — Multi-LGU coordination dashboard for provincial governments (includes spoke management, cross-LGU analytics)
- **Knowledge Base Management** — Admin tools for document ingestion, BM25 indexing, LightRAG knowledge graph management
- **Admin Dashboard** — User management, interaction logs, analytics, token metering dashboard

Each component should have a base price and optional add-ons. Some components have dependencies (e.g., ELLA requires Knowledge Base Management; Provincial Hub requires at least 2 spoke deployments).

**4. Support Services**
- **Tier 1: Email Support** — Business hours email response (24-48 hour SLA)
- **Tier 2: Email + Remote Support** — Email + Zoom/remote assistance
  - Mode options: 4 hrs × 5 days, 8 hrs × 5 days, 12 hrs × 5 days, On-demand (per-incident), On-site (per-visit)
- **Tier 3: Dedicated Support** — Named support engineer, priority queue, monthly check-ins

**5. Customization Services**
- **Minor Enhancements** — Branding, logo, color scheme, LGU-specific prompts, custom landing page content
- **Additional Modules** — Custom AI modules beyond ELLA/OBRA/YALA (e.g., budget analysis assistant, constituent feedback analyzer)
- **Productivity Monitoring Tools** — Usage analytics dashboards, adoption tracking, ROI reporting for LGU management
- **Integration Services** — Connect to existing LGU systems (DILG reporting, document management systems)

**6. Token Credits (AI Usage Allowance — Sized by LGU Class)**
Token tiers are mapped to LGU class based on estimated legislative output volume (see `docs/PILLAR-LGU-CLASS-TOKEN-SIZING-RESEARCH.md` for full methodology). Each tier includes a 2–3× buffer over estimated consumption for peak session periods, training, and adoption growth.

| Tier | Monthly Allowance | Target LGU | Est. Raw Cost | Suggested ₱/mo |
|------|------------------|-----------|--------------|----------------|
| **Barangay** | 500K tokens | 5th–4th Class Municipality | $0.22 | ₱250 |
| **Municipal** | 1.5M tokens | 3rd–2nd Class Municipality | $0.65 | ₱650 |
| **Provincial** | 3M tokens | 1st Class Municipality | $1.29 | ₱1,200 |
| **City** | 6M tokens | Component City | $2.58 | ₱2,500 |
| **Metro** | 12M tokens | ICC / Small HUC | $5.16 | ₱5,000 |
| **Metropolitan** | 25M tokens | Large HUC | $10.75 | ₱10,000 |
| **Unlimited** | No cap | Enterprise / Provincial Hub | At-cost + 30% | Custom |

**Legislative volume basis for sizing:**
- Full OBRA ordinance workflow (extract → draft → review → fix): ~48,150 tokens / $0.017
- OBRA resolution (draft → review): ~20,100 tokens / $0.009
- ELLA 5-turn legal research session: ~38,400 tokens / $0.014
- YALA 3-turn citizen session: ~7,800 tokens / $0.003

**Overage handling:**
- Soft cap: Dashboard warning at 80% usage
- Overage billing: Excess tokens at actual OpenRouter rate + 30% platform fee
- Auto-upgrade suggestion: If overage occurs 2+ consecutive months, suggest next tier
- Hard cap option: Admin can set spending limit for government budget compliance

Token pricing references OpenRouter rates: qwen/qwen3.7-plus at $0.27/$0.85 per 1M input/output tokens, google/gemini-2.5-flash at $0.15/$0.60 per 1M tokens. Platform markup of ~3× covers infrastructure, monitoring, support, and R&D.

### What the App Should Generate

For each configured quotation:

1. **Professional Quote Document** (PDF/DOCX) — Itemized pricing table with line items for each selected component, support tier, customization, and token credits. Include subtotal, VAT (12% Philippine VAT), discounts (multi-LGU, annual commitment, pilot program), and grand total. Show both one-time setup costs and recurring monthly/annual costs.

2. **Technical Configuration Spec** — A deployment specification document that the engineering team can use to provision the LGU's infrastructure: ECS instance type, Docker container list, port allocation, domain/subdomain configuration, SSL certificate requirements, environment variables, resource limits, and network topology.

3. **Comparison View** — Side-by-side comparison of different configuration options (e.g., Dedicated vs. Shared ECS, Barangay vs. Municipal vs. Provincial token tiers, 5th Class vs. 1st Class Municipality vs. Component City) so the LGU decision-maker can see the trade-offs.

### Deep Think Requirements

Before writing any code, research and think deeply about:

1. **SaaS Pricing Calculator Best Practices** — How do Alibaba Cloud, AWS, Azure, and Google Cloud structure their pricing calculators? What UX patterns work well for configuration-driven quoting? How do they handle dependencies between components, volume discounts, and commitment terms?

2. **Government Procurement Compatibility** — Philippine LGU procurement follows RA 9184 (Government Procurement Reform Act). Quotations need to support: ABC (Approved Budget for the Contract) alignment, line-item breakdown for bidding, warranty periods, and SLA commitments. Research how government software vendors in the Philippines structure their proposals.

3. **Multi-LGU Deployment Economics** — The current pilot runs on a single Hostinger VPS. For scale, PILLAR will deploy to Alibaba Cloud ECS instances. Think about the cost structure: shared instances (5 LGUs per ECS) vs. dedicated instances. How does the per-LGU cost change at different scales? What are the break-even points?

4. **Token Credit Tier Validation** — The LGU Class research (`docs/PILLAR-LGU-CLASS-TOKEN-SIZING-RESEARCH.md`) proposes 7 token tiers (Barangay through Unlimited) sized by legislative output volume. Validate these tiers: Are the buffers sufficient for peak session periods? How do you handle the conversation history growth effect (longer ELLA conversations cost exponentially more)? Should there be per-module token budgets? What happens when an LGU's actual usage significantly exceeds or falls below the estimate for their class?

5. **Configuration Dependencies** — Some components depend on others. ELLA needs the Knowledge Base. OBRA needs the Knowledge Base + document extraction. Provincial Hub needs at least 2 spokes. Map out all dependencies and enforce them in the calculator UI.

6. **Pricing Model Structure** — Should pricing be per-module monthly subscription? Per-LGU annual license? One-time setup + monthly recurring? Hybrid? Research what works best for government SaaS in the Philippines and Southeast Asia.

7. **LGU-Class-Based Pricing Psychology** — The LGU class selection is both a technical sizing parameter AND a procurement signal. Higher-class LGUs have larger budgets and more complex legislative needs. Think about: How does the calculator present the LGU class selection so it feels like a natural starting point rather than a technical configuration? How do you show the legislative volume estimates (ordinances/year, resolutions/year) so the buyer understands WHY a particular token tier is recommended? How do you handle the sensitivity of income classification (some LGUs may not want to be reminded they're "5th class")? Should the calculator use neutral labels like "Growing Municipality" instead of "5th Class"?

### Deliverables Expected

1. **Pricing Model Document** — Complete pricing matrix for all components, tiers, and options with rationale
2. **Configuration Dependency Map** — Which components require which, what's optional, what's bundled
3. **LGU Class Reference Table** — Quick-reference card mapping each LGU class/city type to recommended infrastructure, token tier, support level, modules, and estimated annual cost. Suitable for printing and sharing with LGU decision-makers.
4. **The Calculator App** — Interactive web application (React or Next.js) with real-time price calculation
5. **Quote Generator** — PDF/DOCX output with professional formatting suitable for government procurement
6. **Technical Spec Generator** — Deployment configuration document output
7. **Admin Panel** — For updating prices, adding new modules, adjusting token tier thresholds, and updating LGU class income thresholds when DOF issues new classification orders

### Technical Preferences

- Build as a standalone Next.js app (can be a new directory within the PILLAR project or a sibling project)
- Use React with Tailwind CSS for the UI
- Recharts for any cost visualization charts
- jsPDF or docx library for document generation
- All pricing data should be configurable (stored in a JSON config or database, not hardcoded)
- The calculator should work offline (no API calls needed for price calculation)
- Philippine Peso (₱) as primary currency with USD equivalent shown

Start by reading all context documents, then deep think about the pricing model and best practices before proposing the architecture. Present the pricing model and app architecture first — do not jump to implementation.
