import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// GET: Get deployment details
export const GET = withAuth(async (request, session, context) => {
  const { id } = await context.params;

  try {
    const deployment = await prisma.lguDeployment.findUnique({
      where: { id },
      include: {
        ecsInstance: {
          select: { name: true, publicIp: true, province: true, status: true },
        },
      },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    return NextResponse.json(deployment);
  } catch (err) {
    console.error("[admin/deployments/[id]] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch deployment" },
      { status: 500 }
    );
  }
});

// PUT: Update deployment
export const PUT = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      // Check if deployment exists
      const existing = await prisma.lguDeployment.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
      }

      const body = await request.json();
      const fieldMap: Record<string, string> = {
        lgu_name: "lguName",
        lgu_type: "lguType",
        lgu_class: "lguClass",
        province: "province",
        ecs_instance_id: "ecsInstanceId",
        container_name: "containerName",
        container_port: "containerPort",
        domain: "domain",
        openrouter_api_key: "openrouterApiKey",
        image_tag: "imageTag",
        status: "status",
        lightrag_service_url: "lightragServiceUrl",
        env_vars: "envVars",
        health_status: "healthStatus",
        error_message: "errorMessage",
      };

      const data: Record<string, unknown> = {};
      for (const [bodyField, prismaField] of Object.entries(fieldMap)) {
        if (body[bodyField] !== undefined) {
          data[prismaField] = body[bodyField];
        }
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      await prisma.lguDeployment.update({
        where: { id },
        data,
      });

      const updated = await prisma.lguDeployment.findUnique({
        where: { id },
        include: {
          ecsInstance: {
            select: { name: true, publicIp: true },
          },
        },
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("[admin/deployments/[id]] PUT error:", err);
      return NextResponse.json(
        { error: "Failed to update deployment" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);

// DELETE: Remove deployment record
export const DELETE = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const existing = await prisma.lguDeployment.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
      }

      await prisma.lguDeployment.delete({ where: { id } });

      return NextResponse.json({ success: true, message: "Deployment removed" });
    } catch (err) {
      console.error("[admin/deployments/[id]] DELETE error:", err);
      return NextResponse.json(
        { error: "Failed to delete deployment" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
