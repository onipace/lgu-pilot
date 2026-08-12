// tests/unit/linaw-ocr.test.ts
// Sprint 5 (S5-C4) — N014 LINAW-owned OCR wrapper contract test (hermetic).
// The wrapper's fetcher is injectable; OpenRouter is mocked with ZERO
// network and ZERO real API key. Deterministic with or without a key on the
// machine (contract-only — decision D11 note). node:test + node:assert/strict,
// relative imports only (no @/ alias).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractText, OcrError, OcrTimeoutError } from '../../src/lib/linaw/ocr';

process.env.OPENROUTER_API_KEY = 'test-key';

const SUCCESS_BODY = { choices: [{ message: { content: 'ORDINANCE TEXT' } }] };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function recordingFetcher(responder: (callIndex: number) => Response | Promise<Response>) {
  const calls: CapturedCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    return responder(calls.length - 1);
  }) as typeof fetch;
  return { calls, fetcher };
}

test('linaw OCR wrapper suite', async (t) => {
  await t.test('model selection, URL, temperature, auth header, media parts', async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse(200, SUCCESS_BODY));

    // PDF → gemini, `file`/`file_data` data-URI media part.
    const pdfRes = await extractText({
      fileBuffer: Buffer.from('%PDF-fake'),
      mimeType: 'application/pdf',
      filename: 'ord-01.pdf',
      fetcher,
    });
    assert.equal(pdfRes.text, 'ORDINANCE TEXT');
    assert.equal(pdfRes.model, 'google/gemini-2.5-flash');
    assert.equal(pdfRes.attempts, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');

    const pdfBody = JSON.parse(String(calls[0].init.body));
    assert.equal(pdfBody.model, 'google/gemini-2.5-flash');
    assert.equal(pdfBody.temperature, 0);
    assert.equal(pdfBody.max_tokens, 8192);

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer test-key');
    assert.equal(headers['Content-Type'], 'application/json');

    const pdfUserContent = pdfBody.messages[1].content;
    assert.equal(pdfUserContent[0].type, 'file');
    assert.equal(pdfUserContent[0].file.filename, 'ord-01.pdf');
    assert.ok(
      String(pdfUserContent[0].file.file_data).startsWith(
        'data:application/pdf;base64,'
      )
    );

    // Images → qwen, `image_url` media part.
    const imgRes = await extractText({
      fileBuffer: Buffer.from('PNG-fake'),
      mimeType: 'image/png',
      fetcher,
    });
    assert.equal(imgRes.model, 'qwen/qwen3.7-plus');
    assert.equal(calls.length, 2);
    const imgBody = JSON.parse(String(calls[1].init.body));
    assert.equal(imgBody.model, 'qwen/qwen3.7-plus');
    assert.equal(imgBody.temperature, 0);
    const imgUserContent = imgBody.messages[1].content;
    assert.equal(imgUserContent[0].type, 'image_url');
    assert.ok(String(imgUserContent[0].image_url.url).startsWith('data:image/png;base64,'));
  });

  await t.test('4xx fails fast — OcrError with status, exactly ONE fetch', async () => {
    const { calls, fetcher } = recordingFetcher(() =>
      jsonResponse(401, { error: 'unauthorized' })
    );
    await assert.rejects(
      () => extractText({ fileBuffer: Buffer.from('x'), mimeType: 'image/png', fetcher }),
      (err: unknown) => {
        assert.ok(err instanceof OcrError);
        assert.equal(err.status, 401);
        assert.match(err.message, /HTTP 401/);
        return true;
      }
    );
    assert.equal(calls.length, 1);
  });

  await t.test('500 then success → retries once, attempts === 2', async () => {
    const { calls, fetcher } = recordingFetcher((i) =>
      i === 0 ? jsonResponse(500, {}) : jsonResponse(200, SUCCESS_BODY)
    );
    const res = await extractText({
      fileBuffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
      fetcher,
    });
    assert.equal(res.text, 'ORDINANCE TEXT');
    assert.equal(res.attempts, 2);
    assert.equal(calls.length, 2);
  });

  await t.test('500 twice → OcrError with status 500, exactly 2 calls', async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse(500, {}));
    await assert.rejects(
      () => extractText({ fileBuffer: Buffer.from('x'), mimeType: 'image/png', fetcher }),
      (err: unknown) => {
        assert.ok(err instanceof OcrError);
        assert.equal(err.status, 500);
        return true;
      }
    );
    assert.equal(calls.length, 2);
  });

  await t.test('timeout-like rejection twice → OcrTimeoutError, exactly 2 calls', async () => {
    const { calls, fetcher } = recordingFetcher(() => {
      const abort = new Error('The operation was aborted');
      abort.name = 'AbortError';
      return Promise.reject(abort);
    });
    await assert.rejects(
      () => extractText({ fileBuffer: Buffer.from('x'), mimeType: 'image/png', fetcher }),
      (err: unknown) => {
        assert.ok(err instanceof OcrTimeoutError);
        assert.ok(err instanceof OcrError);
        return true;
      }
    );
    assert.equal(calls.length, 2);
  });

  await t.test('network error then success → attempts === 2', async () => {
    const { calls, fetcher } = recordingFetcher((i) => {
      if (i === 0) return Promise.reject(new TypeError('fetch failed'));
      return jsonResponse(200, SUCCESS_BODY);
    });
    const res = await extractText({
      fileBuffer: Buffer.from('x'),
      mimeType: 'application/pdf',
      fetcher,
    });
    assert.equal(res.text, 'ORDINANCE TEXT');
    assert.equal(res.attempts, 2);
    assert.equal(calls.length, 2);
  });

  await t.test('empty content → OcrError, NOT retried (one call)', async () => {
    const { calls, fetcher } = recordingFetcher(() =>
      jsonResponse(200, { choices: [{ message: { content: '' } }] })
    );
    await assert.rejects(
      () => extractText({ fileBuffer: Buffer.from('x'), mimeType: 'image/png', fetcher }),
      (err: unknown) => {
        assert.ok(err instanceof OcrError);
        assert.equal(err.message, 'OCR returned empty text');
        return true;
      }
    );
    assert.equal(calls.length, 1);
  });

  await t.test('missing API key → OcrError before any fetch', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const { calls, fetcher } = recordingFetcher(() => jsonResponse(200, SUCCESS_BODY));
      await assert.rejects(
        () => extractText({ fileBuffer: Buffer.from('x'), mimeType: 'image/png', fetcher }),
        (err: unknown) => {
          assert.ok(err instanceof OcrError);
          assert.match(err.message, /OPENROUTER_API_KEY is not configured/);
          return true;
        }
      );
      assert.equal(calls.length, 0);
    } finally {
      process.env.OPENROUTER_API_KEY = saved;
    }
  });
});
