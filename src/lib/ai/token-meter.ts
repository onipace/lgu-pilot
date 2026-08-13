// ─────────────────────────────────────────────────────────────
// PILLAR Token Meter — Fire-and-Forget Recording Utility
// ─────────────────────────────────────────────────────────────
//
// This module provides the single integration point between
// pillar-pilot's LLM call paths and the token-meter service.
// It sends a non-blocking POST to the meter with a 2-second timeout.
// All errors are caught and logged as warnings — the LLM response
// is NEVER delayed or blocked by token recording.

const METER_URL = process.env.TOKEN_METER_URL || "http://token-meter:3084";
const METER_TIMEOUT_MS = 2000;

interface TokenUsageEvent {
  model: string;
  input_tokens: number;
  output_tokens: number;
  module: "ella" | "obra" | "yala";
  route: string;
  user_id?: string;
  user_name?: string;
  session_id?: string;
  timestamp?: string;
}

/**
 * Record a token usage event to the token-meter service.
 *
 * This function is fire-and-forget:
 * - Returns void (not a Promise) — the caller never awaits it.
 * - Uses AbortSignal.timeout(2000) to cancel after 2 seconds.
 * - All errors are caught and logged as warnings.
 * - The LLM response is never delayed.
 */
export function recordTokenUsage(event: TokenUsageEvent): void {
  fetch(`${METER_URL}/api/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(METER_TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `[token-meter] Record failed: ${res.status} ${res.statusText}`
        );
      }
    })
    .catch((err: Error) => {
      // Meter unavailable — log warning, do not block
      console.warn(`[token-meter] Service unavailable: ${err.message}`);
    });
}
