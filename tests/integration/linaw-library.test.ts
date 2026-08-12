// tests/integration/linaw-library.test.ts
// Sprint 5 (S5-C8) — LINAW library API-level suite: list/search, manual
// create (+409 duplicate), detail + authenticated scan stream, and the
// approve/reject/edit verification lifecycle (persistence + audit rows).
// Runs against a running dev server. node:test + node:assert/strict,
// relative imports only.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
  seedLinawPendingReviewRecord,
  readLinawFixture,
} from '../helpers/linaw-test-util';

const LIBRARY_URL = BASE_URL + '/api/linaw/library';
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'linaw');

let user: ReturnType<typeof seedApprovedUser>;
let db: Database.Database;

const rowIds: string[] = [];
const auditPipelineIds: string[] = [];
let scanFilePath: string | null = null;
let scanRowId: string;
let manualRowId: string;
let rejectRowId: string;
let editRowId: string;

before(async () => {
  await assertServerReachable();
  user = seedApprovedUser();
  db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));

  // Manual-shaped pending rows for approve / reject / edit cases.
  manualRowId = seedLinawPendingReviewRecord(db, user.userId, {
    ordinanceNumber: 77,
    seriesYear: 2031,
    sourceType: 'import',
    sourceFilename: null,
    fileHash: null,
    title: 'An ordinance establishing zebrafolio kiosks',
    content: 'Section 1. Title. Zebrafolio kiosks for the municipal plaza.',
  });
  rejectRowId = seedLinawPendingReviewRecord(db, user.userId, {
    ordinanceNumber: 78,
    seriesYear: 2031,
    sourceType: 'import',
    sourceFilename: null,
    fileHash: null,
    title: 'An ordinance on reject-case fees',
    content: 'Section 1. Title. Fees.',
  });
  editRowId = seedLinawPendingReviewRecord(db, user.userId, {
    ordinanceNumber: 79,
    seriesYear: 2031,
    sourceType: 'import',
    sourceFilename: null,
    fileHash: null,
    title: 'An ordinance on edit-case rules',
    content: 'Section 1. Title. Rules.',
  });

  // Scan-shaped pending row WITH a real stored file at the deterministic path.
  scanRowId = seedLinawPendingReviewRecord(db, user.userId, {
    ordinanceNumber: 81,
    seriesYear: 2031,
    sourceType: 'scan',
    sourceFilename: 'scan-sample.png',
    fileHash: 'ab12'.repeat(16),
    title: 'An ordinance with a stored scan',
    content: 'Section 1. Title. Scanned record.',
  });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  scanFilePath = path.join(UPLOAD_DIR, scanRowId + '__scan-sample.png');
  fs.writeFileSync(scanFilePath, readLinawFixture('sample-scan.png'));

  rowIds.push(manualRowId, rejectRowId, editRowId, scanRowId);
});

after(() => {
  try {
    const delOrd = db.prepare('DELETE FROM linaw_ordinances WHERE id = ?');
    for (const id of rowIds) delOrd.run(id);
    const delAudit = db.prepare('DELETE FROM agent_decisions WHERE pipeline_id = ?');
    for (const pid of auditPipelineIds) delAudit.run(pid);
    if (scanFilePath) fs.rmSync(scanFilePath, { force: true });
  } finally {
    db.close();
    user.cleanup();
  }
});

const AUTH = () => ({ cookie: user.cookie });

test('linaw library API suite', async (t) => {
  await t.test('401s without cookie: GET list, PUT create, PUT [id], GET scan', async () => {
    const list = await fetch(LIBRARY_URL);
    assert.equal(list.status, 401);
    const create = await fetch(LIBRARY_URL, { method: 'PUT', body: '{}' });
    assert.equal(create.status, 401);
    const decide = await fetch(LIBRARY_URL + '/' + manualRowId, { method: 'PUT', body: '{}' });
    assert.equal(decide.status, 401);
    const scan = await fetch(LIBRARY_URL + '/' + scanRowId + '/scan');
    assert.equal(scan.status, 401);
  });

  await t.test('PUT create happy → 201 manual/pending_review; audit row written', async () => {
    const res = await fetch(LIBRARY_URL, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ordinanceNumber: 80,
        seriesYear: 2031,
        title: 'An ordinance on manual entries',
        content: 'Section 1. Title. Manual entry body.',
        subjectTags: ['manual'],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.record.id);
    rowIds.push(body.record.id);
    auditPipelineIds.push('manual-' + body.record.id);

    const row = db
      .prepare('SELECT * FROM linaw_ordinances WHERE id = ?')
      .get(body.record.id) as Record<string, unknown>;
    assert.equal(row.source_type, 'manual');
    assert.equal(row.library_status, 'pending_review');

    const audits = db
      .prepare(`SELECT agent_name, action FROM agent_decisions WHERE pipeline_id = ?`)
      .all('manual-' + body.record.id) as Array<Record<string, unknown>>;
    assert.equal(audits.length, 1);
    assert.equal(audits[0].agent_name, 'Ingestion');
    assert.equal(audits[0].action, 'complete');
  });

  await t.test('PUT create same (ord#, series) again → 409 CONFLICT', async () => {
    const res = await fetch(LIBRARY_URL, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ordinanceNumber: 80,
        seriesYear: 2031,
        title: 'Duplicate pair',
        content: 'Body.',
      }),
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'CONFLICT');
  });

  await t.test('PUT create invalid (year 0) → 400', async () => {
    const res = await fetch(LIBRARY_URL, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ordinanceNumber: 82,
        seriesYear: 0,
        title: 'Bad year',
        content: 'Body.',
      }),
    });
    assert.equal(res.status, 400);
  });

  await t.test('GET list: filter, search q, invalid status → 400', async () => {
    const list = await fetch(LIBRARY_URL + '?libraryStatus=pending_review&limit=100', {
      headers: AUTH(),
    });
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(typeof body.total === 'number');
    assert.equal(body.page, 1);
    assert.ok(typeof body.limit === 'number');
    assert.ok(typeof body.tookMs === 'number');

    const ids = body.items.map((i: { id: string }) => i.id);
    for (const seeded of [manualRowId, scanRowId, rejectRowId, editRowId]) {
      assert.ok(ids.includes(seeded), `seeded row ${seeded} should be listed`);
    }
    for (const item of body.items) {
      assert.equal(item.libraryStatus, 'pending_review');
      assert.ok(typeof item.ordinanceNumber === 'number');
      assert.ok(typeof item.snippet === 'string');
    }

    const search = await fetch(LIBRARY_URL + '?q=zebrafolio', { headers: AUTH() });
    assert.equal(search.status, 200);
    const searchBody = await search.json();
    assert.ok(searchBody.items.some((i: { id: string }) => i.id === manualRowId));
    // Wildcards are escaped — a literal % must not match everything.
    const wildcard = await fetch(LIBRARY_URL + '?q=%25', { headers: AUTH() });
    assert.equal(wildcard.status, 200);
    assert.equal((await wildcard.json()).items.length, 0);

    const bogus = await fetch(LIBRARY_URL + '?libraryStatus=bogus', { headers: AUTH() });
    assert.equal(bogus.status, 400);
  });

  await t.test('GET detail: scan row exposes scan stream; unknown id → 404', async () => {
    const res = await fetch(LIBRARY_URL + '/' + scanRowId, { headers: AUTH() });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.record.id, scanRowId);
    assert.equal(body.scanAvailable, true);
    assert.equal(body.scanMimeType, 'image/png');
    assert.ok(String(body.scanUrl).endsWith('/scan'));

    const scan = await fetch(LIBRARY_URL + '/' + scanRowId + '/scan', { headers: AUTH() });
    assert.equal(scan.status, 200);
    assert.equal(scan.headers.get('content-type'), 'image/png');
    assert.match(scan.headers.get('content-disposition') ?? '', /inline/);
    const bytes = Buffer.from(await scan.arrayBuffer());
    assert.deepEqual(bytes, readLinawFixture('sample-scan.png'));

    const missing = await fetch(LIBRARY_URL + '/no-such-id', { headers: AUTH() });
    assert.equal(missing.status, 404);
  });

  await t.test('approve → ready + verified_by_id + audit confirm; double-approve → 409', async () => {
    const detail = await fetch(LIBRARY_URL + '/' + manualRowId, { headers: AUTH() });
    const { record } = await detail.json();
    auditPipelineIds.push('verification-' + manualRowId);

    const res = await fetch(LIBRARY_URL + '/' + manualRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', expectedUpdatedAt: record.updatedAt }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.libraryStatus, 'ready');

    const row = db
      .prepare('SELECT library_status, verified_by_id FROM linaw_ordinances WHERE id = ?')
      .get(manualRowId) as Record<string, unknown>;
    assert.equal(row.library_status, 'ready');
    assert.equal(row.verified_by_id, user.userId);

    const audits = db
      .prepare(
        `SELECT module, agent_name, action, user_id FROM agent_decisions WHERE pipeline_id = ?`
      )
      .all('verification-' + manualRowId) as Array<Record<string, unknown>>;
    assert.equal(audits.length, 1);
    assert.equal(audits[0].module, 'linaw');
    assert.equal(audits[0].agent_name, 'Library Verification');
    assert.equal(audits[0].action, 'confirm');
    assert.equal(audits[0].user_id, user.userId);

    const again = await fetch(LIBRARY_URL + '/' + manualRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(again.status, 409);
  });

  await t.test('reject: reason required (400), then rejected + reason audited', async () => {
    auditPipelineIds.push('verification-' + rejectRowId);

    const noReason = await fetch(LIBRARY_URL + '/' + rejectRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    assert.equal(noReason.status, 400);

    const withReason = await fetch(LIBRARY_URL + '/' + rejectRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: 'Duplicate of Ord. 77' }),
    });
    assert.equal(withReason.status, 200);
    assert.equal((await withReason.json()).libraryStatus, 'rejected');

    const row = db
      .prepare('SELECT library_status FROM linaw_ordinances WHERE id = ?')
      .get(rejectRowId) as Record<string, unknown>;
    assert.equal(row.library_status, 'rejected');

    const audit = db
      .prepare('SELECT action, reason FROM agent_decisions WHERE pipeline_id = ?')
      .all('verification-' + rejectRowId) as Array<{ action: string; reason: string | null }>;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, 'reject');
    assert.equal(audit[0].reason, 'Duplicate of Ord. 77');
  });

  await t.test('edit: persists + stays pending_review; collision → 409', async () => {
    auditPipelineIds.push('verification-' + editRowId);

    const edit = await fetch(LIBRARY_URL + '/' + editRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        fields: { title: 'Corrected edit-case title', content: 'Corrected content body.' },
      }),
    });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).libraryStatus, 'pending_review');

    const row = db
      .prepare('SELECT title, content, library_status FROM linaw_ordinances WHERE id = ?')
      .get(editRowId) as Record<string, unknown>;
    assert.equal(row.title, 'Corrected edit-case title');
    assert.equal(row.content, 'Corrected content body.');
    assert.equal(row.library_status, 'pending_review');

    const collision = await fetch(LIBRARY_URL + '/' + editRowId, {
      method: 'PUT',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', fields: { ordinanceNumber: 77, seriesYear: 2031 } }),
    });
    assert.equal(collision.status, 409);
  });
});
