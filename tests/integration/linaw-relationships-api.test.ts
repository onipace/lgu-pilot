// tests/integration/linaw-relationships-api.test.ts
// Sprint 6 (S6-C10) — N003/N004 detection + relationships + conflicts
// API-level suite. Runs against the live dev server; helper seeds an approved
// user + session into data/workshop.db, rows go in via better-sqlite3 with
// DISTINCTIVE ordinance numbers, cleanup removes every seeded row + audit row.
//
// The detect happy path works WITHOUT an OpenRouter key because the regex
// pass is authoritative (decision D7/D12); conflicts may be empty keyless, so
// the conflicts list asserts SHAPE only.

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

test('linaw relationships api suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 970_000 + crypto.randomInt(0, 20_000);

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    libraryStatus: 'pending_review' | 'ready';
    content?: string;
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
      'An ordinance for the relationships integration suite',
      opts.content ?? 'Section 1. Title. Integration test body.',
      opts.libraryStatus,
      userId
    );
    return id;
  }

  // Ready TARGET (base+1, 2019).
  const targetId = seedRow({ ordinanceNumber: base + 1, seriesYear: 2019, libraryStatus: 'ready' });
  // Ready SOURCE (base+2, 2021) amending the TARGET + an orphan reference.
  const sourceContent =
    `Section 3. This ordinance amends Ordinance No. ${base + 1}, S. 2019. ` +
    `This ordinance also repeals Ordinance No. ${base + 99}, S. 1999.`;
  const sourceId = seedRow({
    ordinanceNumber: base + 2,
    seriesYear: 2021,
    libraryStatus: 'ready',
    content: sourceContent,
  });
  // Plain ready row (base+3, 2020).
  seedRow({ ordinanceNumber: base + 3, seriesYear: 2020, libraryStatus: 'ready' });
  // A pending_review row that ALSO amends the TARGET (ready-only proof — it
  // must produce NO relationship row).
  const pendingId = seedRow({
    ordinanceNumber: base + 4,
    seriesYear: 2020,
    libraryStatus: 'pending_review',
    content: `Section 1. This ordinance amends Ordinance No. ${base + 1}, S. 2019.`,
  });

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

  await t.test('auth: all three routes require a session (401 envelope)', async () => {
    const post = await api('/api/linaw/detect-relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(post.status, 401);
    assert.equal(post.body?.code, 'NO_SESSION');

    const rel = await api('/api/linaw/relationships');
    assert.equal(rel.status, 401);
    assert.equal(rel.body?.code, 'NO_SESSION');

    const conf = await api('/api/linaw/conflicts');
    assert.equal(conf.status, 401);
    assert.equal(conf.body?.code, 'NO_SESSION');
  });

  await t.test('body validation: {ordinanceIds: "x"} → 400 INVALID_BODY', async () => {
    const res = await api('/api/linaw/detect-relationships', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: 'x' }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body?.code, 'INVALID_BODY');
  });

  await t.test('detect happy path (contract — regex is authoritative)', async () => {
    const res = await api('/api/linaw/detect-relationships', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const body = res.body;

    assert.ok(body.relationshipsPersisted >= 1, 'amending reference persisted');
    assert.equal(body.hitlRequired, true, 'detections raise HITL');
    assert.ok(Array.isArray(body.orphans));
    assert.ok(Array.isArray(body.conflicts));
    assert.equal(typeof body.conflictsDetected, 'number');
    assert.equal(typeof body.conflictsPersisted, 'number');

    // The amends row: source=SOURCE, target=TARGET, section_ref 'Section 3',
    // confidence ~0.85, confirmed 0.
    const rows = db
      .prepare(
        `SELECT * FROM ordinance_relationships
         WHERE source_id = ? AND target_id = ? AND relationship_type = 'amends'`
      )
      .all(sourceId, targetId) as Array<Record<string, any>>;
    assert.ok(rows.length >= 1, 'amends row exists');
    const amends = rows[0];
    assert.equal(amends.section_ref, 'Section 3');
    assert.equal(amends.confirmed, 0);
    assert.ok(Math.abs(amends.confidence - 0.85) <= 0.01, `confidence ~0.85 (${amends.confidence})`);

    // Orphan (base+99, 1999) present with 'missing target'.
    const orphan = body.orphans.find(
      (o: any) => o.referencedNumber === base + 99 && o.referencedYear === 1999
    );
    assert.ok(orphan, 'orphan for the never-seeded reference');
    assert.equal(orphan.warning, 'missing target');

    // The pending_review row produced NO relationship row (rule 4).
    const pendingRows = db
      .prepare(
        `SELECT COUNT(*) AS n FROM ordinance_relationships WHERE source_id = ? OR target_id = ?`
      )
      .get(pendingId, pendingId) as { n: number };
    assert.equal(pendingRows.n, 0, 'pending_review row never a source/target');

    // Audit rows exist for agent 3 AND agent 4.
    const agents = db
      .prepare(
        `SELECT DISTINCT agent_id FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`
      )
      .all(userId) as Array<{ agent_id: number }>;
    const agentIds = new Set(agents.map((a) => a.agent_id));
    assert.ok(agentIds.has(3), 'agent-3 audited');
    assert.ok(agentIds.has(4), 'agent-4 audited');
  });

  await t.test('idempotency: second POST persists nothing new', async () => {
    // Count ONLY this suite's rows — Sprint-7 suites seed rows concurrently
    // into the shared dev DB, so the whole-table count is not stable here.
    const suiteRows = () => {
      const placeholders = seededIds.map(() => '?').join(',');
      return (
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM ordinance_relationships
             WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`
          )
          .get(...seededIds, ...seededIds) as { n: number }
      ).n;
    };
    const before = suiteRows();
    const res = await api('/api/linaw/detect-relationships', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.relationshipsPersisted, 0, 'no new rows on re-run');
    assert.ok(res.body.skippedExisting >= 1, 'existing detections skipped');
    const after = suiteRows();
    assert.equal(after, before, 'row count unchanged');
  });

  await t.test('GET relationships: joined metadata, never the conflict marker', async () => {
    const res = await api('/api/linaw/relationships?limit=100', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const body = res.body;
    assert.ok(Array.isArray(body.items));
    assert.equal(typeof body.total, 'number');
    assert.equal(typeof body.page, 'number');
    assert.equal(typeof body.limit, 'number');

    // The amends row is present with source/target endpoint metadata.
    const amends = body.items.find(
      (i: any) => i.sourceId === sourceId && i.targetId === targetId && i.type === 'amends'
    );
    assert.ok(amends, 'amends row listed');
    assert.equal(amends.source.ordinanceNumber, base + 2);
    assert.equal(amends.target.ordinanceNumber, base + 1);
    assert.equal(typeof amends.target.title, 'string');

    // No item carries the conflict marker.
    assert.ok(body.items.every((i: any) => i.type !== 'conflict'), 'marker never leaks');

    // Filter type=repeals → our amends row is excluded.
    const repeals = await api('/api/linaw/relationships?type=repeals&limit=100', {
      headers: { Cookie: cookie },
    });
    assert.equal(repeals.status, 200);
    assert.ok(repeals.body.items.every((i: any) => i.type === 'repeals'));

    // Invalid type → 400 VALIDATION.
    const bogus = await api('/api/linaw/relationships?type=bogus', { headers: { Cookie: cookie } });
    assert.equal(bogus.status, 400);
    assert.equal(bogus.body?.code, 'VALIDATION');
  });

  await t.test('GET conflicts: evidence shape (may be empty keyless)', async () => {
    const res = await api('/api/linaw/conflicts?limit=100', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const body = res.body;
    assert.ok(Array.isArray(body.items));
    assert.equal(typeof body.total, 'number');
    assert.equal(typeof body.page, 'number');
    assert.equal(typeof body.limit, 'number');
    for (const item of body.items) {
      assert.ok(item.ordinanceA, 'ordinanceA endpoint');
      assert.ok(item.ordinanceB, 'ordinanceB endpoint');
      assert.equal(typeof item.reason, 'string');
      assert.equal(typeof item.confidence, 'number');
      assert.ok(Array.isArray(item.excerpts));
    }
  });
});
