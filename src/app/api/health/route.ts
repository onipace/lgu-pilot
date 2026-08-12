import { NextResponse } from "next/server";
import { checkLightRAGHealth } from "@/lib/ai/lightrag";

export async function GET() {
  const lightragOk = await checkLightRAGHealth().catch(() => false);

  return NextResponse.json({
    status: "ok",
    service: "esangguni",
    modules: ["ella", "obra", "yala"],
    lightrag: lightragOk ? "healthy" : "unavailable",
    timestamp: new Date().toISOString(),
  });
}
