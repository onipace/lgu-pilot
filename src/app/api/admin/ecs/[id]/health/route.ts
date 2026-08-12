import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// GET: Check ECS health (mock response for now)
export const GET = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const instance = await prisma.ecsInstance.findUnique({
        where: { id },
        select: { id: true, name: true, publicIp: true, status: true },
      });

      if (!instance) {
        return NextResponse.json({ error: "ECS instance not found" }, { status: 404 });
      }

      // Count actual containers from deployments
      const total = await prisma.lguDeployment.count({
        where: { ecsInstanceId: id },
      });
      const running = await prisma.lguDeployment.count({
        where: { ecsInstanceId: id, status: "running" },
      });

      const now = new Date();

      // Update last_health_check timestamp
      await prisma.ecsInstance.update({
        where: { id },
        data: { lastHealthCheck: now },
      });

      return NextResponse.json({
        ecs_id: id,
        status: instance.status || "unknown",
        docker_version: "pending check",
        containers_running: running,
        containers_total: total,
        cpu_usage: "pending",
        memory_usage: "pending",
        disk_usage: "pending",
        uptime: "pending",
        last_check: now.toISOString(),
        note: "Health metrics are pending SSH-based implementation. Container counts are from deployment records.",
      });
    } catch (err) {
      console.error("[admin/ecs/[id]/health] GET error:", err);
      return NextResponse.json(
        { error: "Failed to check ECS health" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
