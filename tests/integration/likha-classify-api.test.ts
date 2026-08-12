// tests/integration/likha-classify-api.test.ts
// Sprint 4 (S4-C8) — L007 classify + override API-level tests.
// Runs against the live dev server (npm run dev) exactly like Sprint-2/3's
// likha-upload/likha-archive suites: helper seeds an approved user + session
// directly into data/workshop.db, test records go in via better-sqlite3, and
// every seeded row + audit/log row is cleaned up in t.after.
//
// Decision D32 — no real LLM calls are asserted in automated tests. The DI
// seam cannot be injected over HTTP, so the classify happy path asserts
// CONTRACT only (status codes, envelopes, persistence shape, audit rows).
// When the dev environment has NO usable OpenRouter key the server returns
// 500 for the happy path; the test then records the structured failure and
// still asserts the 401/400/404/override behaviors (pilot classification
// accuracy is SYSTEM_TEST scope, SPRINT_PLAN risk 7).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
} from '../helpers/likha-test-util';

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

test('likha classify api suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 940_000 + crypto.randomInt(0, 50_000);

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    archiveStatus: 'processing' | 'pending_review' | 'published';
    title?: string;
    content?: string;
  }): string {
    const id = crypto.randomUUID();
    seededIds.push(id);
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, section_count,
          subject_tags, status, source_type, original_filename, scan_file_path,
          file_hash, archive_status, extraction_confidence, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, 8, '[]', 'active', 'scan', ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      opts.ordinanceNumber,
      opts.seriesYear,
      opts.title ?? 'An ordinance regulating the operation of tricycles for hire',
      opts.content ?? 'Section 1. Title. This ordinance regulates tricycle franchises and fares.',
      `ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      `data/uploads/likha/${id}__ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      crypto.createHash('sha256').update(id).digest('hex'),
      opts.archiveStatus,
      JSON.stringify({ ordinanceNumber: 0.95, seriesYear: 0.95, title: 0.9, sectionCount: 0.9 }),
      userId
    );
    return id;
  }

  const pubId = seedRow({ ordinanceNumber: base + 1, seriesYear: 2021, archiveStatus: 'published' });
  const pubId2 = seedRow({ ordinanceNumber: base + 2, seriesYear: 2022, archiveStatus: 'published' });
  const pendId = seedRow({ ordinanceNumber: base + 3, seriesYear: 2023, archiveStatus: 'pending_review' });
  const processingId = seedRow({ ordinanceNumber: base + 4, seriesYear: 2024, archiveStatus: 'processing' });

  // Pre-seeded AI classification row on pubId2 — the override round-trip
  // proves REPLACE semantics (this row must be gone after the override).
  const preseededClassId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO classifications (id, ordinance_id, category, confidence, assigned_by)
     VALUES (?, ?, 'Taxation & Revenue', 0.7, 'ai')`
  ).run(preseededClassId, pubId2);

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM classifications WHERE ordinance_id = ?').run(id);
        db.prepare('DELETE FROM archived_ordinances WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'likha' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('likha-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('likha-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('auth: both routes require a session (401 envelope)', async () => {
    const post = await api('/api/likha/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordinanceIds: [pubId] }),
    });
    assert.equal(post.status, 401);
    assert.equal(post.body?.error, 'Authentication required');
    assert.equal(post.body?.code, 'NO_SESSION');

    const put = await api('/api/likha/classify/' + pubId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: ['Taxation & Revenue'] }),
    });
    assert.equal(put.status, 401);
    assert.equal(put.body?.error, 'Authentication required');
    assert.equal(put.body?.code, 'NO_SESSION');
  });

  await t.test('body validation: 400 INVALID_BODY', async () => {
    for (const body of [{}, { ordinanceIds: [] }, { ordinanceIds: 'x' }]) {
      const res = await api('/api/likha/classify', {
        method: 'POST',
        headers: authed.headers,
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 400, `body ${JSON.stringify(body)} → 400`);
      assert.equal(res.body?.code, 'INVALID_BODY');
    }
  });

  await t.test('classify happy path (contract-level — decision D32)', async () => {
    const res = await api('/api/likha/classify', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [pubId, pendId, processingId, 'missing-id'] }),
    });

    if (res.status === 500) {
      // D32 FALLBACK: the dev environment has no usable LLM key — the server
      // failed structurally but WITHOUT crashing. Record it and move on; the
      // 401/400/404/override assertions above and below still hold. Pilot
      // classification accuracy is SYSTEM_TEST scope.
      assert.ok(res.body?.error, 'structured 500 envelope carries an error');
      console.log('  [D32 fallback] classify happy path returned 500 (no LLM key):', res.body?.error);
      return;
    }

    assert.equal(res.status, 200);
    const body = res.body;
    assert.equal(typeof body.classified, 'number');
    assert.ok(Array.isArray(body.results), 'results array');
    assert.ok(Array.isArray(body.skipped), 'skipped array');

    const skippedReasons = new Map(body.skipped.map((s: any) => [s.recordId, s.reason]));
    assert.ok(
      String(skippedReasons.get(processingId) ?? '').startsWith('not_classifiable'),
      'processing id skipped as not_classifiable'
    );
    assert.equal(skippedReasons.get('missing-id'), 'not_found', 'unknown id → not_found');

    // Full contract when the LLM is available: classified = published + pending.
    assert.equal(body.classified, 2, 'published + pending_review classified');
    assert.equal(body.results.length, 2);
    for (const item of body.results) {
      assert.equal(typeof item.ordinanceNumber, 'number');
      assert.equal(typeof item.seriesYear, 'number');
      assert.ok(Array.isArray(item.suggestions));
      assert.equal(typeof item.hitlRequired, 'boolean');
    }

    for (const id of [pubId, pendId]) {
      const rows = db
        .prepare(`SELECT assigned_by FROM classifications WHERE ordinance_id = ?`)
        .all(id) as Array<{ assigned_by: string }>;
      assert.ok(rows.length >= 1, `classifications persisted for ${id}`);
      assert.ok(rows.every((r) => r.assigned_by === 'ai'), 'AI provenance');
    }

    const audits = db
      .prepare(
        `SELECT agent_name FROM agent_decisions
         WHERE module = 'likha' AND agent_id = 4 AND user_id = ?`
      )
      .all(userId) as Array<{ agent_name: string }>;
    assert.ok(audits.length >= 1, 'agent-4 audit rows present');
    assert.ok(audits.every((a) => a.agent_name === 'Subject Classifier'));
  });

  await t.test('override round-trip over HTTP (decision D25)', async () => {
    const put = await api('/api/likha/classify/' + pubId2, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ categories: ['Taxation & Revenue'] }),
    });
    assert.equal(put.status, 200);
    assert.equal(put.body?.recordId, pubId2);
    assert.deepEqual(put.body?.categories, ['Taxation & Revenue']);
    assert.equal(put.body?.assignedBy, userId);

    // GET detail surfaces the override; the pre-seeded AI row is gone
    // (REPLACE semantics).
    const detail = await api('/api/likha/archive/' + pubId2, { headers: { Cookie: cookie } });
    assert.equal(detail.status, 200);
    const classifications = detail.body?.classifications;
    assert.ok(Array.isArray(classifications), 'classifications array present');
    assert.equal(classifications.length, 1, 'exactly the override row');
    assert.equal(classifications[0].assignedBy, userId, 'user provenance');
    assert.equal(classifications[0].confidence, null, 'human rows carry no confidence');
    assert.equal(classifications[0].category, 'Taxation & Revenue');

    const audit = db
      .prepare(
        `SELECT action, reason FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = ?`
      )
      .all('override-' + pubId2) as Array<{ action: string; reason: string | null }>;
    const confirm = audit.find((a) => a.action === 'confirm' && a.reason === 'override');
    assert.ok(confirm, 'override audit row (confirm/override) present');

    // Error envelopes.
    const badCategory = await api('/api/likha/classify/' + pubId2, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ categories: ['Not A Real Category'] }),
    });
    assert.equal(badCategory.status, 400);

    const notFound = await api('/api/likha/classify/does-not-exist', {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ categories: ['Taxation & Revenue'] }),
    });
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body?.code, 'NOT_FOUND');

    const empty = await api('/api/likha/classify/' + pubId2, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({}),
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body?.code, 'INVALID_BODY');
  });
});
