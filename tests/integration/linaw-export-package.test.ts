// tests/integration/linaw-export-package.test.ts
// Sprint 7 (S7-C14) — N015 L1 interchange export over HTTP (INTERCHANGE-SPEC
// v1.0.0 §7 + §11 LINAW row). Runs against the live dev server. The hash
// ROUND-TRIP uses the test's OWN canonical serializer + node:crypto (never
// imports module code) and covers a package WITH confirmed relationships.
// Parallel-suite tolerant: assertions use find-semantics for the seeded rows
// (the export is a global ready-library snapshot by design).

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
  seedLinawPendingReviewRecord,
  seedLinawRelationship,
} from '../helpers/linaw-test-util';

/** The test's OWN canonical JSON serializer (INTERCHANGE-SPEC §6) — an
 *  independent implementation for the round-trip check. */
function canonicalJsonLocal(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJsonLocal(v === undefined ? null : v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined && typeof record[k] !== 'function')
      .sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + canonicalJsonLocal(record[k])).join(',') +
      '}'
    );
  }
  return 'null';
}

async function apiRaw(urlPath: string, init?: RequestInit): Promise<Response> {
  return fetch(BASE_URL + urlPath, init);
}

test('linaw export package suite', async (t) => {
  await assertServerReachable();

  // The Sprint-7 additive `rejected` column lands lazily via initSchema — run
  // the real migration on the shared dev DB before seeding.
  const { getDb } = await import('../../src/lib/db');
  getDb();

  const { userId, cookie, cleanup } = seedApprovedUser();
  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  const base = 880_000 + crypto.randomInt(0, 20_000);
  const seededIds: string[] = [];
  const seededRelIds: string[] = [];

  // Two ready rows WITH summaries.
  const sourceId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: base + 1,
    seriesYear: 2021,
    title: 'An ordinance revising the fee schedule',
    summary: 'Revises the municipal fee schedule in plain terms.',
    subjectTags: ['Taxation & Revenue'],
  });
  seededIds.push(sourceId);
  const targetId = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: base + 2,
    seriesYear: 2015,
    title: 'An ordinance setting the base fee schedule',
    summary: 'Sets the base fee schedule for municipal services.',
    subjectTags: ['Taxation & Revenue'],
  });
  seededIds.push(targetId);

  // CONFIRMED relationship between them (amends).
  const confirmedRel = seedLinawRelationship(db, sourceId, targetId, {
    type: 'amends',
    sectionRef: 'Section 2',
    confidence: 0.88,
    confirmed: 1,
    confirmedById: userId,
  });
  seededRelIds.push(confirmedRel);

  // UNCONFIRMED relationship (must never export).
  const unconfirmedRel = seedLinawRelationship(db, sourceId, targetId, {
    type: 'extends',
    confirmed: 0,
  });
  seededRelIds.push(unconfirmedRel);

  // pending_review row (never exportable).
  const pendingId = seedLinawPendingReviewRecord(db, userId, {
    ordinanceNumber: base + 3,
    seriesYear: 2015,
    libraryStatus: 'pending_review',
  });
  seededIds.push(pendingId);

  t.after(() => {
    try {
      for (const id of seededRelIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE id = ?').run(id);
      }
      for (const id of seededIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
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

  await t.test('auth: export requires a session (401 envelope)', async () => {
    const res = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body?.code, 'NO_SESSION');
  });

  let fullPackage: any = null;

  await t.test('full export: manifest + records + confirmed relationships + attachment', async () => {
    const res = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: '{}',
    });
    assert.equal(res.status, 200);
    const disposition = res.headers.get('content-disposition') ?? '';
    assert.match(disposition, /attachment/);
    assert.ok(disposition.includes('esangguni-linaw-l1-package'), disposition);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);

    fullPackage = await res.json();

    // §2 verbatim key set.
    assert.deepEqual(Object.keys(fullPackage).sort(), [
      'manifest',
      'packageHash',
      'records',
      'relationships',
    ]);

    // §3 manifest.
    assert.equal(fullPackage.manifest.module, 'linaw');
    assert.equal(fullPackage.manifest.schemaVersion, '1.0.0');
    assert.equal(fullPackage.manifest.interchangeLevel, 'L1');
    assert.equal(fullPackage.manifest.source.table, 'linaw_ordinances');
    assert.equal(fullPackage.manifest.source.recordCount, fullPackage.records.length);
    assert.equal(fullPackage.manifest.exportedById, userId);
    assert.equal(fullPackage.manifest.exporter.platform, 'esangguni-pilot');

    // §4: seeded ready rows present, pending_review ABSENT.
    const mine = fullPackage.records.filter((r: any) =>
      [base + 1, base + 2].includes(r.ordinanceNumber)
    );
    assert.equal(mine.length, 2);
    assert.ok(!fullPackage.records.some((r: any) => r.sourceRecordId === pendingId));
    const sourceRec = mine.find((r: any) => r.ordinanceNumber === base + 1);
    assert.equal(sourceRec.summary, 'Revises the municipal fee schedule in plain terms.');
    assert.deepEqual(sourceRec.subjectTags, ['Taxation & Revenue']);
  });

  await t.test('relationships array: confirmed-only, number/year keys, no internal ids', async () => {
    assert.ok(Array.isArray(fullPackage.relationships));

    const mine = fullPackage.relationships.filter(
      (rel: any) =>
        rel.sourceOrdinance.ordinanceNumber === base + 1 &&
        rel.targetOrdinance.ordinanceNumber === base + 2
    );
    assert.equal(mine.length, 1, 'exactly the seeded confirmed relationship');
    const rel = mine[0];
    assert.deepEqual(rel.sourceOrdinance, { ordinanceNumber: base + 1, seriesYear: 2021 });
    assert.deepEqual(rel.targetOrdinance, { ordinanceNumber: base + 2, seriesYear: 2015 });
    assert.equal(rel.type, 'amends');
    assert.equal(rel.sectionRef, 'Section 2');
    assert.ok(Math.abs(rel.confidence - 0.88) < 0.001);
    assert.equal(rel.confirmedById, userId);

    // No internal-id-looking fields: entries carry EXACTLY the §5 keys, and
    // the serialization contains neither endpoint UUID.
    assert.deepEqual(Object.keys(rel).sort(), [
      'confidence',
      'confirmedById',
      'sectionRef',
      'sourceOrdinance',
      'targetOrdinance',
      'type',
    ]);
    const relJson = JSON.stringify(fullPackage.relationships);
    assert.ok(!relJson.includes(sourceId), 'source UUID never leaks');
    assert.ok(!relJson.includes(targetId), 'target UUID never leaks');
    assert.ok(!relJson.includes(unconfirmedRel), 'unconfirmed row id never present');
    // The unconfirmed row is absent entirely.
    assert.ok(
      !fullPackage.relationships.some(
        (r: any) =>
          r.type === 'extends' &&
          r.sourceOrdinance.ordinanceNumber === base + 1 &&
          r.targetOrdinance.ordinanceNumber === base + 2
      )
    );
  });

  await t.test('packageHash ROUND-TRIP over HTTP (independent serializer)', async () => {
    assert.match(fullPackage.packageHash, /^sha256:[0-9a-f]{64}$/);
    const recomputed =
      'sha256:' +
      crypto
        .createHash('sha256')
        .update(
          canonicalJsonLocal({
            records: fullPackage.records,
            relationships: fullPackage.relationships,
          })
        )
        .digest('hex');
    assert.equal(recomputed, fullPackage.packageHash, 'hash recomputes from the payload');
  });

  await t.test('filter: one endpoint only → relationship omitted; hash round-trips', async () => {
    const res = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [sourceId] }),
    });
    assert.equal(res.status, 200);
    const filtered = await res.json();

    const mine = filtered.records.filter((r: any) => r.sourceRecordId === sourceId);
    assert.equal(mine.length, 1);
    assert.ok(
      !filtered.relationships.some(
        (rel: any) => rel.sourceOrdinance.ordinanceNumber === base + 1
      ),
      'confirmed relationship omitted — other endpoint filtered out (self-consistency)'
    );
    const recomputed =
      'sha256:' +
      crypto
        .createHash('sha256')
        .update(
          canonicalJsonLocal({ records: filtered.records, relationships: filtered.relationships })
        )
        .digest('hex');
    assert.equal(recomputed, filtered.packageHash);
  });

  await t.test('ineligible id → 409 CONFLICT listing it; [] → valid empty package', async () => {
    const ineligible = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [pendingId] }),
    });
    assert.equal(ineligible.status, 409);
    const ineligibleBody = await ineligible.json();
    assert.equal(ineligibleBody?.code, 'CONFLICT');
    assert.ok(String(ineligibleBody?.error).includes(pendingId), 'ineligible id listed');

    const empty = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [] }),
    });
    assert.equal(empty.status, 200);
    const emptyPackage = await empty.json();
    assert.deepEqual(emptyPackage.records, []);
    assert.deepEqual(emptyPackage.relationships, []);
    assert.equal(emptyPackage.manifest.source.recordCount, 0);
    assert.deepEqual(emptyPackage.manifest.source.yearRange, []);
    const recomputed =
      'sha256:' +
      crypto.createHash('sha256').update(canonicalJsonLocal({ records: [], relationships: [] })).digest('hex');
    assert.equal(recomputed, emptyPackage.packageHash, 'empty package hash deterministic');
  });

  await t.test('invalid ordinanceIds type → 400 INVALID_BODY', async () => {
    const res = await apiRaw('/api/linaw/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: 'not-an-array' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body?.code, 'INVALID_BODY');
  });
});
