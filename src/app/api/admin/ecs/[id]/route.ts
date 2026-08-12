import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// GET: Get ECS instance details with its deployments
export const GET = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const instance = await prisma.ecsInstance.findUnique({
        where: { id },
        include: {
          deployments: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!instance) {
        return NextResponse.json({ error: "ECS instance not found" }, { status: 404 });
      }

      return NextResponse.json(instance);
    } catch (err) {
      console.error("[admin/ecs/[id]] GET error:", err);
      return NextResponse.json(
        { error: "Failed to fetch ECS instance" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);

// PUT: Update ECS instance
export const PUT = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const existing = await prisma.ecsInstance.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "ECS instance not found" }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields: Record<string, string> = {
        name: "name",
        province: "province",
        region: "region",
        public_ip: "publicIp",
        ssh_port: "sshPort",
        ssh_user: "sshUser",
        ssh_key_path: "sshKeyPath",
        status: "status",
        notes: "notes",
      };

      const data: Record<string, unknown> = {};
      for (const [bodyField, prismaField] of Object.entries(allowedFields)) {
        if (body[bodyField] !== undefined) {
          data[prismaField] = body[bodyField];
        }
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.ecsInstance.update({
        where: { id },
        data,
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("[admin/ecs/[id]] PUT error:", err);
      return NextResponse.json(
        { error: "Failed to update ECS instance" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);

// DELETE: Remove ECS instance (only if no deployments)
export const DELETE = withAuth(
  async (request, session, context) => {
    const { id } = await context.params;

    try {
      const existing = await prisma.ecsInstance.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "ECS instance not found" }, { status: 404 });
      }

      // Check for active deployments
      const deployCount = await prisma.lguDeployment.count({
        where: { ecsInstanceId: id },
      });

      if (deployCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete: ECS instance has ${deployCount} deployment(s). Remove deployments first.` },
          { status: 409 }
        );
      }

      await prisma.ecsInstance.delete({ where: { id } });

      return NextResponse.json({ success: true, message: "ECS instance removed" });
    } catch (err) {
      console.error("[admin/ecs/[id]] DELETE error:", err);
      return NextResponse.json(
        { error: "Failed to delete ECS instance" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
