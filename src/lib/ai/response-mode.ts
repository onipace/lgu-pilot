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
  brief:    { label: 'Brief',    wordLimit: 150, citationCount: 3, citationLimit: 3,    maxTokens: 400 },
  standard: { label: 'Standard', wordLimit: 300, citationCount: 4, citationLimit: 4,    maxTokens: 600 },
  detailed: { label: 'Detailed', wordLimit: 500, citationCount: 5, citationLimit: null, maxTokens: 1000 },
};

/**
 * Get the calibrated max_tokens for a specific model given a response mode.
 * Useful for health probes, logging, and any caller that needs to know the
 * derived budget without going through the fallback loop.
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
- RESPONSE LENGTH: Write a thorough response of approximately ${cfg.wordLimit} words. Fully utilize this word allowance — provide complete legal analysis, explain the reasoning, and include practical implications. Do not truncate or be overly brief.
- ${citationRule}
- Prioritize the most important and directly applicable citations first.`;
}
