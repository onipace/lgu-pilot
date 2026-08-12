import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

export const GET = withAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const sessionParam = searchParams.get("session") || "";
  const format = searchParams.get("format") === "json" ? "json" : "csv";

  try {
    // Build where clause for interaction logs
    const logWhere: Record<string, unknown> = {};
    if (sessionParam) {
      logWhere.workshopSessionId = sessionParam;
    }

    // Fetch interaction logs with participant session info
    const logs = await prisma.interactionLog.findMany({
      where: logWhere,
      orderBy: { createdAt: "asc" },
      include: {
        participantSession: {
          select: {
            participantName: true,
            ipAddress: true,
          },
        },
      },
    });

    // Build rows matching the original query shape
    const rows = logs.map((log) => ({
      id: log.id,
      created_at: log.createdAt.toISOString(),
      module: log.module,
      interaction_type: log.interactionType,
      role: log.role,
      participant:
        log.participantSession.participantName ||
        log.participantSession.ipAddress ||
        "Anonymous",
      ip_address: log.participantSession.ipAddress,
      content: log.content,
      topic_tags: log.topicTags,
      obra_template: log.obraTemplate,
      obra_compliance_score: log.obraComplianceScore,
      obra_draft_length: log.obraDraftLength,
      workshop_session_id: log.workshopSessionId,
    }));

    if (format === "json") {
      return new Response(JSON.stringify(rows, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="esangguni-workshop-${sessionParam || "all"}.json"`,
        },
      });
    }

    // CSV export
    if (rows.length === 0) {
      return new Response("No data found", { status: 404 });
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = (row as Record<string, unknown>)[h];
            if (val === null || val === undefined) return "";
            const str = String(val).replace(/"/g, '""');
            return str.includes(",") || str.includes("\n") || str.includes('"')
              ? `"${str}"`
              : str;
          })
          .join(",")
      ),
    ];

    const csv = csvLines.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="esangguni-workshop-${sessionParam || "all"}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/export]", err);
    return new Response("Export failed", { status: 500 });
  }
});
