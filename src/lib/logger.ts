import { prisma } from "@/lib/prisma";
import { classifyTopics } from "@/lib/topic-classifier";
import type { OrdTemplateType } from "@/types";

function getWorkshopSessionId(): string {
  return (
    process.env.WORKSHOP_SESSION_ID ||
    new Date().toISOString().slice(0, 10)
  );
}

function getWorkshopSessionTitle(): string {
  return (
    process.env.WORKSHOP_SESSION_TITLE ||
    `eSANGGUNI Workshop — ${getWorkshopSessionId()}`
  );
}

/**
 * Ensures the workshop_sessions row exists (upsert).
 * Called once per request — idempotent.
 */
async function ensureWorkshopSession(workshopSessionId: string): Promise<void> {
  try {
    await prisma.workshopSession.upsert({
      where: { id: workshopSessionId },
      create: { id: workshopSessionId, title: getWorkshopSessionTitle() },
      update: {},
    });
  } catch (err) {
    console.error("[logger] ensureWorkshopSession failed:", err);
  }
}

/**
 * Ensures the participant_sessions row exists (upsert on id).
 * Updates last_active_at on every call.
 */
export async function ensureParticipantSession(params: {
  sessionId: string;
  workshopSessionId: string;
  module: string;
  ipAddress: string;
  participantName?: string;
}): Promise<void> {
  try {
    await ensureWorkshopSession(params.workshopSessionId);

    await prisma.participantSession.upsert({
      where: { id: params.sessionId },
      create: {
        id: params.sessionId,
        workshopSessionId: params.workshopSessionId,
        participantName: params.participantName || null,
        ipAddress: params.ipAddress,
        module: params.module,
      },
      update: {
        lastActiveAt: new Date(),
        ...(params.participantName ? { participantName: params.participantName } : {}),
      },
    });
  } catch (err) {
    console.error("[logger] ensureParticipantSession failed:", err);
  }
}

/**
 * Log a single chat message (user or assistant).
 * For assistant messages, also stores the RAG context and citations for analysis.
 */
export async function logChatMessage(params: {
  participantSessionId: string;
  workshopSessionId: string;
  module: "ella" | "yala";
  role: "user" | "assistant";
  content: string;
  ipAddress: string;
  participantName?: string;
  ragContext?: string;
  citations?: unknown[];
}): Promise<void> {
  try {
    await ensureParticipantSession({
      sessionId: params.participantSessionId,
      workshopSessionId: params.workshopSessionId,
      module: params.module,
      ipAddress: params.ipAddress,
      participantName: params.participantName,
    });

    const topicTags =
      params.role === "user"
        ? JSON.stringify(classifyTopics(params.content))
        : null;

    await prisma.interactionLog.create({
      data: {
        participantSessionId: params.participantSessionId,
        workshopSessionId: params.workshopSessionId,
        module: params.module,
        interactionType: "chat_message",
        role: params.role,
        content: params.content,
        topicTags,
        ragContext: params.ragContext || null,
        citationsJson: params.citations ? JSON.stringify(params.citations) : null,
      },
    });
  } catch (err) {
    console.error("[logger] logChatMessage failed:", err);
  }
}

/**
 * Log an OBRA draft generation event.
 */
export async function logObraDraft(params: {
  participantSessionId: string;
  workshopSessionId: string;
  template: OrdTemplateType;
  draftContent: string;
  ipAddress: string;
  participantName?: string;
}): Promise<void> {
  try {
    await ensureParticipantSession({
      sessionId: params.participantSessionId,
      workshopSessionId: params.workshopSessionId,
      module: "obra",
      ipAddress: params.ipAddress,
      participantName: params.participantName,
    });

    const topicTags = JSON.stringify(classifyTopics(params.draftContent));

    await prisma.interactionLog.create({
      data: {
        participantSessionId: params.participantSessionId,
        workshopSessionId: params.workshopSessionId,
        module: "obra",
        interactionType: "obra_draft",
        content: params.draftContent,
        topicTags,
        obraTemplate: params.template,
        obraDraftLength: params.draftContent.length,
      },
    });
  } catch (err) {
    console.error("[logger] logObraDraft failed:", err);
  }
}

/**
 * Log an OBRA compliance review event.
 */
export async function logObraReview(params: {
  participantSessionId: string;
  workshopSessionId: string;
  draftContent: string;
  complianceScore: number;
  ipAddress: string;
  participantName?: string;
}): Promise<void> {
  try {
    await ensureParticipantSession({
      sessionId: params.participantSessionId,
      workshopSessionId: params.workshopSessionId,
      module: "obra",
      ipAddress: params.ipAddress,
      participantName: params.participantName,
    });

    await prisma.interactionLog.create({
      data: {
        participantSessionId: params.participantSessionId,
        workshopSessionId: params.workshopSessionId,
        module: "obra",
        interactionType: "obra_review",
        content: params.draftContent.substring(0, 500),
        obraComplianceScore: params.complianceScore,
        obraDraftLength: params.draftContent.length,
      },
    });
  } catch (err) {
    console.error("[logger] logObraReview failed:", err);
  }
}

export { getWorkshopSessionId };

/**
 * Generic module-scoped write-event logger (additive, Sprint 2).
 * Used by standalone modules (LIKHA now, other modules later) whose events do
 * not fit the chat/obra-specific writers. Inserts into interaction_logs with
 * the caller's module tag; ensures workshop + participant session rows exist.
 */
export async function logModuleEvent(params: {
  module: string;
  interactionType: string;
  content?: string;
  ipAddress: string;
  participantName?: string;
  participantSessionId?: string;
}): Promise<void> {
  try {
    const workshopSessionId = getWorkshopSessionId();
    const sessionId =
      params.participantSessionId || `${params.module}-${Date.now()}`;

    await ensureParticipantSession({
      sessionId,
      workshopSessionId,
      module: params.module,
      ipAddress: params.ipAddress,
      participantName: params.participantName,
    });

    await prisma.interactionLog.create({
      data: {
        participantSessionId: sessionId,
        workshopSessionId,
        module: params.module,
        interactionType: params.interactionType,
        content: params.content ?? null,
      },
    });
  } catch (err) {
    console.error("[logger] logModuleEvent failed:", err);
  }
}
