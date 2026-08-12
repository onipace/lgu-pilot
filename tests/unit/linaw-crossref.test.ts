// tests/unit/linaw-crossref.test.ts
// Sprint 6 (S6-C8) — N003 Cross-Reference Scanner (HERMETIC, in-process).
// DB_PATH → fresh temp DB before dynamic imports; the `refine` seam is
// injected everywhere — NO real LLM. Covers the regex battery (D7), section
// capture, ready-only target resolution + orphans (D8), self-references,
// idempotency, and the refinement seam contract.

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

test('linaw crossref suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { extractCrossReferences, scanCrossReferences, LINAW_BASELINE_CROSSREF_CONFIDENCE } =
    await import('../../src/lib/linaw/agents');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `crossref-test-${Date.now()}@example.com`,
    'test-not-used',
    'CrossRef Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  // ── Regex battery (pure, never throws) ────────────────────────────────────

  await t.test('regex battery: verb family → type mapping', () => {
    const amends = extractCrossReferences('This ordinance is amending Ordinance No. 4, S. 2019 today.');
    assert.equal(amends.length, 1);
    assert.equal(amends[0].type, 'amends');
    assert.equal(amends[0].ordinanceNumber, 4);
    assert.equal(amends[0].seriesYear, 2019);

    const repeals = extractCrossReferences('...repealing Ordinance No. 5, Series of 2018 effective soon.');
    assert.equal(repeals[0].type, 'repeals');
    assert.equal(repeals[0].ordinanceNumber, 5);
    assert.equal(repeals[0].seriesYear, 2018);

    const partial = extractCrossReferences('...repealing in part Ordinance No. 6, S. 2017 for causes.');
    assert.equal(partial[0].type, 'partial_repeal');

    const implementsRef = extractCrossReferences('Done pursuant to Ordinance No. 7, S. 2016 of this body.');
    assert.equal(implementsRef[0].type, 'implements');

    const supersedes = extractCrossReferences('...superseding Ordinance No. 8, S. 2015 in all respects.');
    assert.equal(supersedes[0].type, 'supersedes');

    const extendsRef = extractCrossReferences('...extending Ordinance No. 9, S. 2014 for one more year.');
    assert.equal(extendsRef[0].type, 'extends');

    const upper = extractCrossReferences('AMENDING ORDINANCE NO. 4, S. 2019 NOW.');
    assert.equal(upper[0].type, 'amends');
    assert.equal(upper[0].ordinanceNumber, 4);

    const numberVariant = extractCrossReferences('amending Ordinance Number 12, S. 2013 here.');
    assert.equal(numberVariant[0].ordinanceNumber, 12);
    assert.equal(numberVariant[0].seriesYear, 2013);

    const noYear = extractCrossReferences('amending Ordinance No. 21 without a series year.');
    assert.equal(noYear[0].ordinanceNumber, 21);
    assert.equal(noYear[0].seriesYear, 0, 'missing series year → 0 (orphan downstream)');

    assert.deepEqual(extractCrossReferences('Nothing to see here, no references.'), []);
    assert.deepEqual(extractCrossReferences(''), []);
    assert.doesNotThrow(() => extractCrossReferences('a'.repeat(10_000)));
  });

  await t.test('sectionRef capture: nearest preceding Section N within 200 chars', () => {
    const withSection = extractCrossReferences(
      'Section 12. Penalty. The council amends Ordinance No. 4, S. 2019 accordingly.'
    );
    assert.equal(withSection[0].sectionRef, 'Section 12');

    const without = extractCrossReferences(
      'A preamble with no section marker amending Ordinance No. 4, S. 2019 directly.'
    );
    assert.equal(without[0].sectionRef, undefined);
  });

  // ── Resolution + persistence corpus ────────────────────────────────────────

  const TARGET_NO = 51;
  const TARGET_YEAR = 2019;
  const targetId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: TARGET_NO,
    seriesYear: TARGET_YEAR,
    title: 'An ordinance on the base market fee schedule',
  });
  const sourceId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 52,
    seriesYear: 2021,
    title: 'An ordinance adjusting the market fee schedule',
    content: `Section 3. Amendment. This ordinance amends Ordinance No. ${TARGET_NO}, S. ${TARGET_YEAR} for fairness.`,
  });

  await t.test('resolution + persistence: baseline 0.85, confirmed=0, audit pair', async () => {
    const pipelineId = 'detect-crossref-1';
    const res = await scanCrossReferences({ userId, db, pipelineId, refine: async () => null });

    assert.equal(res.scanned, 2, 'both ready rows scanned as sources');
    assert.equal(res.persisted, 1);
    assert.equal(res.detected, 1);
    assert.equal(res.orphans.length, 0);
    assert.equal(res.relationships.length, 1);
    const rel = res.relationships[0];
    assert.equal(rel.sourceId, sourceId);
    assert.equal(rel.targetId, targetId);
    assert.equal(rel.type, 'amends');
    assert.equal(rel.sectionRef, 'Section 3');
    assert.equal(rel.confidence, LINAW_BASELINE_CROSSREF_CONFIDENCE);
    assert.equal(LINAW_BASELINE_CROSSREF_CONFIDENCE, 0.85);
    assert.equal(rel.confirmed, 0);

    const row = db
      .prepare(`SELECT * FROM ordinance_relationships WHERE id = ?`)
      .get(rel.id) as Record<string, any>;
    assert.equal(row.source_id, sourceId);
    assert.equal(row.target_id, targetId);
    assert.equal(row.relationship_type, 'amends');
    assert.equal(row.confirmed, 0);
    assert.ok(Math.abs(row.confidence - 0.85) < 0.001);

    const audits = db
      .prepare(
        `SELECT action FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 3 AND pipeline_id = ? ORDER BY rowid`
      )
      .all(pipelineId) as Array<{ action: string }>;
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[audits.length - 1].action, 'complete');
  });

  await t.test('idempotency: second identical run persists nothing', async () => {
    const res = await scanCrossReferences({ userId, db, pipelineId: 'detect-crossref-2', refine: async () => null });
    assert.equal(res.persisted, 0);
    assert.equal(res.skippedExisting, 1);
    const count = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM ordinance_relationships WHERE source_id = ?`)
        .get(sourceId) as { n: number }
    ).n;
    assert.equal(count, 1, 'row count unchanged');
  });

  await t.test('orphans: unknown target / non-ready target / missing year', async () => {
    // A target that EXISTS but is not ready is still an orphan (rule 4).
    const PENDING_NO = 54;
    const PENDING_YEAR = 2018;
    seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: PENDING_NO,
      seriesYear: PENDING_YEAR,
      libraryStatus: 'pending_review',
    });

    const orphanSource = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 53,
      seriesYear: 2021,
      content:
        'Section 1. Title. This repeals Ordinance No. 999, S. 1999 entirely. ' +
        'It also amends Ordinance No. 777 without a year. ' +
        `Finally it amends Ordinance No. ${PENDING_NO}, S. ${PENDING_YEAR} too.`,
    });

    const res = await scanCrossReferences({
      ordinanceIds: [orphanSource],
      userId,
      db,
      pipelineId: 'detect-crossref-orphans',
      refine: async () => null,
    });

    assert.equal(res.persisted, 0, 'orphans are never persisted');
    assert.equal(res.orphans.length, 3);
    assert.ok(res.orphans.every((o) => o.warning === 'missing target'));
    assert.ok(res.orphans.some((o) => o.referencedNumber === 999 && o.referencedYear === 1999));
    assert.ok(res.orphans.some((o) => o.referencedNumber === 777 && o.referencedYear === 0));
    assert.ok(res.orphans.some((o) => o.referencedNumber === PENDING_NO), 'non-ready target is an orphan');
    assert.ok(res.orphans.every((o) => o.rawQuote.length > 0 && o.rawQuote.length <= 160));
  });

  await t.test('self-reference: neither persisted nor orphaned', async () => {
    const selfSource = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 60,
      seriesYear: 2022,
      content: 'Section 1. Title. This ordinance amends Ordinance No. 60, S. 2022 itself.',
    });
    const res = await scanCrossReferences({
      ordinanceIds: [selfSource],
      userId,
      db,
      pipelineId: 'detect-crossref-self',
      refine: async () => null,
    });
    assert.equal(res.detected, 0, 'self-references are skipped before detection');
    assert.equal(res.persisted, 0);
    assert.equal(res.orphans.length, 0);
  });

  await t.test('refinement seam: override type + confidence', async () => {
    const refineSource = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 61,
      seriesYear: 2022,
      content: `Section 2. This extends Ordinance No. ${TARGET_NO}, S. ${TARGET_YEAR} briefly.`,
    });
    const res = await scanCrossReferences({
      ordinanceIds: [refineSource],
      userId,
      db,
      pipelineId: 'detect-crossref-refine',
      refine: async () => [{ refIndex: 0, type: 'repeals', confidence: 0.95 }],
    });
    assert.equal(res.persisted, 1);
    assert.equal(res.relationships[0].type, 'repeals');
    assert.equal(res.relationships[0].confidence, 0.95);
  });

  await t.test('refinement seam throwing → baseline verdict persists (never crashes)', async () => {
    const throwSource = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 62,
      seriesYear: 2022,
      content: `Section 2. This amends Ordinance No. ${TARGET_NO}, S. ${TARGET_YEAR} again.`,
    });
    const res = await scanCrossReferences({
      ordinanceIds: [throwSource],
      userId,
      db,
      pipelineId: 'detect-crossref-throw',
      refine: async () => {
        throw new Error('refine boom');
      },
    });
    assert.equal(res.persisted, 1, 'baseline verdict persists despite seam failure');
    assert.equal(res.relationships[0].type, 'amends');
    assert.equal(res.relationships[0].confidence, 0.85);
  });
});
