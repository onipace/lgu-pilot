// tests/unit/linaw-confirmation.test.ts
// Sprint 7 (S7-C3) — N005 relationship confirmation workflow (HERMETIC,
// in-process). DB_PATH → fresh temp DB before dynamic imports. Covers the D2
// status mapping (confirmed repeal/partial_repeal/supersedes flip the TARGET
// ordinance — the affected instrument), non-flipping types, terminal-status
// protection, rejection storage (D1: rejected=1, confirmed stays 0, reason
// audited), decision finality, validation, agent-5 reviewRelationships counts
// (conflicts included — D3), and the additive rejected-column idempotency.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawRelationship,
} from '../helpers/linaw-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

after(() => {
  try {
    fs.rmSync(DB_FILE, { force: true });
    fs.rmSync(DB_FILE + '-wal', { force: true });
    fs.rmSync(DB_FILE + '-shm', { force: true });
  } catch {
    // best-effort
  }
});

test('linaw confirmation suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const {
    decideRelationship,
    reviewRelationships,
    ordinanceStatusAfterConfirmedRelationship,
  } = await import('../../src/lib/linaw/agents');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `confirmation-test-${Date.now()}@example.com`,
    'test-not-used',
    'Confirmation Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  function ordinanceStatus(id: string): string {
    const row = db
      .prepare(`SELECT status FROM linaw_ordinances WHERE id = ?`)
      .get(id) as { status: string };
    return row.status;
  }

  function relationshipRow(id: string): Record<string, unknown> {
    return db
      .prepare(`SELECT * FROM ordinance_relationships WHERE id = ?`)
      .get(id) as Record<string, unknown>;
  }

  // ── reviewRelationships on an empty table (run BEFORE any seeding) ────────

  await t.test('reviewRelationships: empty table → hitlRequired false', () => {
    const res = reviewRelationships({ userId, db, pipelineId: 'review-empty' });
    assert.equal(res.pending, 0);
    assert.equal(res.confirmed, 0);
    assert.equal(res.rejected, 0);
    assert.equal(res.hitlRequired, false);
  });

  // ── D2 status mapping (pure function) ─────────────────────────────────────

  await t.test('ordinanceStatusAfterConfirmedRelationship: only 3 types flip', () => {
    assert.equal(ordinanceStatusAfterConfirmedRelationship('repeals'), 'repealed');
    assert.equal(ordinanceStatusAfterConfirmedRelationship('partial_repeal'), 'amended');
    assert.equal(ordinanceStatusAfterConfirmedRelationship('supersedes'), 'superseded');
    assert.equal(ordinanceStatusAfterConfirmedRelationship('amends'), undefined);
    assert.equal(ordinanceStatusAfterConfirmedRelationship('extends'), undefined);
    assert.equal(ordinanceStatusAfterConfirmedRelationship('implements'), undefined);
  });

  // ── Confirm status propagation (D2): the TARGET flips, source unchanged ────

  const flipCases: Array<{
    type: 'repeals' | 'partial_repeal' | 'supersedes';
    expected: 'repealed' | 'amended' | 'superseded';
  }> = [
    { type: 'repeals', expected: 'repealed' },
    { type: 'partial_repeal', expected: 'amended' },
    { type: 'supersedes', expected: 'superseded' },
  ];

  for (const [i, flip] of flipCases.entries()) {
    await t.test(`confirm ${flip.type} flips TARGET to ${flip.expected}`, () => {
      const source = seedLinawReadyRecord(db, userId, {
        ordinanceNumber: 100 + i,
        seriesYear: 2024,
        title: `Actor instrument ${flip.type}`,
      });
      const target = seedLinawReadyRecord(db, userId, {
        ordinanceNumber: 110 + i,
        seriesYear: 2015,
        title: `Affected instrument ${flip.type}`,
      });
      const relId = seedLinawRelationship(db, source, target, { type: flip.type });

      const outcome = decideRelationship({
        relationshipId: relId,
        userId,
        body: { action: 'confirm' },
        db,
      });
      if (!outcome.ok) throw new Error('expected ok outcome: ' + outcome.error);

      assert.equal(outcome.response.confirmed, 1);
      assert.equal(outcome.response.rejected, 0);
      assert.ok(outcome.response.statusUpdate, 'statusUpdate present for flipping types');
      assert.equal(outcome.response.statusUpdate.to, flip.expected);
      assert.equal(outcome.response.statusUpdate.from, 'active');
      assert.equal(outcome.response.statusUpdate.ordinanceId, target, 'TARGET is flipped (D2)');

      assert.equal(ordinanceStatus(target), flip.expected, 'target row flipped');
      assert.equal(ordinanceStatus(source), 'active', 'source row untouched');

      const row = relationshipRow(relId);
      assert.equal(row.confirmed, 1);
      assert.equal(row.confirmed_by_id, userId);
      assert.equal(Number(row.rejected ?? 0), 0);
    });
  }

  // ── Non-flipping types: amends + conflict marker ──────────────────────────

  await t.test('confirm amends: both statuses unchanged, statusUpdate absent', () => {
    const source = seedLinawReadyRecord(db, userId, { ordinanceNumber: 120, seriesYear: 2023 });
    const target = seedLinawReadyRecord(db, userId, { ordinanceNumber: 121, seriesYear: 2014 });
    const relId = seedLinawRelationship(db, source, target, { type: 'amends' });

    const outcome = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'confirm' },
      db,
    });
    if (!outcome.ok) throw new Error('expected ok outcome: ' + outcome.error);
    assert.equal(outcome.response.statusUpdate, undefined);
    assert.equal(ordinanceStatus(source), 'active');
    assert.equal(ordinanceStatus(target), 'active');
  });

  await t.test('confirm conflict-marker row: works, no flip', () => {
    const a = seedLinawReadyRecord(db, userId, { ordinanceNumber: 122, seriesYear: 2023 });
    const b = seedLinawReadyRecord(db, userId, { ordinanceNumber: 123, seriesYear: 2023 });
    const relId = seedLinawRelationship(db, a, b, { type: 'conflict' });

    const outcome = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'confirm' },
      db,
    });
    if (!outcome.ok) throw new Error('expected ok outcome: ' + outcome.error);
    assert.equal(outcome.response.confirmed, 1);
    assert.equal(outcome.response.statusUpdate, undefined);
    assert.equal(ordinanceStatus(a), 'active');
    assert.equal(ordinanceStatus(b), 'active');
  });

  // ── Terminal target protection ─────────────────────────────────────────────

  await t.test('terminal target status is never overwritten', () => {
    const source = seedLinawReadyRecord(db, userId, { ordinanceNumber: 130, seriesYear: 2024 });
    const target = seedLinawReadyRecord(db, userId, { ordinanceNumber: 131, seriesYear: 2012 });
    db.prepare(`UPDATE linaw_ordinances SET status = 'repealed' WHERE id = ?`).run(target);
    const relId = seedLinawRelationship(db, source, target, { type: 'supersedes' });

    const outcome = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'confirm' },
      db,
    });
    if (!outcome.ok) throw new Error('expected ok outcome: ' + outcome.error);
    assert.equal(outcome.response.confirmed, 1);
    assert.equal(outcome.response.statusUpdate, undefined, 'no statusUpdate on terminal target');
    assert.equal(ordinanceStatus(target), 'repealed', 'terminal status preserved');
  });

  // ── Reject (D1): rejected=1, confirmed stays 0, reason audited ────────────

  await t.test('reject with reason: storage + audit row', () => {
    const source = seedLinawReadyRecord(db, userId, { ordinanceNumber: 140, seriesYear: 2022 });
    const target = seedLinawReadyRecord(db, userId, { ordinanceNumber: 141, seriesYear: 2016 });
    const relId = seedLinawRelationship(db, source, target, { type: 'repeals' });

    const outcome = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'reject', reason: 'Reference is to a resolution, not an ordinance' },
      db,
    });
    if (!outcome.ok) throw new Error('expected ok outcome: ' + outcome.error);
    assert.equal(outcome.response.action, 'reject');
    assert.equal(outcome.response.confirmed, 0);
    assert.equal(outcome.response.rejected, 1);
    assert.equal(outcome.response.statusUpdate, undefined);

    const row = relationshipRow(relId);
    assert.equal(row.rejected, 1);
    assert.equal(row.confirmed, 0, 'confirmed stays 0 on rejection');
    assert.equal(row.confirmed_by_id, null, 'confirmed_by_id stays NULL on rejection');
    assert.equal(ordinanceStatus(target), 'active', 'reject never flips status');

    const audit = db
      .prepare(
        `SELECT agent_id, action, reason FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 5 AND action = 'reject'
         ORDER BY rowid DESC LIMIT 1`
      )
      .get() as { agent_id: number; action: string; reason: string };
    assert.equal(audit.agent_id, 5);
    assert.equal(audit.action, 'reject');
    assert.equal(audit.reason, 'Reference is to a resolution, not an ordinance');
  });

  // ── Finality: decisions are FINAL (409 territory) ─────────────────────────

  await t.test('finality: second action on a decided row → already_decided', () => {
    // confirm → confirm
    const s1 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 150, seriesYear: 2021 });
    const t1 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 151, seriesYear: 2015 });
    const r1 = seedLinawRelationship(db, s1, t1, { type: 'amends' });
    const first = decideRelationship({ relationshipId: r1, userId, body: { action: 'confirm' }, db });
    assert.equal(first.ok, true);
    const again = decideRelationship({ relationshipId: r1, userId, body: { action: 'confirm' }, db });
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.kind, 'already_decided');

    // reject → confirm
    const s2 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 152, seriesYear: 2021 });
    const t2 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 153, seriesYear: 2015 });
    const r2 = seedLinawRelationship(db, s2, t2, { type: 'amends' });
    const rej = decideRelationship({
      relationshipId: r2,
      userId,
      body: { action: 'reject', reason: 'wrong pairing' },
      db,
    });
    assert.equal(rej.ok, true);
    const afterReject = decideRelationship({ relationshipId: r2, userId, body: { action: 'confirm' }, db });
    assert.equal(afterReject.ok, false);
    if (!afterReject.ok) assert.equal(afterReject.kind, 'already_decided');

    // confirm → reject
    const s3 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 154, seriesYear: 2021 });
    const t3 = seedLinawReadyRecord(db, userId, { ordinanceNumber: 155, seriesYear: 2015 });
    const r3 = seedLinawRelationship(db, s3, t3, { type: 'amends' });
    assert.equal(decideRelationship({ relationshipId: r3, userId, body: { action: 'confirm' }, db }).ok, true);
    const afterConfirm = decideRelationship({
      relationshipId: r3,
      userId,
      body: { action: 'reject', reason: 'changed my mind' },
      db,
    });
    assert.equal(afterConfirm.ok, false);
    if (!afterConfirm.ok) assert.equal(afterConfirm.kind, 'already_decided');
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  await t.test('validation: missing reason / bogus action / unknown id', () => {
    const s = seedLinawReadyRecord(db, userId, { ordinanceNumber: 160, seriesYear: 2020 });
    const tg = seedLinawReadyRecord(db, userId, { ordinanceNumber: 161, seriesYear: 2014 });
    const relId = seedLinawRelationship(db, s, tg, { type: 'amends' });

    const noReason = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'reject' },
      db,
    });
    assert.equal(noReason.ok, false);
    if (!noReason.ok) {
      assert.equal(noReason.kind, 'invalid');
      assert.match(noReason.error, /reason/i);
    }

    const blankReason = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'reject', reason: '   ' },
      db,
    });
    assert.equal(blankReason.ok, false);
    if (!blankReason.ok) assert.equal(blankReason.kind, 'invalid');

    const bogus = decideRelationship({
      relationshipId: relId,
      userId,
      body: { action: 'maybe' as unknown as 'confirm' },
      db,
    });
    assert.equal(bogus.ok, false);
    if (!bogus.ok) {
      assert.equal(bogus.kind, 'invalid');
      assert.match(bogus.error, /confirm or reject/);
    }

    const missing = decideRelationship({
      relationshipId: crypto.randomUUID(),
      userId,
      body: { action: 'confirm' },
      db,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.kind, 'not_found');

    // Row untouched by the failed attempts.
    const row = relationshipRow(relId);
    assert.equal(row.confirmed, 0);
    assert.equal(Number(row.rejected ?? 0), 0);
  });

  // ── reviewRelationships counts (controlled fixture) ───────────────────────

  await t.test('reviewRelationships: pending/confirmed/rejected counts + hitl audit', () => {
    db.prepare(`DELETE FROM ordinance_relationships`).run();
    db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw'`).run();

    const a = seedLinawReadyRecord(db, userId, { ordinanceNumber: 170, seriesYear: 2020 });
    const b = seedLinawReadyRecord(db, userId, { ordinanceNumber: 171, seriesYear: 2020 });
    const c = seedLinawReadyRecord(db, userId, { ordinanceNumber: 172, seriesYear: 2020 });
    const d = seedLinawReadyRecord(db, userId, { ordinanceNumber: 173, seriesYear: 2020 });

    // One pending (six-type), one confirmed (conflict marker), one rejected (six-type).
    seedLinawRelationship(db, a, b, { type: 'amends' });
    seedLinawRelationship(db, c, d, {
      type: 'conflict',
      confirmed: 1,
      confirmedById: userId,
    });
    seedLinawRelationship(db, c, b, { type: 'repeals', rejected: 1 });

    const res = reviewRelationships({ userId, db, pipelineId: 'review-counts' });
    assert.equal(res.pending, 1);
    assert.equal(res.confirmed, 1);
    assert.equal(res.rejected, 1);
    assert.equal(res.hitlRequired, true);

    const hitl = db
      .prepare(
        `SELECT agent_id, action, reason FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'review-counts' AND action = 'hitl'`
      )
      .all() as Array<{ agent_id: number; action: string; reason: string }>;
    assert.equal(hitl.length, 1);
    assert.equal(hitl[0].agent_id, 5);
    assert.ok(hitl[0].reason.includes('detected_relationship'));

    // start + complete audit rows always present (hitl row follows complete).
    const actions = db
      .prepare(
        `SELECT action FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'review-counts' ORDER BY rowid`
      )
      .all() as Array<{ action: string }>;
    assert.equal(actions[0].action, 'start');
    assert.ok(actions.some((a) => a.action === 'complete'), 'complete row audited');
    assert.equal(actions[actions.length - 1].action, 'hitl');
  });

  // ── Additive rejected column: idempotent schema init (D1) ─────────────────

  await t.test('rejected column: exists exactly once; schema init idempotent', async () => {
    const cols = db
      .prepare(`PRAGMA table_info(ordinance_relationships)`)
      .all() as Array<{ name: string }>;
    const rejectedCols = cols.filter((c) => c.name === 'rejected');
    assert.equal(rejectedCols.length, 1, 'rejected column present exactly once');

    // Re-run the module's init over the SAME file via a cache-busted import —
    // a fresh module instance opens the existing DB and re-inits the schema.
    process.env.DB_PATH = DB_FILE;
    const reinitSpecifier = '../../src/lib/db?reinit=1';
    const fresh = (await import(reinitSpecifier)) as typeof import('../../src/lib/db');
    const db2 = fresh.getDb();
    assert.ok(db2, 'second init over an existing DB succeeds');
    const cols2 = db2
      .prepare(`PRAGMA table_info(ordinance_relationships)`)
      .all() as Array<{ name: string }>;
    assert.equal(cols2.filter((c) => c.name === 'rejected').length, 1, 'still exactly once');
  });
});
