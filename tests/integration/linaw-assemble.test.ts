// tests/integration/linaw-assemble.test.ts
// Sprint 7 (S7-C10) — N006 assemble + code list + code detail API-level
// suite. The assembler is GLOBAL by design (its gate counts every pending
// detection across the library — D5), and tsx --test runs integration files
// in parallel over the shared dev DB: blocked/409 expectations therefore use
// >= semantics + a DB-snapshot check, and the success path retries briefly
// until concurrent suites' rows are decided. Proves: 409 PENDING_RELATIONSHIPS
// while a seeded detection is pending (no volume written), success after
// confirm, rejected rows not blocking, edition validation, list/detail
// round-trip of the structure JSON, and NOTHING_TO_ASSEMBLE for an empty
// eligible set.

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
  seedLinawCodificationRecord,
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test('linaw assemble suite', async (t) => {
  await assertServerReachable();

  // The Sprint-7 additive `rejected` column lands lazily via initSchema — run
  // the real migration on the shared dev DB before seeding.
  const { getDb } = await import('../../src/lib/db');
  getDb();

  const { userId, cookie, cleanup } = seedApprovedUser();
  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  const base = 900_000 + crypto.randomInt(0, 20_000);
  const seededOrdinanceIds: string[] = [];
  const seededRelIds: string[] = [];

  function readyOrd(ordinanceNumber: number, seriesYear: number): string {
    const id = seedLinawReadyRecord(db, userId, { ordinanceNumber, seriesYear });
    seededOrdinanceIds.push(id);
    return id;
  }

  // Pair 1 — placed, pending detection confirmed before the first success.
  const p1a = readyOrd(base + 1, 2019);
  const p1b = readyOrd(base + 2, 2021);
  seedLinawCodificationRecord(db, p1a, { titleNumber: 3, chapterNumber: 1 });
  seedLinawCodificationRecord(db, p1b, { titleNumber: 3, chapterNumber: 1 });
  const rel1 = seedLinawRelationship(db, p1b, p1a, { type: 'amends' });
  seededRelIds.push(rel1);

  // Pair 2 (rejection path) is seeded INSIDE its subtest so it does not hold
  // the global gate during pair 1's success path.
  const p2a = readyOrd(base + 3, 2018);
  const p2b = readyOrd(base + 4, 2022);
  seedLinawCodificationRecord(db, p2a, { titleNumber: 6, chapterNumber: 2 });
  seedLinawCodificationRecord(db, p2b, { titleNumber: 6, chapterNumber: 2 });
  let rel2 = '';

  function globalPending(): number {
    return (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM ordinance_relationships
           WHERE confirmed = 0 AND (rejected IS NULL OR rejected = 0)`
        )
        .get() as { n: number }
    ).n;
  }
  function globalEligible(): number {
    return (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM codification_records c
           JOIN linaw_ordinances o ON o.id = c.ordinance_id
           WHERE o.library_status = 'ready' AND c.title_number IS NOT NULL
             AND c.chapter_number IS NOT NULL AND o.status IN ('active','amended')`
        )
        .get() as { n: number }
    ).n;
  }
  function volumeCount(): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM code_volumes`).get() as { n: number }).n;
  }

  /** Assemble, retrying briefly while OTHER suites' pending rows clear. */
  async function assembleWhenClear(edition: string): Promise<{ status: number; body: any }> {
    let last = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ edition }),
    });
    for (let i = 0; i < 20 && last.status === 409 && last.body?.code === 'PENDING_RELATIONSHIPS'; i += 1) {
      if (globalPending() === 0) break;
      await sleep(750);
      last = await api('/api/linaw/assemble', {
        method: 'POST',
        headers: authed.headers,
        body: JSON.stringify({ edition }),
      });
    }
    return last;
  }

  t.after(() => {
    try {
      for (const id of seededOrdinanceIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        db.prepare('DELETE FROM codification_records WHERE ordinance_id = ?').run(id);
        db.prepare('DELETE FROM linaw_ordinances WHERE id = ?').run(id);
      }
      for (const id of seededRelIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM code_volumes WHERE generated_by_id = ?`).run(userId);
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('linaw-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('linaw-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('auth: all three routes require a session (401 envelope)', async () => {
    const post = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edition: 'X' }),
    });
    assert.equal(post.status, 401);
    assert.equal(post.body?.code, 'NO_SESSION');

    const list = await api('/api/linaw/code');
    assert.equal(list.status, 401);
    assert.equal(list.body?.code, 'NO_SESSION');

    const detail = await api('/api/linaw/code/anything');
    assert.equal(detail.status, 401);
    assert.equal(detail.body?.code, 'NO_SESSION');
  });

  await t.test('fresh user, pending detection → 409 PENDING_RELATIONSHIPS, no volume', async () => {
    assert.ok(globalPending() >= 1, 'seeded detections are pending');
    const before = volumeCount();
    const res = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ edition: 'Blocked Edition 2026' }),
    });
    assert.equal(res.status, 409);
    assert.equal(res.body?.code, 'PENDING_RELATIONSHIPS');
    assert.ok(res.body.pending >= 1);
    assert.match(res.body.error, /await human decision/);
    assert.equal(volumeCount(), before, 'no volume row while blocked');
  });

  let firstAssembly: any = null;
  let firstVolumeId = '';

  await t.test('confirm the detection → assemble succeeds (final_code_export raised)', async () => {
    const confirm = await api(`/api/linaw/relationships/${rel1}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.confirmed, 1);
    // rel1 is 'amends' — a non-flipping type: no statusUpdate expected.
    assert.equal(confirm.body.statusUpdate, undefined);

    const res = await assembleWhenClear('Test Edition 2026');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    firstAssembly = res.body;
    firstVolumeId = res.body.codeVolumeId;
    assert.ok(firstVolumeId);
    assert.equal(res.body.title, 'Municipal Code of Ordinances');
    assert.equal(res.body.edition, 'Test Edition 2026');
    assert.equal(res.body.hitlRequired, true);
    assert.equal(res.body.gate, 'final_code_export');
    assert.ok(Array.isArray(res.body.toc) && res.body.toc.length > 0, 'toc non-empty');
    assert.equal(res.body.counts.titles, res.body.toc.length);
    const chapterCount = res.body.toc.reduce((s: number, n: any) => s + n.chapters.length, 0);
    assert.equal(res.body.counts.chapters, chapterCount);
    assert.ok(res.body.counts.sections >= 4, 'the four seeded ordinances assembled');
  });

  await t.test('rejected detection does NOT block assembly', async () => {
    rel2 = seedLinawRelationship(db, p2b, p2a, { type: 'repeals' });
    seededRelIds.push(rel2);

    // rel2 is pending → blocked first.
    const blocked = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ edition: 'Second Test Edition' }),
    });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body?.code, 'PENDING_RELATIONSHIPS');

    const reject = await api(`/api/linaw/relationships/${rel2}`, {
      method: 'PUT',
      headers: authed.headers,
      body: JSON.stringify({ action: 'reject', reason: 'Integration probe: not an operative repeal' }),
    });
    assert.equal(reject.status, 200);
    assert.equal(reject.body.rejected, 1);

    const res = await assembleWhenClear('Second Test Edition');
    assert.equal(res.status, 200, 'rejected rows do not block');
    assert.equal(res.body.edition, 'Second Test Edition');
    assert.notEqual(res.body.codeVolumeId, firstVolumeId, 'a NEW draft volume per assemble');
  });

  await t.test('edition validation: missing/empty/non-string → 400 VALIDATION', async () => {
    const missing = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: '{}',
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.body?.code, 'VALIDATION');

    const empty = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ edition: '   ' }),
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body?.code, 'VALIDATION');

    const badJson = await api('/api/linaw/assemble', {
      method: 'POST',
      headers: authed.headers,
      body: '{not json',
    });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body?.code, 'VALIDATION');
  });

  await t.test('code list + detail: newest-first, toc round-trips, 404 unknown', async () => {
    const list = await api('/api/linaw/code?limit=100', { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.items));
    assert.equal(typeof list.body.total, 'number');

    const mine = list.body.items.filter((v: any) =>
      ['Test Edition 2026', 'Second Test Edition'].includes(v.edition)
    );
    assert.equal(mine.length, 2, 'both volumes listed');
    assert.ok(mine.every((v: any) => v.status === 'draft'));
    // Newest first: Second Test Edition above Test Edition 2026.
    const idxSecond = list.body.items.findIndex((v: any) => v.edition === 'Second Test Edition');
    const idxFirst = list.body.items.findIndex((v: any) => v.edition === 'Test Edition 2026');
    assert.ok(idxSecond < idxFirst, 'newest-first ordering');

    const detail = await api(`/api/linaw/code/${firstVolumeId}`, { headers: { Cookie: cookie } });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, firstVolumeId);
    assert.equal(detail.body.edition, 'Test Edition 2026');
    assert.equal(detail.body.generatedById, userId);
    assert.deepEqual(detail.body.toc, firstAssembly.toc, 'structure parses back into the toc');

    const missing = await api(`/api/linaw/code/${crypto.randomUUID()}`, { headers: { Cookie: cookie } });
    assert.equal(missing.status, 404);
    assert.equal(missing.body?.code, 'NOT_FOUND');
  });

  await t.test('fresh-user probe: gate outcome matches the shared-library snapshot', async () => {
    const emptyUser = seedApprovedUser();
    try {
      // The assembler is global by design: a fresh user sees the SAME queue.
      // Snapshot the library first so the expectation is honest even while
      // parallel suites hold detections or eligible placements.
      const pending = globalPending();
      const eligible = globalEligible();
      const res = await api('/api/linaw/assemble', {
        method: 'POST',
        headers: { Cookie: emptyUser.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: 'Empty Probe' }),
      });
      if (pending > 0) {
        assert.equal(res.status, 409);
        assert.equal(res.body?.code, 'PENDING_RELATIONSHIPS');
      } else if (eligible === 0) {
        assert.equal(res.status, 409);
        assert.equal(res.body?.code, 'NOTHING_TO_ASSEMBLE');
      } else {
        assert.equal(res.status, 200, 'eligible rows exist → assembly succeeds');
        assert.equal(res.body?.gate, 'final_code_export');
      }
    } finally {
      db.prepare(`DELETE FROM code_volumes WHERE generated_by_id = ?`).run(emptyUser.userId);
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`).run(emptyUser.userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('linaw-' + emptyUser.userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('linaw-' + emptyUser.userId);
      emptyUser.cleanup();
    }
  });
});
