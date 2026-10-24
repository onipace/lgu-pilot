import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { streamWithFallback, chatWithFallback } from "./llm-resilient";

let client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      throw new Error("OPENROUTER_API_KEY not configured");
    }
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });
  }
  return client;
}

// Kept for backward compat with any callers reading DEFAULT_MODEL
const DEFAULT_MODEL = "qwen/qwen3.7-plus";

function getModel(): string {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

/**
 * Streaming chat with fallback chain, circuit breaker, retry, and provider routing.
 * All hardening logic lives in llm-resilient.ts.
 *
 * When wordLimit is provided, the token budget is auto-derived per model
 * via the calibration table — the ceiling moves with the model across the chain.
 * When only maxTokens is provided, it's used directly (backward compat for OBRA, LIKHA, LINAW).
 */
export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  ragContext?: string,
  options?: { maxTokens?: number; wordLimit?: number }
): Promise<Stream<ChatCompletionChunk>> {
  const llm = getLLMClient();
  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const { stream } = await streamWithFallback(llm, {
    systemPrompt: fullSystemPrompt,
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    wordLimit: options?.wordLimit,
    maxTokens: options?.maxTokens,
  });

  return stream;
}

/**
 * Non-streaming chat with fallback chain.
 * Supports wordLimit for calibrated per-model token budgets.
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; wordLimit?: number; temperature?: number }
): Promise<{
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}> {
  const llm = getLLMClient();

  const { response, model } = await chatWithFallback(llm, {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    wordLimit: options?.wordLimit,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature ?? 0.3,
  });

  return {
    content: response.choices[0]?.message?.content || "",
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
    model,
  };
}

// Re-export circuit status for observability
export { getCircuitStatus } from "./llm-resilient";
