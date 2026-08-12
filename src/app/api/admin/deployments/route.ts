import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import type { Prisma } from "@/generated/prisma/client";
import crypto from "crypto";

// GET: List all LGU deployments with filtering
export const GET = withAuth(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const ecsId = searchParams.get("ecs_id");
  const status = searchParams.get("status");
  const province = searchParams.get("province");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    const where: Prisma.LguDeploymentWhereInput = {};
    if (ecsId) where.ecsInstanceId = ecsId;
    if (status) where.status = status;
    if (province) where.province = province;

    // Total count
    const total = await prisma.lguDeployment.count({ where });

    // Fetch deployments with ECS info
    const deployments = await prisma.lguDeployment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        ecsInstance: {
          select: {
            name: true,
            publicIp: true,
            province: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      deployments,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/deployments] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch deployments" },
      { status: 500 }
    );
  }
});

// POST: Create a new deployment record
export const POST = withAuth(
  async (request, session) => {
    try {
      const body = await request.json();
      const {
        lgu_id,
        lgu_name,
        lgu_type,
        lgu_class,
        province,
        ecs_instance_id,
        container_name,
        container_port,
        domain,
        openrouter_api_key,
        image_tag,
      } = body;

      // Validation
      if (!lgu_id || !lgu_name || !lgu_type || !province || !ecs_instance_id || !container_name) {
        return NextResponse.json(
          { error: "Missing required fields: lgu_id, lgu_name, lgu_type, province, ecs_instance_id, container_name" },
          { status: 400 }
        );
      }

      const validTypes = ["municipality", "city", "component_city", "huc"];
      if (!validTypes.includes(lgu_type)) {
        return NextResponse.json(
          { error: `Invalid lgu_type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }

      const validClasses = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
      if (lgu_class && !validClasses.includes(lgu_class)) {
        return NextResponse.json(
          { error: `Invalid lgu_class. Must be one of: ${validClasses.join(", ")}` },
          { status: 400 }
        );
      }

      // Verify ECS instance exists
      const ecs = await prisma.ecsInstance.findUnique({ where: { id: ecs_instance_id } });
      if (!ecs) {
        return NextResponse.json(
          { error: "ECS instance not found" },
          { status: 404 }
        );
      }

      const deployment = await prisma.lguDeployment.create({
        data: {
          lguId: lgu_id,
          lguName: lgu_name,
          lguType: lgu_type,
          lguClass: lgu_class || null,
          province,
          ecsInstanceId: ecs_instance_id,
          containerName: container_name,
          containerPort: container_port || 3000,
          domain: domain || null,
          openrouterApiKey: openrouter_api_key || null,
          imageTag: image_tag || "latest",
          createdBy: session.user.id,
        },
        include: {
          ecsInstance: {
            select: { name: true, publicIp: true },
          },
        },
      });

      return NextResponse.json(deployment, { status: 201 });
    } catch (err) {
      console.error("[admin/deployments] POST error:", err);
      return NextResponse.json(
        { error: "Failed to create deployment" },
        { status: 500 }
      );
    }
  },
  { requireSuperAdmin: true }
);
