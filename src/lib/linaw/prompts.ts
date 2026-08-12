// src/lib/linaw/prompts.ts
// Sprint 5 (S5-C6) — LINAW's OWN metadata-extraction prompt + never-throws
// response parser (duplicates the proven sibling-module pattern with separate
// wording; decision D3). Uses the shared text completion primitive only.

/**
 * Strict-JSON extraction prompt for Philippine LGU ordinances. The model must
 * return ONLY the metadata object — no prose, no markdown fences.
 */
export const LINAW_METADATA_SYSTEM_PROMPT: string = [
  'You extract structured metadata from transcribed Philippine local government ordinances.',
  'Respond with ONLY a single JSON object, no prose and no markdown fences, shaped exactly as:',
  '{"ordinanceNumber": number, "seriesYear": number, "title": string, "confidence": {"ordinanceNumber": number, "seriesYear": number, "title": number}}.',
  'ordinanceNumber is the numeric part of "Ordinance No. X" (integer, no leading zeros).',
  'seriesYear is the four-digit year from "Series of YYYY".',
  'title is the full enactment clause beginning "An ordinance ..." exactly as written.',
  'Each confidence value is your 0-1 self-estimate for that field; use 0 when the field is not found.',
].join(' ');

/** Builds the user prompt, truncating the transcription to 12,000 characters. */
export function buildLinawMetadataUserPrompt(rawText: string): string {
  const truncated = rawText.slice(0, 12_000);
  return (
    'Extract the metadata JSON object from this ordinance transcription.\n\n' +
    truncated +
    '\n\nReturn ONLY the JSON object.'
  );
}

export interface ParsedLinawMetadata {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  confidence: { ordinanceNumber: number; seriesYear: number; title: number };
}

const ZERO_METADATA: ParsedLinawMetadata = {
  ordinanceNumber: 0,
  seriesYear: 0,
  title: '',
  confidence: { ordinanceNumber: 0, seriesYear: 0, title: 0 },
};

function toNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const truncated = Math.trunc(n);
  return truncated > 0 ? truncated : 0;
}

function toConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parses the LLM metadata response. NEVER throws: strips ``` fences, locates
 * the first {…} span, coerces integers, clamps confidences to [0,1]; any
 * failure yields all-zero defaults.
 */
export function parseLinawMetadataResponse(llmText: string): ParsedLinawMetadata {
  try {
    if (typeof llmText !== 'string') return { ...ZERO_METADATA, confidence: { ...ZERO_METADATA.confidence } };

    let text = llmText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return { ...ZERO_METADATA, confidence: { ...ZERO_METADATA.confidence } };
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...ZERO_METADATA, confidence: { ...ZERO_METADATA.confidence } };
    }

    const conf = (parsed.confidence ?? {}) as Record<string, unknown>;
    return {
      ordinanceNumber: toNonNegativeInt(parsed.ordinanceNumber),
      seriesYear: toNonNegativeInt(parsed.seriesYear),
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      confidence: {
        ordinanceNumber: toConfidence(conf.ordinanceNumber),
        seriesYear: toConfidence(conf.seriesYear),
        title: toConfidence(conf.title),
      },
    };
  } catch {
    return { ...ZERO_METADATA, confidence: { ...ZERO_METADATA.confidence } };
  }
}

// ── Sprint 6 (S6-C6): N002 Code classification prompts ─────────────────────

/**
 * The municipal Code taxonomy priors shown to the model — 13 Code Titles with
 * their 1-based numbers (PRP-LINAW data rules; the Code Classifier uses the
 * library's OWN subject metadata as priors alongside this list).
 */
export const LINAW_CODE_TITLES: string[] = [
  '1 General Provisions',
  '2 Administration',
  '3 Taxation and Revenue',
  '4 Business Permits and Licensing',
  '5 Public Health and Sanitation',
  '6 Public Works and Infrastructure',
  '7 Education and Culture',
  '8 Social Welfare and Development',
  '9 Agriculture and Environment',
  '10 Public Order and Safety',
  '11 Personnel and Civil Service',
  '12 Finance and Budget',
  '13 Miscellaneous and Transitory',
];

/**
 * Strict-JSON classification prompt. The model must return ONLY one placement
 * object — no prose, no markdown fences.
 */
export const LINAW_CLASSIFY_SYSTEM_PROMPT: string = [
  'You classify one Philippine local government ordinance into the municipal Code of Ordinances.',
  'Respond with ONLY one JSON object, no prose and no markdown fences, shaped exactly as:',
  '{"titleNumber": number, "chapterNumber": number, "articleNumber": number | null, "confidence": number}.',
  'titleNumber is an integer 1-13 chosen from the provided Code Title list.',
  'chapterNumber is a positive integer naming the Chapter within that Title where the ordinance belongs.',
  'articleNumber is a positive integer ONLY when the ordinance text explicitly organizes articles; otherwise null.',
  'confidence is your 0-1 self-estimate for the placement.',
].join(' ');

/**
 * Builds the classification user prompt: the numbered Code Title list, the
 * library's OWN subject-tag frequency table (data-rule priors), the record's
 * metadata + subject tags, and its content truncated to 12,000 characters.
 */
export function buildLinawClassifyUserPrompt(
  input: {
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    content: string;
    subjectTags: string[];
  },
  priors: { subjectFrequencies: Array<{ subject: string; count: number }> }
): string {
  const titleList = LINAW_CODE_TITLES.map((entry) => '  ' + entry).join('\n');
  const frequencyTable =
    priors.subjectFrequencies.length > 0
      ? priors.subjectFrequencies
          .map((row) => `  ${row.subject}: ${row.count}`)
          .join('\n')
      : '  (no subject metadata recorded yet)';

  return [
    'Place this ordinance into the municipal Code of Ordinances.',
    '',
    'Code Titles:',
    titleList,
    '',
    'Library subject-tag frequencies (this library’s own prior):',
    frequencyTable,
    '',
    `Ordinance No. ${input.ordinanceNumber}, Series of ${input.seriesYear}`,
    `Title: ${input.title}`,
    `Subject tags: ${input.subjectTags.length > 0 ? input.subjectTags.join(', ') : '(none)'}`,
    '',
    'Content:',
    input.content.slice(0, 12_000),
    '',
    'Return ONLY the JSON object.',
  ].join('\n');
}

export interface ParsedLinawPlacement {
  titleNumber: number;
  chapterNumber: number;
  articleNumber?: number;
  confidence: number;
}

const ZERO_PLACEMENT: ParsedLinawPlacement = { titleNumber: 0, chapterNumber: 0, confidence: 0 };

function toPositiveInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const truncated = Math.trunc(n);
  return truncated > 0 ? truncated : 0;
}

function toUnitInterval(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Parses the LLM classification response. NEVER throws: strips ``` fences,
 * locates the first {…} span, coerces titleNumber/chapterNumber to positive
 * integers (else 0), articleNumber positive integer or undefined, clamps
 * confidence to [0,1]; any failure yields all-zero defaults (zeros = invalid
 * placement downstream).
 */
export function parseLinawClassifyResponse(llmText: string): ParsedLinawPlacement {
  try {
    if (typeof llmText !== 'string') return { ...ZERO_PLACEMENT };

    let text = llmText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return { ...ZERO_PLACEMENT };

    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...ZERO_PLACEMENT };
    }

    const titleNumber = toPositiveInt(parsed.titleNumber);
    const chapterNumber = toPositiveInt(parsed.chapterNumber);
    const articleNumber = toPositiveInt(parsed.articleNumber);
    const placement: ParsedLinawPlacement = {
      titleNumber,
      chapterNumber,
      confidence: toUnitInterval(parsed.confidence),
    };
    if (articleNumber > 0) placement.articleNumber = articleNumber;
    return placement;
  } catch {
    return { ...ZERO_PLACEMENT };
  }
}

// ── Sprint 6 (S6-C8): N003 cross-reference refinement prompts ──────────────

const LINAW_RELATIONSHIP_TYPES = [
  'amends',
  'repeals',
  'partial_repeal',
  'supersedes',
  'extends',
  'implements',
] as const;

/**
 * Refinement prompt: given regex-extracted candidate cross-references, the
 * model may adjust type/confidence. Respond with ONLY a JSON array — omitting
 * an entry keeps that candidate's baseline verdict.
 */
export const LINAW_CROSSREF_SYSTEM_PROMPT: string = [
  'You refine candidate cross-references between Philippine local government ordinances.',
  'Respond with ONLY a JSON array, no prose and no markdown fences, of objects shaped exactly as:',
  '{"refIndex": number, "type": string, "confidence": number}.',
  'type must be one of: amends, repeals, partial_repeal, supersedes, extends, implements.',
  'confidence is your 0-1 self-estimate for that reference.',
  'Omit any candidate whose baseline verdict you keep unchanged.',
].join(' ');

/** Builds the refinement user prompt (content truncated to 12,000 chars). */
export function buildLinawCrossRefUserPrompt(
  content: string,
  candidates: Array<{ index: number; quote: string; type: string; number: number; year: number }>
): string {
  const list = candidates
    .map(
      (c) =>
        `  [${c.index}] "${c.quote}" — baseline type ${c.type}, references Ordinance No. ${c.number}` +
        (c.year > 0 ? `, S. ${c.year}` : ' (no series year)')
    )
    .join('\n');
  return [
    'Refine these candidate cross-references found in the ordinance text.',
    '',
    'Candidates:',
    list,
    '',
    'Ordinance text:',
    content.slice(0, 12_000),
    '',
    'Return ONLY the JSON array.',
  ].join('\n');
}

export interface ParsedLinawCrossRefEntry {
  refIndex: number;
  type?: (typeof LINAW_RELATIONSHIP_TYPES)[number];
  confidence?: number;
}

/**
 * Parses the refinement response. NEVER throws: non-array/malformed → [];
 * refIndex coerced to integer >= 0; type accepted only when it is one of the
 * six relationship values; confidence clamped to [0,1].
 */
export function parseLinawCrossRefResponse(llmText: string): ParsedLinawCrossRefEntry[] {
  try {
    if (typeof llmText !== 'string') return [];

    let text = llmText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return [];

    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];

    const entries: ParsedLinawCrossRefEntry[] = [];
    for (const raw of parsed) {
      if (typeof raw !== 'object' || raw === null) continue;
      const item = raw as Record<string, unknown>;
      const indexNum = typeof item.refIndex === 'number' ? item.refIndex : Number(item.refIndex);
      if (!Number.isFinite(indexNum)) continue;
      const refIndex = Math.trunc(indexNum);
      if (refIndex < 0) continue;

      const entry: ParsedLinawCrossRefEntry = { refIndex };
      if (
        typeof item.type === 'string' &&
        (LINAW_RELATIONSHIP_TYPES as readonly string[]).includes(item.type)
      ) {
        entry.type = item.type as ParsedLinawCrossRefEntry['type'];
      }
      const conf = typeof item.confidence === 'number' ? item.confidence : Number(item.confidence);
      if (Number.isFinite(conf)) entry.confidence = Math.min(1, Math.max(0, conf));
      entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

// ── Sprint 6 (S6-C9): N004 conflict detection prompts ──────────────────────

/**
 * Conflict-judgement prompt: compare two ordinances on the SAME subject and
 * decide whether their provisions contradict. Respond with ONLY one JSON
 * object; excerpts are verbatim passages from each text (empty arrays when
 * there is no conflict).
 */
export const LINAW_CONFLICT_SYSTEM_PROMPT: string = [
  'You compare two Philippine local government ordinances on the same subject.',
  'Respond with ONLY one JSON object, no prose and no markdown fences, shaped exactly as:',
  '{"conflict": boolean, "reason": string, "confidence": number, "excerptsA": string[], "excerptsB": string[]}.',
  'conflict is true ONLY when the two texts contain genuinely contradictory provisions.',
  'reason cites the contradictory provisions in one or two sentences.',
  'excerptsA and excerptsB are verbatim passages quoted from each text (empty arrays when no conflict).',
  'confidence is your 0-1 self-estimate for the verdict.',
].join(' ');

/** Builds the conflict user prompt (each content truncated to 8,000 chars). */
export function buildLinawConflictUserPrompt(
  a: { ordinanceNumber: number; seriesYear: number; title: string; content: string },
  b: { ordinanceNumber: number; seriesYear: number; title: string; content: string },
  sharedSubjects: string[]
): string {
  const describe = (label: string, o: typeof a) =>
    [
      `${label} — Ordinance No. ${o.ordinanceNumber}, Series of ${o.seriesYear}`,
      `Title: ${o.title}`,
      'Text:',
      o.content.slice(0, 8_000),
    ].join('\n');

  return [
    'Decide whether these two ordinances on the same subject conflict.',
    `Shared subjects: ${sharedSubjects.length > 0 ? sharedSubjects.join(', ') : '(none recorded)'}`,
    '',
    describe('Ordinance A', a),
    '',
    describe('Ordinance B', b),
    '',
    'Return ONLY the JSON object.',
  ].join('\n');
}

export interface ParsedLinawConflictVerdict {
  conflict: boolean;
  reason: string;
  confidence: number;
  excerptsA: string[];
  excerptsB: string[];
}

const ZERO_CONFLICT_VERDICT: ParsedLinawConflictVerdict = {
  conflict: false,
  reason: '',
  confidence: 0,
  excerptsA: [],
  excerptsB: [],
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : String(item)))
    .filter((item) => item.trim().length > 0);
}

/**
 * Parses the conflict verdict. NEVER throws: any failure → the zero verdict;
 * confidence clamped to [0,1]; excerpts coerced to non-empty strings.
 */
export function parseLinawConflictResponse(llmText: string): ParsedLinawConflictVerdict {
  try {
    if (typeof llmText !== 'string') return { ...ZERO_CONFLICT_VERDICT, excerptsA: [], excerptsB: [] };

    let text = llmText.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return { ...ZERO_CONFLICT_VERDICT, excerptsA: [], excerptsB: [] };
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...ZERO_CONFLICT_VERDICT, excerptsA: [], excerptsB: [] };
    }

    const confRaw = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
    return {
      conflict: parsed.conflict === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      confidence: Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0,
      excerptsA: toStringArray(parsed.excerptsA),
      excerptsB: toStringArray(parsed.excerptsB),
    };
  } catch {
    return { ...ZERO_CONFLICT_VERDICT, excerptsA: [], excerptsB: [] };
  }
}

// ── Sprint 7 (S7-C6): N007 plain-language summary prompts ──────────────────

/**
 * Plain-text summary prompt (summaries are NOT JSON — the parser contract
 * differs from the JSON parsers above). The model must answer with the
 * summary text only.
 */
export const LINAW_SUMMARY_SYSTEM_PROMPT: string = [
  'You summarize Philippine local government ordinances in plain language for non-lawyers.',
  'Write exactly 2-3 sentences capturing what the ordinance does, whom it affects, and any key rule or penalty.',
  'Respond with the summary text ONLY — no preamble, no labels, no markdown, no quotation marks around the whole text.',
].join(' ');

/** Builds the summary user prompt (content truncated to 12,000 chars). */
export function buildLinawSummaryUserPrompt(input: {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  content: string;
}): string {
  const content = typeof input.content === 'string' ? input.content : '';
  return (
    'Summarize this ordinance in plain language.\n\n' +
    `Ordinance No. ${input.ordinanceNumber}, Series of ${input.seriesYear}\n` +
    `Title: ${input.title}\n\n` +
    'Text:\n' +
    content.slice(0, 12_000)
  );
}

const SUMMARY_MAX_LENGTH = 600;

/**
 * Parses the LLM summary response. NEVER throws: strips ``` fences, drops
 * common leading labels ('Summary:', 'Plain-language summary:' etc. — any
 * leading token sequence ending with ':'), trims surrounding quotes,
 * collapses internal whitespace runs to single spaces, caps at 600 chars
 * (never mid-word: cut at the last space before 600, trailing '…' added when
 * truncated), and returns '' for empty/whitespace-only results.
 */
export function parseLinawSummaryResponse(llmText: string): string {
  try {
    if (typeof llmText !== 'string') return '';

    let text = llmText.trim();
    if (text.length === 0) return '';

    const fenced = text.match(/```(?:[a-z-]*)?\s*([\s\S]*?)```/i);
    if (fenced) {
      text = fenced[1].trim();
    } else {
      // Unbalanced fence markers — drop any leading/trailing remnants.
      text = text.replace(/^```[a-z-]*\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    }

    // Drop ONE leading label such as 'Summary:' / 'Plain-language summary:'.
    const label = text.match(/^[A-Za-z][A-Za-z0-9 \-&]{0,60}:\s*/);
    if (label) text = text.slice(label[0].length).trim();

    // Trim one layer of surrounding quotes (ASCII or typographic pairs).
    if (text.length >= 2) {
      const first = text[0];
      const last = text[text.length - 1];
      if (
        (first === '"' && last === '"') ||
        (first === "'" && last === "'") ||
        (first === '\u201C' && last === '\u201D')
      ) {
        text = text.slice(1, -1).trim();
      }
    }

    // Collapse every internal whitespace run to a single space.
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length === 0) return '';

    if (text.length > SUMMARY_MAX_LENGTH) {
      const cutWindow = text.slice(0, SUMMARY_MAX_LENGTH);
      const lastSpace = cutWindow.lastIndexOf(' ');
      const cut = lastSpace > 0 ? cutWindow.slice(0, lastSpace + 1) : cutWindow;
      return cut + '\u2026';
    }

    return text;
  } catch {
    return '';
  }
}
