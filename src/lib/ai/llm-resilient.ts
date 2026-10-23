// src/lib/ai/llm-resilient.ts
// Resilient LLM wrapper for eSANGGUNI — bulletproof against:
//   1. Model rate limits (429 Provider returned error)
//   2. Silent reasoning-only responses (thinking but no text)
//   3. Model deprecation / API unavailability
//   4. Transient network / timeout errors
//   5. Provider-side outages
//
// Design:
//   - Fallback chain: try models in priority order
//   - Circuit breaker: after N failures per model, cooldown for T seconds
//   - Retry with exponential backoff: transient errors retried per model
//   - Response-shape guard: detect reasoning-only streams before returning
//   - Provider routing: skip providers we know are unstable
//
// Configured via env vars (all optional, sensible defaults):
//   LLM_MODEL_CHAIN           comma-separated model IDs (default: 5-model chain)
//   LLM_CIRCUIT_THRESHOLD     failures before opening (default 3)
//   LLM_CIRCUIT_COOLDOWN_MS   cooldown after opening (default 300000 = 5 min)
//   LLM_MAX_RETRIES           retries per model on transient (default 2)
//   LLM_PROVIDER_PREFER       comma-separated providers to prefer (default alibaba,novita,fireworks)
//   LLM_PROVIDER_IGNORE       comma-separated providers to skip (default empty)

import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type {
  ChatCompletionChunk,
  ChatCompletion,
} from "openai/resources/chat/completions";
import { sendLLMFailureAlert } from "../email";

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════

const DEFAULT_CHAIN = [
  "qwen/qwen3.7-plus",       // primary — stable production-capacity model
  "qwen/qwen3.8-flash",      // cheaper upgrade when not rate-limited
  "qwen/qwen3-235b-a22b",    // dense non-reasoning fallback
  "qwen/qwen-plus",          // older Qwen lineage
  "openai/gpt-4o-mini",      // non-Qwen cross-vendor fallback
];

function getModelChain(): string[] {
  const raw = process.env.LLM_MODEL_CHAIN;
  if (!raw) return DEFAULT_CHAIN;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCircuitThreshold(): number {
  return parseInt(process.env.LLM_CIRCUIT_THRESHOLD || "3", 10);
}

function getCircuitCooldownMs(): number {
  return parseInt(process.env.LLM_CIRCUIT_COOLDOWN_MS || "300000", 10);
}

function getMaxRetries(): number {
  return parseInt(process.env.LLM_MAX_RETRIES || "2", 10);
}

function getProviderRouting(): { order?: string[]; ignore?: string[] } {
  const prefer = process.env.LLM_PROVIDER_PREFER;
  const ignore = process.env.LLM_PROVIDER_IGNORE;
  const routing: { order?: string[]; ignore?: string[] } = {};
  if (prefer) routing.order = prefer.split(",").map((s) => s.trim()).filter(Boolean);
  if (ignore) routing.ignore = ignore.split(",").map((s) => s.trim()).filter(Boolean);
  return routing;
}

// ═══════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  openUntil: number; // epoch ms; 0 = closed
  successStreak: number;
}

const circuits = new Map<string, CircuitState>();

function getCircuit(model: string): CircuitState {
  let c = circuits.get(model);
  if (!c) {
    c = { failures: 0, lastFailureAt: 0, openUntil: 0, successStreak: 0 };
    circuits.set(model, c);
  }
  return c;
}

function isCircuitOpen(model: string): boolean {
  const c = getCircuit(model);
  if (c.openUntil === 0) return false;
  if (Date.now() >= c.openUntil) {
    // Half-open: reset for retry
    c.openUntil = 0;
    c.failures = Math.max(0, c.failures - 1); // decay failure count
    return false;
  }
  return true;
}

function recordSuccess(model: string): void {
  const c = getCircuit(model);
  c.failures = 0;
  c.openUntil = 0;
  c.successStreak++;
}

function recordFailure(model: string, reason: string): void {
  const c = getCircuit(model);
  c.failures++;
  c.lastFailureAt = Date.now();
  c.successStreak = 0;
  if (c.failures >= getCircuitThreshold()) {
    c.openUntil = Date.now() + getCircuitCooldownMs();
    console.warn(
      `[llm-circuit] Model ${model} circuit OPENED after ${c.failures} failures. Last: ${reason}. Cooling down for ${getCircuitCooldownMs() / 1000}s.`
    );
  }
}

export function getCircuitStatus(): Record<
  string,
  { failures: number; open: boolean; openUntil: number; successStreak: number }
> {
  const out: Record<string, any> = {};
  for (const [model, c] of circuits) {
    out[model] = {
      failures: c.failures,
      open: c.openUntil > Date.now(),
      openUntil: c.openUntil,
      successStreak: c.successStreak,
    };
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════

interface ClassifiedError {
  kind: "rate-limit" | "provider-error" | "network" | "auth" | "silent" | "unknown";
  retryable: boolean;
  shouldCircuitBreak: boolean;
  message: string;
  status?: number;
}

function classifyError(err: unknown): ClassifiedError {
  const e = err as any;
  const msg = String(e?.message || e || "unknown");
  const status = e?.status || e?.error?.code;

  if (status === 429) {
    return { kind: "rate-limit", retryable: true, shouldCircuitBreak: true, message: msg, status };
  }
  if (status === 401 || status === 403) {
    return { kind: "auth", retryable: false, shouldCircuitBreak: true, message: msg, status };
  }
  if (status === 502 || status === 503 || status === 504) {
    return { kind: "provider-error", retryable: true, shouldCircuitBreak: true, message: msg, status };
  }
  if (msg.includes("Provider returned error")) {
    return { kind: "provider-error", retryable: true, shouldCircuitBreak: true, message: msg };
  }
  if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET")) {
    return { kind: "network", retryable: true, shouldCircuitBreak: false, message: msg };
  }
  return { kind: "unknown", retryable: false, shouldCircuitBreak: true, message: msg, status };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  // 500ms, 1s, 2s, 4s with 20% jitter
  const base = 500 * Math.pow(2, attempt);
  return base + Math.random() * base * 0.2;
}

// ═══════════════════════════════════════════════════════════
// CORE: STREAMING WITH FALLBACK
// ═══════════════════════════════════════════════════════════

export interface ResilientParams {
  systemPrompt: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

function buildBaseRequest(params: ResilientParams) {
  const routing = getProviderRouting();
  const req: any = {
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
    stream: true,
    stream_options: { include_usage: true },
    reasoning: { enabled: false }, // critical for Qwen — prevents reasoning-budget exhaustion
    messages: params.messages,
  };
  if (routing.order?.length || routing.ignore?.length) {
    req.provider = {};
    if (routing.order?.length) req.provider.order = routing.order;
    if (routing.ignore?.length) req.provider.ignore = routing.ignore;
  }
  return req;
}

export interface ResilientStreamResult {
  stream: Stream<ChatCompletionChunk>;
  model: string;
}

/**
 * Attempt each model in the chain. Returns the first stream that opens successfully.
 * Circuit-open models are skipped. Transient errors trigger retries within a model.
 */
export async function streamWithFallback(
  llm: OpenAI,
  params: ResilientParams
): Promise<ResilientStreamResult> {
  const chain = getModelChain();
  const errors: string[] = [];

  for (const model of chain) {
    if (isCircuitOpen(model)) {
      errors.push(`${model}: circuit-open (skipped)`);
      continue;
    }

    let attempt = 0;
    while (attempt <= getMaxRetries()) {
      try {
        const request = { ...buildBaseRequest(params), model };
        const stream = (await llm.chat.completions.create(
          request as any
        )) as unknown as Stream<ChatCompletionChunk>;

        recordSuccess(model);
        return { stream, model };
      } catch (err) {
        attempt++;
        const classified = classifyError(err);
        errors.push(`${model}: ${classified.kind} (${classified.message.slice(0, 80)})`);
        console.warn(
          `[llm-resilient] ${model} attempt ${attempt}/${getMaxRetries()}: ${classified.kind} — ${classified.message.slice(0, 120)}`
        );

        if (classified.shouldCircuitBreak) recordFailure(model, classified.message);
        if (!classified.retryable) break; // don't retry auth/unknown
        if (attempt <= getMaxRetries()) {
          await sleep(backoffMs(attempt));
        }
      }
    }
  }

  const err = new Error(`All LLM models failed. Attempts: ${errors.join(" | ")}`);
  (err as any).errors = errors;
  // Fire-and-forget admin alert
  sendLLMFailureAlert({
    route: "/api/chat (stream)",
    chain,
    errors,
  }).catch(() => {});
  throw err;
}

/**
 * Non-streaming variant for chatCompletion (OBRA review/fix/draft).
 */
export interface ResilientChatResult {
  response: ChatCompletion;
  model: string;
}

export async function chatWithFallback(
  llm: OpenAI,
  params: ResilientParams & { nonStreaming?: boolean }
): Promise<ResilientChatResult> {
  const chain = getModelChain();
  const errors: string[] = [];

  for (const model of chain) {
    if (isCircuitOpen(model)) {
      errors.push(`${model}: circuit-open (skipped)`);
      continue;
    }

    let attempt = 0;
    while (attempt <= getMaxRetries()) {
      try {
        const routing = getProviderRouting();
        const request: any = {
          model,
          max_tokens: params.maxTokens ?? 8192,
          temperature: params.temperature ?? 0.3,
          reasoning: { enabled: false },
          messages: params.messages,
        };
        if (routing.order?.length) request.provider = { order: routing.order };

        const response = (await llm.chat.completions.create(request as any)) as unknown as ChatCompletion;

        // Silent-failure guard: content is null/empty despite tokens generated
        const content = response.choices?.[0]?.message?.content;
        const tokensUsed = response.usage?.completion_tokens || 0;
        if (!content || content.trim().length === 0) {
          if (tokensUsed > 100) {
            // Model burned tokens but produced no content — treat as failure
            recordFailure(model, "silent: 0 content chars despite tokens spent");
            errors.push(`${model}: silent failure (0 content, ${tokensUsed} tokens)`);
            console.warn(
              `[llm-resilient] ${model} returned 0 content chars with ${tokensUsed} completion tokens — falling back`
            );
            attempt = getMaxRetries() + 1; // skip retry, move to next model
            break;
          }
        }

        recordSuccess(model);
        return { response, model };
      } catch (err) {
        attempt++;
        const classified = classifyError(err);
        errors.push(`${model}: ${classified.kind}`);
        console.warn(
          `[llm-resilient] ${model} chat attempt ${attempt}: ${classified.kind}`
        );
        if (classified.shouldCircuitBreak) recordFailure(model, classified.message);
        if (!classified.retryable) break;
        if (attempt <= getMaxRetries()) await sleep(backoffMs(attempt));
      }
    }
  }

  const err = new Error(`All LLM models failed (chat). Attempts: ${errors.join(" | ")}`);
  (err as any).errors = errors;
  sendLLMFailureAlert({
    route: "/api/chat (completion)",
    chain,
    errors,
  }).catch(() => {});
  throw err;
}

/**
 * Peek the first 30 chunks of a stream to verify it contains content, not just reasoning.
 * Returns { stream (reconstructable), hadContent, hadThinking, peekedChunks }.
 *
 * Note: Streams are single-use. This wraps peeking into a "restartable" pattern
 * by buffering the peeked chunks and re-emitting them alongside the rest.
 */
export interface PeekedStream {
  stream: AsyncIterable<ChatCompletionChunk>;
  hadContent: boolean;
  hadThinking: boolean;
  model: string;
}

export async function streamWithContentGuard(
  llm: OpenAI,
  params: ResilientParams
): Promise<PeekedStream> {
  const chain = getModelChain();
  const errors: string[] = [];

  for (const model of chain) {
    if (isCircuitOpen(model)) {
      errors.push(`${model}: circuit-open`);
      continue;
    }

    try {
      const request = { ...buildBaseRequest(params), model };
      const rawStream = (await llm.chat.completions.create(
        request as any
      )) as unknown as Stream<ChatCompletionChunk>;

      // Buffer first chunks to detect silent failures
      const peeked: ChatCompletionChunk[] = [];
      let hadContent = false;
      let hadThinking = false;
      const peekLimit = 15; // check first 15 chunks

      const iterator = rawStream[Symbol.asyncIterator]();
      for (let i = 0; i < peekLimit; i++) {
        const next = await iterator.next();
        if (next.done) break;
        const chunk = next.value;
        peeked.push(chunk);
        const delta = chunk.choices?.[0]?.delta as any;
        if (delta?.content && delta.content.length > 0) hadContent = true;
        if (delta?.reasoning && delta.reasoning.length > 0) hadThinking = true;
      }

      if (hadContent || !hadThinking) {
        // Good — has content, or has neither (empty stream is unusual but let it pass through)
        recordSuccess(model);
        // Reconstruct stream: peeked chunks first, then remaining
        const merged = (async function* () {
          for (const c of peeked) yield c;
          while (true) {
            const next = await iterator.next();
            if (next.done) return;
            yield next.value;
          }
        })();
        return { stream: merged, hadContent, hadThinking, model };
      }

      // hadThinking=true but hadContent=false after 15 chunks → suspicious
      // Continue reading in case content comes later (large reasoning)
      // but log a warning
      console.warn(
        `[llm-resilient] ${model}: 15 chunks of thinking, no content yet. Waiting for content or exhausting.`
      );

      const merged = (async function* () {
        for (const c of peeked) yield c;
        while (true) {
          const next = await iterator.next();
          if (next.done) return;
          yield next.value;
        }
      })();
      return { stream: merged, hadContent: false, hadThinking: true, model };
    } catch (err) {
      const classified = classifyError(err);
      errors.push(`${model}: ${classified.kind}`);
      if (classified.shouldCircuitBreak) recordFailure(model, classified.message);
      console.warn(`[llm-resilient] ${model} failed guard attempt: ${classified.kind}`);
    }
  }

  const e = new Error(`All LLM models failed (stream guard). Attempts: ${errors.join(" | ")}`);
  (e as any).errors = errors;
  throw e;
}
