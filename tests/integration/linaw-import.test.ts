// tests/integration/linaw-import.test.ts
// Sprint 5 (S5-C5) — N013 bulk text import API-level suite.
// Runs against a running dev server (npm run dev) with cookie auth seeded
// directly into data/workshop.db. node:test + node:assert/strict, relative
// imports only (no @/ alias). Teardown removes every row this suite creates.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
  buildMinimalDocx,
} from '../helpers/linaw-test-util';

const IMPORT_URL = BASE_URL + '/api/linaw/import';

let user: ReturnType<typeof seedApprovedUser>;
let db: Database.Database;

const createdRecordIds: string[] = [];
const createdBatchIds: string[] = [];
const seededRowIds: string[] = [];

function trackImported(body: { records?: Array<{ id: string }>; batchId?: string }) {
  if (body.batchId) createdBatchIds.push(body.batchId);
  for (const rec of body.records ?? []) createdRecordIds.push(rec.id);
}

function validRecord(ord: number, series: number, tag?: string) {
  return {
    ordinanceNumber: ord,
    seriesYear: series,
    title: `An ordinance ${ord} of series ${series}`,
    content: `Section 1. Title. Body of ordinance ${ord}-${series}.`,
    subjectTags: tag ? [tag] : [],
  };
}

before(async () => {
  await assertServerReachable();
  user = seedApprovedUser();
  db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
});

after(() => {
  try {
    const delOrd = db.prepare('DELETE FROM linaw_ordinances WHERE id = ?');
    for (const id of [...createdRecordIds, ...seededRowIds]) delOrd.run(id);
    const delAudit = db.prepare('DELETE FROM agent_decisions WHERE pipeline_id = ?');
    for (const batchId of createdBatchIds) delAudit.run(batchId);
  } finally {
    db.close();
    user.cleanup();
  }
});

test('linaw import API suite', async (t) => {
  await t.test('no cookie → 401 NO_SESSION', async () => {
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([validRecord(901, 1991)]),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'NO_SESSION');
  });

  await t.test('JSON {records:[2 valid]} → 200, imported 2, rows persisted', async () => {
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({ records: [validRecord(902, 1992), validRecord(903, 1993)] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 2);
    assert.equal(body.skippedDuplicates, 0);
    assert.equal(body.records.length, 2);
    assert.ok(body.batchId);
    trackImported(body);

    for (const rec of body.records) {
      assert.equal(rec.library_status, 'pending_review');
      const row = db
        .prepare('SELECT * FROM linaw_ordinances WHERE id = ?')
        .get(rec.id) as Record<string, unknown>;
      assert.equal(row.source_type, 'import');
      assert.equal(row.library_status, 'pending_review');
      assert.equal(row.uploaded_by_id, user.userId);
    }

    // Audit: start + complete pair (module='linaw', agent_id=0, agent_name='Ingestion').
    const audits = db
      .prepare(
        `SELECT action, agent_id, agent_name, module FROM agent_decisions
          WHERE pipeline_id = ? ORDER BY created_at`
      )
      .all(body.batchId) as Array<Record<string, unknown>>;
    assert.equal(audits.length, 2);
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[1].action, 'complete');
    for (const row of audits) {
      assert.equal(row.module, 'linaw');
      assert.equal(row.agent_id, 0);
      assert.equal(row.agent_name, 'Ingestion');
    }
  });

  await t.test('duplicate WITHIN batch → imported 1, skippedDuplicates 1', async () => {
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify([validRecord(904, 1994), validRecord(904, 1994)]),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 1);
    assert.equal(body.skippedDuplicates, 1);
    trackImported(body);
  });

  await t.test('duplicate against pre-existing DB row → skipped', async () => {
    const seededId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO linaw_ordinances
         (id, ordinance_number, series_year, title, content, subject_tags,
          source_type, library_status, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, '[]', 'manual', 'ready', ?)`
    ).run(seededId, 905, 1995, 'Pre-existing ordinance', 'Body.', user.userId);
    seededRowIds.push(seededId);

    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify([validRecord(905, 1995)]),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 0);
    assert.equal(body.skippedDuplicates, 1);
    trackImported(body);
  });

  await t.test('501-record JSON array → 400 TOO_MANY_RECORDS, zero rows inserted', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => validRecord(2000 + i, 2100));
    const countBefore = (
      db
        .prepare('SELECT COUNT(*) AS n FROM linaw_ordinances WHERE uploaded_by_id = ?')
        .get(user.userId) as { n: number }
    ).n;

    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify(rows),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'TOO_MANY_RECORDS');

    const countAfter = (
      db
        .prepare('SELECT COUNT(*) AS n FROM linaw_ordinances WHERE uploaded_by_id = ?')
        .get(user.userId) as { n: number }
    ).n;
    assert.equal(countAfter, countBefore);
  });

  await t.test('CSV body (text/csv, quoted commas) → imported', async () => {
    const csv = [
      'ordinanceNumber,seriesYear,title,content,subjectTags',
      '906,1996,"An ordinance on permits, licenses","Section 1. Body.",permits',
    ].join('\n');
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', cookie: user.cookie },
      body: csv,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 1);
    trackImported(body);
    const row = db
      .prepare('SELECT title, subject_tags FROM linaw_ordinances WHERE id = ?')
      .get(body.records[0].id) as { title: string; subject_tags: string };
    assert.equal(row.title, 'An ordinance on permits, licenses');
    assert.deepEqual(JSON.parse(row.subject_tags), ['permits']);
  });

  await t.test('DOCX multipart (JSON-shaped text) → imported (D1 end-to-end)', async () => {
    const docx = buildMinimalDocx(
      JSON.stringify([validRecord(907, 1997, 'docx'), validRecord(908, 1998)])
    );
    const form = new FormData();
    form.append('file', new File([new Uint8Array(docx)], 'batch.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));

    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { cookie: user.cookie },
      body: form,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 2);
    assert.equal(body.skippedDuplicates, 0);
    trackImported(body);
  });

  await t.test('invalid-record report: bad year row collected, valid rows import', async () => {
    const payload = [validRecord(909, 1999), { ...validRecord(910, 2000), seriesYear: 0 }];
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.imported, 1);
    assert.equal(body.invalidRecords.length, 1);
    assert.equal(body.invalidRecords[0].index, 1);
    assert.match(body.invalidRecords[0].error, /seriesYear must be a positive integer/);
    trackImported(body);
  });

  await t.test('unsupported .xlsx file → 400 UNSUPPORTED_FORMAT', async () => {
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array(Buffer.from('not really xlsx'))], 'batch.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    const res = await fetch(IMPORT_URL, {
      method: 'POST',
      headers: { cookie: user.cookie },
      body: form,
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'UNSUPPORTED_FORMAT');
  });
});
