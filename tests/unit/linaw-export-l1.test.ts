// tests/unit/linaw-export-l1.test.ts
// Sprint 7 (S7-C13) — N015 L1 interchange builder (HERMETIC, in-process).
// INTERCHANGE-SPEC v1.0.0 §2–§6 for module 'linaw': canonical JSON contract
// (sorted keys at every depth), §4 record mapping over ready rows, §5
// relationships (confirmed-only, six-type-only, keyed by {ordinanceNumber,
// seriesYear} — NEVER internal ids), filtering self-consistency, all-or-
// nothing eligibility, valid empty package, and the §6 packageHash
// round-trip INCLUDING a package with confirmed relationships.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
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

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

test('linaw export L1 suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { linawCanonicalJson, buildLinawInterchangePackage } = await import(
    '../../src/lib/linaw/export'
  );

  // ── canonicalJson contract (pure) ─────────────────────────────────────────

  await t.test('canonicalJson: sorted keys at every depth, arrays keep order, undefined dropped', () => {
    const fixture = {
      b: 1,
      a: { d: [3, { z: true, y: null }], c: 'x' },
      u: undefined,
    };
    assert.equal(
      linawCanonicalJson(fixture),
      '{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}',
      'exact canonical string — no insignificant whitespace'
    );
    assert.equal(linawCanonicalJson({}), '{}');
    assert.equal(linawCanonicalJson([]), '[]');
    assert.equal(linawCanonicalJson('s'), '"s"');
    assert.equal(linawCanonicalJson(4.5), '4.5');
    assert.equal(linawCanonicalJson(true), 'true');
    assert.equal(linawCanonicalJson(null), 'null');
    // Arrays preserve order (never sorted).
    assert.equal(linawCanonicalJson({ list: [3, 1, 2] }), '{"list":[3,1,2]}');
  });

  // ── Corpus ─────────────────────────────────────────────────────────────────

  const db = getDb();
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `export-test-${Date.now()}@example.com`,
    'test-not-used',
    'Export Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  // Ready R1 — No. 1, S. 2020, has summary.
  const r1 = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 1,
    seriesYear: 2020,
    title: 'An ordinance on market fees',
    summary: 'Regulates market fees in plain language.',
    subjectTags: ['Taxation & Revenue'],
  });
  // Ready R2 — No. 2, S. 2018, NULL summary + MALFORMED subject_tags.
  const r2 = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 2,
    seriesYear: 2018,
    title: 'An ordinance on tricycle routes',
    subjectTags: ['Permits'],
  });
  db.prepare(`UPDATE linaw_ordinances SET summary = NULL, subject_tags = '{bad' WHERE id = ?`).run(r2);
  // Ready R3 — No. 3, S. 2019.
  const r3 = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 3,
    seriesYear: 2019,
    title: 'An ordinance on solid waste',
    subjectTags: ['Health'],
  });
  // pending_review P1 — never exportable.
  const p1 = seedLinawPendingReviewRecord(db, userId, {
    ordinanceNumber: 4,
    seriesYear: 2019,
    libraryStatus: 'pending_review',
  });

  // Relationships: two confirmed six-type rows, one unconfirmed, one
  // confirmed conflict-marker row.
  const relAmends = seedLinawRelationship(db, r2, r1, {
    type: 'amends',
    sectionRef: 'Section 3',
    confidence: 0.9,
    confirmed: 1,
    confirmedById: userId,
  });
  const relRepeals = seedLinawRelationship(db, r3, r2, {
    type: 'repeals',
    sectionRef: null,
    confidence: 0.8,
    confirmed: 1,
    confirmedById: userId,
  });
  seedLinawRelationship(db, r1, r3, { type: 'extends', confirmed: 0 });
  seedLinawRelationship(db, r1, r2, {
    type: 'conflict',
    confirmed: 1,
    confirmedById: userId,
  });

  const FIXED_NOW = '2026-08-09T12:00:00.000Z';

  // ── Full package: records + confirmed relationships + hash round-trip ─────

  await t.test('full export: manifest, §4 mapping, §5 relationships, hash round-trip', () => {
    const outcome = buildLinawInterchangePackage({ userId, db, now: () => FIXED_NOW });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const pkg = outcome.payload;

    // Verbatim package shape (§2) — relationships ALWAYS present for LINAW.
    assert.deepEqual(Object.keys(pkg).sort(), ['manifest', 'packageHash', 'records', 'relationships']);

    // Manifest (§3).
    assert.deepEqual(Object.keys(pkg.manifest).sort(), [
      'exportedAt',
      'exportedById',
      'exporter',
      'interchangeLevel',
      'module',
      'schemaVersion',
      'source',
    ]);
    assert.equal(pkg.manifest.schemaVersion, '1.0.0');
    assert.equal(pkg.manifest.module, 'linaw');
    assert.equal(pkg.manifest.interchangeLevel, 'L1');
    assert.equal(pkg.manifest.exportedAt, FIXED_NOW);
    assert.equal(pkg.manifest.exportedById, userId);
    assert.equal(pkg.manifest.source.table, 'linaw_ordinances');
    assert.equal(pkg.manifest.source.recordCount, pkg.records.length);
    assert.deepEqual(pkg.manifest.source.yearRange, [2018, 2020]);
    assert.equal(pkg.manifest.exporter.platform, 'esangguni-pilot');
    assert.ok(pkg.manifest.exporter.appVersion.length > 0);

    // Records (§4 LINAW mapping) — chronological order, ready only.
    assert.equal(pkg.records.length, 3);
    assert.deepEqual(
      pkg.records.map((r) => [r.ordinanceNumber, r.seriesYear]),
      [
        [2, 2018],
        [3, 2019],
        [1, 2020],
      ],
      'ordered (series_year ASC, ordinance_number ASC); pending_review absent'
    );
    assert.ok(!pkg.records.some((r) => r.sourceRecordId === p1));

    const rec1 = pkg.records.find((r) => r.sourceRecordId === r1)!;
    assert.equal(rec1.summary, 'Regulates market fees in plain language.');
    assert.deepEqual(rec1.subjectTags, ['Taxation & Revenue']);
    assert.equal(rec1.status, 'active');
    assert.ok(['scan', 'import', 'manual'].includes(rec1.sourceType));
    assert.equal(rec1.fileHash, null);

    const rec2 = pkg.records.find((r) => r.sourceRecordId === r2)!;
    assert.equal(rec2.summary, null, 'NULL summary maps to null');
    assert.deepEqual(rec2.subjectTags, [], 'malformed subject_tags → []');

    // Relationships (§5): ONLY the two confirmed six-type rows.
    assert.equal(pkg.relationships.length, 2);
    const types = pkg.relationships.map((rel) => rel.type).sort();
    assert.deepEqual(types, ['amends', 'repeals'], 'conflict marker + unconfirmed excluded');

    const amends = pkg.relationships.find((rel) => rel.type === 'amends')!;
    assert.deepEqual(amends.sourceOrdinance, { ordinanceNumber: 2, seriesYear: 2018 });
    assert.deepEqual(amends.targetOrdinance, { ordinanceNumber: 1, seriesYear: 2020 });
    assert.equal(amends.sectionRef, 'Section 3');
    assert.equal(amends.confidence, 0.9);
    assert.equal(amends.confirmedById, userId);

    const repeals = pkg.relationships.find((rel) => rel.type === 'repeals')!;
    assert.equal(repeals.sectionRef, null);

    // NEVER an internal id anywhere in a relationship entry.
    const relJson = JSON.stringify(pkg.relationships);
    for (const internalId of [r1, r2, r3, p1, relAmends, relRepeals]) {
      assert.ok(!relJson.includes(internalId), `internal id ${internalId} must not leak`);
    }

    // Hash (§6) round-trip: recompute from the returned payload.
    assert.match(pkg.packageHash, /^sha256:[0-9a-f]{64}$/);
    const recomputed =
      'sha256:' +
      sha256Hex(linawCanonicalJson({ records: pkg.records, relationships: pkg.relationships }));
    assert.equal(recomputed, pkg.packageHash, 'hash round-trips over {records, relationships}');

    // Tamper detection: one changed record field breaks the hash.
    const tamperedRecords = pkg.records.map((r, i) =>
      i === 0 ? { ...r, title: 'TAMPERED' } : r
    );
    const tamperedHash =
      'sha256:' +
      sha256Hex(linawCanonicalJson({ records: tamperedRecords, relationships: pkg.relationships }));
    assert.notEqual(tamperedHash, pkg.packageHash, 'tampered payload changes the hash');

    // Manifest independence: mutating the manifest never changes the hash.
    const manifestMutated = { ...pkg.manifest, exportedAt: '1999-01-01T00:00:00.000Z' };
    const recomputedAfterManifestChange =
      'sha256:' +
      sha256Hex(linawCanonicalJson({ records: pkg.records, relationships: pkg.relationships }));
    assert.equal(recomputedAfterManifestChange, pkg.packageHash);
    assert.notEqual(manifestMutated.exportedAt, pkg.manifest.exportedAt);
  });

  // ── Filtering self-consistency (D8) ────────────────────────────────────────

  await t.test('filter: confirmed relationship omitted when an endpoint is filtered out', () => {
    const outcome = buildLinawInterchangePackage({ userId, recordIds: [r1], db, now: () => FIXED_NOW });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.payload.records.length, 1);
    assert.equal(outcome.payload.records[0].sourceRecordId, r1);
    assert.equal(
      outcome.payload.relationships.length,
      0,
      'both confirmed rows touch a filtered-out endpoint → omitted'
    );
    // Hash still round-trips on the filtered package.
    const recomputed =
      'sha256:' +
      sha256Hex(
        linawCanonicalJson({
          records: outcome.payload.records,
          relationships: outcome.payload.relationships,
        })
      );
    assert.equal(recomputed, outcome.payload.packageHash);
    assert.deepEqual(outcome.payload.manifest.source.yearRange, [2020, 2020]);
  });

  // ── Eligibility: all-or-nothing (D8) ───────────────────────────────────────

  await t.test('unknown id + non-ready id refuse the WHOLE request', () => {
    const unknown = crypto.randomUUID();
    const outcome = buildLinawInterchangePackage({ userId, recordIds: [unknown, p1, r1], db });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.kind, 'ineligible');
      assert.deepEqual(outcome.ineligibleIds.sort(), [unknown, p1].sort(), 'both listed');
      assert.match(outcome.error, /not eligible/i);
    }
  });

  await t.test('[] → valid empty package (records [], relationships [], yearRange [])', () => {
    const outcome = buildLinawInterchangePackage({ userId, recordIds: [], db, now: () => FIXED_NOW });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.deepEqual(outcome.payload.records, []);
    assert.deepEqual(outcome.payload.relationships, []);
    assert.equal(outcome.payload.manifest.source.recordCount, 0);
    assert.deepEqual(outcome.payload.manifest.source.yearRange, []);
    assert.match(outcome.payload.packageHash, /^sha256:[0-9a-f]{64}$/);
    const recomputed =
      'sha256:' + sha256Hex(linawCanonicalJson({ records: [], relationships: [] }));
    assert.equal(recomputed, outcome.payload.packageHash, 'empty payload hash deterministic');
  });
});
