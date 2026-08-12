// src/app/api/linaw/inventory/route.ts
// Sprint 6 (S6-C5) — N001 inventory endpoint (PRD §12.6).
// GET /api/linaw/inventory — parameterless; thin auth + engine + envelope
// wrapper over analyzeInventory (agent 1). Zero business logic here.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { analyzeInventory } from "@/lib/linaw/agents";

export const GET = withUserAuth(async (_request, { user }) => {
  try {
    const result = await analyzeInventory({ userId: user.user.id });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[linaw/inventory] computation failed:", err);
    return NextResponse.json(
      { error: "Inventory computation failed" },
      { status: 500 }
    );
  }
});
