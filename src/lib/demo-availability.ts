// src/lib/demo-availability.ts — CR-001 Demo Booking System
// Computes available time slots from DemoAvailability rules minus bookings minus blocked dates

import { prisma } from "@/lib/prisma";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailableSlot {
  date: string;       // "2026-08-14"
  dayLabel: string;   // "Thursday"
  slots: string[];    // ["09:00", "09:30", "10:00", ...]
}

/**
 * Generate time slots between start and end times at given interval.
 */
function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  for (let m = startMinutes; m + durationMinutes <= endMinutes; m += durationMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }

  return slots;
}

/**
 * Get available demo slots for the next N days.
 */
export async function getAvailableSlots(daysAhead: number = 14): Promise<AvailableSlot[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch availability rules, blocked dates, and existing bookings in parallel
  const [availabilityRules, blockedDates, existingBookings] = await Promise.all([
    prisma.demoAvailability.findMany({ where: { isActive: true } }),
    prisma.demoBlockedDate.findMany(),
    prisma.demoBooking.findMany({
      where: {
        preferredDate: { gte: today },
        status: { notIn: ["cancelled"] },
      },
      select: { preferredDate: true, preferredSlot: true },
    }),
  ]);

  // Build set of blocked date strings
  const blockedDateSet = new Set(
    blockedDates.map((bd) => new Date(bd.date).toISOString().split("T")[0])
  );

  // Build map of booked slots: "2026-08-14" → Set("09:00", "10:00")
  const bookedSlotsMap = new Map<string, Set<string>>();
  for (const booking of existingBookings) {
    if (!booking.preferredDate || !booking.preferredSlot) continue;
    const dateStr = new Date(booking.preferredDate).toISOString().split("T")[0];
    if (!bookedSlotsMap.has(dateStr)) {
      bookedSlotsMap.set(dateStr, new Set());
    }
    bookedSlotsMap.get(dateStr)!.add(booking.preferredSlot);
  }

  // Group availability rules by day of week
  const rulesByDay = new Map<number, typeof availabilityRules>();
  for (const rule of availabilityRules) {
    if (!rulesByDay.has(rule.dayOfWeek)) {
      rulesByDay.set(rule.dayOfWeek, []);
    }
    rulesByDay.get(rule.dayOfWeek)!.push(rule);
  }

  // Compute available slots for each day
  const result: AvailableSlot[] = [];

  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Skip weekends if no rules for that day
    const dayOfWeek = date.getDay();
    const rules = rulesByDay.get(dayOfWeek);
    if (!rules || rules.length === 0) continue;

    const dateStr = date.toISOString().split("T")[0];

    // Skip blocked dates
    if (blockedDateSet.has(dateStr)) continue;

    // Generate all slots from all rules for this day
    const allSlots = new Set<string>();
    for (const rule of rules) {
      const timeSlots = generateTimeSlots(rule.startTime, rule.endTime, rule.slotDuration);
      for (const slot of timeSlots) {
        allSlots.add(slot);
      }
    }

    // Remove booked slots
    const bookedSlots = bookedSlotsMap.get(dateStr);
    const availableSlots = Array.from(allSlots)
      .filter((slot) => !bookedSlots?.has(slot))
      .sort();

    if (availableSlots.length > 0) {
      result.push({
        date: dateStr,
        dayLabel: DAY_LABELS[dayOfWeek],
        slots: availableSlots,
      });
    }
  }

  return result;
}

/**
 * Get all availability rules (for admin).
 */
export async function getAvailabilityRules() {
  const [rules, blockedDates] = await Promise.all([
    prisma.demoAvailability.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.demoBlockedDate.findMany({ orderBy: { date: "asc" } }),
  ]);
  return { rules, blockedDates };
}

/**
 * Save availability rules (upsert pattern: delete all + recreate for simplicity).
 */
export async function saveAvailabilityRules(data: {
  rules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    isActive: boolean;
  }>;
  blockedDates: Array<{
    date: string;
    reason?: string;
  }>;
}) {
  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Clear existing rules and blocked dates
    await tx.demoAvailability.deleteMany();
    await tx.demoBlockedDate.deleteMany();

    // Insert new rules
    if (data.rules.length > 0) {
      await tx.demoAvailability.createMany({
        data: data.rules.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          slotDuration: r.slotDuration,
          isActive: r.isActive,
        })),
      });
    }

    // Insert new blocked dates
    if (data.blockedDates.length > 0) {
      await tx.demoBlockedDate.createMany({
        data: data.blockedDates.map((bd) => ({
          date: new Date(bd.date),
          reason: bd.reason || null,
        })),
      });
    }
  });
}
