import OpenAI from "openai";

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
    max_tokens: options?.maxTokens ?? 2048,
    temperature: 0.3,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  return stream;
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
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

  return response.choices[0]?.message?.content || "";
}
