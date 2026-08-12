// tests/unit/likha-export-l1.test.ts
// Sprint 4 (S4-C7) — L013 L1 interchange builder unit tests (hermetic).
// INTERCHANGE-SPEC v1.0.0 conformance is the gate: §2 package key set (no
// relationship array for LIKHA), §3 manifest, §4 record mapping, §6
// packageHash over the canonical JSON of {records} — verified by an
// independent ROUND-TRIP recomputation (test-side canonical serializer +
// node:crypto), never trusting the emitted hash string alone.

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

/** Test-side canonical serializer (INDEPENDENT of the app's canonicalJson):
 *  object keys sorted lexicographically at every depth, no insignificant
 *  whitespace, arrays preserve order (INTERCHANGE-SPEC §6). */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonical(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonical(obj[k]));
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value) as string;
}

function sha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const RECORD_KEYS = [
  'content',
  'fileHash',
  'ordinanceNumber',
  'seriesYear',
  'sourceRecordId',
  'sourceType',
  'status',
  'subjectTags',
  'summary',
  'title',
];

test('likha export-l1 builder suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { canonicalJson, buildInterchangePackage } = await import(
    '../../src/lib/likha/export'
  );

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `l1-test-${Date.now()}@example.com`,
    'test-not-used',
    'L1 Test',
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

  await t.test('canonicalJson contract (sorted keys, no insignificant whitespace)', () => {
    assert.equal(
      canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, a: 2 }] } }),
      '{"a":{"c":[3,{"a":2,"z":1}],"d":2},"b":1}'
    );
    // Arrays preserve order; nesting sorts at EVERY depth.
    assert.equal(canonicalJson([1, [2, { y: 1, x: 2 }]]), '[1,[2,{"x":2,"y":1}]]');
    // Strings JSON-escaped; quotes stay valid.
    assert.equal(canonicalJson('a"b'), '"a\\"b"');
    // Literals.
    assert.equal(canonicalJson(null), 'null');
    assert.equal(canonicalJson(true), 'true');
    assert.equal(canonicalJson(false), 'false');
    assert.equal(canonicalJson(1.5), '1.5');
    // Unicode untouched.
    assert.equal(canonicalJson('üñïçødé'), '"üñïçødé"');
    // Empty containers.
    assert.equal(canonicalJson({}), '{}');
    assert.equal(canonicalJson([]), '[]');
  });

  // ── Seed: 2 published + 1 pending_review ──
  const pub1 = seedPublishedRecord(db, userId, {
    ordinanceNumber: 12,
    seriesYear: 2019,
    title: 'An ordinance regulating the operation of tricycles for hire',
    summary: 'X',
    subjectTags: ['Health & Sanitation'],
    sourceType: 'scan',
    status: 'active',
    fileHash: 'cafebabe'.repeat(8),
  });
  db.prepare(
    `INSERT INTO classifications (id, ordinance_id, category, confidence, assigned_by)
     VALUES (?, ?, ?, ?, 'ai')`
  ).run(crypto.randomUUID(), pub1, 'Title VI - Health, Sanitation & Welfare', 0.8);

  const pub2 = seedPublishedRecord(db, userId, {
    ordinanceNumber: 3,
    seriesYear: 2024,
    title: 'An ordinance appropriating funds for road maintenance',
    summary: null,
    subjectTags: [],
    fileHash: null,
  });
  const pendingId = seedPendingReviewRecord(db, userId, {
    ordinanceNumber: 40,
    seriesYear: 2025,
    archiveStatus: 'pending_review',
  });

  await t.test('record mapping (INTERCHANGE-SPEC §4 LIKHA)', () => {
    const outcome = buildInterchangePackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const pkg = outcome.payload;
    assert.equal(pkg.records.length, 2, 'published rows only');

    // Sorted series_year ASC, ordinance_number ASC → 2019 first.
    const rec1 = pkg.records[0];
    assert.equal(rec1.sourceRecordId, pub1);
    assert.equal(rec1.ordinanceNumber, 12);
    assert.equal(rec1.seriesYear, 2019);
    assert.equal(rec1.title, 'An ordinance regulating the operation of tricycles for hire');
    assert.ok(rec1.content.length > 0, 'full text carried');
    assert.equal(rec1.summary, 'X');
    // subjectTags = subject_tags JSON UNION classifications categories (deduped).
    assert.ok(rec1.subjectTags.includes('Health & Sanitation'), 'row tag present');
    assert.ok(
      rec1.subjectTags.includes('Title VI - Health, Sanitation & Welfare'),
      'classification category present'
    );
    assert.equal(new Set(rec1.subjectTags).size, rec1.subjectTags.length, 'deduped');
    assert.equal(rec1.status, 'active');
    assert.equal(rec1.sourceType, 'scan');
    assert.equal(rec1.fileHash, 'cafebabe'.repeat(8));

    const rec2 = pkg.records[1];
    assert.equal(rec2.sourceRecordId, pub2);
    assert.equal(rec2.summary, null, 'summary null passthrough');
    assert.equal(rec2.fileHash, null, 'fileHash null passthrough');

    // No internal-only columns leak into records.
    for (const rec of pkg.records) {
      assert.ok(!('archive_status' in rec), 'no archive_status leak');
      assert.ok(!('archiveStatus' in rec), 'no archiveStatus leak');
      assert.ok(!('uploaded_by_id' in rec), 'no uploaded_by_id leak');
    }
  });

  await t.test('manifest (INTERCHANGE-SPEC §3)', () => {
    const outcome = buildInterchangePackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const m = outcome.payload.manifest;
    assert.equal(m.schemaVersion, '1.0.0');
    assert.equal(m.module, 'likha');
    assert.equal(m.interchangeLevel, 'L1');
    assert.ok(!Number.isNaN(Date.parse(m.exportedAt)), 'exportedAt ISO-8601 parseable');
    assert.equal(m.exportedAt, FIXED_TS);
    assert.equal(m.exportedById, userId);
    assert.equal(m.source.table, 'archived_ordinances');
    assert.equal(m.source.recordCount, outcome.payload.records.length);
    assert.deepEqual(m.source.yearRange, [2019, 2024], 'min/max of exported series years');
    assert.equal(m.exporter.platform, 'esangguni-pilot');
    assert.equal(m.exporter.appVersion, '1.0.0', 'read from package.json version');
  });

  await t.test('packageHash (§6) + ROUND-TRIP + manifest independence', () => {
    const outcome = buildInterchangePackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const pkg = outcome.payload;

    assert.match(pkg.packageHash, /^sha256:[0-9a-f]{64}$/, 'sha256:<64 hex>');

    // ROUND-TRIP — the acceptance-critical assertion: recompute from the
    // RETURNED payload with the test's OWN canonical serializer.
    const recomputed = 'sha256:' + sha256Hex(canonical({ records: pkg.records }));
    assert.equal(recomputed, pkg.packageHash, 'hash round-trips from the payload');

    // The hash covers the PAYLOAD ONLY — mutating the manifest must not
    // change the hash recomputed from records.
    const mutated = {
      ...pkg,
      manifest: { ...pkg.manifest, exportedAt: '1999-01-01T00:00:00.000Z' },
    };
    const fromMutated = 'sha256:' + sha256Hex(canonical({ records: mutated.records }));
    assert.equal(fromMutated, pkg.packageHash, 'manifest never hashed');
  });

  await t.test('eligibility + recordIds filter + empty package', () => {
    const bad = buildInterchangePackage({
      userId,
      db,
      recordIds: [pub1, pendingId],
      now: () => FIXED_TS,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.kind, 'ineligible');
      assert.ok(bad.ineligibleIds.includes(pendingId), 'names the pending id');
      assert.ok(bad.error.includes(pendingId), 'error names the pending id');
    }

    const one = buildInterchangePackage({ userId, db, recordIds: [pub1], now: () => FIXED_TS });
    assert.equal(one.ok, true);
    if (one.ok) assert.equal(one.payload.records.length, 1);

    const empty = buildInterchangePackage({ userId, db, recordIds: [], now: () => FIXED_TS });
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.deepEqual(empty.payload.records, []);
    assert.equal(empty.payload.manifest.source.recordCount, 0);
    assert.deepEqual(empty.payload.manifest.source.yearRange, [], 'empty export → []');
    // Deterministic empty-payload hash, computed independently.
    assert.equal(
      empty.payload.packageHash,
      'sha256:' + sha256Hex(canonical({ records: [] })),
      'empty package hash = sha256 of canonical {"records":[]}'
    );
  });

  await t.test('verbatim package shape (INTERCHANGE-SPEC §2, §4 key sets)', () => {
    const outcome = buildInterchangePackage({ userId, db, now: () => FIXED_TS });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const pkg = outcome.payload as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(pkg).sort(), ['manifest', 'packageHash', 'records']);
    assert.ok(!('relationships' in pkg), 'LIKHA packages carry no relationship array');
    for (const rec of outcome.payload.records) {
      assert.deepEqual(
        Object.keys(rec).sort(),
        RECORD_KEYS,
        'record keys exactly the 10 of INTERCHANGE-SPEC §4'
      );
    }
  });
});
