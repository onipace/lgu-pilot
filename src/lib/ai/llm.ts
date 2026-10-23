import OpenAI from "openai";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

let client: OpenAI | null = null;

function getLLMClient(): OpenAI {
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

const DEFAULT_MODEL = "qwen/qwen3.7-plus";

function getModel(): string {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  ragContext?: string,
  options?: { maxTokens?: number }
) {
  const llm = getLLMClient();

  const fullSystemPrompt = ragContext
    ? `${systemPrompt}\n\n${ragContext}`
    : systemPrompt;

  const stream = await llm.chat.completions.create({
    model: getModel(),
    max_tokens: options?.maxTokens ?? 4096,
    temperature: 0.3,
    stream: true,
    stream_options: { include_usage: true }, // Request usage in final stream chunk
    // OpenRouter extension — disable Qwen hybrid thinking mode so the model
    // outputs the answer directly instead of exhausting max_tokens on reasoning
    // tokens (which was causing "no response received" errors).
    reasoning: { enabled: false },
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  } as any) as unknown as Stream<ChatCompletionChunk>;

  return stream;
}

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
}> {
  const llm = getLLMClient();

  const response = await llm.chat.completions.create({
    model: getModel(),
    max_tokens: options?.maxTokens ?? 8192,
    temperature: options?.temperature ?? 0.3,
    // OpenRouter extension — disable Qwen hybrid thinking mode
    reasoning: { enabled: false },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  } as any);

  return {
    content: response.choices[0]?.message?.content || "",
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };
}
