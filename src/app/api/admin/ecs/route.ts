import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// GET: List all ECS instances with deployment counts
export const GET = withAuth(
  async (request, session) => {
    try {
      const instances = await prisma.ecsInstance.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          deployments: {
            select: { id: true, status: true },
          },
        },
      });

      const rows = instances.map((e) => ({
        ...e,
        deployment_count: e.deployments.length,
        running_count: e.deployments.filter((d) => d.status === "running").length,
        deployments: undefined,
      }));

      return NextResponse.json({ instances: rows });
    } catch (err) {
      console.error("[admin/ecs] GET error:", err);
      return NextResponse.json(
        { error: "Failed to fetch ECS instances" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);

// POST: Create a new ECS instance record
export const POST = withAuth(
  async (request, session) => {
    try {
      const body = await request.json();
      const {
        name,
        province,
        region,
        public_ip,
        ssh_port,
        ssh_user,
        ssh_key_path,
        notes,
      } = body;

      // Validation
      if (!name || !province || !public_ip) {
        return NextResponse.json(
          { error: "Missing required fields: name, province, public_ip" },
          { status: 400 }
        );
      }

      const instance = await prisma.ecsInstance.create({
        data: {
          name,
          province,
          region: region || null,
          publicIp: public_ip,
          sshPort: ssh_port || 22,
          sshUser: ssh_user || "root",
          sshKeyPath: ssh_key_path || null,
          notes: notes || null,
        },
      });

      return NextResponse.json(instance, { status: 201 });
    } catch (err) {
      console.error("[admin/ecs] POST error:", err);
      return NextResponse.json(
        { error: "Failed to create ECS instance" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
