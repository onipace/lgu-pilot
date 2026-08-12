// src/app/api/admin/bookings/route.ts — CR-001 Demo Booking System
// GET: List demo bookings (paginated, filterable)
// PATCH: Update booking status/notes

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/bookings
 * List all demo bookings with filtering and pagination.
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { organization: { contains: search, mode: "insensitive" } },
      ];
    }

    const [bookings, total, statusCounts] = await Promise.all([
      prisma.demoBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.demoBooking.count({ where }),
      prisma.demoBooking.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    // Convert status counts to a simple map
    const counts: Record<string, number> = {
      new: 0,
      contacted: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const sc of statusCounts) {
      counts[sc.status] = sc._count.status;
    }

    return NextResponse.json({
      success: true,
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: counts,
    });
  } catch (error) {
    console.error("[admin/bookings] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch bookings." },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/bookings/[id]
 * Update booking status and/or admin notes.
 */
export const PATCH = withAuth(async (request: Request) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Booking ID required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, adminNotes } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "contacted") updateData.contactedAt = new Date();
      if (status === "confirmed") updateData.confirmedAt = new Date();
      if (status === "completed") updateData.completedAt = new Date();
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const booking = await prisma.demoBooking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("[admin/bookings] PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update booking." },
      { status: 500 }
    );
  }
});
