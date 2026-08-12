# How Token Metering Works in PILLAR

## A Plain-Language Guide for Administrators and Stakeholders

**PILLAR** — Presiding with Integrity and Legislative Leadership Action Reform
**Document Date:** July 11, 2026
**Audience:** LGU administrators, SB members, technical staff, and stakeholders

---

## 1. What Are Tokens?

Every time PILLAR asks an AI model a question — whether ELLA is researching law, OBRA is drafting an ordinance, or YALA is answering a citizen query — it sends a message to OpenRouter and gets a response back. Both the message sent and the response received are measured in **tokens**.

Tokens are roughly pieces of words. As a rule of thumb, one English word is about 1 to 1.5 tokens. The word "ordinance" is about 2 tokens. "R.A. 7160" is about 3 tokens. A full paragraph of legal text might be 80 to 150 tokens. Filipino and Tagalog words tend to use slightly more tokens per word than English because of how the tokenizer splits syllables.

OpenRouter tells us exactly how many tokens went in (input) and how many came back (output) in every response. This information arrives in a small `usage` object attached to each API response:

```
{
  "prompt_tokens": 2325,      ← everything PILLAR sent
  "completion_tokens": 1180,  ← everything the AI wrote back
  "total_tokens": 3505        ← the sum of both
}
```

### What Counts as Input Tokens

Input tokens are **everything** PILLAR sends to the AI model in a single call. This is more than just the user's question. A typical ELLA call includes:

- **System prompt** (~800 tokens) — Instructions like "You are a Philippine local government legal expert. Cite R.A. 7160 sections and DILG opinions..."
- **RAG context** (~1,000 to 2,000 tokens) — Relevant laws, ordinances, and legal opinions pulled from the knowledge base (LightRAG knowledge graph + BM25 search index)
- **Conversation history** (~1,000 to 9,000 tokens) — All previous messages in the current chat session, sent so the AI can maintain context
- **User's actual question** (~15 to 50 tokens) — The question the user typed

This means the user's question is often just a tiny fraction of the total input. The system prompt and RAG context are re-sent with every call, and the conversation history grows longer with each exchange.

### What Counts as Output Tokens

Output tokens are the AI's response — the legal analysis, draft ordinance text, compliance review, or citizen-friendly answer. Output tokens vary widely depending on the task:

- A short YALA answer about office hours might be 380 tokens
- An ELLA legal analysis citing multiple R.A. 7160 sections might be 1,200 tokens
- An OBRA ordinance draft with full WHEREAS clauses and numbered sections might be 3,800 tokens

---

## 2. The Problem: Invisible Consumption

Right now, PILLAR **throws that information away**. Every API response from OpenRouter includes the `usage` object, but the current code extracts only the text content and discards the rest. This means:

- There is no record of how many tokens each API call consumes
- No way to know which user or session triggered the most expensive calls
- No visibility into which module (ELLA, OBRA, or YALA) drives the most consumption
- No tracking of daily, weekly, monthly, or yearly consumption trends
- No way to estimate costs before receiving the OpenRouter bill

OpenRouter charges per token, and different models have different rates. Without tracking, administrators have zero visibility into spending until the invoice arrives.

---

## 3. The Solution: Token Meter

The Token Meter is a lightweight service that records every token usage event. After every AI call, PILLAR quietly fires off a tiny background message to the token meter service saying:

> "This call used 2,325 input tokens and 1,180 output tokens. It came from ELLA, user Councilor Reyes, route /api/chat, model qwen/qwen3.7-plus."

This recording happens in the background and never delays the user's response. If the meter service is slow or temporarily unavailable, PILLAR logs a warning and keeps working — the user's experience is completely unaffected.

### The Fire-and-Forget Pattern

The diagram below shows how token data flows through the system:

![Token Metering Flow Diagram — All 5 Steps](images/token-flow-professional.png)

The flow works like this:

1. **User's browser** sends a request to pillar-pilot (e.g., an ELLA question)
2. **pillar-pilot** builds a comprehensive prompt — combining system instructions, RAG context from the knowledge base, conversation history, and the user's question — and sends it to **OpenRouter API**
3. **OpenRouter** processes the request and returns a response that includes a `usage` object with `prompt_tokens` and `completion_tokens`
4. **pillar-pilot** extracts the usage data from the response
5. **pillar-pilot** fires a non-blocking POST request (with a 2-second timeout) to the separate **token-meter** service, which writes the event to its **SQLite** database tagged with `user_id`, `module`, `route`, and `timestamp`

Steps 1 through 4 are the normal request flow that already exists today. Step 5 is the only new addition — and it runs asynchronously, meaning PILLAR doesn't wait for it to complete before responding to the user.

---

## 4. How Token Usage Gets Grouped and Aggregated

Each recorded event carries five tags that make it queryable from every angle:

| Tag | Example Values | What It Tells You |
|-----|---------------|-------------------|
| **user_id** | Councilor Reyes, Councilor Santos | Who triggered the call |
| **session_id** | sess-abc123 | Which login session it belongs to |
| **module** | ella, obra, yala | Which PILLAR module was used |
| **route** | /api/chat, /api/obra/draft, /api/obra/extract | Which specific action was performed |
| **timestamp** | 2026-07-11 14:30:00 | When the call happened |

The meter stores every individual event in a database table. It also periodically rolls these events up into daily summaries grouped by model + module + route, which makes dashboard queries fast even after months of data.

The admin dashboard at `/admin/tokens` queries these tables to produce breakdowns:

- **By module** — How much ELLA vs. OBRA vs. YALA consumed
- **By route** — Which actions are most expensive (chat vs. drafting vs. PDF extraction)
- **By user** — Who uses the most tokens
- **By time period** — Daily, weekly, monthly, and yearly trends

These are all just different filters on the same underlying data. The "this month" view filters events from the past 30 days. The "by module" view groups them by the module tag. The "by user" view groups by user_id.

---

## 5. Live Scenario: Three Councilors, One Session

To make this concrete, consider a realistic scenario where three SB councilors use PILLAR simultaneously:

### The Scenario

- **Councilor Reyes** signs in and opens ELLA. Asks "Can a road be closed for 10 days with just a resolution?" then asks two more follow-up questions, requests a sample resolution draft, and asks for a summary of all legal citations.
- **Councilor Santos** signs in and opens OBRA. Uploads a scanned PDF ordinance for text extraction, then uploads an image of a handwritten amendment page, reviews the extracted text, clicks "Analyze Draft" for compliance review, applies fixes, and generates a new tax ordinance.
- **Councilor Villanueva** signs in and opens YALA. Asks about business permit application process, sari-sari store permit costs, and Municipal Hall location and hours.

### What Happens Under the Hood

Each user action triggers one or more API calls to OpenRouter. Across the three councilors, **13 API calls** are made. The Token Meter records each one.

### Simulation: Mid-Scenario Dashboard

After 7 of the 13 calls have been processed, the admin dashboard looks like this:

![Simulation mid-run: 7 of 13 API calls recorded](images/simulation-mid-run.png)

The left panel shows each individual API call as it arrives — tagged with the user's name, the module they're using (ELLA in blue, OBRA in brown, YALA in green), the specific API route, a description of what they did, and the token counts. The right panel shows real-time aggregations: total tokens consumed, split between input and output, estimated cost, and breakdowns by module, route, and user.

### Simulation: Completed Scenario

After all 13 calls complete:

![Simulation complete: all 13 API calls recorded](images/simulation-complete.png)

The totals tell the story: **94,428 total tokens** consumed across 13 calls, with an estimated cost of **$0.0284**. Councilor Santos' OBRA session consumed the most (42,690 tokens across 4 calls) because PDF extraction and ordinance drafting are token-intensive tasks. Councilor Villanueva's YALA queries were the lightest (8,755 tokens across 3 calls) because citizen information answers tend to be shorter.

### The Conversation History Effect

One of the most important patterns the Token Meter reveals is how **input tokens grow with every follow-up question**. Look at Councilor Reyes' ELLA session:

| Call | Action | Input Tokens | Why |
|------|--------|-------------|-----|
| 1st | First question | 2,325 | System prompt + RAG context + short question |
| 2nd | First follow-up | 3,618 | Everything above + full Q1 conversation |
| 3rd | "Draft a sample resolution" | 6,220 | Everything above + Q1 and Q2 conversation |
| 4th | "Publication requirements?" | 8,820 | Growing conversation history |
| 5th | "Summarize all citations" | 11,000 | Full 4-turn conversation + all RAG context |

Each call re-sends the **entire** system prompt, all RAG context, and the full conversation history so the AI can understand what was discussed previously. This is how large language models work — they have no memory between calls, so the full context must be provided every time.

This means a 10-turn ELLA conversation can consume 5 to 10 times more input tokens than a 2-turn conversation, even if the questions themselves are short. The Token Meter makes this pattern visible so administrators can understand why some sessions cost more than others.

### Why OBRA Costs More Per Call

OBRA operations tend to consume more tokens per call than ELLA or YALA because:

- **PDF/image extraction** sends base64-encoded file content, which can be 10,000+ tokens for a single scanned page
- **Compliance review** sends the full ordinance text plus all RAG context for citation cross-referencing
- **Draft generation** produces long structured output (WHEREAS clauses, numbered sections, penalty provisions, effectivity clauses)
- **Fix application** re-sends the full draft plus the list of issues to fix

A single OBRA session with upload + review + fix + draft can easily consume 40,000+ tokens, while a YALA citizen Q&A session might use only 3,000 tokens per question.

---

## 6. What the Admin Dashboard Shows

The Token Meter dashboard at `/admin/tokens` provides six views of consumption data:

### Summary Cards

Four cards at the top show total tokens, input tokens, output tokens, and estimated cost for today, this week, this month, and this year. These update in real time as API calls are recorded.

### Budget Status Bars

Visual progress bars show how close consumption is to configured daily and monthly budget thresholds. Colors indicate status: green (under 60%), yellow (60-80%), and red (over 80%). These thresholds are configurable by administrators and serve as early warnings — they do not enforce hard limits or block PILLAR from working.

### Module Breakdown (Pie Chart)

Shows the percentage of total token consumption attributed to ELLA, OBRA, and YALA. This helps administrators understand which module drives the most AI usage.

### Route Breakdown (Bar Chart)

Shows token consumption per API route. This reveals which specific actions are most expensive — for example, `/api/obra/extract` (PDF/image extraction) typically appears at the top because base64 file content is token-heavy.

### Consumption Trend (Line Chart)

A time-series chart showing daily, weekly, or monthly token consumption over time. This reveals usage patterns: are councilors using PILLAR more during session periods? Is there a spike before ordinance deadlines?

### Per-User Table

A sortable table showing each user's total token consumption, call count, average tokens per call, and estimated cost. This identifies power users and helps attribute costs to specific departments or offices.

### Export and Reports

Administrators can export consumption data as CSV or JSON, filtered by date range, module, route, and user. These reports can be attached to budget proposals or shared with the Municipal Administrator for cost allocation.

---

## 7. Cost Model: How Much Does PILLAR Actually Cost?

OpenRouter charges per million tokens, with different rates for different models:

| Model | Input Price (per 1M tokens) | Output Price (per 1M tokens) | Used For |
|-------|---------------------------|------------------------------|----------|
| qwen/qwen3.7-plus | $0.27 | $0.85 | ELLA chat, YALA chat, OBRA draft/review/fix, OBRA image OCR |
| google/gemini-2.5-flash | $0.15 | $0.60 | OBRA PDF OCR |

Output tokens cost roughly 3 times more than input tokens because generating text requires more computational effort than processing it.

### The Scenario Cost

In our three-councilor scenario with 13 API calls and 94,428 total tokens, the estimated cost was **$0.0284** — less than 3 centavos. At this rate:

| Usage Level | Daily Calls | Monthly Tokens | Est. Monthly Cost |
|-------------|------------|----------------|-------------------|
| Light (5 councilors, occasional use) | 50 | 6,000,000 | ~$2.50 |
| Moderate (15 councilors, daily use) | 200 | 24,000,000 | ~$10.00 |
| Heavy (30+ users, active sessions) | 500 | 60,000,000 | ~$25.00 |
| Peak (workshop or session period) | 1,000 | 120,000,000 | ~$50.00 |

These estimates assume an average of 4,000 tokens per call (a mix of short YALA answers and long OBRA drafts). The actual cost per call varies widely: an ELLA follow-up question might cost $0.002, while an OBRA PDF extraction might cost $0.004.

### Cost Per Module (Typical Ranges)

| Module | Typical Tokens Per Call | Typical Cost Per Call |
|--------|------------------------|-----------------------|
| ELLA (first question) | 3,500 | $0.002 |
| ELLA (5th follow-up) | 12,500 | $0.005 |
| OBRA draft generation | 8,800 | $0.005 |
| OBRA compliance review | 11,300 | $0.005 |
| OBRA PDF extraction | 18,100 | $0.004 |
| OBRA image extraction | 9,400 | $0.003 |
| OBRA fix application | 9,950 | $0.005 |
| YALA citizen question | 2,600 | $0.001 |

---

## 8. Technical Details (For IT Staff)

### Architecture

The Token Meter runs as a separate Docker container (`token-meter`) on the same VPS as pillar-pilot. It is a minimal Node.js HTTP service backed by SQLite in WAL mode. It joins the shared Docker network (`esangguni_esangguni-network`) so pillar-pilot can reach it at `http://token-meter:3084`.

Resource limits: 0.25 CPU core, 256 MB RAM, 50 PIDs. The container typically idles at 30-50 MB RAM.

### Recording Utility

A shared TypeScript utility (`src/lib/ai/token-meter.ts`) provides the `recordTokenUsage()` function. It sends a non-blocking POST to the meter with a 2-second timeout using `AbortSignal.timeout()`. All errors are caught and logged as warnings — the function never throws or delays the LLM response.

### Streaming vs. Non-Streaming Capture

ELLA and YALA use streaming responses (Server-Sent Events). For these, the OpenAI SDK is configured with `stream_options: { include_usage: true }`, which causes OpenRouter to include a `usage` object in the final stream chunk. The chat route's ReadableStream handler captures this usage after the stream completes.

OBRA routes (draft, review, fix) use non-streaming responses. The `chatCompletion()` function returns `{ content, usage }`, and the calling route records the usage immediately.

The OBRA extract route uses a direct `fetch()` call (bypassing the shared LLM client because it needs to send base64-encoded file content). It extracts the `usage` object from the response JSON directly.

### Data Retention

Raw token usage events are kept for 90 days. After that, they are deleted to control database size. Daily aggregates (grouped by date, model, module, and route) are kept indefinitely — these compact summaries provide historical trend data without the storage cost of individual events.

At current usage levels (~200 calls per day), the database grows at approximately 100 KB per month. Storage is negligible.

### Admin Access

The token meter is not directly accessible from the internet (bound to 127.0.0.1 only). The admin dashboard communicates with it through proxy API routes in pillar-pilot, protected by admin authentication. Only authenticated super_admin or lgu_admin users can view token consumption data.

---

## 9. Frequently Asked Questions

**Does the Token Meter slow down PILLAR?**
No. The recording call runs asynchronously with a 2-second timeout. If the meter is unreachable, PILLAR logs a warning and continues normally. Users will never notice a difference.

**What happens if the Token Meter goes down?**
PILLAR keeps working. All LLM calls proceed as normal. The only impact is that token usage during the outage is not recorded. When the meter comes back online, recording resumes automatically.

**Can users see their own token usage?**
Not in the initial version. The dashboard is admin-only. Future versions may include a per-user usage summary visible to the user.

**Do budget thresholds block PILLAR from working?**
No. Budget thresholds are informational alerts only. The dashboard shows visual warnings when consumption exceeds configured limits, but PILLAR never stops working because of budget alerts.

**Why does an ELLA conversation get more expensive as it goes on?**
Because every call re-sends the full system prompt, all RAG context, and the entire conversation history. A 10-turn conversation sends approximately 5 times more input tokens than a 2-turn conversation, even if the questions are short. This is how large language models work — they need full context for every response.

**How accurate is the cost estimation?**
The cost is calculated using OpenRouter's published per-model pricing, which is configurable in the admin dashboard. Prices should be verified quarterly against the OpenRouter pricing page.

**Does plain text extraction (uploading a .txt file in OBRA) consume tokens?**
No. Plain text files are read directly without calling OpenRouter. Only image and PDF extraction trigger LLM API calls.

---

*This document is part of the PILLAR Token Meter implementation. For the full technical implementation plan including database schema, API specification, Docker Compose configuration, and deployment instructions, refer to the PILLAR Token Meter Implementation Plan.*
