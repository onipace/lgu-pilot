// src/lib/ai/model-calibration.ts
// ═══════════════════════════════════════════════════════════
// MODEL-CALIBRATED RESPONSE BUDGET
// ═══════════════════════════════════════════════════════════
//
// Problem: RESPONSE_MODE_CONFIG defines word caps (150/300/500)
// for ELLA and YALA. The max_tokens budget was hardcoded (400/600/1000)
// against one model's tokenizer. When the fallback chain switches
// models mid-request, the same token budget produces different actual
// word counts. The ceiling drifts.
//
// Solution: Express intent in WORDS (human unit). Derive the API-level
// token budget PER MODEL at request time using calibration constants:
//   - wordsPerToken: how many words fit per output token (tokenizer density)
//   - verbosityFactor: tendency to over-write beyond the instruction (1.0 = perfect)
//   - headroomTokens: extra tokens so the model finishes its last sentence cleanly
//
// Derivation formula:
//   effectiveMaxTokens = ceil((wordLimit * verbosityFactor) / wordsPerToken) + headroomTokens
//
// Production adjustment guide:
//   1. Change word caps in RESPONSE_MODE_CONFIG → token budget auto-derives
//   2. Change model in chain → calibration picks it up (or falls to DEFAULT_CALIBRATION)
//   3. Override calibration at runtime via LLM_CALIBRATION_JSON env var (JSON object)
//   4. Adjust grace ratio for the SSE soft-stop via WORD_CAP_GRACE_RATIO env var
//
// CALIBRATION REVIEW: Every 3 months, run the calibration probe (see /api/health/llm
// endpoint with ?calibrate=true) and update the wordsPerToken/verbosityFactor values.
// Last calibration: 2026-10-24 (initial estimates from codebase analysis)
// Next review: 2027-01-24

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface Calibration {
  wordsPerToken: number;     // avg words produced per completion token (PH legal English)
  verbosityFactor: number;   // 1.0 = follows word instruction precisely; >1 = tends to over-write
  headroomTokens: number;    // safety tokens so model can finish sentence + emit stop token
}

// ═══════════════════════════════════════════════════════════
// CALIBRATION TABLE
// ═══════════════════════════════════════════════════════════
// Values are empirical estimates based on:
//   - Qwen 2.5/3.x tokenizer: ~1.4 tokens/word for English (so ~0.71 words/token)
//   - GPT-4o-mini tokenizer: ~1.28 tokens/word (so ~0.78 words/token)
//   - Legal Filipino-English hybrid text slightly denser (~5% fewer words per token)
//   - Verbosity: larger models tend to elaborate more when given reasoning budgets
//
// After 3 months of live production data, replace these estimates with measured values
// by running the calibration probe script (see docs/MAINTENANCE.md).

const CALIBRATION: Record<string, Calibration> = {
  "qwen/qwen3.7-plus": {
    wordsPerToken: 0.73,
    verbosityFactor: 1.05,
    headroomTokens: 24,
  },
  "qwen/qwen3.8-flash": {
    wordsPerToken: 0.75,
    verbosityFactor: 0.98,  // flash is more concise, slightly under-writes
    headroomTokens: 20,
  },
  "qwen/qwen3-235b-a22b": {
    wordsPerToken: 0.66,
    verbosityFactor: 1.15,  // large model, verbose tendency
    headroomTokens: 36,
  },
  "qwen/qwen-plus": {
    wordsPerToken: 0.70,
    verbosityFactor: 1.08,
    headroomTokens: 28,
  },
  "openai/gpt-4o-mini": {
    wordsPerToken: 0.78,
    verbosityFactor: 1.02,  // respects word instructions well
    headroomTokens: 18,
  },
};

// Fallback for any model not in the table (future chain additions)
const DEFAULT_CALIBRATION: Calibration = {
  wordsPerToken: 0.72,
  verbosityFactor: 1.10,
  headroomTokens: 30,
};

// ═══════════════════════════════════════════════════════════
// ENV-OVERRIDE: Allow runtime tuning without redeployment
// ═══════════════════════════════════════════════════════════
// LLM_CALIBRATION_JSON='{"qwen/qwen3.7-plus":{"wordsPerToken":0.71,"verbosityFactor":1.03,"headroomTokens":20}}'
//
// Merge strategy: parsed JSON overlays onto the base table.
// This lets you recalibrate a model without a code deploy.

let _calibrationTable: Record<string, Calibration> | null = null;

function getCalibrationTable(): Record<string, Calibration> {
  if (_calibrationTable) return _calibrationTable;

  const merged = { ...CALIBRATION };
  const envOverride = process.env.LLM_CALIBRATION_JSON;
  if (envOverride) {
    try {
      const overrides = JSON.parse(envOverride) as Record<string, Partial<Calibration>>;
      for (const [model, partial] of Object.entries(overrides)) {
        const base = merged[model] ?? DEFAULT_CALIBRATION;
        merged[model] = {
          wordsPerToken: partial.wordsPerToken ?? base.wordsPerToken,
          verbosityFactor: partial.verbosityFactor ?? base.verbosityFactor,
          headroomTokens: partial.headroomTokens ?? base.headroomTokens,
        };
      }
    } catch (e) {
      console.warn("[calibration] Failed to parse LLM_CALIBRATION_JSON, using defaults:", e);
    }
  }
  _calibrationTable = merged;
  return merged;
}

// ═══════════════════════════════════════════════════════════
// CORE DERIVATION
// ═══════════════════════════════════════════════════════════

/**
 * Derive the effective max_tokens for a specific model given a word-count target.
 *
 * @param wordCap — the human-experience ceiling (e.g. 150 for Brief, 300 for Standard)
 * @param model   — the model ID as it appears in the fallback chain
 * @returns integer max_tokens value calibrated to this model's speaking rate
 */
export function deriveMaxTokens(wordCap: number, model: string): number {
  const table = getCalibrationTable();
  const cal = table[model] ?? DEFAULT_CALIBRATION;
  const adjustedWords = wordCap * cal.verbosityFactor;
  const tokenEstimate = Math.ceil(adjustedWords / cal.wordsPerToken);
  return tokenEstimate + cal.headroomTokens;
}

/**
 * Get the calibration entry for a model (for health probe / observability).
 */
export function getCalibrationForModel(model: string): Calibration {
  const table = getCalibrationTable();
  return table[model] ?? DEFAULT_CALIBRATION;
}

/**
 * Export the full calibration table for diagnostics.
 */
export function getFullCalibrationTable(): Record<string, Calibration> {
  return { ...getCalibrationTable() };
}

// ═══════════════════════════════════════════════════════════
// WORD CAP GRACE RATIO (for SSE soft-stop)
// ═══════════════════════════════════════════════════════════
// When the streaming response exceeds wordCap * graceRatio, the SSE loop
// stops enqueueing and closes the stream. This is the belt-and-suspenders
// hard guarantee that the user never sees more than ~cap × grace words,
// even if calibration is slightly off.
//
// Default 1.15 (15% grace for tokenization imprecision and sentence boundaries).
// Override via WORD_CAP_GRACE_RATIO env var (e.g. "1.10" for tighter enforcement).

export function getGraceRatio(): number {
  return parseFloat(process.env.WORD_CAP_GRACE_RATIO || "1.15");
}

// ═══════════════════════════════════════════════════════════
// UTILITY: Count words in a text chunk (for streaming accumulator)
// ═══════════════════════════════════════════════════════════

/**
 * Count words in a text delta. Splits on whitespace, filters empty strings.
 * Used in the SSE loop to track accumulated word count incrementally.
 */
export function countWords(text: string): number {
  if (!text || text.length === 0) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Trim text to the last sentence boundary at or below the word cap.
 * Used when the soft-stop triggers — we want the user to see a complete
 * sentence, not a mid-word cut.
 */
export function trimToLastSentence(text: string, wordCap: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);
  if (!sentences) return text;

  let result = "";
  let wordCount = 0;
  for (const sent of sentences) {
    const sentWords = countWords(sent);
    if (wordCount + sentWords > wordCap) break;
    result += sent;
    wordCount += sentWords;
  }
  return result || text.slice(0, text.lastIndexOf(" "));
}
