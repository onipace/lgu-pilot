// src/app/api/book-demo/route.ts — CR-001 Demo Booking System
// POST: Submit a demo booking request

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendBookingRow } from "@/lib/google-sheets";
import { sendDemoBookingNotification, sendDemoConfirmation } from "@/lib/email";

// Simple in-memory rate limiter (per IP, per hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function verifyHCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  // Graceful: skip verification if not configured (dev mode)
  if (!secretKey) {
    console.warn("[book-demo] HCAPTCHA_SECRET_KEY not set — skipping captcha verification");
    return true;
  }

  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    console.error("[book-demo] hCaptcha verification request failed");
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { fullName, email, organization, position, phone, preferredDate, preferredSlot, message, hCaptchaToken } = body;

    if (!fullName || !email || !organization) {
      return NextResponse.json(
        { success: false, message: "Full name, email, and organization are required." },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Verify hCaptcha
    const captchaPassed = hCaptchaToken ? await verifyHCaptcha(hCaptchaToken) : !process.env.HCAPTCHA_SECRET_KEY;
    if (hCaptchaToken && process.env.HCAPTCHA_SECRET_KEY && !captchaPassed) {
      return NextResponse.json(
        { success: false, message: "Captcha verification failed. Please try again." },
        { status: 400 }
      );
    }

    // Check slot availability if date+slot selected
    if (preferredDate && preferredSlot) {
      const slotDate = new Date(preferredDate);
      const existingBooking = await prisma.demoBooking.findFirst({
        where: {
          preferredDate: slotDate,
          preferredSlot,
          status: { notIn: ["cancelled"] },
        },
      });

      if (existingBooking) {
        return NextResponse.json(
          { success: false, message: "This time slot has just been booked. Please select another." },
          { status: 409 }
        );
      }
    }

    // Save booking to database
    const booking = await prisma.demoBooking.create({
      data: {
        fullName,
        email,
        organization,
        position: position || null,
        phone: phone || null,
        message: message || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredSlot: preferredSlot || null,
        hcaptchaPassed: captchaPassed,
      },
    });

    // Send email notification to admin (non-blocking)
    sendDemoBookingNotification({
      fullName,
      email,
      organization,
      position,
      phone,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredSlot,
      message,
    }).catch((err) => console.error("[book-demo] Email notification failed:", err));

    // Send confirmation to prospect (non-blocking)
    sendDemoConfirmation({
      fullName,
      email,
      organization,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredSlot,
    }).catch((err) => console.error("[book-demo] Confirmation email failed:", err));

    // Sync to Google Sheets (non-blocking)
    appendBookingRow({
      id: booking.id,
      fullName,
      email,
      organization,
      position,
      phone,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredSlot,
      message,
      createdAt: booking.createdAt,
    }).then((result) => {
      if (result.success) {
        prisma.demoBooking.update({
          where: { id: booking.id },
          data: { sheetsSynced: true },
        }).catch(() => {});
      } else {
        prisma.demoBooking.update({
          where: { id: booking.id },
          data: { sheetsSynced: false, sheetsError: result.error },
        }).catch(() => {});
      }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Demo request received. We'll be in touch within 1 business day.",
      bookingId: booking.id,
    });
  } catch (error) {
    console.error("[book-demo] Error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
