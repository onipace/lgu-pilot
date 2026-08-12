# Alibaba Cloud ECS Pricing Research — Reference for PILLAR Pricing Calculator

**Research Date:** July 21, 2026
**Sources:** Alibaba Cloud official documentation, CloudPriceCalculators.com, CloudPriceIndex.org, Vonng.com ECS cost analysis

---

## 1. Alibaba Cloud Pricing Calculator — UX Pattern

The Alibaba Cloud Pricing Calculator (https://www.alibabacloud.com/pricing-calculator) follows a sequential form-based configuration flow:

**Configuration Steps:**
1. Select **Instance Family** (g7, g8i, c7, c8i, r7, r8i, etc.)
2. Select **Region** (Singapore, Manila, Jakarta, etc.)
3. Specify **vCPU** and **RAM** (or pick a named instance type like ecs.g7.large)
4. Set **Server Count** (quantity)
5. Set **Monthly Runtime Hours** (default 730 hrs/month)
6. Select **Billing Mode**: Pay-as-you-go, Monthly Subscription, 1-Year, 3-Year, 5-Year, Spot
7. Optionally add **Storage** (OSS Standard, ESSD)
8. Optionally add **Outbound Internet Egress** (GB/month)
9. Click **Calculate** → displays "Your Estimated Monthly Alibaba Cloud Cost"

**Result Panel Shows:**
- Estimated monthly cost
- Annualized cost (monthly × 12)
- Configuration summary
- Billing mode
- Region

**Key UX Patterns to Replicate:**
- Real-time price updates as parameters change (no submit button needed for recalculation)
- Side-by-side comparison of different configurations
- Line-item breakdown (compute + storage + bandwidth = total)
- Commitment term selector with visible discount percentages
- Export/share configuration as URL or PDF

---

## 2. ECS Instance Type Specifications (Key Families)

### General Purpose (g-series) — 1:4 vCPU:Memory ratio
Best for PILLAR: web servers, application servers, balanced workloads.

| Instance Type | vCPU | Memory (GiB) | Network (Gbit/s) | PPS (M) |
|--------------|------|-------------|-------------------|---------|
| ecs.g7.large | 2 | 8 | 2/12.5 | 1.1 |
| ecs.g7.xlarge | 4 | 16 | 3/12.5 | 1.1 |
| ecs.g7.2xlarge | 8 | 32 | 5/15 | 1.6 |
| ecs.g7.4xlarge | 16 | 64 | 10/25 | 3 |
| ecs.g7.8xlarge | 32 | 128 | 16/32 | 6 |
| ecs.g8i.large | 2 | 8 | 2.5/15 | 1 |
| ecs.g8i.xlarge | 4 | 16 | 4/15 | 1.2 |
| ecs.g8i.2xlarge | 8 | 32 | 6/15 | 1.6 |
| ecs.g8i.4xlarge | 16 | 64 | 12/25 | 3 |
| ecs.g8i.8xlarge | 32 | 128 | 20/25 | 6 |

### Compute Optimized (c-series) — 1:2 vCPU:Memory ratio
Best for: batch processing, high-performance computing.

| Instance Type | vCPU | Memory (GiB) | Network (Gbit/s) | PPS (M) |
|--------------|------|-------------|-------------------|---------|
| ecs.c7.large | 2 | 4 | 2/12.5 | 1.1 |
| ecs.c7.xlarge | 4 | 8 | 3/12.5 | 1.1 |
| ecs.c7.2xlarge | 8 | 16 | 5/15 | 1.6 |
| ecs.c8i.large | 2 | 4 | 2.5/15 | 1 |
| ecs.c8i.xlarge | 4 | 8 | 4/15 | 1.2 |
| ecs.c8i.2xlarge | 8 | 16 | 6/15 | 1.6 |

### Memory Optimized (r-series) — 1:8 vCPU:Memory ratio
Best for: in-memory databases, real-time analytics.

| Instance Type | vCPU | Memory (GiB) | Network (Gbit/s) | PPS (M) |
|--------------|------|-------------|-------------------|---------|
| ecs.r7.large | 2 | 16 | 2/12.5 | 1.1 |
| ecs.r7.xlarge | 4 | 32 | 3/12.5 | 1.1 |
| ecs.r7.2xlarge | 8 | 64 | 5/15 | 1.6 |
| ecs.r8i.large | 2 | 16 | 2.5/15 | 1 |
| ecs.r8i.xlarge | 4 | 32 | 4/15 | 1.2 |

---

## 3. ECS Pricing (USD)

### Pay-As-You-Go Hourly Rates (per vCPU and per GB RAM)

| Family | vCPU Rate ($/hr) | RAM Rate ($/GB-hr) | Ratio |
|--------|-----------------|-------------------|-------|
| g8i | $0.0268 | $0.0045 | 1:4 |
| g7 | $0.0255 | $0.0043 | 1:4 |
| g8a (AMD) | $0.0242 | $0.0040 | 1:4 |
| c8i | $0.0276 | $0.0059 | 1:2 |
| c7 | $0.0262 | $0.0056 | 1:2 |
| c8a (AMD) | $0.0244 | $0.0052 | 1:2 |
| r7 | $0.0315 | $0.0048 | 1:8 |
| e (economy) | $0.0140 | $0.0023 | — |

### Example Instance Prices (Subscription Monthly, Singapore/Manila Region)

| Instance | vCPU | RAM | Monthly (USD) | Hourly (USD) |
|----------|------|-----|--------------|-------------|
| ecs.g7.large | 2 | 8 GB | ~$61 | ~$0.084 |
| ecs.g7.xlarge | 4 | 16 GB | ~$124 | ~$0.170 |
| ecs.g7.2xlarge | 8 | 32 GB | ~$248 | ~$0.340 |
| ecs.c7.xlarge | 4 | 8 GB | ~$110 | ~$0.150 |
| ecs.g8i.large | 2 | 8 GB | ~$65 | ~$0.089 |
| ecs.g8i.xlarge | 4 | 16 GB | ~$130 | ~$0.178 |

### Commitment Term Discounts (vs. Monthly Subscription)

| Term | Discount | Payment Ratio |
|------|----------|--------------|
| Pay-as-you-go | +50% (premium) | 150% |
| Monthly | Baseline | 100% |
| 1-Year | -35% | 65% |
| 2-Year | -45% | 55% |
| 3-Year | -56% | 44% |
| 5-Year | -70% | 30% |

---

## 4. Regional Pricing Multipliers

| Region | Multiplier | Notes |
|--------|-----------|-------|
| China (Hangzhou, Shanghai, Beijing) | 0.85× | Cheapest |
| Hong Kong | 1.00× | Baseline |
| **Singapore** | **1.00×** | **Baseline — nearest to Philippines** |
| **Malaysia (Kuala Lumpur)** | **1.00×** | **Same as Singapore** |
| **Indonesia (Jakarta)** | **1.00×** | **Same as Singapore** |
| Japan (Tokyo) | 1.05× | +5% |
| US East (Virginia) | 1.00× | Baseline |
| US West (Silicon Valley) | 1.05× | +5% |
| Germany (Frankfurt) | 1.10× | +10% |
| UK (London) | 1.15× | +15% |

**Note:** There is no Alibaba Cloud region in the Philippines. The nearest regions are Singapore and Jakarta, both at 1.00× baseline pricing.

---

## 5. Bandwidth / Data Transfer Pricing

### Pay-by-Bandwidth (Fixed Mbps)
- Charged per Mbps of outbound bandwidth, regardless of actual usage
- Inbound traffic is always free
- Example: 10 Mbps in China (Hangzhou) = ~$76/month (subscription)
- Pay-as-you-go: ~$0.134/hour for 10 Mbps

### Pay-by-Traffic (Per GB)
- Charged per GB of outbound data transfer
- Example rate: ~$0.123/GB in China (Hangzhou)
- Rates vary by region
- Cloud Data Transfer (CDT) offers free monthly allowance + tiered pricing (more traffic = lower per-GB rate)

### Estimated PILLAR Bandwidth Needs

| Tier | Monthly Outbound | Est. Cost (pay-by-traffic) | Est. Cost (pay-by-bandwidth) |
|------|-----------------|--------------------------|---------------------------|
| Low (5 GB) | 5 GB | ~$0.62 | 1 Mbps ≈ $8/mo |
| Medium (20 GB) | 20 GB | ~$2.46 | 3 Mbps ≈ $23/mo |
| High (50 GB) | 50 GB | ~$6.15 | 5 Mbps ≈ $38/mo |

---

## 6. Block Storage (ESSD) Pricing

| Disk Type | IOPS | Throughput | Monthly ($/GB) | 1-Year ($/GB) | 3-Year ($/GB) |
|-----------|------|-----------|---------------|--------------|--------------|
| ESSD PL0 | 10,000 | 180 MB/s | ~$0.07 | ~$0.06 | ~$0.035 |
| ESSD PL1 | 50,000 | 350 MB/s | ~$0.14 | ~$0.12 | ~$0.07 |
| ESSD PL2 | 100,000 | 750 MB/s | ~$0.28 | ~$0.24 | ~$0.14 |
| ESSD PL3 | 1,000,000 | 4 GB/s | ~$0.56 | ~$0.48 | ~$0.28 |

**PILLAR Recommendation:** ESSD PL1 is sufficient for PILLAR deployments (Next.js app + SQLite + Docker images). A 100 GB system disk + 200 GB data disk at PL1 costs approximately $42/month (subscription) or $25/month (3-year commitment).

---

## 7. PILLAR-Specific Infrastructure Sizing

### Current Pilot (Hostinger VPS)
- 8 vCPU / 31 GB RAM / 387 GB disk
- Runs 24 containers including pillar-pilot, lightrag-service, PostgreSQL instances
- Cost: ~$30-50/month (Hostinger VPS pricing)

### Recommended Alibaba Cloud ECS for PILLAR

**Dedicated Instance (1 LGU):**
- **ecs.g7.2xlarge** (8 vCPU, 32 GB RAM) — matches current VPS capacity
- Subscription: ~$248/month, 1-Year: ~$161/month, 3-Year: ~$109/month
- + 100 GB ESSD PL1 system disk: ~$14/month
- + 200 GB ESSD PL1 data disk: ~$28/month
- + 5 Mbps bandwidth: ~$38/month
- **Total dedicated: ~$328/month (subscription) or ~$189/month (3-year)**

**Shared Instance (5 LGUs per ECS):**
- **ecs.g7.8xlarge** (32 vCPU, 128 GB RAM) — 5× the dedicated capacity
- Subscription: ~$992/month, 1-Year: ~$645/month, 3-Year: ~$437/month
- + 500 GB ESSD PL1: ~$70/month
- + 20 Mbps bandwidth: ~$150/month
- **Total shared: ~$1,212/month (subscription) or ~$657/month (3-year)**
- **Per-LGU cost: ~$242/month (subscription) or ~$131/month (3-year)**

**Economy Option (Hostinger VPS equivalent):**
- Hostinger KVM 4: 8 vCPU / 32 GB RAM / 400 GB NVMe
- ~$30-50/month
- Suitable for pilot/evaluation deployments

---

## 8. How to Map to PILLAR Pricing Calculator

### Infrastructure Tier Pricing (Monthly, per LGU)

| Tier | Infrastructure | Est. Monthly Cost | 3-Year Monthly |
|------|---------------|-------------------|----------------|
| Pilot (Hostinger VPS) | Shared VPS, best-effort | $40 | $30 |
| Standard (Shared ECS) | 1/5 of g7.8xlarge | $242 | $131 |
| Professional (Dedicated ECS) | g7.2xlarge dedicated | $328 | $189 |
| Enterprise (Dedicated + HA) | g7.4xlarge + failover | $650+ | $380+ |

### Suggested PILLAR Pricing Structure

The calculator should present pricing in three layers:

**Layer 1: Platform Fee (Monthly Recurring)**
- Covers infrastructure, container orchestration, SSL, domain management
- Varies by infrastructure tier (Pilot/Standard/Professional/Enterprise)

**Layer 2: Module License (Monthly Recurring, per module)**
- Each solution component (ELLA, OBRA, YALA, Hub, etc.) has a monthly license fee
- Bundles available (e.g., "Legislative Suite" = ELLA + OBRA + Knowledge Base at 15% discount)

**Layer 3: Token Credits (Monthly Recurring or Prepaid)**
- AI usage allowance based on OpenRouter consumption
- Tiered: Standard (6M), Professional (24M), Premium (60M), Max (120M), Unlimited
- Overage billed at actual OpenRouter rates + 30% platform fee

**One-Time Fees:**
- Setup & Deployment (per LGU)
- Customization (branding, prompts, integrations)
- Training (admin training, user onboarding)
- Data Migration (knowledge base ingestion, document indexing)

---

## Sources

- [Alibaba Cloud ECS Instance Types](https://www.alibabacloud.com/help/en/ecs/instance-types)
- [Alibaba Cloud ECS Instance Families](https://www.alibabacloud.com/help/en/ecs/user-guide/overview-of-instance-families)
- [Alibaba Cloud Pricing Calculator](https://www.alibabacloud.com/pricing-calculator)
- [Alibaba Cloud Pricing Calculator Review](https://cloudpricecalculators.com/alibaba-calculator/)
- [ECS g7.large Pricing — CloudPriceIndex](https://cloudpriceindex.org/zh/instance/11285)
- [Alibaba Cloud Public Bandwidth Billing](https://www.alibabacloud.com/help/en/ecs/public-bandwidth)
- [Alibaba Cloud ECS Cost Analysis — Vonng/Pigsty](https://vonng.com/en/cloud/ecs/)
- [Alibaba Cloud Pricing Page](https://www.alibabacloud.com/en/pricing)
