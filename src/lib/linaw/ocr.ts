// src/lib/linaw/ocr.ts
// Sprint 5 (S5-C4) — N014 LINAW-owned multimodal OCR wrapper (decision D2).
// Independent implementation for LINAW's scan digitization: direct OpenRouter
// fetch (the shared text-only chat primitive cannot carry media parts or a
// per-attempt timeout). ZERO imports from any other module — Node built-ins
// and the global fetch only. No DB access, no logging.
//
// Contract: gemini-2.5-flash for PDFs / qwen3.7-plus for images, temperature
// 0, max_tokens 8192, 60s per attempt, at most 2 attempts. Retry ONLY on
// timeout/abort, network failure, or HTTP >= 500. 4xx and empty text fail fast.

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PDF_MODEL = 'google/gemini-2.5-flash';
const IMAGE_MODEL = 'qwen/qwen3.7-plus';
export const DEFAULT_TIMEOUT_MS = 60_000;
export const MAX_ATTEMPTS = 2;
export const MAX_TOKENS = 8192;

export type LinawOcrMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

/** OCR failure with an optional HTTP status (4xx/5xx responses). */
export class OcrError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OcrError';
    this.status = status;
  }
}

/** Both attempts exhausted on timeout/abort-shaped failures. */
export class OcrTimeoutError extends OcrError {
  constructor(message = 'OCR timed out after retry') {
    super(message);
    this.name = 'OcrTimeoutError';
  }
}

export interface OcrOptions {
  fileBuffer: Buffer;
  mimeType: LinawOcrMimeType;
  filename?: string;
  timeoutMs?: number;
  /** Injectable for hermetic contract tests; defaults to the global fetch. */
  fetcher?: typeof fetch;
}

export interface OcrResult {
  text: string;
  model: string;
  attempts: number;
}

/** LINAW's own transcription system prompt (LGU legislative documents). */
const LINAW_OCR_SYSTEM_PROMPT = [
  'You transcribe scanned Philippine local government ordinance documents.',
  'Output ONLY the document text in reading order as plain text: preserve',
  'section numbers, ordinance number, series year, and enactment clause',
  'exactly as printed. No commentary, no markdown, no summarizing. If the',
  'image is unreadable, output an empty string.',
].join(' ');

function isTimeoutLike(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  return /abort|timeout/i.test(err.message);
}

function buildRequestBody(
  model: string,
  fileBuffer: Buffer,
  mimeType: LinawOcrMimeType,
  filename?: string
): Record<string, unknown> {
  const base64 = fileBuffer.toString('base64');
  const mediaPart =
    mimeType === 'application/pdf'
      ? {
          type: 'file',
          file: {
            filename: filename || 'scan.pdf',
            file_data: 'data:application/pdf;base64,' + base64,
          },
        }
      : {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,` + base64 },
        };

  return {
    model,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: LINAW_OCR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [mediaPart, { type: 'text', text: 'Transcribe this document.' }],
      },
    ],
  };
}

/**
 * Extracts text from one scan (PDF/JPEG/PNG) via OpenRouter. Retries at most
 * once, and only on timeout/abort, network failure, or HTTP >= 500.
 */
export async function extractText(options: OcrOptions): Promise<OcrResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OcrError('OPENROUTER_API_KEY is not configured');
  }

  const model = options.mimeType === 'application/pdf' ? PDF_MODEL : IMAGE_MODEL;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = JSON.stringify(
    buildRequestBody(model, options.fileBuffer, options.mimeType, options.filename)
  );

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const failure = new OcrError(
          `OCR request failed with HTTP ${response.status}`,
          response.status
        );
        // Server errors retry once; 4xx fail fast.
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          lastError = failure;
          continue;
        }
        throw failure;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const rawContent = data?.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string' ? rawContent : '';
      if (text === '') {
        throw new OcrError('OCR returned empty text'); // never retried
      }
      return { text, model, attempts: attempt };
    } catch (err) {
      lastError = err;
      const timeoutLike = isTimeoutLike(err);
      const retriable = timeoutLike || !(err instanceof OcrError);
      if (attempt < MAX_ATTEMPTS && retriable) {
        continue; // one retry on timeout/abort or network failure
      }
      if (timeoutLike) {
        throw new OcrTimeoutError();
      }
      if (err instanceof OcrError) {
        throw err;
      }
      throw new OcrError(
        err instanceof Error ? `OCR request failed: ${err.message}` : 'OCR request failed'
      );
    }
  }

  // Unreachable — the loop always returns or throws.
  throw lastError instanceof OcrError ? lastError : new OcrError('OCR request failed');
}
