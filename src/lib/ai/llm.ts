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
 */
export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  ragContext?: string,
  options?: { maxTokens?: number }
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
    maxTokens: options?.maxTokens ?? 4096,
  });

  return stream;
}

/**
 * Non-streaming chat with fallback chain.
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
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
    maxTokens: options?.maxTokens ?? 8192,
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
