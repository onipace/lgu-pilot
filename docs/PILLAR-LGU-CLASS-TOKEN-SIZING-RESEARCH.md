# PILLAR Pilot — LGU Classification & Token Credit Sizing Research

**Research Date:** July 21, 2026
**Purpose:** Define LGU class / city type parameters for the PILLAR Pricing Calculator and map each to appropriate token credit tiers based on estimated legislative output volume.

---

## 1. Philippine LGU Classification System

### 1.1 Municipality Income Classification (RA 11964, signed October 26, 2023)

RA 11964 ("Automatic Income Classification of Local Government Units Act") replaced the old PD 465 system. Key changes: reduced from 6 classes to **5 classes**, classification based on **average annual regular income over 3 prior fiscal years**, and reclassification is now **automatic every 3 years**.

| Class | Annual Regular Income (RA 11964) | Old Threshold (PD 465) |
|-------|----------------------------------|----------------------|
| **1st Class** | ₱200,000,000 and above | ₱55M+ |
| **2nd Class** | ₱160,000,000 – <₱200,000,000 | ₱45M–₱55M |
| **3rd Class** | ₱130,000,000 – <₱160,000,000 | ₱35M–₱45M |
| **4th Class** | ₱90,000,000 – <₱130,000,000 | ₱25M–₱35M |
| **5th Class** | Below ₱90,000,000 | ₱15M–₱25M |
| ~~6th Class~~ | **Eliminated** | ~~Below ₱15M~~ |

**Implementing issuances:** DOF Department Order No. 074-2024, BLGF Memorandum Circular No. 020-2024, IRR published December 2024.

**Distribution:** The majority of the 1,493 municipalities are 4th and 5th class. Under the new higher thresholds, many previously "1st class" municipalities (old ₱55M+ floor) now fall into lower classes.

### 1.2 City Classification Types

| Type | Criteria | Count |
|------|----------|-------|
| **Highly Urbanized City (HUC)** | Population 200,000+ AND annual income ≥₱50M (1991 constant prices); declared by President after plebiscite | **33** |
| **Independent Component City (ICC)** | Charter prohibits residents from voting for provincial officials; independent from province | **5** (Cotabato, Ormoc, Dagupan, Naga, Santiago) |
| **Component City (CC)** | Created by law + plebiscite; avg annual revenue ≥₱20M over 2 consecutive years AND either 150,000 residents or 100 sq km contiguous land; remains part of province | **~111** |
| **Total Cities** | | **149** |

### 1.3 City Income Classification (RA 11964)

| Class | Annual Regular Income |
|-------|----------------------|
| **1st Class City** | ₱1,300,000,000 and above |
| **2nd Class City** | ₱1,000,000,000 – <₱1,300,000,000 |
| **3rd Class City** | ₱800,000,000 – <₱1,000,000,000 |
| **4th Class City** | ₱500,000,000 – <₱800,000,000 |
| **5th Class City** | Below ₱500,000,000 |

---

## 2. Legislative Output Volume Estimates

### 2.1 Session Frequency (RA 7160, Section 52)

- Regular sessions: **at least once per week** for Sangguniang Bayan/Panlungsod/Panlalawigan
- Estimated **48–52 regular sessions per year**, plus special sessions
- In practice, many councils meet 1–3 times per week

### 2.2 Observed Legislative Output Data Points

| LGU | Type | Data | Source |
|-----|------|------|--------|
| Moncada, Tarlac | Municipality | **31 ordinances in 2023** — described as "highest number enacted" | Moncada PIO |
| San Fernando City, La Union | Component City | **6 ordinances + 24 resolutions in June alone** (~30/month) | SP San Fernando City |
| Vigan City | Component City | Reached 100th regular session of 8th City Council | SP Vigan |

### 2.3 Estimated Annual Legislative Output by LGU Class

| LGU Class | Ordinances/Year | Resolutions/Year | Total Legislative Actions/Year |
|-----------|----------------|-----------------|-------------------------------|
| **5th Class Municipality** | 10–15 | 40–60 | 50–75 |
| **4th Class Municipality** | 15–20 | 50–80 | 65–100 |
| **3rd Class Municipality** | 20–30 | 70–100 | 90–130 |
| **2nd Class Municipality** | 25–35 | 80–120 | 105–155 |
| **1st Class Municipality** | 30–50 | 100–150 | 130–200 |
| **Component City** | 40–80 | 120–250 | 160–330 |
| **ICC** | 60–100 | 150–300 | 210–400 |
| **HUC** | 80–150+ | 200–400+ | 280–550+ |

**Assumptions:** Ordinances require full OBRA workflow (extract → draft → review → fix). Resolutions are shorter and may only need draft + review. Not all legislative actions use PILLAR — adoption rates of 30–60% in the first year are realistic.

---

## 3. Token Consumption Per PILLAR Workflow

### 3.1 Per-Operation Token Costs

| Operation | Input Tokens | Output Tokens | Total Tokens | Est. Cost (USD) |
|-----------|-------------|--------------|-------------|-----------------|
| OBRA PDF Extraction | 14,920 | 3,200 | 18,120 | $0.0037 |
| OBRA Image Extraction | 8,720 | 680 | 9,400 | $0.0034 |
| OBRA Draft Generation | 5,000 | 3,800 | 8,800 | $0.0043 |
| OBRA Compliance Review | 8,500 | 2,800 | 11,300 | $0.0047 |
| OBRA Fix Application | 5,750 | 4,200 | 9,950 | $0.0041 |
| ELLA First Question | 2,325 | 1,180 | 3,505 | $0.0016 |
| ELLA 3rd Follow-up | 6,220 | 2,100 | 8,320 | $0.0035 |
| ELLA 5th Follow-up | 11,000 | 1,500 | 12,500 | $0.0042 |
| YALA Citizen Question | 1,815 | 850 | 2,665 | $0.0010 |
| YALA Follow-up | 2,368 | 620 | 2,988 | $0.0012 |

### 3.2 Complete Workflow Totals

| Workflow | Tokens | Cost (USD) |
|----------|--------|-----------|
| **Full OBRA Ordinance** (extract → draft → review → fix) | ~48,150 | $0.017 |
| **OBRA Resolution** (draft → review only) | ~20,100 | $0.009 |
| **ELLA 3-question legal research session** | ~15,800 | $0.006 |
| **ELLA 5-question deep research session** | ~38,400 | $0.014 |
| **YALA 2-question citizen session** | ~5,200 | $0.002 |
| **YALA 3-question citizen session** | ~7,800 | $0.003 |

### 3.3 Critical Cost Driver: Conversation History Growth

ELLA's input tokens grow with each follow-up because the full system prompt + RAG context + conversation history is re-sent every call:

| Turn | Input Tokens | Cumulative Cost |
|------|-------------|----------------|
| 1st question | 2,325 | $0.0016 |
| 2nd question | 3,618 | $0.0042 |
| 3rd question | 6,220 | $0.0077 |
| 4th question | 8,820 | $0.0118 |
| 5th question | 11,000 | $0.0160 |

A 5-turn session costs **2.4× more** than a 3-turn session. This must be factored into token credit sizing.

---

## 4. Monthly Token Estimates by LGU Class

### 4.1 Assumptions

| Parameter | Value |
|-----------|-------|
| PILLAR adoption rate (Year 1) | 40% of legislative actions use OBRA |
| ELLA queries per council member per month | 10–30 depending on LGU class |
| YALA queries per month (citizen-facing) | Varies by population and awareness |
| Council members (Sangguniang Bayan) | 8–10 (regular) + 2 (ex-officio) |
| Council members (Sangguniang Panlungsod) | 10–12 (regular) + 2 (ex-officio) |
| Working months per year | 12 (but peak during session periods) |

### 4.2 Monthly Token Consumption Estimates

| LGU Class | OBRA Tokens/Mo | ELLA Tokens/Mo | YALA Tokens/Mo | **Total Tokens/Mo** | **Est. Monthly Cost** |
|-----------|---------------|---------------|---------------|-------------------|---------------------|
| **5th Class Municipality** | 34K (2 ordinances) | 120K (20 sessions) | 100K (40 sessions) | **~254K** | **$0.11** |
| **4th Class Municipality** | 51K (3 ordinances) | 240K (40 sessions) | 200K (80 sessions) | **~491K** | **$0.21** |
| **3rd Class Municipality** | 85K (5 ordinances) | 420K (70 sessions) | 375K (150 sessions) | **~880K** | **$0.38** |
| **2nd Class Municipality** | 119K (7 ordinances) | 600K (100 sessions) | 625K (250 sessions) | **~1.34M** | **$0.58** |
| **1st Class Municipality** | 170K (10 ordinances) | 900K (150 sessions) | 1.25M (500 sessions) | **~2.32M** | **$1.00** |
| **Component City** | 340K (20 ordinances) | 1.5M (250 sessions) | 2.5M (1,000 sessions) | **~4.34M** | **$1.87** |
| **ICC** | 510K (30 ordinances) | 2.4M (400 sessions) | 3.75M (1,500 sessions) | **~6.66M** | **$2.87** |
| **HUC** | 850K (50 ordinances) | 4.8M (800 sessions) | 5.0M (2,000 sessions) | **~10.65M** | **$4.59** |

### 4.3 Annual Token Consumption and Cost

| LGU Class | Annual Tokens | Annual AI Cost (raw) | With 30% Platform Fee |
|-----------|--------------|---------------------|----------------------|
| 5th Class Municipality | ~3.0M | $1.32 | $1.72 |
| 4th Class Municipality | ~5.9M | $2.52 | $3.28 |
| 3rd Class Municipality | ~10.6M | $4.56 | $5.93 |
| 2nd Class Municipality | ~16.1M | $6.96 | $9.05 |
| 1st Class Municipality | ~27.8M | $12.00 | $15.60 |
| Component City | ~52.1M | $22.44 | $29.17 |
| ICC | ~79.9M | $34.44 | $44.77 |
| HUC | ~127.8M | $55.08 | $71.60 |

---

## 5. Recommended Token Credit Tiers for Pricing Calculator

Based on the estimates above, with generous headroom (2–3× buffer for peak session periods, training, and adoption growth):

| Tier Name | Monthly Token Allowance | Target LGU | Est. Raw Cost | Suggested Price (₱/mo) |
|-----------|----------------------|-----------|--------------|----------------------|
| **Barangay** | 500K | 5th–4th Class Municipality | $0.22 | ₱250 |
| **Municipal** | 1.5M | 3rd–2nd Class Municipality | $0.65 | ₱650 |
| **Provincial** | 3M | 1st Class Municipality | $1.29 | ₱1,200 |
| **City** | 6M | Component City | $2.58 | ₱2,500 |
| **Metro** | 12M | ICC / Small HUC | $5.16 | ₱5,000 |
| **Metropolitan** | 25M | Large HUC | $10.75 | ₱10,000 |
| **Unlimited** | No cap | Enterprise / Provincial Hub | At-cost + 30% | Custom |

**Pricing rationale:**
- Raw OpenRouter cost is marked up ~3× to cover platform overhead (infrastructure, monitoring, support, R&D)
- Prices are rounded to clean numbers for government procurement
- Annual commitment discount: 15% off (pay for 10 months, get 12)
- Multi-LGU provincial bundle: 20% off for 3+ LGUs under one provincial contract
- Pilot program discount: 50% off first 6 months for early adopter LGUs

### 5.1 Overage Handling

When an LGU exceeds their monthly token allowance:
- **Soft cap:** Dashboard shows warning at 80% usage
- **Overage billing:** Excess tokens billed at actual OpenRouter rate + 30% platform fee
- **Auto-upgrade suggestion:** If overage occurs 2+ consecutive months, calculator suggests upgrading to next tier
- **Hard cap option:** Admin can set a hard spending limit to prevent unexpected charges (useful for government budget compliance)

---

## 6. LGU Class → Pricing Calculator Mapping

The pricing calculator should use LGU Class as a **primary sizing parameter** that pre-selects recommended defaults:

| LGU Class Selection | Pre-selected Infrastructure | Pre-selected Token Tier | Pre-selected Support | Recommended Modules |
|--------------------|---------------------------|----------------------|---------------------|-------------------|
| 5th–4th Class Municipality | Shared ECS (5 LGU/instance) | Barangay (500K) | Email only | ELLA + OBRA + KB |
| 3rd–2nd Class Municipality | Shared ECS (5 LGU/instance) | Municipal (1.5M) | Email + Remote (4×5) | ELLA + OBRA + YALA + KB |
| 1st Class Municipality | Dedicated ECS | Provincial (3M) | Email + Remote (8×5) | Full suite |
| Component City | Dedicated ECS | City (6M) | Email + Remote (8×5) | Full suite + Landing |
| ICC | Dedicated ECS | Metro (12M) | Dedicated Support | Full suite + Landing + Hub |
| HUC | Dedicated ECS + HA | Metropolitan (25M) | Dedicated Support | Full suite + Landing + Hub + Custom |

All pre-selections are **editable** — the admin can override any default.

---

## Sources

- [RA 11964 Full Text](https://lawphil.net/statutes/repacts/ra2023/ra_11964_2023.html)
- [PCO: PBBM signs RA 11964](https://pco.gov.ph/news_releases/pbbm-signs-ra-11964-institutionalizing-automatic-lgu-income-classification/)
- [DOF Department Order 074-2024](https://blgf.gov.ph/wp-content/uploads/2025/01/DOF-DO-074.2024.pdf)
- [BLGF MC No. 020-2024](https://blgf.gov.ph/wp-content/uploads/2024/12/04.-BLGF-MC-No.-020.2024.pdf)
- [Wikipedia: Municipalities of the Philippines](https://en.wikipedia.org/wiki/Municipalities_of_the_Philippines)
- [Wikipedia: Cities of the Philippines](https://en.wikipedia.org/wiki/Cities_of_the_Philippines)
- [PhilAtlas: Cities](https://www.philatlas.com/cities.html)
- [DILG: HUCs, ICCs, CCs by Income Class](https://dilg.gov.ph/PDF_File/factsfigures/DILG-Facts_Figures-2011627-88553695cc.pdf)
- [RA 7160 Local Government Code](https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html)
- [Moncada PIO: 31 Ordinances in 2023](https://www.facebook.com/MoncadaPIO/posts/894889855976752/)
- [SP San Fernando City, La Union](https://sp.sanfernandocity.gov.ph/)
- [PILLAR Token Meter Implementation Plan](docs/PILLAR-Token-Meter-Implementation-Plan.docx)
- [How Token Metering Works in PILLAR](docs/How-Token-Metering-Works.docx)
