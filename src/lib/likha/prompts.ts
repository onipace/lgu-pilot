// src/lib/likha/prompts.ts
// Sprint 2 (S2-C7) — L003 metadata parsing prompts.
// Strict-JSON extraction prompt for Philippine LGU ordinances + a parser that
// NEVER throws (garbage in → zeroed metadata out; confidences clamped to [0,1]).
// Imports types only from @/types/likha.

import {
  LIKHA_CLASSIFICATION_LABELS,
  LIKHA_CODE_TITLES,
  LIKHA_SUBJECTS,
  type MetadataConfidence,
  type ParsedMetadata,
} from '@/types/likha';

const MAX_RAW_TEXT_CHARS = 12_000;

export const METADATA_SYSTEM_PROMPT: string =
  'You are a precise metadata extraction engine for Philippine LGU ordinances ' +
  '(Sangguniang Bayan records). Read the transcribed ordinance text and return ONLY a JSON object — ' +
  'no prose, no markdown fences — with exactly this shape: ' +
  '{"ordinanceNumber": number, "seriesYear": number, "title": string, "sectionCount": number, ' +
  '"confidence": {"ordinanceNumber": number, "seriesYear": number, "title": number, "sectionCount": number}}. ' +
  "Ordinance numbers are the numeric part of 'Ordinance No. X'; seriesYear is the 'Series of YYYY' year; " +
  "title is the full 'An ordinance …' enactment clause. " +
  "IMPORTANT — sectionCount: Count every numbered section in the ordinance body. Look for patterns like " +
  "'Section 1.', 'Section 2.', 'SEC. 1.', 'SEC. 2.', 'SECTION 1.', '§1', '§ 1', or numbered paragraphs " +
  "that begin with 'Section'. Count ALL distinct section markers, even if they use different formats. " +
  "If you find at least one section marker, return the total count as a positive integer — never return 0 " +
  "when sections are present. " +
  'Confidence values are 0–1 self-estimates; use 0 when a field cannot be found.';

/** Truncates the transcription to 12,000 chars and asks for the strict JSON object. */
export function buildMetadataUserPrompt(rawText: string): string {
  const truncated = rawText.slice(0, MAX_RAW_TEXT_CHARS);
  return (
    'Transcribed ordinance text:\n\n' +
    truncated +
    '\n\nReturn ONLY the JSON object described in the system instructions — no prose, no markdown fences.'
  );
}

function defaultMetadata(): ParsedMetadata {
  return {
    ordinanceNumber: 0,
    seriesYear: 0,
    title: '',
    sectionCount: 0,
    confidence: { ordinanceNumber: 0, seriesYear: 0, title: 0, sectionCount: 0 },
  };
}

function toInteger(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toClampedConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parses the LLM response into typed metadata. Strips ``` fences, finds the
 * first {…} JSON span, coerces numbers, clamps every confidence to [0, 1].
 * NEVER throws: any failure yields zeroed defaults.
 */
export function parseMetadataResponse(llmText: string): ParsedMetadata {
  try {
    if (typeof llmText !== 'string' || llmText.trim() === '') {
      return defaultMetadata();
    }

    // Strip markdown fences (```json … ```), then locate the outermost JSON span.
    const stripped = llmText
      .trim()
      .replace(/^```[a-zA-Z]*[\r\n]?/, '')
      .replace(/[\r\n]?```$/, '');

    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return defaultMetadata();
    }

    const json = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    const rawConfidence = (json.confidence ?? {}) as Record<string, unknown>;

    const confidence: MetadataConfidence = {
      ordinanceNumber: toClampedConfidence(rawConfidence.ordinanceNumber),
      seriesYear: toClampedConfidence(rawConfidence.seriesYear),
      title: toClampedConfidence(rawConfidence.title),
      sectionCount: toClampedConfidence(rawConfidence.sectionCount),
    };

    return {
      ordinanceNumber: toInteger(json.ordinanceNumber, 0),
      seriesYear: toInteger(json.seriesYear, 0),
      title: typeof json.title === 'string' ? json.title : '',
      sectionCount: toInteger(json.sectionCount, 0),
      confidence,
    };
  } catch {
    return defaultMetadata();
  }
}

/**
 * Regex fallback for sectionCount. Counts distinct section markers in raw text
 * when the LLM returns 0. Matches: "Section 1", "SEC. 2", "SECTION 3", "§1",
 * "§ 4", and similar patterns common in Philippine LGU ordinances.
 */
export function countSectionsByRegex(rawText: string): number {
  const patterns = [
    /\bSection\s+\d+/gi,       // "Section 1", "section 2"
    /\bSEC\.?\s+\d+/gi,        // "SEC. 1", "SEC 2", "sec. 3"
    /\b§\s*\d+/g,              // "§1", "§ 2"
  ];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    const matches = rawText.match(pattern);
    if (matches) {
      for (const m of matches) {
        // Normalize: extract the number to deduplicate across patterns
        const num = m.match(/\d+/);
        if (num) seen.add(num[0]);
      }
    }
  }
  return seen.size;
}

// ── Sprint 4 (S4-C3): L007 subject classification prompt + parser ──────────
// Follows the exact metadata precedent above: strict-JSON system prompt, a
// 12,000-char truncating user prompt builder, and a parser that NEVER throws.
// The legal label space is the decision-D21 union of the 13 Code Titles and the
// existing LIKHA_SUBJECTS; any label outside the union is dropped.

const MAX_CLASSIFY_SUGGESTIONS = 5;

export const CLASSIFICATION_SYSTEM_PROMPT: string =
  'You are a legislative classification engine for Philippine LGU ordinances. ' +
  'Classify the ordinance against the Code Titles/Chapters taxonomy and LIKHA subject categories. ' +
  'Return ONLY a JSON array — no prose, no markdown fences — of 1–5 objects shaped ' +
  '{"label": string, "confidence": number} sorted by confidence descending. ' +
  'Labels MUST be chosen exactly from: ' +
  [...LIKHA_CODE_TITLES, ...LIKHA_SUBJECTS].join(' | ') +
  '. Confidence values are 0–1 self-estimates.';

/** Truncates the transcription to 12,000 chars and asks for the strict JSON array. */
export function buildClassificationUserPrompt(rawText: string, title: string): string {
  return (
    'Ordinance title: ' +
    title +
    '\n\nTranscribed ordinance text:\n\n' +
    rawText.slice(0, MAX_RAW_TEXT_CHARS) +
    '\n\nReturn ONLY the JSON array described in the system instructions — no prose, no markdown fences.'
  );
}

/** Clamp any numeric-coercible value into [0, 1]; non-finite → 0. */
function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parses the LLM classification response into typed suggestions. Strips ```
 * fences, locates the first [ … ] JSON span, keeps only entries whose label is
 * in the D21 legal union, clamps confidence to [0,1], dedupes by label (first
 * wins), sorts by confidence descending, and caps at 5. NEVER throws: any
 * failure yields an empty array.
 */
export function parseClassificationResponse(
  llmText: string
): Array<{ label: string; confidence: number }> {
  try {
    if (typeof llmText !== 'string' || llmText.trim() === '') {
      return [];
    }

    const stripped = llmText
      .trim()
      .replace(/^```[a-zA-Z]*[\r\n]?/, '')
      .replace(/[\r\n]?```$/, '');

    const start = stripped.indexOf('[');
    const end = stripped.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      return [];
    }

    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();
    const suggestions: Array<{ label: string; confidence: number }> = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
      const candidate = entry as { label?: unknown; confidence?: unknown };
      if (typeof candidate.label !== 'string') continue;
      if (!LIKHA_CLASSIFICATION_LABELS.includes(candidate.label)) continue;
      if (seen.has(candidate.label)) continue; // dedupe — first occurrence wins
      seen.add(candidate.label);
      suggestions.push({ label: candidate.label, confidence: clampConfidence(candidate.confidence) });
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, MAX_CLASSIFY_SUGGESTIONS);
  } catch {
    return [];
  }
}
