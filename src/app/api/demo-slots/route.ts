// src/app/api/demo-slots/route.ts — CR-001 Demo Booking System
// GET: Fetch available demo slots for the next N days

import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/demo-availability";

export async function GET() {
  try {
    const slots = await getAvailableSlots(14);
    return NextResponse.json({ success: true, dates: slots });
  } catch (error) {
    console.error("[demo-slots] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch available slots." },
      { status: 500 }
    );
  }
}
