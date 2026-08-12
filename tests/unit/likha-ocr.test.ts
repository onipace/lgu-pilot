// tests/unit/likha-ocr.test.ts
// Sprint 2 (S2-C6) — L002 module-owned OCR wrapper contract test.
// Hermetic: the wrapper's fetcher is injectable; OpenRouter is mocked with
// ZERO network and ZERO real API key. node:test + node:assert/strict,
// relative imports only (no @/ alias).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractText, OcrError, OcrTimeoutError } from '../../src/lib/likha/ocr';

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

function mockOkFetcher(calls: CapturedCall[], status = 200, body: unknown = SUCCESS_BODY) {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    return jsonResponse(status, body);
  }) as typeof fetch;
}

test('likha OCR wrapper suite', async (t) => {
  await t.test('model selection, temperature, auth header, media parts', async () => {
    const calls: CapturedCall[] = [];
    const fetcher = mockOkFetcher(calls);

    const pdfBuffer = Buffer.from('%PDF-fake');
    const pdfRes = await extractText({
      fileBuffer: pdfBuffer,
      mimeType: 'application/pdf',
      fetcher,
    });
    assert.equal(pdfRes.text, 'ORDINANCE TEXT');
    assert.equal(pdfRes.model, 'google/gemini-2.5-flash');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');

    const pdfBody = JSON.parse(String(calls[0].init.body));
    assert.equal(pdfBody.model, 'google/gemini-2.5-flash');
    assert.equal(pdfBody.temperature, 0);

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer test-key');

    const pdfUserContent = pdfBody.messages[1].content;
    assert.deepEqual(pdfUserContent[0], {
      type: 'file',
      file: {
        filename: 'upload',
        file_data: 'data:application/pdf;base64,' + pdfBuffer.toString('base64'),
      },
    });
    assert.equal(pdfUserContent[1].type, 'text');

    const pngBuffer = Buffer.from('png-bytes');
    const pngRes = await extractText({
      fileBuffer: pngBuffer,
      mimeType: 'image/png',
      fetcher,
    });
    assert.equal(pngRes.model, 'qwen/qwen3.7-plus');
    const pngBody = JSON.parse(String(calls[1].init.body));
    assert.equal(pngBody.model, 'qwen/qwen3.7-plus');
    assert.equal(pngBody.temperature, 0);
    const pngHeaders = calls[1].init.headers as Record<string, string>;
    assert.equal(pngHeaders.Authorization, 'Bearer test-key');
    assert.deepEqual(pngBody.messages[1].content[0], {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + pngBuffer.toString('base64') },
    });
  });

  await t.test('timeout is applied via AbortSignal and throws OcrTimeoutError', async () => {
    let signalSeen: AbortSignal | null = null;
    const hangingFetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
      signalSeen = init?.signal ?? null;
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return; // never settles — only abort ends it
        const onAbort = () => reject(signal.reason ?? new Error('aborted'));
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort);
      });
    }) as typeof fetch;

    const started = Date.now();
    await assert.rejects(
      () =>
        extractText({
          fileBuffer: Buffer.from('x'),
          mimeType: 'image/png',
          timeoutMs: 50,
          fetcher: hangingFetcher,
        }),
      (err: unknown) => err instanceof OcrTimeoutError
    );
    assert.ok(Date.now() - started < 500, 'rejects within ~500ms');
    assert.ok(signalSeen, 'AbortSignal was passed in the fetch init');
  });

  await t.test('one retry on timeout then success (attempts === 2)', async () => {
    let calls = 0;
    const fetcher = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return jsonResponse(200, SUCCESS_BODY);
    }) as typeof fetch;

    const res = await extractText({
      fileBuffer: Buffer.from('%PDF-fake'),
      mimeType: 'application/pdf',
      fetcher,
    });
    assert.equal(res.attempts, 2);
    assert.equal(res.text, 'ORDINANCE TEXT');
    assert.equal(calls, 2);
  });

  await t.test('gives up after one retry (2 attempts) with OcrTimeoutError', async () => {
    let calls = 0;
    const fetcher = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
      calls += 1;
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }) as typeof fetch;

    await assert.rejects(
      () =>
        extractText({
          fileBuffer: Buffer.from('x'),
          mimeType: 'image/jpeg',
          fetcher,
        }),
      (err: unknown) => err instanceof OcrTimeoutError
    );
    assert.equal(calls, 2);
  });

  await t.test('retries HTTP 5xx once, never retries 4xx', async () => {
    // 502 → 200: succeeds on the second attempt.
    let calls502 = 0;
    const fetcher502 = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
      calls502 += 1;
      if (calls502 === 1) return jsonResponse(502, { error: 'bad gateway' });
      return jsonResponse(200, SUCCESS_BODY);
    }) as typeof fetch;

    const res = await extractText({
      fileBuffer: Buffer.from('x'),
      mimeType: 'image/png',
      fetcher: fetcher502,
    });
    assert.equal(res.attempts, 2);
    assert.equal(res.text, 'ORDINANCE TEXT');

    // 401 → OcrError immediately, exactly 1 attempt.
    let calls401 = 0;
    const fetcher401 = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
      calls401 += 1;
      return jsonResponse(401, { error: 'unauthorized' });
    }) as typeof fetch;

    await assert.rejects(
      () =>
        extractText({
          fileBuffer: Buffer.from('x'),
          mimeType: 'image/png',
          fetcher: fetcher401,
        }),
      (err: unknown) => err instanceof OcrError && !(err instanceof OcrTimeoutError)
    );
    assert.equal(calls401, 1);
  });

  await t.test('missing OPENROUTER_API_KEY throws OcrError before any fetch', async () => {
    const prev = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      let fetchCalled = false;
      const fetcher = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
        fetchCalled = true;
        return jsonResponse(200, SUCCESS_BODY);
      }) as typeof fetch;

      await assert.rejects(
        () =>
          extractText({
            fileBuffer: Buffer.from('x'),
            mimeType: 'image/png',
            fetcher,
          }),
        (err: unknown) =>
          err instanceof OcrError && /OPENROUTER_API_KEY/.test(err.message)
      );
      assert.equal(fetchCalled, false);
    } finally {
      if (prev !== undefined) process.env.OPENROUTER_API_KEY = prev;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });
});
