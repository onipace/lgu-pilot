export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import {
  ensureParticipantSession,
  logChatMessage,
  getWorkshopSessionId,
} from "@/lib/logger";
import { searchDocuments, buildRAGContext, getYalaKnowledgeContext, getHybridContext } from "@/lib/ai/rag";
import { ELLA_SYSTEM_PROMPT, YALA_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { streamChatResponse } from "@/lib/ai/llm";
import { validateAllCitations } from "@/lib/ai/citation-validator";
import { getResponseModeSuffix, RESPONSE_MODE_CONFIG, type ResponseMode } from "@/lib/ai/response-mode";
import type { Citation } from "@/types";

interface ChatRequestBody {
  module: "ella" | "yala";
  message: string;
  history: { role: string; content: string }[];
  participantName?: string;
  sessionId: string;
  responseMode?: ResponseMode;
}

export const POST = withUserAuth(async (request: NextRequest) => {
  try {
    const body: ChatRequestBody = await request.json();
    const { module, message, history, participantName, sessionId } = body;

    const ipAddress =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const workshopSessionId = getWorkshopSessionId();

    // Persist participant session and log user message (fire-and-forget)
    try {
      ensureParticipantSession({
        sessionId,
        workshopSessionId,
        module,
        ipAddress,
        participantName,
      });
      await logChatMessage({
        participantSessionId: sessionId,
        workshopSessionId,
        module,
        role: "user",
        content: message,
        ipAddress,
        participantName,
      });
    } catch {
      // Non-blocking — don't fail the request if logging errors
    }

    // Check if API key is configured
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json(
        { error: "AI service not configured. Set OPENROUTER_API_KEY." },
        { status: 503 }
      );
    }

    const responseMode = body.responseMode || 'standard';
    const modeConfig = RESPONSE_MODE_CONFIG[responseMode];
    const systemPrompt =
      module === "ella" ? ELLA_SYSTEM_PROMPT : YALA_SYSTEM_PROMPT;
    const fullSystemPrompt = systemPrompt + getResponseModeSuffix(responseMode);

    let ragContext: string | undefined;
    let searchResults: Awaited<ReturnType<typeof searchDocuments>> | undefined;

    if (module === "ella") {
      // Hybrid RAG: BM25 + LightRAG knowledge graph for legal research
      ragContext = await getHybridContext(message, "ella", { limit: 6 });
      searchResults = searchDocuments(message, { limit: 6 });
    } else if (module === "yala") {
      // YALA: knowledge base context + hybrid legal context
      const knowledgeContext = getYalaKnowledgeContext(message);
      const hybridContext = await getHybridContext(message, "yala", {
        docTypes: ["ordinance", "ra7160"],
        limit: 3,
      });
      ragContext = [knowledgeContext, hybridContext].filter(Boolean).join("\n\n---\n\n") || undefined;
      searchResults = searchDocuments(message, { docTypes: ["ordinance", "ra7160"], limit: 3 });
    }

    // Build messages array from history + new message
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history
        .filter((h) => h.role === "user" || h.role === "assistant")
        .map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
      { role: "user" as const, content: message },
    ];

    const stream = await streamChatResponse(fullSystemPrompt, messages, ragContext, {
      maxTokens: modeConfig.maxTokens,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta as { content?: string | null; reasoning?: string } | undefined;
            const content = delta?.content;
            const reasoning = delta?.reasoning;
            if (reasoning) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ thinking: reasoning })}\n\n`)
              );
            }
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
              );
            }
          }

          // Post-stream citation validation for ELLA responses
          const citations: Citation[] = [];
          if (module === "ella" && fullResponse) {
            const validationResult = validateAllCitations(fullResponse);

            // Build citations array ONLY from what the LLM actually cited
            for (const cited of validationResult.citations) {
              // Try to find matching search result for metadata
              const matchedResult = searchResults?.find(
                (r) =>
                  r.doc_type === cited.reference.docType &&
                  (r.section_number === cited.reference.sectionNumber ||
                    r.ordinance_number === cited.reference.sectionNumber)
              );

              citations.push({
                section: cited.reference.sectionNumber,
                title: cited.title || matchedResult?.title || cited.reference.raw,
                text: matchedResult?.snippet || cited.reference.raw,
                relevance: matchedResult?.relevance || 0,
                doc_type: cited.reference.docType,
                verified: cited.verified,
                confidence: cited.confidence,
                doc_id: cited.docId || matchedResult?.id || undefined,
              });
            }

            if (citations.length > 0) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ citations })}\n\n`)
              );
            }
          }

          // Log assistant response after stream completes
          try {
            await logChatMessage({
              participantSessionId: sessionId,
              workshopSessionId,
              module,
              role: "assistant",
              content: fullResponse,
              ipAddress,
              participantName,
              ragContext: ragContext || undefined,
              citations: citations.length > 0 ? citations : undefined,
            });
          } catch {
            // Non-blocking
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred processing your request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
