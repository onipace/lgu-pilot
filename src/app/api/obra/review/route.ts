export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { chatCompletion } from "@/lib/ai/llm";
import { recordTokenUsage } from "@/lib/ai/token-meter";
import { searchDocuments, buildRAGContext } from "@/lib/ai/rag";
import { queryLightRAG } from "@/lib/ai/lightrag";
import { OBRA_REVIEW_PROMPT } from "@/lib/ai/prompts";
import { validateAllCitations, buildCitationAllowList } from "@/lib/ai/citation-validator";
import type { ReviewResult, CitationWarning } from "@/types";
import {
  ensureParticipantSession,
  logObraReview,
  getWorkshopSessionId,
} from "@/lib/logger";

interface ReviewRequestBody {
  draft: string;
  participantName?: string;
  sessionId: string;
}

export const POST = withUserAuth(async (request: NextRequest, { user }) => {
  try {
    const body: ReviewRequestBody = await request.json();
    const { draft, participantName, sessionId } = body;

    if (!draft || draft.trim().length === 0) {
      return NextResponse.json(
        { error: "Draft text is required." },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const workshopSessionId = getWorkshopSessionId();

    try {
      ensureParticipantSession({
        sessionId,
        workshopSessionId,
        module: "obra",
        ipAddress,
        participantName,
      });
    } catch {
      // Non-blocking
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json(
        { error: "AI service not configured. Set OPENROUTER_API_KEY." },
        { status: 503 }
      );
    }

    // Enhanced RAG: broader search with increased limit
    const draftSnippet = draft.substring(0, 500);
    const results = searchDocuments(draftSnippet, {
      docTypes: ["ordinance", "ra7160"],
      limit: 8,
    });
    const ragContext = buildRAGContext(results);

    // Also query LightRAG for semantic context
    const lightragResponse = await queryLightRAG(
      `compliance review ${draftSnippet}`,
      "obra"
    ).catch(() => null);

    // Build citation allow-list from RAG results
    const allowedSections = buildCitationAllowList(results);

    // Inject allow-list into the prompt template
    const promptWithAllowList = OBRA_REVIEW_PROMPT.replace("{ALLOWED_SECTIONS}", allowedSections);

    // Build full system prompt with all context
    const contextParts: string[] = [];
    if (lightragResponse?.context) {
      contextParts.push(
        `KNOWLEDGE GRAPH CONTEXT (semantic + relationship-based):\n${lightragResponse.context}`
      );
    }
    if (ragContext) {
      contextParts.push(ragContext);
    }
    const fullContext = contextParts.join("\n\n---\n\n");

    const systemPrompt = fullContext
      ? `${promptWithAllowList}\n\nEXISTING ORDINANCES AND LEGAL PROVISIONS FOR REFERENCE:\n${fullContext}`
      : promptWithAllowList;

    const { content: responseText, usage } = await chatCompletion(
      systemPrompt,
      `Please review the following draft ordinance for compliance with R.A. 7160:\n\n${draft}`,
      { maxTokens: 4096, temperature: 0.1 }
    );

    // Record token usage (fire-and-forget)
    if (usage) {
      recordTokenUsage({
        model: process.env.LLM_MODEL || "qwen/qwen3.7-plus",
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        module: "obra",
        route: "/api/obra/review",
        user_id: user.user.id,
        user_name: user.user.full_name,
        session_id: sessionId,
      });
    }

    // Attempt to parse JSON from the response
    let reviewResult: ReviewResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewResult = JSON.parse(jsonMatch[0]) as ReviewResult;
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch {
      reviewResult = {
        overallScore: 70,
        risks: [
          {
            severity: "medium",
            section: "General",
            description:
              "The AI analysis could not be automatically structured. Please review the raw analysis below.",
            recommendation: responseText.substring(0, 500),
          },
        ],
        structuralIssues: [
          "Automated structural analysis was inconclusive. Manual review recommended.",
        ],
        missingSections: [],
      };
    }

    // Post-generation citation validation on the original draft text
    const draftValidation = validateAllCitations(draft);

    // Also validate citations mentioned in the review's risk descriptions
    const reviewText = reviewResult.risks
      .map((r) => `${r.section} ${r.description} ${r.recommendation}`)
      .join(" ");
    const reviewValidation = validateAllCitations(reviewText);

    // Merge unverified citations from both the draft and the review
    const allUnverified = [...draftValidation.unverified, ...reviewValidation.unverified];

    // Deduplicate by raw citation text
    const seenWarnings = new Set<string>();
    const citationWarnings: CitationWarning[] = [];

    for (const c of allUnverified) {
      const key = `${c.reference.docType}-${c.reference.sectionNumber}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);

      citationWarnings.push({
        section: c.reference.sectionNumber,
        raw: c.reference.raw,
        verified: c.verified,
        confidence: c.confidence,
        reason: c.docId
          ? `Section "${c.reference.sectionNumber}" was found in the index but confidence is ${c.confidence}. Verify sub-section references.`
          : `Section "${c.reference.sectionNumber}" was NOT found in the legal database. This may be a hallucinated citation.`,
      });
    }

    // Attach citation warnings to the review result
    reviewResult.citationWarnings = citationWarnings.length > 0 ? citationWarnings : undefined;

    if (reviewResult.overallScore !== undefined) {
      try {
        await logObraReview({
          participantSessionId: sessionId,
          workshopSessionId,
          draftContent: draft,
          complianceScore: reviewResult.overallScore,
          ipAddress,
          participantName,
        });
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json(reviewResult);
  } catch (error) {
    console.error("Review API error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred reviewing the draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
