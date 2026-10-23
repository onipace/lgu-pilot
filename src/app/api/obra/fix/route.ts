export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { chatCompletion } from "@/lib/ai/llm";
import { recordTokenUsage } from "@/lib/ai/token-meter";
import {
  ensureParticipantSession,
  getWorkshopSessionId,
} from "@/lib/logger";

interface SelectedFixes {
  structuralIssues: number[];
  missingSections: number[];
  risks: number[];
  citationWarnings: number[];
}

interface FixRequestBody {
  draft: string;
  selectedFixes: SelectedFixes;
  reviewResult: {
    structuralIssues: string[];
    missingSections: string[];
    risks: { severity: string; section: string; description: string; recommendation: string }[];
    citationWarnings?: { section: string; raw: string; verified: boolean; reason: string }[];
  };
  participantName?: string;
  sessionId: string;
}

function buildFixPrompt(selectedFixes: SelectedFixes, reviewResult: FixRequestBody["reviewResult"]): string {
  const parts: string[] = [];

  parts.push("You are an expert Philippine legislative drafter specializing in municipal ordinances and R.A. 7160 (Local Government Code).");
  parts.push("");
  parts.push("Your task is to revise the given ordinance draft by applying ONLY the selected fixes below. Do NOT change anything else in the draft.");
  parts.push("");

  if (selectedFixes.risks.length > 0) {
    parts.push("COMPLIANCE RISKS TO ADDRESS:");
    for (const idx of selectedFixes.risks) {
      const risk = reviewResult.risks[idx];
      if (risk) {
        parts.push(`  - [${risk.severity.toUpperCase()}] ${risk.section}: ${risk.description}`);
        parts.push(`    Recommendation: ${risk.recommendation}`);
      }
    }
    parts.push("");
  }

  if (selectedFixes.structuralIssues.length > 0) {
    parts.push("STRUCTURAL ISSUES TO FIX:");
    for (const idx of selectedFixes.structuralIssues) {
      const issue = reviewResult.structuralIssues[idx];
      if (issue) parts.push(`  - ${issue}`);
    }
    parts.push("");
  }

  if (selectedFixes.missingSections.length > 0) {
    parts.push("SECTIONS TO ADD:");
    for (const idx of selectedFixes.missingSections) {
      const section = reviewResult.missingSections[idx];
      if (section) parts.push(`  - ${section}`);
    }
    parts.push("Add these sections in the proper location within the ordinance structure, following standard Philippine legislative format.");
    parts.push("");
  }

  if (selectedFixes.citationWarnings.length > 0 && reviewResult.citationWarnings) {
    parts.push("CITATION WARNINGS TO ADDRESS:");
    for (const idx of selectedFixes.citationWarnings) {
      const warning = reviewResult.citationWarnings[idx];
      if (warning) {
        parts.push(`  - "${warning.raw}" (${warning.section}): ${warning.reason}`);
        parts.push(`    Action: Remove or replace with a verified citation. If uncertain, remove the citation entirely rather than risk hallucination.`);
      }
    }
    parts.push("");
  }

  parts.push("RULES:");
  parts.push("1. Output ONLY the revised ordinance draft text — no explanations, no commentary, no markdown.");
  parts.push("2. Preserve the overall structure, numbering, and formatting of the original draft.");
  parts.push("3. Only apply the fixes listed above. Leave everything else unchanged.");
  parts.push("4. Maintain consistent legal language and Philippine legislative conventions.");
  parts.push("5. If adding missing sections, match the style and numbering pattern of existing sections.");
  parts.push("6. For citation fixes, prefer removing unverified citations over guessing replacements.");

  return parts.join("\n");
}

export const POST = withUserAuth(async (request: NextRequest, { user }) => {
  try {
    const body: FixRequestBody = await request.json();
    const { draft, selectedFixes, reviewResult, participantName, sessionId } = body;

    if (!draft || draft.trim().length === 0) {
      return NextResponse.json(
        { error: "Draft text is required." },
        { status: 400 }
      );
    }

    if (!selectedFixes || !reviewResult) {
      return NextResponse.json(
        { error: "Selected fixes and review result are required." },
        { status: 400 }
      );
    }

    const totalSelected =
      selectedFixes.structuralIssues.length +
      selectedFixes.missingSections.length +
      selectedFixes.risks.length +
      selectedFixes.citationWarnings.length;

    if (totalSelected === 0) {
      return NextResponse.json(
        { error: "No fixes selected." },
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

    const systemPrompt = buildFixPrompt(selectedFixes, reviewResult);

    const { content: fixedDraft, usage } = await chatCompletion(
      systemPrompt,
      `Revise the following ordinance draft by applying only the selected fixes:\n\n${draft}`,
      { maxTokens: 4096, temperature: 0.3 }
    );

    // Record token usage (fire-and-forget)
    if (usage) {
      recordTokenUsage({
        model: process.env.LLM_MODEL || "qwen/qwen3.7-plus",
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        module: "obra",
        route: "/api/obra/fix",
        user_id: user.user.id,
        user_name: user.user.full_name,
        session_id: sessionId,
      });
    }

    if (!fixedDraft || fixedDraft.trim().length === 0) {
      return NextResponse.json(
        { error: "Fix generation produced empty result. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ draft: fixedDraft.trim() });
  } catch (error) {
    console.error("Fix API error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred applying fixes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
