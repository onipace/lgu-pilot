// tests/integration/linaw-classify-api.test.ts
// Sprint 6 (S6-C7) — N002 classify + override API-level tests.
// Runs against the live dev server exactly like the Sprint-4/5 API suites:
// helper seeds an approved user + session directly into data/workshop.db,
// test records go in via better-sqlite3 with DISTINCTIVE ordinance numbers,
// and every seeded row + audit/log row is cleaned up in t.after.
//
// Decision D12 posture — no real LLM calls are asserted in automated tests.
// Classification is LLM-primary: when the dev environment has NO usable
// OpenRouter key the server returns a structured 500 for the happy path; the
// test then records the fallback and still asserts the 401/400/404/409/
// override behaviors (pilot accuracy is SYSTEM_TEST scope).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { BASE_URL, assertServerReachable, seedApprovedUser } from '../helpers/linaw-test-util';

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

test('linaw classify api suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 950_000 + crypto.randomInt(0, 40_000);

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    libraryStatus: 'processing' | 'pending_review' | 'ready';
  }): string {
    const id = crypto.randomUUID();
    seededIds.push(id);
    db.prepare(
      `INSERT INTO linaw_ordinances
         (id, ordinance_number, series_year, title, content, subject_tags,
          source_type, source_filename, file_hash, library_status, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, '["Taxation & Revenue"]', 'import', NULL, NULL, ?, ?)`
    ).run(
      id,
      opts.ordinanceNumber,
      opts.seriesYear,
      'An ordinance regulating the municipal market fees',
      'Section 1. Title. Market fees are collected monthly.',
      opts.libraryStatus,
      userId
    );
    return id;
  }

  const readyId1 = seedRow({ ordinanceNumber: base + 1, seriesYear: 2021, libraryStatus: 'ready' });
  const readyId2 = seedRow({ ordinanceNumber: base + 2, seriesYear: 2022, libraryStatus: 'ready' });
  const pendingId = seedRow({ ordinanceNumber: base + 3, seriesYear: 2023, libraryStatus: 'pending_review' });
  const processingId = seedRow({ ordinanceNumber: base + 4, seriesYear: 2024, libraryStatus: 'processing' });

  // Pre-seeded AI codification row on readyId2 — the override round-trip must
  // PRESERVE this ai_suggestion history (decision D6).
  db.prepare(
    `INSERT INTO codification_records
       (id, ordinance_id, title_number, chapter_number, cod_status, ai_suggestion)
     VALUES (?, ?, 3, 1, 'classified', ?)`
  ).run(
    crypto.randomUUID(),
    readyId2,
    JSON.stringify({ titleNumber: 3, chapterNumber: 1, confidence: 0.9, suggestedAt: new Date().toISOString() })
  );

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        db.prepare('DELETE FROM codification_records WHERE ordinance_id = ?').run(id);
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
    const post = await api('/api/linaw/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordinanceIds: [readyId1] }),
    });
    assert.equal(post.status, 401);
    assert.equal(post.body?.error, 'Authentication required');
    assert.equal(post.body?.code, 'NO_SESSION');

    const put = await api('/api/linaw/classify/' + readyId1, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleNumber: 3, chapterNumber: 1, reason: 'x' }),
    });
    assert.equal(put.status, 401);
    assert.equal(put.body?.error, 'Authentication required');
    assert.equal(put.body?.code, 'NO_SESSION');
  });

  await t.test('body validation: 400 INVALID_BODY', async () => {
    for (const body of [{ ordinanceIds: 'x' }, { ordinanceIds: [1] }]) {
      const res = await api('/api/linaw/classify', {
        method: 'POST',
        headers: authed.headers,
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 400, `POST body ${JSON.stringify(body)} → 400`);
      assert.equal(res.body?.code, 'INVALID_BODY');
    }

    const badTitle = await api('/api/linaw/classify/' + readyId1, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ titleNumber: 'five', chapterNumber: 1, reason: 'x' }),
    });
    assert.equal(badTitle.status, 400);
    assert.equal(badTitle.body?.code, 'INVALID_BODY');

    const missingReason = await api('/api/linaw/classify/' + readyId1, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ titleNumber: 5, chapterNumber: 1 }),
    });
    assert.equal(missingReason.status, 400);
    assert.equal(missingReason.body?.code, 'INVALID_BODY');
  });

  await t.test('classify happy path (contract-level — decision D12)', async () => {
    const res = await api('/api/linaw/classify', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [readyId1, pendingId, processingId, 'missing-id'] }),
    });

    if (res.status === 500) {
      // D12 FALLBACK: no usable LLM key — classification is LLM-primary and
      // failed structurally WITHOUT crashing. Record + continue; the
      // 401/400/404/409/override assertions still hold.
      assert.ok(res.body?.error, 'structured 500 envelope carries an error');
      console.log('  [D12 fallback] classify happy path returned 500 (no LLM key):', res.body?.error);
      return;
    }

    assert.equal(res.status, 200);
    const body = res.body;
    assert.equal(body.classified, 1, 'only the ready record classified');
    assert.ok(Array.isArray(body.results));
    assert.ok(Array.isArray(body.skipped));

    const skippedReasons = new Map(body.skipped.map((s: any) => [s.recordId, s.reason]));
    assert.equal(skippedReasons.get(pendingId), 'not_classifiable:pending_review');
    assert.equal(skippedReasons.get(processingId), 'not_classifiable:processing');
    assert.equal(skippedReasons.get('missing-id'), 'not_found');

    assert.equal(body.results.length, 1);
    const item = body.results[0];
    assert.equal(item.recordId, readyId1);
    assert.equal(typeof item.hitlRequired, 'boolean');
    assert.ok(item.placement === null || typeof item.placement.titleNumber === 'number');

    // Persistence + audit for the ready record.
    const cod = db
      .prepare(`SELECT cod_status FROM codification_records WHERE ordinance_id = ?`)
      .get(readyId1) as { cod_status: string } | undefined;
    assert.equal(cod?.cod_status, 'classified');

    const audits = db
      .prepare(
        `SELECT agent_name FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 2 AND user_id = ?`
      )
      .all(userId) as Array<{ agent_name: string }>;
    assert.ok(audits.length >= 1, 'agent-2 audit rows present');
    assert.ok(audits.every((a) => a.agent_name === 'Code Classifier'));
  });

  await t.test('override round-trip over HTTP (decision D6)', async () => {
    const put = await api('/api/linaw/classify/' + readyId2, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ titleNumber: 5, chapterNumber: 2, reason: 'Market fees fit Public Health' }),
    });
    assert.equal(put.status, 200);
    assert.equal(put.body?.recordId, readyId2);
    assert.equal(put.body?.codStatus, 'reviewed');
    assert.equal(put.body?.reviewedBy, userId);

    const row = db
      .prepare(`SELECT * FROM codification_records WHERE ordinance_id = ?`)
      .get(readyId2) as Record<string, any>;
    assert.equal(row.cod_status, 'reviewed');
    assert.equal(row.reviewed_by_id, userId);
    assert.equal(row.title_number, 5);
    assert.equal(row.chapter_number, 2);
    const override = JSON.parse(row.human_override);
    assert.equal(override.reason, 'Market fees fit Public Health');
    assert.ok(row.ai_suggestion, 'pre-seeded AI suggestion preserved');
    assert.equal(JSON.parse(row.ai_suggestion).titleNumber, 3, 'AI history intact');

    const audit = db
      .prepare(
        `SELECT action, reason FROM agent_decisions WHERE module = 'linaw' AND pipeline_id = ?`
      )
      .all('override-' + readyId2) as Array<{ action: string; reason: string | null }>;
    assert.ok(audit.some((a) => a.action === 'confirm' && a.reason === 'override'));
  });

  await t.test('override errors: 404 unknown / 409 non-ready', async () => {
    const notFound = await api('/api/linaw/classify/does-not-exist', {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ titleNumber: 1, chapterNumber: 1, reason: 'x' }),
    });
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body?.code, 'NOT_FOUND');

    const conflict = await api('/api/linaw/classify/' + pendingId, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ titleNumber: 1, chapterNumber: 1, reason: 'x' }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body?.code, 'CONFLICT');
  });
});
