// tests/integration/linaw-summaries.test.ts
// Sprint 7 (S7-C8) — N007 summarize POST + PUT API-level suite. Runs against
// the live dev server. Keyless-tolerant per decision D12: WITHOUT an
// OpenRouter key the batch still returns 200 with summarized: 0 + failed
// entries (never 500s); WITH a key the suite tolerates generation but always
// asserts the contract shape. Human edits round-trip over PUT.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
} from '../helpers/linaw-test-util';

async function api(urlPath: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(BASE_URL + urlPath, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** True when the dev server has a usable OpenRouter key (.env files or env). */
function devServerHasLlmKey(): boolean {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const match = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/m);
      if (match) {
        const value = match[1].trim().replace(/^["']|["']$/g, '');
        if (value.length > 0 && value !== 'your-api-key-here') return true;
      }
    } catch {
      // absent file — try next
    }
  }
  const envValue = process.env.OPENROUTER_API_KEY;
  return !!envValue && envValue !== 'your-api-key-here';
}

test('linaw summaries suite', async (t) => {
  await assertServerReachable();

  // The Sprint-7 additive `rejected` column lands lazily via initSchema — run
  // the real migration on the shared dev DB before seeding.
  const { getDb } = await import('../../src/lib/db');
  getDb();

  const { userId, cookie, cleanup } = seedApprovedUser();
  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };
  const hasKey = devServerHasLlmKey();

  const base = 920_000 + crypto.randomInt(0, 20_000);
  const seededIds: string[] = [];

  // Ready WITHOUT a summary.
  const bareId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: base + 1,
    seriesYear: 2019,
    title: 'An ordinance on solid waste collection',
  });
  seededIds.push(bareId);

  // Ready WITH a pre-set summary (skipped by the implicit batch).
  const summarizedId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: base + 2,
    seriesYear: 2019,
    title: 'An ordinance on barangay curfew rules',
    summary: 'A human-authored summary already on file for the curfew ordinance.',
  });
  seededIds.push(summarizedId);

  // pending_review row — never summarized, never editable.
  const pendingId = seedLinawPendingReviewRecord(db, userId, {
    ordinanceNumber: base + 3,
    seriesYear: 2019,
    libraryStatus: 'pending_review',
  });
  seededIds.push(pendingId);

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        db.prepare('DELETE FROM linaw_ordinances WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('linaw-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('linaw-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('auth: both routes require a session (401 envelope)', async () => {
    const post = await api('/api/linaw/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(post.status, 401);
    assert.equal(post.body?.code, 'NO_SESSION');

    const put = await api(`/api/linaw/summarize/${bareId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Anything.' }),
    });
    assert.equal(put.status, 401);
    assert.equal(put.body?.code, 'NO_SESSION');
  });

  await t.test('POST {} → 200 with contract shape; graceful keyless degradation', async () => {
    const res = await api('/api/linaw/summarize', {
      method: 'POST',
      headers: authed.headers,
      body: '{}',
    });
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.pipelineId === 'string');
    assert.equal(typeof res.body.summarized, 'number');
    assert.ok(Array.isArray(res.body.skipped));
    assert.ok(Array.isArray(res.body.results));
    assert.ok(Array.isArray(res.body.failed));

    // The pre-summarized row is ALWAYS skipped as has_summary.
    const skippedSummarized = res.body.skipped.find((s: any) => s.recordId === summarizedId);
    assert.ok(skippedSummarized, 'has_summary skip reported');
    assert.equal(skippedSummarized.reason, 'has_summary');

    // The pending_review row never appears in results (ready-only — rule 4).
    assert.ok(!res.body.results.some((r: any) => r.recordId === pendingId));
    // The pre-summarized row is never re-generated by the implicit batch.
    assert.ok(!res.body.results.some((r: any) => r.recordId === summarizedId));

    if (!hasKey) {
      assert.equal(res.body.summarized, 0, 'keyless: nothing summarized');
      assert.ok(
        res.body.failed.length + res.body.skipped.length >= 1,
        'keyless: failures/skips reported, never a 500'
      );
      assert.ok(
        res.body.failed.some((f: any) => f.recordId === bareId),
        'keyless: the bare ready row lands in failed[]'
      );
    }
  });

  await t.test('POST with unknown explicit id → 200 + skipped not_found', async () => {
    const res = await api('/api/linaw/summarize', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [crypto.randomUUID()] }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.summarized, 0);
    assert.ok(res.body.skipped.some((s: any) => s.reason === 'not_found'));
  });

  await t.test('POST invalid ordinanceIds type → 400 INVALID_BODY', async () => {
    const res = await api('/api/linaw/summarize', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: 'not-an-array' }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body?.code, 'INVALID_BODY');
  });

  await t.test('PUT edit round-trip: human summary persisted', async () => {
    const summary = 'Plain-language summary written by a human.';
    const res = await api(`/api/linaw/summarize/${bareId}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ summary }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.recordId, bareId);
    assert.equal(res.body.summary, summary);
    assert.equal(res.body.editedById, userId);

    const row = db.prepare(`SELECT summary FROM linaw_ordinances WHERE id = ?`).get(bareId) as {
      summary: string | null;
    };
    assert.equal(row.summary, summary);
  });

  await t.test('PUT empty summary → 400; unknown id → 404; pending row → 409', async () => {
    const empty = await api(`/api/linaw/summarize/${bareId}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ summary: '   ' }),
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body?.code, 'VALIDATION');

    const missing = await api(`/api/linaw/summarize/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ summary: 'Anything.' }),
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body?.code, 'NOT_FOUND');

    const conflict = await api(`/api/linaw/summarize/${pendingId}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ summary: 'Anything.' }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body?.code, 'CONFLICT');
  });
});
