// src/lib/ai/response-mode.ts
// ═══════════════════════════════════════════════════════════
// RESPONSE MODE CONFIGURATION (ELLA & YALA chat)
// ═══════════════════════════════════════════════════════════
//
// CANONICAL INTENT = wordLimit (human experience unit).
// maxTokens field is @deprecated — it's retained only as an absolute
// safety cap for non-calibrated callers (health probe, OBRA). The real
// per-model token budget is derived at runtime via model-calibration.ts
// using the formula: deriveMaxTokens(wordLimit, modelId).
//
// CR-002 (2026-10-25): word ceilings raised from 150/300/500 to
// 250/500/800 to eliminate the "cut off" / "inconclusive" user experience.
// Legal answers need enough headroom for rule + application + recommendation
// + citations. Prompt suffix also rewritten to require an actionable
// conclusion so the model doesn't stop mid-thought.
//
// To adjust word caps during production: change wordLimit here and the
// token budgets auto-derive across the entire fallback chain.

import { deriveMaxTokens } from "./model-calibration";

export type ResponseMode = 'brief' | 'standard' | 'detailed';

export const RESPONSE_MODE_CONFIG: Record<ResponseMode, {
  label: string;
  wordLimit: number;            // CANONICAL: the human-facing ceiling
  citationCount: number;
  citationLimit: number | null; // null = no upper cap
  /** @deprecated — safety cap only; real budget derives from wordLimit via calibration */
  maxTokens: number;
}> = {
  brief:    { label: 'Brief',    wordLimit: 250, citationCount: 3, citationLimit: 3,    maxTokens: 600 },
  standard: { label: 'Standard', wordLimit: 500, citationCount: 4, citationLimit: 4,    maxTokens: 900 },
  detailed: { label: 'Detailed', wordLimit: 800, citationCount: 5, citationLimit: null, maxTokens: 1600 },
};

/**
 * Get the calibrated max_tokens for a specific model given a response mode.
 * Useful for health probes, tooltips, and any caller that needs to know
 * the derived budget without going through the fallback loop.
 */
export function getEffectiveMaxTokens(mode: ResponseMode, model: string): number {
  const cfg = RESPONSE_MODE_CONFIG[mode];
  return deriveMaxTokens(cfg.wordLimit, model);
}

// Prompt suffix appended to the system prompt
export function getResponseModeSuffix(mode: ResponseMode): string {
  const cfg = RESPONSE_MODE_CONFIG[mode];
  const citationRule = cfg.citationLimit
    ? `Include exactly ${cfg.citationLimit} legal citations from the most relevant provisions in the context above. Do not include fewer than ${cfg.citationLimit} or more than ${cfg.citationLimit}. Each citation must reference a distinct legal provision.`
    : `Include at least ${cfg.citationCount} legal citations from the most relevant provisions in the context above. Include more if highly relevant to the question.`;

  return `\n\nRESPONSE FORMAT INSTRUCTION:
- LENGTH: Deliver a complete, self-contained answer of at least ${cfg.wordLimit} words. Do not stop early — this is a floor, not a target.
- STRUCTURE (all four parts required):
  (1) STATE the applicable legal rule or provision, in plain language.
  (2) APPLY it to the LGU's situation described in the question.
  (3) RECOMMEND one concrete next step or action the reader should take.
  (4) CITE: ${citationRule}
- COMPLETENESS: The reader must not need to ask a follow-up to understand what to do. End with a clear conclusion, not a trailing "it depends..." or "in summary..." fragment.
- ORDER: Prioritize the most important and directly applicable citations first.`;
}
