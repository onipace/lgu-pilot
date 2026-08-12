// tests/unit/likha-export-dilg.test.ts
// Sprint 4 (S4-C4) — L010 DILG MC 2026-041 builder unit tests (hermetic).
// Temp DB set BEFORE the dynamic imports (db.ts reads DB_PATH at module load);
// the builder is exercised directly with a DI db handle + fixed clock. No server,
// no logging asserted here (routes own logging — S4-C8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedPublishedRecord,
  seedPendingReviewRecord,
} from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

const FIXED_TS = '2026-08-09T00:00:00.000Z';

test('likha export-dilg builder suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { buildDilgPackage } = await import('../../src/lib/likha/export');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `dilg-test-${Date.now()}@example.com`,
    'test-not-used',
    'DILG Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  t.after(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        // ignore
      }
    }
  });

  // Two published rows (2019 + 2023), one pending_review, one flagged.
  const pub2019 = seedPublishedRecord(db, userId, {
    ordinanceNumber: 12,
    seriesYear: 2019,
    subjectTags: ['Taxation & Revenue'],
    title: 'An ordinance regulating the operation of tricycles for hire',
  });
  const pub2023 = seedPublishedRecord(db, userId, {
    ordinanceNumber: 3,
    seriesYear: 2023,
    status: 'amended',
    subjectTags: [],
    title: 'An ordinance revising the schedule of business permit fees',
  });
  const pendingId = seedPendingReviewRecord(db, userId, {
    ordinanceNumber: 40,
    seriesYear: 2024,
    archiveStatus: 'pending_review',
  });
  const flaggedId = seedPendingReviewRecord(db, userId, {
    ordinanceNumber: 41,
    seriesYear: 2024,
    archiveStatus: 'flagged',
  });

  await t.test('selects published only, sorted chronologically', () => {
    const outcome = buildDilgPackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const pkg = outcome.payload;
    assert.equal(pkg.manifest.recordCount, 2);
    assert.equal(pkg.records.length, 2);
    const ids = pkg.records.map((r) => r.sourceRecordId);
    assert.ok(ids.includes(pub2019) && ids.includes(pub2023), 'both published rows present');
    assert.ok(!ids.includes(pendingId) && !ids.includes(flaggedId), 'non-published excluded');
    // Chronological: 2019 before 2023.
    assert.equal(pkg.records[0].seriesYear, 2019);
    assert.equal(pkg.records[1].seriesYear, 2023);
  });

  await t.test('record shape (decision D27) + subjectTags union incl. classifications', () => {
    // Seed one classifications row for the 2019 record.
    db.prepare(
      `INSERT INTO classifications (id, ordinance_id, category, confidence, assigned_by)
       VALUES (?, ?, ?, ?, 'ai')`
    ).run(crypto.randomUUID(), pub2019, 'Title III - Taxation & Fiscal Affairs', 0.8);

    const outcome = buildDilgPackage({ userId, db, recordIds: [pub2019], now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const rec = outcome.payload.records[0];
    assert.deepEqual(Object.keys(rec).sort(), [
      'dilgSubmittedAt',
      'fileHash',
      'ordinanceNumber',
      'seriesYear',
      'sourceRecordId',
      'status',
      'subjectTags',
      'title',
    ]);
    assert.equal(rec.sourceRecordId, pub2019);
    assert.equal(rec.ordinanceNumber, 12);
    assert.equal(rec.seriesYear, 2019);
    assert.equal(rec.fileHash, 'cafebabe'.repeat(8));
    // Union of subject_tags JSON + classifications categories, deduped.
    assert.ok(rec.subjectTags.includes('Taxation & Revenue'), 'row tag present');
    assert.ok(
      rec.subjectTags.includes('Title III - Taxation & Fiscal Affairs'),
      'classification category present'
    );
    assert.equal(
      new Set(rec.subjectTags).size,
      rec.subjectTags.length,
      'subjectTags deduplicated'
    );
  });

  await t.test('manifest shape', () => {
    const outcome = buildDilgPackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const m = outcome.payload.manifest;
    assert.equal(m.submission, 'DILG MC 2026-041');
    assert.equal(m.module, 'likha');
    assert.equal(m.platform, 'esangguni-pilot');
    assert.equal(m.exportedById, userId);
    assert.equal(m.recordCount, outcome.payload.records.length);
    assert.ok(!Number.isNaN(Date.parse(m.exportedAt)), 'exportedAt ISO-8601 parseable');
    assert.equal(m.exportedAt, FIXED_TS);
  });

  await t.test('recordIds filter + eligibility refusal names the offending id', () => {
    const one = buildDilgPackage({ userId, db, recordIds: [pub2019], now: () => FIXED_TS });
    assert.equal(one.ok, true);
    if (one.ok) assert.equal(one.payload.records.length, 1);

    const bad = buildDilgPackage({ userId, db, recordIds: [pub2019, pendingId], now: () => FIXED_TS });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.kind, 'ineligible');
      assert.ok(bad.ineligibleIds.includes(pendingId), 'names the pending id');
      assert.ok(bad.error.includes(pendingId), 'error names the pending id');
    }

    const missing = buildDilgPackage({ userId, db, recordIds: ['does-not-exist'], now: () => FIXED_TS });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.kind, 'ineligible');
      assert.ok(missing.ineligibleIds.includes('does-not-exist'));
    }
  });

  await t.test('empty selection → valid zero-record package', () => {
    const outcome = buildDilgPackage({ userId, db, recordIds: [], now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.payload.manifest.recordCount, 0);
    assert.deepEqual(outcome.payload.records, []);
  });

  await t.test('marks dilg_submitted on included rows only', () => {
    const outcome = buildDilgPackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;

    for (const id of [pub2019, pub2023]) {
      const row = db
        .prepare('SELECT dilg_submitted, dilg_submitted_at FROM archived_ordinances WHERE id = ?')
        .get(id) as { dilg_submitted: number; dilg_submitted_at: string | null };
      assert.equal(row.dilg_submitted, 1, `row ${id} marked`);
      assert.equal(row.dilg_submitted_at, FIXED_TS, 'timestamp written');
    }
    for (const id of [pendingId, flaggedId]) {
      const row = db
        .prepare('SELECT dilg_submitted FROM archived_ordinances WHERE id = ?')
        .get(id) as { dilg_submitted: number };
      assert.equal(row.dilg_submitted, 0, `row ${id} untouched`);
    }
    // Record timestamps equal the written value.
    for (const rec of outcome.payload.records) {
      assert.equal(rec.dilgSubmittedAt, FIXED_TS);
    }
  });
});
