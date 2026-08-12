// tests/integration/likha-exports.test.ts
// Sprint 4 (S4-C8) — L010 DILG + L013 L1 export API-level tests.
// Runs against the live dev server (npm run dev) exactly like Sprint-2/3's
// API suites: helper seeds an approved user + session directly into
// data/workshop.db, test rows go in via better-sqlite3, and every seeded row
// + classifications/audit/log row is cleaned up in t.after.
//
// L013 conformance (INTERCHANGE-SPEC v1.0.0 §2–§4 + §6) is verified OVER THE
// WIRE: the packageHash is recomputed from the downloaded payload with the
// test's OWN canonical serializer + node:crypto (round-trip — never trusting
// the emitted hash string alone).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
} from '../helpers/likha-test-util';

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

async function apiRaw(urlPath: string, init?: RequestInit): Promise<Response> {
  return fetch(BASE_URL + urlPath, init);
}

test('likha exports suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 960_000 + crypto.randomInt(0, 30_000);

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    archiveStatus: 'pending_review' | 'published' | 'flagged';
    title?: string;
    content?: string;
    status?: string;
    subjectTags?: string[];
    summary?: string | null;
  }): string {
    const id = crypto.randomUUID();
    seededIds.push(id);
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, summary, section_count,
          subject_tags, status, source_type, original_filename, scan_file_path,
          file_hash, archive_status, extraction_confidence, uploaded_by_id, verified_by_id)
       VALUES (?, ?, ?, ?, ?, ?, 8, ?, ?, 'scan', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      opts.ordinanceNumber,
      opts.seriesYear,
      opts.title ?? 'An ordinance regulating the operation of tricycles for hire',
      opts.content ?? 'Section 1. Title. This ordinance regulates tricycle franchises and fares.',
      opts.summary === undefined ? 'Regulates tricycle franchises and fares.' : opts.summary,
      JSON.stringify(opts.subjectTags ?? []),
      opts.status ?? 'active',
      `ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      `data/uploads/likha/${id}__ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      crypto.createHash('sha256').update(id).digest('hex'),
      opts.archiveStatus,
      JSON.stringify({ ordinanceNumber: 0.95, seriesYear: 0.95, title: 0.9, sectionCount: 0.9 }),
      userId,
      userId
    );
    return id;
  }

  const pubId1 = seedRow({
    ordinanceNumber: base + 1,
    seriesYear: 2019,
    archiveStatus: 'published',
    subjectTags: ['Taxation & Revenue'],
  });
  const pubId2 = seedRow({
    ordinanceNumber: base + 2,
    seriesYear: 2023,
    archiveStatus: 'published',
    status: 'amended',
    subjectTags: [],
    title: 'An ordinance revising the schedule of business permit fees',
  });
  const pubId3 = seedRow({
    ordinanceNumber: base + 3,
    seriesYear: 2024,
    archiveStatus: 'published',
    subjectTags: [],
    title: 'An ordinance appropriating funds for road maintenance',
  });
  const pendingId = seedRow({
    ordinanceNumber: base + 4,
    seriesYear: 2025,
    archiveStatus: 'pending_review',
  });
  const flaggedId = seedRow({
    ordinanceNumber: base + 5,
    seriesYear: 2025,
    archiveStatus: 'flagged',
  });

  // Classification row on pubId1 — the subjectTags union must carry it.
  db.prepare(
    `INSERT INTO classifications (id, ordinance_id, category, confidence, assigned_by)
     VALUES (?, ?, 'Title III - Taxation & Fiscal Affairs', 0.8, 'ai')`
  ).run(crypto.randomUUID(), pubId1);

  function dilgSubmitted(ids: string[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const id of ids) {
      const row = db
        .prepare('SELECT dilg_submitted FROM archived_ordinances WHERE id = ?')
        .get(id) as { dilg_submitted: number };
      out.set(id, row.dilg_submitted);
    }
    return out;
  }

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM classifications WHERE ordinance_id = ?').run(id);
        db.prepare('DELETE FROM archived_ordinances WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'likha' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('likha-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('likha-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('auth: both export routes require a session (401 envelope)', async () => {
    for (const route of ['/api/likha/export-dilg', '/api/likha/export-package']) {
      const res = await apiRaw(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      assert.equal(res.status, 401, route);
      assert.equal(body?.error, 'Authentication required');
      assert.equal(body?.code, 'NO_SESSION');
    }
  });

  await t.test('DILG download (all published) + markers + logging', async () => {
    const res = await apiRaw('/api/likha/export-dilg', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    assert.ok(
      (res.headers.get('content-type') ?? '').includes('application/json'),
      'content-type application/json'
    );
    assert.ok(
      (res.headers.get('content-disposition') ?? '').startsWith(
        'attachment; filename="likha-dilg-mc-2026-041-'
      ),
      'attachment filename prefix'
    );

    const body = await res.json();
    assert.equal(body.manifest.submission, 'DILG MC 2026-041');
    assert.equal(body.manifest.module, 'likha');
    assert.equal(body.manifest.platform, 'esangguni-pilot');
    assert.equal(body.manifest.exportedById, userId);
    assert.ok(!Number.isNaN(Date.parse(body.manifest.exportedAt)), 'exportedAt ISO-8601');
    assert.equal(body.manifest.recordCount, body.records.length);
    // CONCURRENCY NOTE: node's test runner executes test files in parallel
    // against the shared dev DB, so other suites' published rows may appear
    // here. The exact-count contract is covered by the filtered subtest
    // below; the ALL-export contract is: every seeded published row present,
    // pending/flagged excluded, global chronological order.
    assert.ok(body.records.length >= 3, 'at least the 3 seeded published rows');

    const ids = body.records.map((r: any) => r.sourceRecordId);
    for (const id of [pubId1, pubId2, pubId3]) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes(pendingId) && !ids.includes(flaggedId), 'non-published excluded');
    // Chronological submission order over the WHOLE package.
    for (let i = 1; i < body.records.length; i += 1) {
      const a = body.records[i - 1];
      const b = body.records[i];
      assert.ok(
        a.seriesYear < b.seriesYear ||
          (a.seriesYear === b.seriesYear && a.ordinanceNumber <= b.ordinanceNumber),
        'records sorted series_year ASC, ordinance_number ASC'
      );
    }
    for (const rec of body.records) {
      assert.ok(rec.sourceRecordId, 'sourceRecordId carried');
      assert.equal(rec.dilgSubmittedAt, body.manifest.exportedAt, 'shared timestamp');
    }

    // Markers: included rows marked, pending/flagged untouched.
    const markers = dilgSubmitted([pubId1, pubId2, pubId3, pendingId, flaggedId]);
    assert.equal(markers.get(pubId1), 1);
    assert.equal(markers.get(pubId2), 1);
    assert.equal(markers.get(pubId3), 1);
    assert.equal(markers.get(pendingId), 0);
    assert.equal(markers.get(flaggedId), 0);

    const logs = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM interaction_logs
         WHERE module = 'likha' AND interaction_type = 'likha_export_dilg'`
      )
      .get() as { cnt: number };
    assert.ok(logs.cnt >= 1, 'likha_export_dilg logged');
  });

  await t.test('DILG filter + all-or-nothing 409 + empty selection', async () => {
    const one = await apiRaw('/api/likha/export-dilg', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [pubId1] }),
    });
    assert.equal(one.status, 200);
    const oneBody = await one.json();
    assert.equal(oneBody.records.length, 1);
    assert.equal(oneBody.records[0].sourceRecordId, pubId1);

    // 409 — ALL-or-nothing: nothing is marked by a refused export.
    const before = dilgSubmitted([pubId1, pubId2, pubId3, pendingId, flaggedId]);
    const bad = await apiRaw('/api/likha/export-dilg', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [pendingId] }),
    });
    assert.equal(bad.status, 409);
    const badBody = await bad.json();
    assert.equal(badBody.code, 'CONFLICT');
    assert.ok(String(badBody.error).includes(pendingId), 'error names the ineligible id');
    const after = dilgSubmitted([pubId1, pubId2, pubId3, pendingId, flaggedId]);
    for (const id of [pubId1, pubId2, pubId3, pendingId, flaggedId]) {
      assert.equal(after.get(id), before.get(id), `dilg_submitted unchanged for ${id}`);
    }

    const empty = await apiRaw('/api/likha/export-dilg', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [] }),
    });
    assert.equal(empty.status, 200);
    const emptyBody = await empty.json();
    assert.equal(emptyBody.manifest.recordCount, 0);
    assert.deepEqual(emptyBody.records, []);
  });

  await t.test('L1 package verbatim + hash ROUND-TRIP over HTTP', async () => {
    const res = await apiRaw('/api/likha/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    assert.ok(
      (res.headers.get('content-disposition') ?? '').startsWith('attachment; filename="'),
      'Content-Disposition attachment'
    );

    const body = await res.json();

    // §2 package key set — EXACTLY manifest + records + packageHash.
    assert.deepEqual(Object.keys(body).sort(), ['manifest', 'packageHash', 'records']);
    assert.ok(!('relationships' in body), 'LIKHA packages carry no relationship array');

    // §3 manifest.
    assert.equal(body.manifest.schemaVersion, '1.0.0');
    assert.equal(body.manifest.module, 'likha');
    assert.equal(body.manifest.interchangeLevel, 'L1');
    assert.equal(body.manifest.exportedById, userId);
    assert.equal(body.manifest.source.table, 'archived_ordinances');
    assert.equal(body.manifest.source.recordCount, body.records.length);
    assert.equal(body.manifest.exporter.platform, 'esangguni-pilot');
    assert.equal(body.manifest.exporter.appVersion, '1.0.0');

    // §4 records — superset contract under parallel suites (see the DILG
    // subtest's concurrency note); the filtered subtest covers exact counts.
    assert.ok(body.records.length >= 3, 'at least the 3 seeded published rows');
    const l1Ids = body.records.map((r: any) => r.sourceRecordId);
    for (const id of [pubId1, pubId2, pubId3]) assert.ok(l1Ids.includes(id), id);
    assert.ok(!l1Ids.includes(pendingId) && !l1Ids.includes(flaggedId), 'non-published excluded');
    for (const rec of body.records) {
      assert.deepEqual(Object.keys(rec).sort(), RECORD_KEYS, 'exactly the §4 keys');
    }
    // §3 yearRange = [min, max] of the exported series years.
    const exportedYears = body.records.map((r: any) => r.seriesYear);
    assert.deepEqual(body.manifest.source.yearRange, [
      Math.min(...exportedYears),
      Math.max(...exportedYears),
    ]);
    const tagged = body.records.find((r: any) => r.sourceRecordId === pubId1);
    assert.ok(tagged, 'tagged record present');
    assert.ok(tagged.subjectTags.includes('Taxation & Revenue'), 'row tag present');
    assert.ok(
      tagged.subjectTags.includes('Title III - Taxation & Fiscal Affairs'),
      'classifications label in the union'
    );

    // §6 ROUND-TRIP: recompute from the downloaded payload with the test's
    // OWN canonical serializer — never trust the emitted hash string alone.
    assert.match(body.packageHash, /^sha256:[0-9a-f]{64}$/);
    const recomputed = 'sha256:' + sha256Hex(canonical({ records: body.records }));
    assert.equal(recomputed, body.packageHash, 'hash round-trips over HTTP');

    const logs = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM interaction_logs
         WHERE module = 'likha' AND interaction_type = 'likha_export_package'`
      )
      .get() as { cnt: number };
    assert.ok(logs.cnt >= 1, 'likha_export_package logged');
  });

  await t.test('L1 filter + 409 + empty package (deterministic hash)', async () => {
    const one = await apiRaw('/api/likha/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [pubId2] }),
    });
    assert.equal(one.status, 200);
    const oneBody = await one.json();
    assert.equal(oneBody.records.length, 1);
    assert.equal(oneBody.records[0].sourceRecordId, pubId2);
    const recomputedOne = 'sha256:' + sha256Hex(canonical({ records: oneBody.records }));
    assert.equal(recomputedOne, oneBody.packageHash, 'filtered hash round-trips');

    const bad = await apiRaw('/api/likha/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [flaggedId] }),
    });
    assert.equal(bad.status, 409);
    const badBody = await bad.json();
    assert.equal(badBody.code, 'CONFLICT');
    assert.ok(String(badBody.error).includes(flaggedId), 'error names the ineligible id');

    const empty = await apiRaw('/api/likha/export-package', {
      method: 'POST',
      headers: authed.headers,
      body: JSON.stringify({ ordinanceIds: [] }),
    });
    assert.equal(empty.status, 200);
    const emptyBody = await empty.json();
    assert.deepEqual(emptyBody.records, []);
    assert.equal(emptyBody.manifest.source.recordCount, 0);
    assert.deepEqual(emptyBody.manifest.source.yearRange, []);
    assert.equal(
      emptyBody.packageHash,
      'sha256:' + sha256Hex(canonical({ records: [] })),
      'empty package hash = sha256 of canonical {"records":[]}'
    );
    assert.ok(!('relationships' in emptyBody), 'no relationship array in the empty package');
  });
});
