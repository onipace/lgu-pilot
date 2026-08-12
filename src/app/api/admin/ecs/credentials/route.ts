import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// GET: List credential info (metadata only, not actual keys)
export const GET = withAuth(
  async (request, session) => {
    try {
      const rows = await prisma.ecsInstance.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sshUser: true,
          sshKeyPath: true,
          sshKeyEncrypted: true,
          apiToken: true,
        },
      });

      // Return sanitized metadata (no actual secrets)
      const credentials = rows.map((row) => ({
        ecs_id: row.id,
        name: row.name,
        ssh_user: row.sshUser,
        ssh_key_path: row.sshKeyPath
          ? `...${row.sshKeyPath.slice(-20)}`
          : null,
        has_ssh_key: !!row.sshKeyEncrypted,
        has_api_token: !!row.apiToken,
      }));

      return NextResponse.json({ credentials });
    } catch (err) {
      console.error("[admin/ecs/credentials] GET error:", err);
      return NextResponse.json(
        { error: "Failed to fetch credential info" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);

// PUT: Update credentials for an ECS instance
export const PUT = withAuth(
  async (request, session) => {
    try {
      const body = await request.json();
      const { ecs_id, ssh_key_path, ssh_key_content, api_token } = body;

      if (!ecs_id) {
        return NextResponse.json(
          { error: "Missing required field: ecs_id" },
          { status: 400 }
        );
      }

      const existing = await prisma.ecsInstance.findUnique({ where: { id: ecs_id } });
      if (!existing) {
        return NextResponse.json({ error: "ECS instance not found" }, { status: 404 });
      }

      const data: Record<string, unknown> = {};

      if (ssh_key_path !== undefined) {
        data.sshKeyPath = ssh_key_path;
      }

      if (ssh_key_content !== undefined) {
        // In production, this would be encrypted before storage
        data.sshKeyEncrypted = ssh_key_content || null;
      }

      if (api_token !== undefined) {
        data.apiToken = api_token || null;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No credential fields to update" },
          { status: 400 }
        );
      }

      await prisma.ecsInstance.update({
        where: { id: ecs_id },
        data,
      });

      return NextResponse.json({
        success: true,
        message: "Credentials updated",
        ecs_id,
      });
    } catch (err) {
      console.error("[admin/ecs/credentials] PUT error:", err);
      return NextResponse.json(
        { error: "Failed to update credentials" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
