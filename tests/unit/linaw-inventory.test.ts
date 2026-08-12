// tests/unit/linaw-inventory.test.ts
// Sprint 6 (S6-C3) — N001 Inventory Analyst engine (HERMETIC, in-process).
// No server, no network: DB_PATH points at a fresh temp DB set BEFORE the
// dynamic imports. node:test + node:assert/strict, relative imports only.
// Proves boundary rule 4: agents see ONLY library_status='ready' rows.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
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

test('linaw inventory suite', async (t) => {
  // Dynamic imports AFTER DB_PATH is set.
  const { getDb } = await import('../../src/lib/db');
  const { analyzeInventory } = await import('../../src/lib/linaw/agents');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `inventory-test-${Date.now()}@example.com`,
    'test-not-used',
    'Inventory Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  await t.test('empty ready library → zeros everywhere, still audited', async () => {
    const pipelineId = 'inventory-empty-run';
    const res = analyzeInventory({ userId, db, pipelineId });
    assert.deepEqual(res.totals, { ordinances: 0, years: 0, subjects: 0 });
    assert.deepEqual(res.byYear, []);
    assert.deepEqual(res.byStatus, []);
    assert.deepEqual(res.bySubject, []);
    assert.deepEqual(res.yearGaps, []);
    assert.equal(res.truncated, false, 'empty corpus never trips the D-2 cap');
    assert.equal(res.completenessScore, 0);
    assert.equal(typeof res.tookMs, 'number');
    assert.ok(res.tookMs >= 0);

    const audits = db
      .prepare(
        `SELECT agent_name, action FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 1 AND pipeline_id = ?
         ORDER BY rowid`
      )
      .all(pipelineId) as Array<{ agent_name: string; action: string }>;
    assert.ok(audits.length >= 2, 'start + complete rows present');
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[1].action, 'complete');
    assert.ok(audits.every((a) => a.agent_name === 'Inventory Analyst'));
  });

  await t.test('ready-only proof: non-ready rows never enter the math', async () => {
    // Two ready rows (years 2021/2022) + one pending_review + one rejected +
    // one processing row (distinct years so their exclusion is observable).
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2021 });
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2022 });
    seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 2,
      seriesYear: 2023,
      libraryStatus: 'pending_review',
    });
    seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 3,
      seriesYear: 2024,
      libraryStatus: 'rejected',
    });
    seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 4,
      seriesYear: 2025,
      libraryStatus: 'processing',
    });

    const res = analyzeInventory({ userId, db });
    assert.equal(res.totals.ordinances, 2, 'only ready rows counted');
    assert.deepEqual(
      res.byYear.map((y) => y.year),
      [2021, 2022],
      'non-ready years never appear'
    );
    // Range [2021,2022] fully covered by ready rows → no gaps, score 100.
    assert.deepEqual(res.yearGaps, []);
    assert.equal(res.truncated, false, 'small clean corpus never trips the D-2 cap');
    assert.equal(res.completenessScore, 100);
  });

  // Reset the corpus for the gap/completeness scenarios.
  db.prepare('DELETE FROM linaw_ordinances').run();

  await t.test('gap-year detection + completeness score', async () => {
    // Ready rows in 2019 + 2021 only → 2020 is a whole missing year.
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2019 });
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2021 });

    const res = analyzeInventory({ userId, db });
    assert.deepEqual(res.yearGaps, [{ year: 2020, missing: [] }]);
    assert.equal(res.truncated, false, 'normal gap corpus stays under the D-2 cap');
    assert.equal(res.completenessScore, 66.7, '2 of 3 range years covered');
  });

  await t.test('numbering holes within a year', async () => {
    // Year 2021 gains ordinance 3 → numbers present {1,3} → hole [2].
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 3, seriesYear: 2021 });

    const res = analyzeInventory({ userId, db });
    const entry = res.yearGaps.find((g) => g.year === 2021);
    assert.deepEqual(entry, { year: 2021, missing: [2] });
    assert.equal(res.truncated, false, 'single-number hole stays under the D-2 cap');
    assert.ok(
      !res.yearGaps.some((g) => g.year === 2019),
      'clean years are omitted'
    );
  });

  // Reset again for the status/subject scenario.
  db.prepare('DELETE FROM linaw_ordinances').run();

  await t.test('byStatus / bySubject + malformed subject_tags tolerated', async () => {
    seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 5,
      seriesYear: 2020,
      subjectTags: ['Taxation & Revenue', 'Permits'],
    });
    db.prepare(`UPDATE linaw_ordinances SET status = 'amended' WHERE ordinance_number = 5`).run();
    // Malformed subject_tags JSON — must not crash nor invent subjects.
    const badId = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 6,
      seriesYear: 2020,
    });
    db.prepare(`UPDATE linaw_ordinances SET subject_tags = 'not-json' WHERE id = ?`).run(badId);

    const res = analyzeInventory({ userId, db });
    assert.equal(res.totals.ordinances, 2);
    assert.equal(res.totals.subjects, 2, 'malformed tags contribute nothing');

    const amended = res.byStatus.find((s) => s.status === 'amended');
    assert.equal(amended?.count, 1);
    const active = res.byStatus.find((s) => s.status === 'active');
    assert.equal(active?.count, 1);
    assert.ok(!res.byStatus.some((s) => s.count === 0), 'zero counts omitted');

    const subjects = res.bySubject.map((s) => s.subject);
    assert.deepEqual(subjects, ['Permits', 'Taxation & Revenue'], 'alphabetical order');
    for (const s of res.bySubject) {
      assert.ok(s.count >= 1);
    }
    assert.equal(typeof res.tookMs, 'number');
    assert.ok(res.tookMs >= 0);
  });

  // ── SYSTEM_TEST D-2 regression: bounded gap analysis ─────────────────────
  // One outlier record must never amplify yearGaps: per-year missing[] lists
  // are capped at 500 entries and the whole yearGaps list at 500 entries,
  // with truncated:true whenever either cap trips.

  // Reset the corpus for the D-2 scenarios.
  db.prepare('DELETE FROM linaw_ordinances').run();

  await t.test('D-2: outlier ordinance number cannot amplify missing[]', async () => {
    // Mirrors the SYSTEM_TEST residue record (Ordinance No. 959579, S. 2018):
    // one outlier number in an otherwise dense year used to enumerate
    // 959,578 missing numbers (~4 MB of JSON in that response).
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2021 });
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 2, seriesYear: 2021 });
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 959579, seriesYear: 2021 });

    const res = analyzeInventory({ userId, db });

    assert.equal(res.totals.ordinances, 3);
    assert.equal(res.truncated, true, 'cap tripped → truncated flag set');

    assert.equal(res.yearGaps.length, 1, 'only the outlier year has holes');
    const entry = res.yearGaps[0];
    assert.equal(entry.year, 2021);
    assert.equal(entry.missing.length, 500, 'missing[] capped at 500 entries');
    assert.equal(entry.missing[0], 3, 'lowest missing numbers emitted first');
    assert.equal(entry.missing[499], 502, 'cap keeps the first 500 holes');

    // The whole serialized response stays small (was ~4 MB for one outlier).
    assert.ok(
      JSON.stringify(res).length < 65_536,
      `response must stay bounded, got ${JSON.stringify(res).length} bytes`
    );

    // Completeness semantics unchanged: single-year window fully covered.
    assert.equal(res.completenessScore, 100);
    assert.ok(res.tookMs <= 2000, `tookMs ${res.tookMs} within the 2s SLA`);
  });

  // Reset again — the series-year outlier scenario needs its own corpus.
  db.prepare('DELETE FROM linaw_ordinances').run();

  await t.test('D-2: outlier series_year cannot amplify yearGaps entries', async () => {
    // One far-future ready row stretches the corpus window to ~10^6 years;
    // every intermediate year used to become its own gap entry (~25 MB).
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 2020 });
    seedLinawReadyRecord(db, userId, { ordinanceNumber: 1, seriesYear: 999999 });

    const res = analyzeInventory({ userId, db });

    assert.equal(res.truncated, true, 'cap tripped → truncated flag set');
    assert.equal(res.yearGaps.length, 500, 'yearGaps capped at 500 entries');
    // Window remains the min..max series_year of the READY corpus: entries
    // start at the first missing year after the corpus minimum, ascending.
    assert.deepEqual(res.yearGaps[0], { year: 2021, missing: [] });
    assert.deepEqual(res.yearGaps[499], { year: 2520, missing: [] });

    // Score semantics unchanged (year coverage of the full bounded window).
    assert.equal(res.completenessScore, 0, '2 years present of ~10^6 window');
    assert.ok(res.tookMs <= 2000, `tookMs ${res.tookMs} within the 2s SLA`);
  });

  // Reset again — outlier rows must never leak into later assertions.
  db.prepare('DELETE FROM linaw_ordinances').run();
});
