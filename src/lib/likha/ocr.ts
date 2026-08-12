// src/lib/likha/ocr.ts
// Sprint 2 (S2-C6) — L002 module-owned OCR wrapper (decision D2).
// Calls OpenRouter DIRECTLY via global fetch: the shared llm.ts primitives
// are text-only / single-model / no-timeout and cannot satisfy L002's
// multimodal contract. Same OPENROUTER_API_KEY env var as llm.ts.
//
// Models (see PDF_MODEL / IMAGE_MODEL below): Gemini 2.5 Flash for PDFs,
// Qwen 3.7 Plus for JPEG/PNG scans.
// temperature 0, max_tokens 8192, 60s timeout per attempt, at most 2 attempts
// (retry ONLY on timeout/abort, network failure, or HTTP >= 500).
// Dependency-free: Node built-ins + global fetch only. Zero console logging,
// zero DB access, zero sibling-module code.

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PDF_MODEL = 'google/gemini-2.5-flash';
const IMAGE_MODEL = 'qwen/qwen3.7-plus';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;
const MAX_TOKENS = 8192;

const SYSTEM_PROMPT =
  'You are a precise document transcription engine for Philippine LGU legislative records. ' +
  'Transcribe the provided document verbatim. Output plain text only — no commentary, no markdown fences.';

const USER_TEXT_PART = {
  type: 'text',
  text: 'Transcribe this scanned ordinance document completely and verbatim.',
} as const;

export type LikhaOcrMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export class OcrError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

export class OcrTimeoutError extends OcrError {
  constructor(message = 'OCR timed out after retry') {
    super(message);
    this.name = 'OcrTimeoutError';
  }
}

export interface OcrOptions {
  fileBuffer: Buffer;
  mimeType: LikhaOcrMimeType;
  filename?: string;
  timeoutMs?: number; // default 60_000
  fetcher?: typeof fetch; // DI for tests; default global fetch
}

export interface OcrResult {
  text: string;
  model: string;
  attempts: number;
}

interface OpenRouterCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

function isTimeoutLike(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  return /abort|timeout/i.test(err.message);
}

function buildRequestBody(options: OcrOptions, model: string) {
  const dataUri =
    'data:' + options.mimeType + ';base64,' + options.fileBuffer.toString('base64');

  const mediaPart =
    options.mimeType === 'application/pdf'
      ? {
          type: 'file',
          file: {
            filename: options.filename || 'upload',
            file_data: dataUri,
          },
        }
      : {
          type: 'image_url',
          image_url: { url: dataUri },
        };

  return {
    model,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [mediaPart, USER_TEXT_PART] },
    ],
  };
}

export async function extractText(options: OcrOptions): Promise<OcrResult> {
  // Read the key lazily per call (same env var llm.ts uses).
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OcrError('OPENROUTER_API_KEY is not configured');
  }

  const model = options.mimeType === 'application/pdf' ? PDF_MODEL : IMAGE_MODEL;
  const requestBody = buildRequestBody(options, model);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: unknown = null;
  let lastWasTimeout = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // Fresh timeout signal per attempt.
    const signal = AbortSignal.timeout(timeoutMs);

    try {
      const response = await fetcher(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const httpError = new OcrError(
          `OCR request failed with HTTP ${response.status}`,
          response.status
        );
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          lastError = httpError;
          lastWasTimeout = false;
          continue; // retry server errors once
        }
        throw httpError; // 4xx (or final 5xx) — not retryable
      }

      const json = (await response.json()) as OpenRouterCompletion;
      const text = json.choices?.[0]?.message?.content ?? '';
      if (text === '') {
        throw new OcrError('OCR returned empty text');
      }
      return { text, model, attempts: attempt };
    } catch (err) {
      // Non-retryable failures surface immediately.
      if (err instanceof OcrError) {
        const status = err.status;
        const retryableHttp = status !== undefined && status >= 500;
        if (!retryableHttp) throw err; // 4xx, empty text, final-5xx already thrown above
      }

      lastError = err;
      lastWasTimeout = isTimeoutLike(err);
      if (attempt >= MAX_ATTEMPTS) break;
      // Retry: timeout/abort errors, network failures, HTTP >= 500.
    }
  }

  if (lastWasTimeout) {
    throw new OcrTimeoutError();
  }
  if (lastError instanceof OcrError) {
    throw lastError;
  }
  throw new OcrError(
    lastError instanceof Error ? lastError.message : 'OCR request failed'
  );
}
