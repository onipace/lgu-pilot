// src/app/api/health/llm/route.ts
// Live probe: verifies the LLM stack end-to-end and reports which model in the chain is currently primary.
// Also returns circuit breaker status per model.
//
// Access: admin session only. Use for daily monitoring and post-incident diagnosis.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { getCircuitStatus } from "@/lib/ai/llm-resilient";
import { chatCompletion } from "@/lib/ai/llm";
import { getFullCalibrationTable, deriveMaxTokens } from "@/lib/ai/model-calibration";

export const GET = withAuth(async () => {
  const startedAt = Date.now();
  const chain = (process.env.LLM_MODEL_CHAIN || "qwen/qwen3.7-plus,qwen/qwen3.8-flash,qwen/qwen3-235b-a22b,qwen/qwen-plus,openai/gpt-4o-mini")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let probe: { ok: boolean; model?: string; contentLength?: number; error?: string } = {
    ok: false,
  };

  try {
    const result = await chatCompletion(
      "You are a health probe. Reply with exactly one word: OK",
      "ping",
      { maxTokens: 20, temperature: 0 }
    );
    probe = {
      ok: true,
      model: (result as any).model || "unknown",
      contentLength: result.content.length,
    };
  } catch (err) {
    const e = err as any;
    probe = {
      ok: false,
      error: String(e?.message || err).slice(0, 500),
    };
  }

  const circuits = getCircuitStatus();
  const calibration = getFullCalibrationTable();

  // Show how Brief mode (150 words) maps to per-model token budget
  const derivedBudget: Record<string, number> = {};
  for (const model of chain) {
    derivedBudget[model] = deriveMaxTokens(150, model);
  }

  return NextResponse.json({
    status: probe.ok ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    probeMs: Date.now() - startedAt,
    probe,
    chain,
    circuits,
    calibration,
    derivedBudget,
    config: {
      providerPrefer: process.env.LLM_PROVIDER_PREFER || "(default)",
      providerIgnore: process.env.LLM_PROVIDER_IGNORE || "(none)",
      circuitThreshold: parseInt(process.env.LLM_CIRCUIT_THRESHOLD || "3", 10),
      cooldownSec: parseInt(process.env.LLM_CIRCUIT_COOLDOWN_MS || "300000", 10) / 1000,
      maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "2", 10),
      graceRatio: parseFloat(process.env.WORD_CAP_GRACE_RATIO || "1.15"),
    },
  });
});
