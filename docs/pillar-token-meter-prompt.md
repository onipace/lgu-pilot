# QoderWork Task Prompt — PILLAR Token Meter

## Context File
Attach: `PILLAR-Architecture-Reference.docx`

## Work Directory
Select: `C:\Users\Emil V. Capino\DATA\QWork\PILLAR`

---

## Starter Prompt

Read the attached PILLAR Architecture Reference document thoroughly first. It describes the complete container architecture, LLM integration via OpenRouter, retrieval pipeline, database schema, and deployment topology for the PILLAR legislative platform.

Your task: **Analyze the architecture document and create a comprehensive implementation plan for a Token Meter system** — a new service that records, tracks, and reports LLM token consumption from every OpenRouter API call made by the PILLAR platform.

### Problem Statement

PILLAR currently makes all LLM calls outbound to OpenRouter (https://openrouter.ai/api/v1) with zero visibility into token consumption. The platform uses multiple models (qwen/qwen3.7-plus for chat/drafting/review/fix/image-OCR, google/gemini-2.5-flash for PDF-OCR) across three AI modules (ELLA, OBRA, YALA). There is no tracking of:
- How many tokens each API call consumes (input vs output)
- Which user or session triggered the call
- Which module (ELLA/OBRA/YALA) and route (/api/chat, /api/obra/draft, /api/obra/review, /api/obra/fix, /api/obra/extract) consumed the tokens
- Daily, weekly, monthly, or yearly consumption trends
- Cost implications (OpenRouter charges per token)

The OpenRouter API response includes a `usage` object with `prompt_tokens`, `completion_tokens`, and `total_tokens`. This data is currently discarded.

### What I Want Built

**1. Token Meter Container** — A lightweight, separate Docker container/service that:
- Exposes a REST API for recording token usage events
- Stores all usage records in its own database (PostgreSQL recommended for time-series aggregation)
- Provides aggregation query endpoints for the admin dashboard
- Runs independently from pillar-pilot (if the meter goes down, PILLAR still works — fire-and-forget recording)

**2. Integration with pillar-pilot** — Modify the existing LLM client (`src/lib/ai/llm.ts`) and the OBRA extract route (`src/app/api/obra/extract/route.ts`) to:
- Capture the `usage` object from every OpenRouter response
- Send a non-blocking POST to the token meter service with: model, input_tokens, output_tokens, module (ella/obra/yala), route, user_id, session_id, and timestamp
- Handle meter service unavailability gracefully (log warning, do not block the LLM response)

**3. Admin Token Meter Dashboard** — A new admin page at `/admin/tokens` that shows:
- **Real-time overview**: Total tokens consumed today, this week, this month, this year with cost estimation
- **Per-module breakdown**: Token consumption split by ELLA, OBRA, YALA with pie/bar charts
- **Per-route breakdown**: Which API routes consume the most tokens
- **Per-user tracking**: Top consumers, average tokens per user, per-session usage
- **Time-series charts**: Daily/weekly/monthly consumption trends with selectable date ranges
- **Cost estimation**: Based on OpenRouter's per-model pricing (configurable)
- **Alert thresholds**: Visual warnings when consumption exceeds configurable daily/monthly budgets
- **Export/Report generation**: Generate comprehensive PDF or CSV reports with all consumption data, filterable by date range, module, user, and route

### Technical Considerations to Deep Think About

- **Fire-and-forget pattern**: The token recording call must be non-blocking. If the meter is slow or down, PILLAR's LLM responses must not be delayed. Consider using a queue, background worker, or a simple try/catch with a short timeout.
- **Streaming responses**: ELLA and YALA use streaming chat (`streamChatResponse`). The `usage` object in streaming responses from OpenRouter may only be available in the final chunk or via the `stream_options: { include_usage: true }` parameter. Plan how to capture usage from streaming vs non-streaming calls differently.
- **Direct fetch calls**: The OBRA extract route bypasses the shared LLM client and calls OpenRouter directly. It also needs to report token usage. Consider whether to create a shared `recordTokenUsage()` utility that both the LLM client and the extract route can call.
- **User attribution**: The streaming chat route (`/api/chat`) has access to user session data via middleware. The OBRA routes also have user context via `withUserAuth`. Plan how to pass user_id through to the token recording call.
- **Cost calculation**: OpenRouter pricing varies by model. qwen/qwen3.7-plus has different input/output rates than gemini-2.5-flash. The meter should store per-model pricing (configurable via admin) and calculate costs on the fly.
- **Data retention**: Token usage data will grow over time. Plan for retention policies (e.g., keep daily granularity forever, but aggregate hourly data after 90 days).
- **Dashboard technology**: Consider using Recharts (already in PILLAR's dependencies) for the admin dashboard charts, or evaluate if a dedicated charting library would be better.
- **Container orchestration**: The token meter needs its own docker-compose entry, health check, and volume. It should join the `esangguni_esangguni-network` so pillar-pilot can reach it. Consider the resource implications on a shared VPS with a 2GB memory limit for pillar-pilot.
- **Existing interaction_logs**: PILLAR already logs chat messages in the `interaction_logs` SQLite table. Consider whether token usage should be recorded there as additional columns, in a separate SQLite table, or in a completely separate PostgreSQL database. Think about the trade-offs: SQLite is simpler but doesn't support concurrent writes from multiple containers; PostgreSQL adds complexity but enables the meter to be a truly independent service.

### Deliverables Expected

1. **Architecture Decision Document** — Which approach you recommend (separate container vs. embedded in pillar-pilot), database choice (PostgreSQL vs. SQLite vs. other), and rationale
2. **Database Schema Design** — Complete table definitions with indexes optimized for time-series aggregation queries
3. **API Specification** — Token recording endpoint, aggregation query endpoints, and report generation endpoints
4. **Integration Plan** — Exactly which files in pillar-pilot need to change and how, with code-level detail
5. **Dashboard Wireframes** — Layout and component breakdown for the admin token meter page
6. **Docker Compose Addition** — The new service definition, health check, volumes, and network configuration
7. **Deployment Plan** — How to add the token meter to the existing VPS deployment without downtime
8. **Cost Model** — How to configure and calculate per-model costs, with current OpenRouter pricing for qwen3.7-plus and gemini-2.5-flash

Start by reading the architecture document, then deep think about the best approach before writing any code. Present the plan first — do not jump to implementation.
