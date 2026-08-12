export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { chatCompletion } from "@/lib/ai/llm";
import { searchDocuments, buildRAGContext } from "@/lib/ai/rag";
import { queryLightRAG } from "@/lib/ai/lightrag";
import { OBRA_DRAFT_PROMPT } from "@/lib/ai/prompts";
import { validateAllCitations, buildCitationAllowList } from "@/lib/ai/citation-validator";
import type { DraftDetails, OrdTemplateType, CitationWarning } from "@/types";
import {
  ensureParticipantSession,
  logObraDraft,
  getWorkshopSessionId,
} from "@/lib/logger";

interface DraftRequestBody {
  template: OrdTemplateType;
  details: DraftDetails;
  participantName?: string;
  sessionId: string;
}

export const POST = withUserAuth(async (request: NextRequest) => {
  try {
    const body: DraftRequestBody = await request.json();
    const { template, details, participantName, sessionId } = body;

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

    // Enhanced RAG: BM25 search with increased limit for broader context
    const searchQuery = `${template} ordinance ${details.subjectMatter} ${details.title}`;
    const results = searchDocuments(searchQuery, { limit: 8 });
    const ragContext = buildRAGContext(results);

    // Also query LightRAG knowledge graph for semantic context
    const lightragResponse = await queryLightRAG(searchQuery, "obra").catch(() => null);

    // Build citation allow-list from RAG results for prompt injection
    const allowedSections = buildCitationAllowList(results);

    // Inject allow-list into the prompt template
    const promptWithAllowList = OBRA_DRAFT_PROMPT.replace("{ALLOWED_SECTIONS}", allowedSections);

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
      ? `${promptWithAllowList}\n\n${fullContext}`
      : promptWithAllowList;

    const userPrompt = `Generate a ${template} ordinance with the following details:
- Title: ${details.title}
- Subject Matter: ${details.subjectMatter}
- Key Provisions: ${details.keyProvisions}
- Target Area: ${details.targetArea}

Follow the required Philippine municipal ordinance structure with TITLE, WHEREAS clauses, numbered SECTIONS, PENAL PROVISIONS, and EFFECTIVITY CLAUSE. Cite relevant R.A. 7160 sections ONLY from the provided context.`;

    const draft = await chatCompletion(systemPrompt, userPrompt, {
      maxTokens: 4096,
      temperature: 0.5,
    });

    // Post-generation citation validation
    const validationResult = validateAllCitations(draft);

    // Build citation warnings for unverified citations
    const citationWarnings: CitationWarning[] = validationResult.unverified.map((c) => ({
      section: c.reference.sectionNumber,
      raw: c.reference.raw,
      verified: c.verified,
      confidence: c.confidence,
      reason: c.docId
        ? `Section "${c.reference.sectionNumber}" was found in the index but confidence is ${c.confidence}. Verify sub-section references.`
        : `Section "${c.reference.sectionNumber}" was NOT found in the legal database. This may be a hallucinated citation.`,
    }));

    if (draft) {
      try {
        await logObraDraft({
          participantSessionId: sessionId,
          workshopSessionId,
          template,
          draftContent: draft,
          ipAddress,
          participantName,
        });
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({ draft, citationWarnings });
  } catch (error) {
    console.error("Draft generation error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred generating the draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
