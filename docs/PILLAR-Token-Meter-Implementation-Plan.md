# PILLAR Token Meter -- Implementation Plan

## Comprehensive Design for LLM Token Consumption Tracking and Reporting

**Project:** PILLAR -- Presiding with Integrity and Legislative Leadership Action Reform
**Scope:** Token Meter service for recording, tracking, and reporting LLM token consumption from every OpenRouter API call
**Date:** July 11, 2026
**Author:** BayanAIhan Engineering

---

## 1. Architecture Decision

### 1.1 The Problem

PILLAR makes all LLM calls outbound to OpenRouter with zero visibility into token consumption. The platform uses multiple models across three AI modules (ELLA, OBRA, YALA) through six distinct API routes. The OpenRouter response includes a `usage` object with `prompt_tokens`, `completion_tokens`, and `total_tokens` -- but this data is currently discarded by every call path:

- `streamChatResponse()` in `src/lib/ai/llm.ts` returns the raw stream and never inspects `response.usage`.
- `chatCompletion()` in `src/lib/ai/llm.ts` extracts only `choices[0].message.content` and discards the rest.
- The OBRA extract route (`/api/obra/extract`) uses a direct `fetch()` call and only reads `choices[0].message.content`.

### 1.2 Decision: Separate Lightweight Container with SQLite

**Recommended approach:** A dedicated `token-meter` Docker container running a minimal Node.js HTTP service backed by SQLite (WAL mode).

**Why a separate container instead of embedding in pillar-pilot:**

The fire-and-forget requirement means token recording must never block or delay LLM responses. A separate container provides true process isolation -- if the token meter is slow, restarting, or completely down, pillar-pilot's LLM pipeline is unaffected. The HTTP call to the meter has a 2-second timeout with a catch-all fallback that logs a warning and moves on. This is architecturally cleaner than trying to achieve the same isolation within a single Node.js process.

A separate container also enables future expansion: other PILLAR services (pillar-hub, pillar-spokes, eSANGGUNI) can report to the same token meter without coupling to pillar-pilot's codebase.

**Why SQLite instead of PostgreSQL:**

The existing VPS already runs 2 PostgreSQL instances (lightrag backing store and pillar-hub). Adding a third would consume approximately 128--256 MB of RAM just for the PostgreSQL process. The token meter is a single-writer workload (pillar-pilot is the only service making LLM calls today) with predictable write volume. SQLite in WAL mode handles this workload trivially -- even at 10,000 API calls per day, that is roughly 1 write per 8 seconds on average.

SQLite also eliminates network hop latency for recording (the meter writes directly to its local volume), simplifies backup (copy one file), and keeps the container's memory footprint under 100 MB.

If token volume grows to millions of events or multi-service concurrent writes become necessary, the meter can be migrated to PostgreSQL (the unused `postgres-pillar-pitogo` container on port 54324 is already available) without changing the recording API.

### 1.3 Resource Budget

| Component | CPU | RAM | Disk |
|-----------|-----|-----|------|
| token-meter container | 0.25 core | 256 MB | 10 MB base + data growth |
| SQLite database file | -- | -- | ~1 KB per 10 events, ~100 KB/month at current volume |

### 1.4 Architecture Diagram

```
                         Hostinger VPS (72.60.104.187)
  +--------------------------------------------------------------------+
  |                                                                    |
  |  +--------------------------------------------------------------+  |
  |  |  pillar-pilot (:3082)                                        |  |
  |  |                                                              |  |
  |  |   ELLA Chat API ----+                                        |  |
  |  |   OBRA Draft API ---+--- recordTokenUsage() --+              |  |
  |  |   OBRA Review API --+    (shared utility)     |              |  |
  |  |   OBRA Fix API -----+                         |              |  |
  |  |   OBRA Extract API -+ (direct fetch)          |              |  |
  |  |   YALA Chat API ----+                         |              |  |
  |  |                                               |              |  |
  |  +-----------------------------------------------|--------------+  |
  |                                                  |                 |
  |                         fire-and-forget POST      |                 |
  |                         (2s timeout, catch-all)   |                 |
  |                                                  v                 |
  |  +--------------------------------------------------------------+  |
  |  |  token-meter (:3084)                                         |  |
  |  |  Node.js HTTP service + SQLite (WAL mode)                    |  |
  |  |                                                              |  |
  |  |  POST /api/record     -- Record a token usage event          |  |
  |  |  GET  /api/stats      -- Aggregated overview (today/W/M/Y)   |  |
  |  |  GET  /api/by-module  -- Per-module breakdown                |  |
  |  |  GET  /api/by-route   -- Per-route breakdown                 |  |
  |  |  GET  /api/by-user    -- Per-user breakdown                  |  |
  |  |  GET  /api/timeseries -- Daily/weekly/monthly trends         |  |
  |  |  GET  /api/costs      -- Cost estimation with model pricing  |  |
  |  |  GET  /api/export     -- CSV/JSON report generation          |  |
  |  |  GET  /health         -- Health check                        |  |
  |  |                                                              |  |
  |  |  SQLite DB: /data/token-meter.db (pillar-token-data volume)  |  |
  |  +--------------------------------------------------------------+  |
  |                                                                    |
  |  esangguni_esangguni-network (shared Docker network)               |
  +--------------------------------------------------------------------+
```

---

## 2. Database Schema Design

### 2.1 token_usage_events (Primary Event Table)

```sql
CREATE TABLE IF NOT EXISTS token_usage_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  model            TEXT NOT NULL,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  total_tokens     INTEGER NOT NULL DEFAULT 0,
  module           TEXT NOT NULL,          -- 'ella' | 'obra' | 'yala'
  route            TEXT NOT NULL,          -- '/api/chat', '/api/obra/draft', etc.
  user_id          TEXT,                   -- user or admin_user id (nullable)
  session_id       TEXT,                   -- participant or admin session id
  cost_usd         REAL DEFAULT 0,        -- calculated at record time
  recorded_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tue_recorded   ON token_usage_events(recorded_at);
CREATE INDEX IF NOT EXISTS idx_tue_module     ON token_usage_events(module);
CREATE INDEX IF NOT EXISTS idx_tue_route      ON token_usage_events(route);
CREATE INDEX IF NOT EXISTS idx_tue_user       ON token_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tue_model      ON token_usage_events(model);
CREATE INDEX IF NOT EXISTS idx_tue_mod_rec    ON token_usage_events(module, recorded_at);
CREATE INDEX IF NOT EXISTS idx_tue_route_rec  ON token_usage_events(route, recorded_at);
```

### 2.2 token_daily_aggregates (Pre-aggregated for Dashboard Speed)

```sql
CREATE TABLE IF NOT EXISTS token_daily_aggregates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  date             TEXT NOT NULL,          -- 'YYYY-MM-DD'
  model            TEXT NOT NULL,
  module           TEXT NOT NULL,
  route            TEXT NOT NULL,
  total_input      INTEGER DEFAULT 0,
  total_output     INTEGER DEFAULT 0,
  total_tokens     INTEGER DEFAULT 0,
  total_cost_usd   REAL DEFAULT 0,
  call_count       INTEGER DEFAULT 0,
  UNIQUE(date, model, module, route)
);

CREATE INDEX IF NOT EXISTS idx_tda_date ON token_daily_aggregates(date);
```

### 2.3 model_pricing (Configurable Per-Model Cost Rates)

```sql
CREATE TABLE IF NOT EXISTS model_pricing (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  model                 TEXT NOT NULL UNIQUE,
  input_price_per_1m    REAL NOT NULL,     -- USD per 1,000,000 input tokens
  output_price_per_1m   REAL NOT NULL,     -- USD per 1,000,000 output tokens
  currency              TEXT DEFAULT 'USD',
  effective_from        TEXT NOT NULL DEFAULT (date('now')),
  is_active             INTEGER DEFAULT 1,
  created_at            TEXT DEFAULT (datetime('now'))
);
```

### 2.4 budget_thresholds (Configurable Alert Limits)

```sql
CREATE TABLE IF NOT EXISTS budget_thresholds (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  period                TEXT NOT NULL UNIQUE, -- 'daily' | 'monthly'
  max_tokens            INTEGER,
  max_cost_usd          REAL,
  alert_percentage      INTEGER DEFAULT 80,   -- warn at 80% of threshold
  is_active             INTEGER DEFAULT 1,
  updated_at            TEXT DEFAULT (datetime('now'))
);
```

### 2.5 Seed Data

```sql
-- Current OpenRouter pricing (as of July 2026, verify before deployment)
INSERT OR IGNORE INTO model_pricing (model, input_price_per_1m, output_price_per_1m)
VALUES
  ('qwen/qwen3.7-plus',      0.27, 0.85),
  ('qwen/qwen3-235b-a22b',   0.27, 0.85),   -- VPS .env.vps model (same family, same pricing)
  ('google/gemini-2.5-flash', 0.15, 0.60);

-- Default budget thresholds
INSERT OR IGNORE INTO budget_thresholds (period, max_tokens, max_cost_usd, alert_percentage)
VALUES
  ('daily',   5000000, 10.00, 80),
  ('monthly', 100000000, 200.00, 80);
```

### 2.6 Aggregation Trigger

A periodic aggregation runs on every record insertion (debounced) or via a cron endpoint. It rolls up the current day's `token_usage_events` into `token_daily_aggregates` using INSERT OR REPLACE with GROUP BY date, model, module, route.

---

## 3. API Specification

### 3.1 Recording Endpoint

**POST /api/record**

Request body:
```json
{
  "model": "qwen/qwen3.7-plus",
  "input_tokens": 2450,
  "output_tokens": 1024,
  "module": "ella",
  "route": "/api/chat",
  "user_id": "user-abc123",
  "session_id": "session-xyz789",
  "timestamp": "2026-07-11T14:30:00Z"
}
```

Response (201 Created):
```json
{ "ok": true, "event_id": "a1b2c3d4..." }
```

Error handling: returns 200 even on partial failures (the caller does not retry). Logs errors internally.

### 3.2 Stats Overview

**GET /api/stats?from=2026-07-01&to=2026-07-11**

Response:
```json
{
  "today": { "total_tokens": 125400, "input_tokens": 98200, "output_tokens": 27200, "cost_usd": 0.052, "call_count": 47 },
  "this_week": { "total_tokens": 876500, "input_tokens": 654300, "output_tokens": 222200, "cost_usd": 0.367, "call_count": 312 },
  "this_month": { "total_tokens": 3245000, "input_tokens": 2456000, "output_tokens": 789000, "cost_usd": 1.332, "call_count": 1187 },
  "this_year": { "total_tokens": 18750000, "input_tokens": 14230000, "output_tokens": 4520000, "cost_usd": 7.693, "call_count": 6842 }
}
```

### 3.3 Per-Module Breakdown

**GET /api/by-module?from=2026-07-01&to=2026-07-11**

Response:
```json
{
  "modules": [
    { "module": "ella", "total_tokens": 1845000, "input_tokens": 1390000, "output_tokens": 455000, "cost_usd": 0.761, "call_count": 423, "percentage": 56.8 },
    { "module": "obra", "total_tokens": 1200000, "input_tokens": 920000, "output_tokens": 280000, "cost_usd": 0.487, "call_count": 187, "percentage": 37.0 },
    { "module": "yala", "total_tokens": 200000, "input_tokens": 146000, "output_tokens": 54000, "cost_usd": 0.084, "call_count": 72, "percentage": 6.2 }
  ]
}
```

### 3.4 Per-Route Breakdown

**GET /api/by-route?from=2026-07-01&to=2026-07-11**

Response:
```json
{
  "routes": [
    { "route": "/api/chat", "module": "ella", "total_tokens": 1845000, "cost_usd": 0.761, "call_count": 423, "avg_tokens_per_call": 4362 },
    { "route": "/api/obra/draft", "module": "obra", "total_tokens": 680000, "cost_usd": 0.276, "call_count": 85, "avg_tokens_per_call": 8000 },
    { "route": "/api/obra/review", "module": "obra", "total_tokens": 320000, "cost_usd": 0.130, "call_count": 52, "avg_tokens_per_call": 6154 },
    { "route": "/api/obra/fix", "module": "obra", "total_tokens": 120000, "cost_usd": 0.049, "call_count": 25, "avg_tokens_per_call": 4800 },
    { "route": "/api/obra/extract", "module": "obra", "total_tokens": 80000, "cost_usd": 0.032, "call_count": 25, "avg_tokens_per_call": 3200 }
  ]
}
```

### 3.5 Per-User Breakdown

**GET /api/by-user?from=2026-07-01&to=2026-07-11&limit=20**

Response:
```json
{
  "users": [
    { "user_id": "user-abc", "user_name": "Juan Dela Cruz", "total_tokens": 450000, "cost_usd": 0.183, "call_count": 156, "avg_tokens_per_call": 2885 },
    { "user_id": "user-def", "user_name": "Maria Santos", "total_tokens": 380000, "cost_usd": 0.154, "call_count": 132, "avg_tokens_per_call": 2879 }
  ]
}
```

### 3.6 Time Series

**GET /api/timeseries?granularity=daily&from=2026-07-01&to=2026-07-11**

Granularity options: `hourly`, `daily`, `weekly`, `monthly`

Response:
```json
{
  "granularity": "daily",
  "data": [
    { "period": "2026-07-01", "total_tokens": 125400, "input_tokens": 98200, "output_tokens": 27200, "cost_usd": 0.052, "call_count": 47 },
    { "period": "2026-07-02", "total_tokens": 134200, "input_tokens": 102100, "output_tokens": 32100, "cost_usd": 0.055, "call_count": 52 }
  ]
}
```

### 3.7 Cost Estimation

**GET /api/costs?from=2026-07-01&to=2026-07-11**

Response includes per-model cost breakdown and projected monthly spend based on recent usage velocity.

### 3.8 Budget Alerts

**GET /api/budgets**

Response:
```json
{
  "daily": { "limit_tokens": 5000000, "limit_usd": 10.00, "used_tokens": 125400, "used_usd": 0.052, "percentage": 2.5, "alert": false },
  "monthly": { "limit_tokens": 100000000, "limit_usd": 200.00, "used_tokens": 3245000, "used_usd": 1.332, "percentage": 3.2, "alert": false }
}
```

### 3.9 Export/Report

**GET /api/export?format=csv&from=2026-07-01&to=2026-07-11&module=ella**

Returns a CSV or JSON file with all token usage events in the specified range, filterable by module, route, and user.

### 3.10 Admin Management

**PUT /api/pricing** -- Update model pricing (admin only).
**PUT /api/budgets** -- Update budget thresholds (admin only).

### 3.11 Health Check

**GET /health**

Response:
```json
{ "status": "ok", "db_size_kb": 245, "total_events": 6842, "uptime_seconds": 86400 }
```

---

## 4. Integration Plan (pillar-pilot Changes)

### 4.1 New File: `src/lib/ai/token-meter.ts`

A shared utility module that both the LLM client and the OBRA extract route can call. This is the single point of integration.

```typescript
// src/lib/ai/token-meter.ts

const METER_URL = process.env.TOKEN_METER_URL || 'http://token-meter:3084';
const METER_TIMEOUT_MS = 2000;

interface TokenUsageEvent {
  model: string;
  input_tokens: number;
  output_tokens: number;
  module: 'ella' | 'obra' | 'yala';
  route: string;
  user_id?: string;
  session_id?: string;
  timestamp?: string;
}

export function recordTokenUsage(event: TokenUsageEvent): void {
  // Fire-and-forget: no await, no throw, short timeout
  fetch(`${METER_URL}/api/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(METER_TIMEOUT_MS),
  })
    .then(res => {
      if (!res.ok) {
        console.warn(`[token-meter] Record failed: ${res.status} ${res.statusText}`);
      }
    })
    .catch(err => {
      // Meter unavailable -- log warning, do not block
      console.warn(`[token-meter] Service unavailable: ${err.message}`);
    });
}
```

Key design choices:

- The function returns `void` (not a Promise). The caller never awaits it.
- `AbortSignal.timeout(2000)` ensures the HTTP call is cancelled after 2 seconds.
- All errors are caught and logged as warnings. The LLM response is never delayed.

### 4.2 Modified File: `src/lib/ai/llm.ts`

**Change 1: Add `stream_options` to the streaming request.**

Add `stream_options: { include_usage: true }` to the `llm.chat.completions.create()` call inside `streamChatResponse`. The function signature and return type are UNCHANGED -- it still returns the raw OpenAI stream object for the caller to iterate. The caller (chat route) is responsible for capturing usage from the final chunk. See Section 5.3 for the complete implementation.

**Change 2: Modify `chatCompletion()` to return usage alongside content.**

Current signature and return:
```typescript
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  // ...
  return response.choices[0]?.message?.content || "";
}
```

New signature and return:
```typescript
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const llm = getLLMClient();

  const response = await llm.chat.completions.create({
    model: getModel(),
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return {
    content: response.choices[0]?.message?.content || "",
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    } : undefined,
  };
}
```

All callers that currently do `const result = await chatCompletion(...)` and expect a string must be updated to `const { content: result } = await chatCompletion(...)` or `const result = await chatCompletion(...); result.content`.

### 4.3 Modified File: `src/app/api/chat/route.ts`

The chat route is the streaming path for ELLA and YALA. Changes:

1. Accept the `context` parameter from `withUserAuth` to access the authenticated user:
   ```typescript
   export const POST = withUserAuth(async (request: NextRequest, context) => {
     const { user } = context;  // UserSession
     const userId = user.user.id;  // UserProfile.id
     // ...
   });
   ```

2. Inside the existing `ReadableStream.start()` handler, add usage capture from stream chunks and call `recordTokenUsage()` after the stream loop completes (see Section 5.3 for the full code pattern).

3. Import `recordTokenUsage` from `@/lib/ai/token-meter`.

No changes to the `streamChatResponse()` call itself -- it is invoked exactly as before.

### 4.4 Modified File: `src/app/api/obra/extract/route.ts`

The extract route uses direct `fetch()` and currently does not accept the `context` parameter from `withUserAuth`. Changes:

1. Update the handler signature to accept `context`:
   ```typescript
   export const POST = withUserAuth(async (request: NextRequest, context) => {
     const userId = context.user.user.id;  // UserProfile.id (NOT context.user.id, which is the session token)
   ```

2. After parsing the OpenRouter response, extract the `usage` object:
   ```typescript
   const data = await response.json();
   const extracted: string = data.choices?.[0]?.message?.content?.trim() ?? "";
   const usage = data.usage;
   ```

3. Before returning the response, fire-and-forget the token recording:
   ```typescript
   if (usage) {
     recordTokenUsage({
       model: isPdf ? PDF_EXTRACT_MODEL : IMAGE_EXTRACT_MODEL,
       input_tokens: usage.prompt_tokens,
       output_tokens: usage.completion_tokens,
       module: 'obra',
       route: '/api/obra/extract',
       user_id: userId,
       session_id: context.user.id,  // session token ID
     });
   }
   ```

4. Import `recordTokenUsage` from `@/lib/ai/token-meter`.

### 4.5 Modified Files: `src/app/api/obra/draft/route.ts`, `src/app/api/obra/review/route.ts`, `src/app/api/obra/fix/route.ts`

All three use `chatCompletion()` which now returns `{ content, usage }`. Since `chatCompletion` is a generic function without knowledge of module/route/user context, each caller must record token usage with the appropriate metadata.

**Draft route changes:**

1. Accept context from `withUserAuth`:
   ```typescript
   export const POST = withUserAuth(async (request: NextRequest, context) => {
     const userId = context.user.user.id;
   ```

2. Destructure the new return type and record usage:
   ```typescript
   const { content: draft, usage } = await chatCompletion(systemPrompt, userPrompt, {
     maxTokens: 4096,
     temperature: 0.5,
   });

   // Fire-and-forget token recording
   if (usage) {
     recordTokenUsage({
       model: process.env.LLM_MODEL || 'qwen/qwen3.7-plus',
       input_tokens: usage.prompt_tokens,
       output_tokens: usage.completion_tokens,
       module: 'obra',
       route: '/api/obra/draft',
       user_id: userId,
       session_id: sessionId,  // from request body
     });
   }

   // Existing code continues to use `draft` as before
   const validationResult = validateAllCitations(draft);
   ```

**Review route changes:** Same pattern -- destructure `{ content: review, usage }`, record with `route: '/api/obra/review'`.

**Fix route changes:** Same pattern -- destructure `{ content: fixedDraft, usage }`, record with `route: '/api/obra/fix'`.

All three routes import `recordTokenUsage` from `@/lib/ai/token-meter`.

### 4.6 Environment Variable Addition

Add to `.env.vps` and `.env.example`:

```
TOKEN_METER_URL=http://token-meter:3084
```

### 4.7 Summary of File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/ai/token-meter.ts` | NEW | Shared fire-and-forget recording utility |
| `src/lib/ai/llm.ts` | MODIFY | Add `stream_options: { include_usage: true }` to stream; `chatCompletion` returns `{ content, usage }` |
| `src/app/api/chat/route.ts` | MODIFY | Accept context from withUserAuth; capture usage from stream chunks; call recordTokenUsage |
| `src/app/api/obra/extract/route.ts` | MODIFY | Accept context from withUserAuth; extract usage from fetch response; call recordTokenUsage |
| `src/app/api/obra/draft/route.ts` | MODIFY | Accept context; destructure `{ content, usage }` from chatCompletion; call recordTokenUsage |
| `src/app/api/obra/review/route.ts` | MODIFY | Accept context; destructure `{ content, usage }` from chatCompletion; call recordTokenUsage |
| `src/app/api/obra/fix/route.ts` | MODIFY | Accept context; destructure `{ content, usage }` from chatCompletion; call recordTokenUsage |
| `src/app/admin/tokens/page.tsx` | NEW | Admin token meter dashboard (Recharts) |
| `src/app/api/admin/tokens/*.ts` | NEW | Proxy routes to token-meter service (auth-gated) |
| `src/app/admin/layout.tsx` | MODIFY | Add "Token Meter" navigation item |
| `.env.vps` | MODIFY | Add TOKEN_METER_URL |
| `.env.example` | MODIFY | Add TOKEN_METER_URL placeholder |

---

## 5. Streaming Usage Capture Strategy

### 5.1 The Challenge

OpenRouter's streaming responses do not include token usage by default. The `usage` object is only present in non-streaming responses. For streaming, the caller must explicitly request usage inclusion.

### 5.2 The Solution: `stream_options.include_usage`

When `stream_options: { include_usage: true }` is passed in the request, OpenRouter includes a final chunk after the last content chunk. This final chunk has:

- `choices: []` (empty array) or `choices: [{ finish_reason: "stop", delta: {} }]`
- `usage: { prompt_tokens: N, completion_tokens: N, total_tokens: N }`

### 5.3 Two-Part Implementation

**Part A: `llm.ts` -- Add `stream_options` to the stream request.**

`streamChatResponse` remains a regular async function that returns the raw OpenAI stream object (it is NOT a generator). The only change is adding `stream_options`:

```typescript
export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  ragContext?: string,
) {
  const llm = getLLMClient();

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const stream = await llm.chat.completions.create({
    model: getModel(),
    max_tokens: 2048,
    temperature: 0.3,
    stream: true,
    stream_options: { include_usage: true },  // NEW: request usage in final chunk
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  return stream;  // unchanged: returns raw stream for caller to iterate
}
```

**Part B: Chat route (`/api/chat/route.ts`) -- Capture usage from chunks.**

The chat route already iterates over the stream inside a `ReadableStream.start()` handler. It captures the `usage` object from any chunk that contains it (the final chunk), then calls `recordTokenUsage()` after the loop completes:

```typescript
// Inside the ReadableStream start() handler:
let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

for await (const chunk of stream) {
  // Capture usage from the final chunk (empty choices + usage object)
  if (chunk.usage) {
    usage = {
      prompt_tokens: chunk.usage.prompt_tokens,
      completion_tokens: chunk.usage.completion_tokens,
      total_tokens: chunk.usage.total_tokens,
    };
  }

  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    fullResponse += content;
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
    );
  }
}

// ... existing citation validation code ...

// Record token usage (fire-and-forget) after stream completes
if (usage) {
  recordTokenUsage({
    model: process.env.LLM_MODEL || 'qwen/qwen3.7-plus',
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    module: module,            // 'ella' or 'yala' from request body
    route: '/api/chat',
    user_id: userId,           // from withUserAuth context
    session_id: sessionId,     // from request body
  });
}
```

The chat route has direct access to all required metadata: `module` comes from the request body, `sessionId` from the request body, and `userId` from the `withUserAuth` context (the route handler signature must be updated to accept the second `context` parameter and destructure `{ user }` from it, where `user.user.id` is the authenticated user's ID).

### 5.4 Fallback for Providers That Don't Support `stream_options`

If OpenRouter or the underlying provider does not support `stream_options`, the `chunk.usage` will simply be undefined. The `recordTokenUsage` call is guarded by `if (usage)`, so it gracefully skips recording without error. This is acceptable -- the admin will see a note in the dashboard indicating that streaming usage may be incomplete for certain providers.

---

## 6. Dashboard Wireframes

### 6.1 Page Layout: `/admin/tokens`

The admin token meter dashboard is a single-page React client component at `src/app/admin/tokens/page.tsx`. It uses Recharts (already a project dependency) for all visualizations.

```
+--------------------------------------------------------------------------+
|  TOKEN METER                                    [Date Range Picker ▼]     |
+--------------------------------------------------------------------------+
|                                                                          |
|  +----------------+  +----------------+  +----------------+  +---------+ |
|  | TODAY          |  | THIS WEEK      |  | THIS MONTH     |  | YEAR    | |
|  | 125,400 tokens |  | 876,500 tokens |  | 3,245,000 tok  |  | 18.7M  | |
|  | $0.052         |  | $0.367         |  | $1.332         |  | $7.69  | |
|  | 47 calls       |  | 312 calls      |  | 1,187 calls    |  | 6,842  | |
|  +----------------+  +----------------+  +----------------+  +---------+ |
|                                                                          |
|  +-- BUDGET STATUS ----------------------------------------+             |
|  | Daily:  [======>          ] 2.5% of 5M tokens ($0.05/10)|             |
|  | Monthly: [==>              ] 3.2% of 100M tokens        |             |
|  +----------------------------------------------------------+             |
|                                                                          |
|  +-- MODULE BREAKDOWN (Pie) -------+  +-- ROUTE BREAKDOWN (Bar) -----+  |
|  |                                 |  |                               |  |
|  |      ╭──────╮                   |  |  /api/chat     ████████████   |  |
|  |    ╱  ELLA   ╲                  |  |  /api/obra/    ██████         |  |
|  |   │  56.8%   │  OBRA 37.0%     |  |    draft                      |  |
|  |    ╲        ╱                   |  |  /api/obra/    ███            |  |
|  |      ╰──────╯  YALA 6.2%       |  |    review                     |  |
|  |                                 |  |  /api/obra/    ██             |  |
|  +---------------------------------+  |    fix                       |  |
|                                       |  /api/obra/    █              |  |
|                                       |    extract                    |  |
|                                       +-------------------------------+  |
|                                                                          |
|  +-- CONSUMPTION TREND (Line Chart) ----------------------------------+  |
|  |                                                                    |  |
|  |   tokens ▲                                                        |  |
|  |          │    ╱╲      ╱╲                                          |  |
|  |          │  ╱    ╲  ╱    ╲  ╱╲                                    |  |
|  |          │╱        ╲      ╲╱  ╲╱                                  |  |
|  |          └──────────────────────────────▶ date                     |  |
|  |                                                                    |  |
|  |  [Granularity: Daily ▼]  [■ Input] [■ Output] [■ Total]          |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +-- TOP USERS (Table) -----------------------------------------------+  |
|  | Rank | User             | Module | Tokens    | Calls | Cost       |  |
|  |------|------------------|--------|-----------|-------|------------|  |
|  | 1    | Juan Dela Cruz   | ELLA   | 450,000   | 156   | $0.183    |  |
|  | 2    | Maria Santos     | OBRA   | 380,000   | 132   | $0.154    |  |
|  | 3    | Pedro Reyes      | ELLA   | 290,000   | 98    | $0.118    |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +-- ACTIONS ---------------------------------------------------------+  |
|  | [Export CSV ▼]  [Export JSON ▼]  [Configure Budgets] [Pricing]    |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### 6.2 Component Breakdown

| Component | Technology | Description |
|-----------|-----------|-------------|
| `TokenStatsCards` | Recharts-free (CSS) | Four summary cards with token counts, costs, and call counts |
| `BudgetStatusBar` | CSS progress bars | Visual budget utilization with color coding (green < 60%, yellow 60-80%, red > 80%) |
| `ModulePieChart` | Recharts `PieChart` | Token distribution by module with percentage labels |
| `RouteBarChart` | Recharts `BarChart` | Horizontal bar chart of token consumption by API route |
| `ConsumptionTrendChart` | Recharts `LineChart` | Multi-line time series with granularity selector and legend |
| `TopUsersTable` | HTML table with sort | Sortable table of highest-consuming users |
| `DateRangePicker` | Custom dropdown | Preset ranges (today, 7 days, 30 days, 90 days, YTD, custom) |
| `ExportControls` | Button group | CSV and JSON export with current filter applied |
| `BudgetConfigModal` | Modal dialog | Edit daily/monthly token and cost thresholds |
| `PricingConfigModal` | Modal dialog | Edit per-model input/output pricing |

### 6.3 Data Flow

1. Page mounts, fetches `/api/admin/tokens/stats`, `/api/admin/tokens/by-module`, `/api/admin/tokens/by-route`, `/api/admin/tokens/by-user`, `/api/admin/tokens/budgets` in parallel.
2. All queries proxy through pillar-pilot's admin API routes (auth-gated with `withAuth`) which forward to the token-meter service.
3. Date range changes trigger re-fetch of all endpoints with updated `from`/`to` parameters.
4. Auto-refresh every 60 seconds for the stats cards and budget status.

---

## 7. Token Meter Service Implementation

### 7.1 Technology Stack

The token meter is a minimal Node.js HTTP service:

- **Runtime:** Node.js 20 Alpine (same base as pillar-pilot for consistency)
- **HTTP Framework:** Native `http` module (no Express overhead for a simple API)
- **Database:** `better-sqlite3` (same library as pillar-pilot, proven reliable)
- **No ORM:** Raw SQL for maximum performance on aggregation queries

### 7.2 Directory Structure

```
token-meter/
  Dockerfile
  package.json
  src/
    server.js          -- HTTP server, routing, request parsing
    db.js              -- SQLite initialization, schema, queries
    routes/
      record.js        -- POST /api/record
      stats.js         -- GET /api/stats
      by-module.js     -- GET /api/by-module
      by-route.js      -- GET /api/by-route
      by-user.js       -- GET /api/by-user
      timeseries.js    -- GET /api/timeseries
      costs.js         -- GET /api/costs
      budgets.js       -- GET /api/budgets, PUT /api/budgets
      export.js        -- GET /api/export
      pricing.js       -- GET /api/pricing, PUT /api/pricing
      health.js        -- GET /health
    aggregation.js     -- Periodic aggregation worker
```

### 7.3 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
RUN addgroup --system --gid 1001 tokenmeter && \
    adduser --system --uid 1001 tokenmeter
USER tokenmeter
EXPOSE 3084
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3084/health || exit 1
CMD ["node", "src/server.js"]
```

---

## 8. Docker Compose Addition

Add to `docker-compose.vps.yml`:

```yaml
services:
  pillar:
    # ... existing configuration unchanged ...
    networks:
      - pillar-network
      - esangguni-network
    environment:
      - TOKEN_METER_URL=http://token-meter:3084
    # Add dependency (optional -- pillar works without meter)
    # depends_on is intentionally omitted for resilience

  token-meter:
    build: ./token-meter
    container_name: token-meter
    restart: unless-stopped
    ports:
      - "127.0.0.1:3084:3084"
    volumes:
      - pillar-token-data:/data
    networks:
      - esangguni-network
    environment:
      - PORT=3084
      - DB_PATH=/data/token-meter.db
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M
          pids: 50
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3084/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

networks:
  pillar-network:
    driver: bridge
  esangguni-network:
    external: true
    name: esangguni_esangguni-network

volumes:
  pillar-data:
  pillar-token-data:    # New volume for token meter database
```

### 8.1 Network Configuration

The token meter joins `esangguni_esangguni-network` (the shared network). This allows pillar-pilot to reach it at `http://token-meter:3084`. The port `3084` is bound to `127.0.0.1` only -- it is not exposed to the internet.

### 8.2 Resource Rationale

The 0.25 CPU / 256 MB limit is generous for what is essentially a write-once-read-occasionally service. The 50 PID limit prevents runaway process spawning. The container should idle at approximately 30-50 MB RAM.

---

## 9. Deployment Plan

### 9.1 Pre-deployment Checklist

1. Verify current VPS memory usage: `docker stats --no-stream`
2. Confirm at least 300 MB free RAM available
3. Back up existing pillar-pilot database: `docker exec pillar-pilot cp /data/pillar-pilot.db /data/pillar-pilot.db.bak.$(date +%Y%m%d)`
4. Review all changes to `llm.ts` locally to ensure no breaking changes to the streaming API

### 9.2 Deployment Steps

**Phase 1: Deploy the token meter service (zero downtime)**

```bash
# 1. SSH into VPS
ssh root@72.60.104.187 -p 2222

# 2. Create the token-meter source directory
mkdir -p /opt/token-meter

# 3. Upload the token-meter source files from local machine
#    (SCP from Windows using tar + ssh cat pattern)

# 4. Add the token-meter service to docker-compose.vps.yml
#    (Append the service definition to the existing compose file)

# 5. Build and start ONLY the token-meter service
cd /opt/pillar-pilot
docker compose -f docker-compose.vps.yml up -d --build token-meter

# 6. Verify health
curl http://127.0.0.1:3084/health
```

**Phase 2: Deploy pillar-pilot changes (brief restart)**

```bash
# 7. Upload modified source files to /opt/pillar-pilot/
#    Modified files:
#    - src/lib/ai/llm.ts
#    - src/lib/ai/token-meter.ts (new)
#    - src/app/api/chat/route.ts
#    - src/app/api/obra/extract/route.ts
#    - src/app/api/obra/draft/route.ts
#    - src/app/api/obra/review/route.ts
#    - src/app/api/obra/fix/route.ts
#    - src/app/admin/tokens/page.tsx (new)
#    - src/app/admin/tokens/layout.tsx (new, if needed)
#    - src/app/api/admin/tokens/[...proxy]/route.ts (new)
#    - .env.vps (add TOKEN_METER_URL)

# 8. Add TOKEN_METER_URL to .env.vps
#    echo "TOKEN_METER_URL=http://token-meter:3084" >> .env.vps

# 9. Rebuild pillar-pilot (this is the only downtime moment, ~2-3 minutes)
docker compose -f docker-compose.vps.yml up -d --build pillar

# 10. Verify pillar-pilot health
curl http://127.0.0.1:3082/api/health

# 11. Verify token recording works (make a test LLM call, then check)
curl http://127.0.0.1:3084/api/stats
```

### 9.3 Rollback Plan

If pillar-pilot fails to start after rebuild:

```bash
# Revert the .env.vps change (remove TOKEN_METER_URL line)
# Revert the source files to previous versions
# Rebuild: docker compose -f docker-compose.vps.yml up -d --build pillar

# The token-meter container can remain running -- it causes no harm
# and pillar-pilot will gracefully log "meter unavailable" warnings
```

### 9.4 Post-deployment Verification

1. Navigate to `https://pillar.bayanaihan.net/admin/tokens` and verify the dashboard loads (empty state).
2. Send a test message through ELLA. Check that the token meter records the event.
3. Refresh the dashboard and confirm the event appears in stats.
4. Test OBRA draft generation. Verify recording.
5. Test OBRA PDF extract. Verify recording (different model: gemini-2.5-flash).
6. Stop the token-meter container and confirm pillar-pilot still works (fire-and-forget resilience).
7. Restart the token-meter container and confirm it resumes recording.

---

## 10. Cost Model

### 10.1 OpenRouter Pricing (Verify Before Deployment)

| Model | Input Price (per 1M tokens) | Output Price (per 1M tokens) | Used For |
|-------|---------------------------|------------------------------|----------|
| `qwen/qwen3.7-plus` | $0.27 | $0.85 | ELLA chat, YALA chat, OBRA draft/review/fix, OBRA image OCR |
| `google/gemini-2.5-flash` | $0.15 | $0.60 | OBRA PDF OCR |

These prices should be verified against the current OpenRouter pricing page at https://openrouter.ai/models before deployment. Prices are configurable via the admin dashboard's Pricing modal.

### 10.2 Cost Calculation Formula

For each token usage event:

```
cost_usd = (input_tokens / 1,000,000 * input_price_per_1m)
         + (output_tokens / 1,000,000 * output_price_per_1m)
```

Example: An ELLA chat response consuming 2,450 input tokens and 1,024 output tokens on `qwen/qwen3.7-plus`:

```
cost = (2450 / 1,000,000 * 0.27) + (1024 / 1,000,000 * 0.85)
     = $0.000661500 + $0.000870400
     = $0.001532 (approximately $0.002 per message)
```

### 10.3 Estimated Monthly Costs at Various Usage Levels

| Daily API Calls | Monthly Calls | Avg Tokens/Call | Monthly Tokens | Est. Monthly Cost |
|----------------|--------------|-----------------|----------------|-------------------|
| 50 | 1,500 | 4,000 | 6,000,000 | $2.50 |
| 200 | 6,000 | 4,000 | 24,000,000 | $10.00 |
| 500 | 15,000 | 4,000 | 60,000,000 | $25.00 |
| 1,000 | 30,000 | 4,000 | 120,000,000 | $50.00 |

### 10.4 Budget Alert Logic

The dashboard displays a visual warning when consumption exceeds the configurable alert percentage (default: 80%) of the daily or monthly budget threshold.

- **Green:** Usage below 60% of threshold -- normal operation.
- **Yellow:** Usage between 60% and 80% -- approaching budget.
- **Red:** Usage above 80% -- budget alert active. The dashboard shows a banner and the budget status bar turns red.

Budget thresholds are stored in the `budget_thresholds` table and configurable through the admin dashboard. They do NOT enforce hard limits (PILLAR does not stop working when the budget is exceeded) -- they are purely informational alerts.

---

## 11. Data Retention Policy

### 11.1 Retention Tiers

| Data Type | Retention | Granularity |
|-----------|-----------|-------------|
| Raw `token_usage_events` | 90 days | Per-event |
| `token_daily_aggregates` | Indefinite | Daily per (model, module, route) |

### 11.2 Cleanup Mechanism

A cleanup job runs daily at midnight (via the aggregation worker or a cron endpoint):

```sql
-- Delete raw events older than 90 days
DELETE FROM token_usage_events
WHERE recorded_at < datetime('now', '-90 days');

-- Daily aggregates are kept forever (they are compact: ~1 row per day per combination)
```

### 11.3 Storage Projection

| Time | Events (at 200/day) | Raw Data Size | Aggregate Size | Total |
|------|---------------------|---------------|----------------|-------|
| 1 month | 6,000 | ~600 KB | ~10 KB | ~610 KB |
| 3 months | 18,000 | ~1.8 MB | ~30 KB | ~1.8 MB |
| After first cleanup | 6,000 (90-day window) | ~600 KB | ~30 KB | ~630 KB |

Storage is negligible. No complex partitioning or archival strategy is needed at this scale.

---

## 12. Admin API Proxy Layer

The token meter runs on an internal network and is not directly accessible from the browser. The admin dashboard communicates with it through proxy API routes in pillar-pilot, gated by admin authentication (`withAuth`).

### 12.1 New Admin API Routes

| Route | Proxies To | Method |
|-------|-----------|--------|
| `/api/admin/tokens/stats` | `token-meter/api/stats` | GET |
| `/api/admin/tokens/by-module` | `token-meter/api/by-module` | GET |
| `/api/admin/tokens/by-route` | `token-meter/api/by-route` | GET |
| `/api/admin/tokens/by-user` | `token-meter/api/by-user` | GET |
| `/api/admin/tokens/timeseries` | `token-meter/api/timeseries` | GET |
| `/api/admin/tokens/costs` | `token-meter/api/costs` | GET |
| `/api/admin/tokens/budgets` | `token-meter/api/budgets` | GET/PUT |
| `/api/admin/tokens/export` | `token-meter/api/export` | GET |
| `/api/admin/tokens/pricing` | `token-meter/api/pricing` | GET/PUT |

### 12.2 Proxy Pattern

Each admin route follows the same pattern:

```typescript
import { withAuth } from '@/lib/auth-middleware';
import { NextResponse } from 'next/server';

const METER_URL = process.env.TOKEN_METER_URL || 'http://token-meter:3084';

export const GET = withAuth(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const meterResponse = await fetch(
    `${METER_URL}/api/stats?${searchParams.toString()}`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!meterResponse.ok) {
    return NextResponse.json(
      { error: 'Token meter unavailable' },
      { status: 503 }
    );
  }

  const data = await meterResponse.json();
  return NextResponse.json(data);
});
```

This ensures that only authenticated admins can query token data, and the token meter's internal network address is never exposed to the browser.

---

## 13. Testing Strategy

### 13.1 Unit Tests

- `token-meter.ts`: Mock `fetch` and verify fire-and-forget behavior (no throw, timeout handling, warning logging).
- `llm.ts`: Verify `chatCompletion` returns `{ content, usage }` structure. Verify `streamChatResponse` captures usage from final chunk.

### 13.2 Integration Tests

- Deploy token-meter locally, send POST to `/api/record`, verify event appears in `/api/stats`.
- Make a real ELLA chat call on the VPS, verify the token event is recorded.

### 13.3 Resilience Tests

- Stop the token-meter container. Verify pillar-pilot LLM calls still work (no delay, no error).
- Restart the token-meter container. Verify recording resumes.
- Send malformed data to `/api/record`. Verify the meter logs the error and returns 400 without crashing.

---

## 14. Implementation Order

The recommended build sequence minimizes risk and enables incremental testing:

| Step | Task | Files | Estimated Effort |
|------|------|-------|-----------------|
| 1 | Build token-meter service (server, DB, routes) | `token-meter/` directory | 4-6 hours |
| 2 | Create Dockerfile and add to docker-compose.vps.yml | `token-meter/Dockerfile`, `docker-compose.vps.yml` | 30 minutes |
| 3 | Deploy token-meter to VPS and verify health | VPS SSH | 15 minutes |
| 4 | Create `src/lib/ai/token-meter.ts` utility | New file | 30 minutes |
| 5 | Modify `src/lib/ai/llm.ts` (stream_options, chatCompletion return type) | 1 file | 1 hour |
| 6 | Update all API routes (chat, draft, review, fix, extract) | 5 files | 2 hours |
| 7 | Create admin proxy routes | 5-9 new route files | 1 hour |
| 8 | Build admin dashboard page | `src/app/admin/tokens/page.tsx` | 4-6 hours |
| 9 | Add navigation item to admin layout | `src/app/admin/layout.tsx` | 10 minutes |
| 10 | Deploy pillar-pilot changes to VPS | VPS SSH + docker compose | 30 minutes |
| 11 | End-to-end testing on VPS | Browser + curl | 1 hour |

**Total estimated effort:** 15-20 hours of focused development.

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `stream_options` not supported by OpenRouter for some models | Streaming usage not recorded | Guard with `if (usage)` check; dashboard shows "streaming usage unavailable" note |
| Token meter container consumes too much VPS memory | Other services affected | Hard 256 MB memory limit; monitor with `docker stats` |
| `chatCompletion` return type change breaks existing callers | Runtime errors in OBRA routes | Update all 3 OBRA routes in same deployment; test each route after deploy |
| OpenRouter pricing changes | Cost estimates become inaccurate | Pricing is admin-configurable; check quarterly |
| SQLite concurrent write contention (future multi-service) | Recording delays | Migrate to PostgreSQL (unused instance available); API contract unchanged |
| Token meter becomes a single point of failure for admin visibility | Dashboard shows 503 | Dashboard shows graceful "meter unavailable" message; pillar-pilot LLM functionality unaffected |
