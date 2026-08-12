import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import type { AdminStats, WorkshopSession } from "@/types";

export const GET = withAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const sessionParam = searchParams.get("session");

  try {
    // Get all workshop sessions for the dropdown
    const allSessions = await prisma.workshopSession.findMany({
      orderBy: { startedAt: "desc" },
    });

    // Determine which session to show stats for
    const workshopSessionId =
      sessionParam ||
      allSessions[0]?.id ||
      process.env.WORKSHOP_SESSION_ID ||
      new Date().toISOString().slice(0, 10);

    const workshopSession =
      allSessions.find((s) => s.id === workshopSessionId) || null;

    // Total unique participant sessions
    const sessionCount = await prisma.participantSession.count({
      where: { workshopSessionId },
    });

    // Total messages (user only to avoid double-counting)
    const messageCount = await prisma.interactionLog.count({
      where: {
        workshopSessionId,
        interactionType: "chat_message",
        role: "user",
      },
    });

    // Messages by module
    const byModuleLogs = await prisma.interactionLog.findMany({
      where: {
        workshopSessionId,
        interactionType: "chat_message",
        role: "user",
      },
      select: { module: true },
    });

    const byModule: Record<string, number> = {};
    for (const log of byModuleLogs) {
      byModule[log.module] = (byModule[log.module] || 0) + 1;
    }

    // Top topics — parse JSON array, explode, count
    const topicLogs = await prisma.interactionLog.findMany({
      where: {
        workshopSessionId,
        topicTags: { not: null },
      },
      select: { module: true, topicTags: true },
    });

    const topicCounts: Record<string, Record<string, number>> = {};
    for (const row of topicLogs) {
      if (!row.topicTags || row.topicTags === "[]") continue;
      try {
        const tags: string[] = JSON.parse(row.topicTags);
        for (const tag of tags) {
          if (!topicCounts[row.module]) topicCounts[row.module] = {};
          topicCounts[row.module][tag] =
            (topicCounts[row.module][tag] || 0) + 1;
        }
      } catch {
        // Skip malformed JSON
      }
    }

    const topTopics: AdminStats["topTopics"] = [];
    for (const [module, topics] of Object.entries(topicCounts)) {
      for (const [topic, count] of Object.entries(topics)) {
        topTopics.push({ module, topic, count });
      }
    }
    topTopics.sort((a, b) => b.count - a.count);

    // Top participants — fetch participant sessions with user logs
    const participantSessions = await prisma.participantSession.findMany({
      where: { workshopSessionId },
      include: {
        logs: {
          where: { role: "user" },
          select: { module: true },
        },
      },
    });

    const participantData = participantSessions.map((ps) => ({
      name: ps.participantName || ps.ipAddress || "Anonymous",
      messageCount: ps.logs.length,
      modules: [...new Set(ps.logs.map((l) => l.module))],
    }));

    participantData.sort((a, b) => b.messageCount - a.messageCount);
    const topParticipants = participantData.slice(0, 10);

    // OBRA stats
    const obraDrafts = await prisma.interactionLog.count({
      where: {
        workshopSessionId,
        interactionType: "obra_draft",
      },
    });

    // Average compliance score
    const scoreLogs = await prisma.interactionLog.findMany({
      where: {
        workshopSessionId,
        interactionType: "obra_review",
        obraComplianceScore: { not: null },
      },
      select: { obraComplianceScore: true },
    });

    const avgScore =
      scoreLogs.length > 0
        ? scoreLogs.reduce((sum, l) => sum + (l.obraComplianceScore || 0), 0) / scoreLogs.length
        : 0;

    // Template breakdown
    const templateLogs = await prisma.interactionLog.findMany({
      where: {
        workshopSessionId,
        interactionType: "obra_draft",
        obraTemplate: { not: null },
      },
      select: { obraTemplate: true },
    });

    const templateBreakdown: Record<string, number> = {};
    for (const log of templateLogs) {
      const tpl = log.obraTemplate!;
      templateBreakdown[tpl] = (templateBreakdown[tpl] || 0) + 1;
    }

    // Activity timeline — group by hour (replaces strftime('%H:00', created_at))
    const timelineLogs = await prisma.interactionLog.findMany({
      where: {
        workshopSessionId,
        role: "user",
      },
      select: { createdAt: true },
    });

    const hourCounts: Record<string, number> = {};
    for (const log of timelineLogs) {
      const hour = `${String(log.createdAt.getHours()).padStart(2, "0")}:00`;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    const activityTimeline = Object.entries(hourCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));

    const stats: AdminStats = {
      workshopSession: workshopSession as unknown as AdminStats["workshopSession"],
      allSessions: allSessions as unknown as AdminStats["allSessions"],
      totals: {
        sessions: sessionCount,
        messages: messageCount,
        byModule,
      },
      topTopics: topTopics.slice(0, 20),
      topParticipants,
      obraStats: {
        totalDrafts: obraDrafts,
        avgComplianceScore: Math.round(avgScore),
        templateBreakdown,
      },
      activityTimeline,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Stats query failed" }, { status: 500 });
  }
});
