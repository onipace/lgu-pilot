// tests/integration/linaw-relationship-decisions.test.ts
// Sprint 7 (S7-C4) — N005 relationship confirmation workflow API-level suite.
// Runs against the live dev server; helper seeds an approved user + session,
// rows go in via better-sqlite3 harness seeders, cleanup removes every seeded
// row + audit/log rows. Proves over HTTP: confirm/reject semantics, the D2
// TARGET status flip (repeals → 'repealed'), rejection reason auditing,
// decision finality (409), validation (400/404), conflict-marker decisions
// through the SAME endpoint (D3), and `rejected` surfacing on GET.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
  seedLinawReadyRecord,
  seedLinawRelationship,
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

test('linaw relationship decisions suite', async (t) => {
  await assertServerReachable();

  // The Sprint-7 additive `rejected` column lands lazily via initSchema — run
  // the real migration on the shared dev DB before seeding rows that carry it.
  const { getDb } = await import('../../src/lib/db');
  getDb();

  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 940_000 + crypto.randomInt(0, 20_000);

  const seededOrdinanceIds: string[] = [];
  const seededRelIds: string[] = [];

  function readyOrd(ordinanceNumber: number, seriesYear: number): string {
    const id = seedLinawReadyRecord(db, userId, { ordinanceNumber, seriesYear });
    seededOrdinanceIds.push(id);
    return id;
  }
  function rel(sourceId: string, targetId: string, overrides?: Parameters<typeof seedLinawRelationship>[3]): string {
    const id = seedLinawRelationship(db, sourceId, targetId, overrides);
    seededRelIds.push(id);
    return id;
  }

  // Pair 1 — confirmed repeal (D2 status flip).
  const repealTarget = readyOrd(base + 1, 2018);
  const repealSource = readyOrd(base + 2, 2023);
  const repealRel = rel(repealSource, repealTarget, { type: 'repeals' });

  // Pair 2 — rejection with reason.
  const rejectTarget = readyOrd(base + 3, 2017);
  const rejectSource = readyOrd(base + 4, 2022);
  const rejectRel = rel(rejectSource, rejectTarget, { type: 'amends' });

  // Pair 3 — validation probes + GET rejected surfacing.
  const validTarget = readyOrd(base + 5, 2016);
  const validSource = readyOrd(base + 6, 2021);
  const validRel = rel(validSource, validTarget, { type: 'extends' });

  // Pair 4 — conflict-marker row decided through the same endpoint (D3).
  const conflictA = readyOrd(base + 7, 2020);
  const conflictB = readyOrd(base + 8, 2020);
  const conflictRel = rel(conflictA, conflictB, { type: 'conflict' });

  t.after(() => {
    try {
      for (const id of seededOrdinanceIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        db.prepare('DELETE FROM linaw_ordinances WHERE id = ?').run(id);
      }
      for (const id of seededRelIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('linaw-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('linaw-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('auth: PUT requires a session (401 envelope)', async () => {
    const res = await api(`/api/linaw/relationships/${repealRel}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(res.status, 401);
    assert.equal(res.body?.code, 'NO_SESSION');
  });

  await t.test('confirm repeals: 200 + TARGET flipped to repealed (D2)', async () => {
    const res = await api(`/api/linaw/relationships/${repealRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, repealRel);
    assert.equal(res.body.action, 'confirm');
    assert.equal(res.body.confirmed, 1);
    assert.equal(res.body.rejected, 0);
    assert.ok(res.body.statusUpdate, 'statusUpdate present');
    assert.equal(res.body.statusUpdate.to, 'repealed');
    assert.equal(res.body.statusUpdate.from, 'active');
    assert.equal(res.body.statusUpdate.ordinanceId, repealTarget);

    const targetRow = db.prepare(`SELECT status FROM linaw_ordinances WHERE id = ?`).get(repealTarget) as { status: string };
    const sourceRow = db.prepare(`SELECT status FROM linaw_ordinances WHERE id = ?`).get(repealSource) as { status: string };
    assert.equal(targetRow.status, 'repealed', 'TARGET row flipped');
    assert.equal(sourceRow.status, 'active', 'SOURCE row untouched');

    const relRow = db.prepare(`SELECT confirmed, confirmed_by_id FROM ordinance_relationships WHERE id = ?`).get(repealRel) as {
      confirmed: number;
      confirmed_by_id: string | null;
    };
    assert.equal(relRow.confirmed, 1);
    assert.equal(relRow.confirmed_by_id, userId);
  });

  await t.test('reject with reason: 200 + storage + audit row', async () => {
    const reason = 'Integration probe: reference is contextual, not operative';
    const res = await api(`/api/linaw/relationships/${rejectRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'reject', reason }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.action, 'reject');
    assert.equal(res.body.rejected, 1);
    assert.equal(res.body.confirmed, 0);
    assert.equal(res.body.statusUpdate, undefined);

    const row = db
      .prepare(`SELECT confirmed, rejected, confirmed_by_id FROM ordinance_relationships WHERE id = ?`)
      .get(rejectRel) as { confirmed: number; rejected: number; confirmed_by_id: string | null };
    assert.equal(row.confirmed, 0);
    assert.equal(row.rejected, 1);
    assert.equal(row.confirmed_by_id, null);

    const audit = db
      .prepare(
        `SELECT agent_id, action, reason FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 5 AND action = 'reject' AND user_id = ?
         ORDER BY rowid DESC LIMIT 1`
      )
      .get(userId) as { agent_id: number; action: string; reason: string };
    assert.equal(audit.agent_id, 5);
    assert.equal(audit.action, 'reject');
    assert.equal(audit.reason, reason);
  });

  await t.test('finality: double-confirm + confirm-after-reject → 409', async () => {
    const double = await api(`/api/linaw/relationships/${repealRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(double.status, 409);
    assert.equal(double.body?.code, 'CONFLICT');

    const afterReject = await api(`/api/linaw/relationships/${rejectRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(afterReject.status, 409);
    assert.equal(afterReject.body?.code, 'CONFLICT');
  });

  await t.test('validation: 400 missing reason / invalid action / bad body; 404 unknown id', async () => {
    const noReason = await api(`/api/linaw/relationships/${validRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'reject' }),
    });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body?.code, 'VALIDATION');

    const invalidAction = await api(`/api/linaw/relationships/${validRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'annul' }),
    });
    assert.equal(invalidAction.status, 400);
    assert.equal(invalidAction.body?.code, 'VALIDATION');

    const badBody = await api(`/api/linaw/relationships/${validRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: '{not json',
    });
    assert.equal(badBody.status, 400);
    assert.equal(badBody.body?.code, 'INVALID_BODY');

    const missing = await api(`/api/linaw/relationships/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body?.code, 'NOT_FOUND');
  });

  await t.test('conflict-marker row: decided through the SAME endpoint (D3), no flip', async () => {
    const res = await api(`/api/linaw/relationships/${conflictRel}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.confirmed, 1);
    assert.equal(res.body.statusUpdate, undefined, 'conflict confirm never flips status');

    const row = db.prepare(`SELECT confirmed FROM ordinance_relationships WHERE id = ?`).get(conflictRel) as { confirmed: number };
    assert.equal(row.confirmed, 1);
  });

  await t.test('GET relationships surfaces rejected (S7-C4)', async () => {
    const res = await api('/api/linaw/relationships?limit=100', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));

    const rejectedItem = res.body.items.find((i: any) => i.id === rejectRel);
    assert.ok(rejectedItem, 'the rejected row is listed');
    assert.equal(rejectedItem.rejected, 1);
    assert.equal(rejectedItem.confirmed, 0);

    const confirmedItem = res.body.items.find((i: any) => i.id === repealRel);
    assert.ok(confirmedItem, 'the confirmed row is listed');
    assert.equal(confirmedItem.rejected, 0);
    assert.equal(confirmedItem.confirmed, 1);

    // Conflict marker never leaks into the relationships API.
    assert.ok(res.body.items.every((i: any) => i.type !== 'conflict'));
  });
});
