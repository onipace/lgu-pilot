// src/app/api/admin/availability/route.ts — CR-001 Demo Booking System
// GET: Fetch availability rules + blocked dates
// PUT: Save/update availability rules + blocked dates

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { getAvailabilityRules, saveAvailabilityRules } from "@/lib/demo-availability";

/**
 * GET /api/admin/availability
 * Fetch current availability configuration.
 */
export const GET = withAuth(async () => {
  try {
    const { rules, blockedDates } = await getAvailabilityRules();
    return NextResponse.json({
      success: true,
      rules,
      blockedDates: blockedDates.map((bd) => ({
        ...bd,
        date: new Date(bd.date).toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    console.error("[admin/availability] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch availability." },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/availability
 * Replace all availability rules and blocked dates.
 */
export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { rules, blockedDates } = body;

    if (!Array.isArray(rules) || !Array.isArray(blockedDates)) {
      return NextResponse.json(
        { success: false, message: "rules and blockedDates arrays required." },
        { status: 400 }
      );
    }

    // Validate rules
    for (const rule of rules) {
      if (typeof rule.dayOfWeek !== "number" || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
        return NextResponse.json(
          { success: false, message: "dayOfWeek must be 0-6." },
          { status: 400 }
        );
      }
      if (!/^\d{2}:\d{2}$/.test(rule.startTime) || !/^\d{2}:\d{2}$/.test(rule.endTime)) {
        return NextResponse.json(
          { success: false, message: "startTime and endTime must be HH:MM format." },
          { status: 400 }
        );
      }
    }

    await saveAvailabilityRules({ rules, blockedDates });

    // Return updated data
    const updated = await getAvailabilityRules();
    return NextResponse.json({
      success: true,
      message: "Availability updated.",
      rules: updated.rules,
      blockedDates: updated.blockedDates.map((bd) => ({
        ...bd,
        date: new Date(bd.date).toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    console.error("[admin/availability] PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update availability." },
      { status: 500 }
    );
  }
});
