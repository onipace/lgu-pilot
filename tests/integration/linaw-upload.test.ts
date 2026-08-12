// tests/integration/linaw-upload.test.ts
// Sprint 5 (S5-C7) — N014 scan upload API-level suite.
// Runs against a running dev server (npm run dev) with cookie auth. All
// happy-path assertions are CONTRACT-ONLY: they hold with or without an
// OPENROUTER_API_KEY on the server (decision D11 / SPRINT_PLAN risk 7).
// node:test + node:assert/strict, relative imports only.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
  readLinawFixture,
} from '../helpers/linaw-test-util';

const UPLOAD_URL = BASE_URL + '/api/linaw/upload';
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'linaw');

let user: ReturnType<typeof seedApprovedUser>;
let db: Database.Database;

const createdRecordIds: string[] = [];
const createdBatchIds: string[] = [];
const seededRowIds: string[] = [];

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
    // Remove stored scan files for created records.
    for (const id of createdRecordIds) {
      if (!fs.existsSync(UPLOAD_DIR)) continue;
      for (const f of fs.readdirSync(UPLOAD_DIR)) {
        if (f.startsWith(id + '__')) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
      }
    }
  } finally {
    db.close();
    user.cleanup();
  }
});

function fileFrom(buffer: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buffer)], name, { type });
}

async function postFiles(files: File[]): Promise<{ status: number; body: any }> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { cookie: user.cookie },
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

test('linaw upload API suite', async (t) => {
  await t.test('no cookie → 401 NO_SESSION', async () => {
    const form = new FormData();
    form.append('files', fileFrom(readLinawFixture('sample-scan.png'), 'a.png', 'image/png'));
    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'NO_SESSION');
  });

  await t.test('empty form → 400 NO_FILES', async () => {
    const { status, body } = await postFiles([]);
    assert.equal(status, 400);
    assert.equal(body.code, 'NO_FILES');
  });

  await t.test('11 files → 400 TOO_MANY_FILES', async () => {
    const tiny = Buffer.from('png-bytes');
    const files = Array.from({ length: 11 }, (_, i) =>
      fileFrom(tiny, `f${i}.png`, 'image/png')
    );
    const { status, body } = await postFiles(files);
    assert.equal(status, 400);
    assert.equal(body.code, 'TOO_MANY_FILES');
    assert.match(body.error, /Maximum 10 files/);
  });

  await t.test('21 MB file → 400 FILE_TOO_LARGE', async () => {
    const big = Buffer.alloc(21 * 1024 * 1024); // zero-filled
    const { status, body } = await postFiles([fileFrom(big, 'big.png', 'image/png')]);
    assert.equal(status, 400);
    assert.equal(body.code, 'FILE_TOO_LARGE');
    assert.ok(Array.isArray(body.files));
    assert.equal(body.files[0].originalFilename, 'big.png');
  });

  await t.test('text/plain file → 400 UNSUPPORTED_TYPE', async () => {
    const { status, body } = await postFiles([
      fileFrom(Buffer.from('hello'), 'notes.txt', 'text/plain'),
    ]);
    assert.equal(status, 400);
    assert.equal(body.code, 'UNSUPPORTED_TYPE');
    assert.equal(body.files[0].originalFilename, 'notes.txt');
  });

  await t.test('hash duplicate → status duplicate, no new row (no OCR needed)', async () => {
    const png = readLinawFixture('sample-scan.png');
    const hash = crypto.createHash('sha256').update(png).digest('hex');

    const seededId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO linaw_ordinances
         (id, ordinance_number, series_year, title, content, subject_tags,
          source_type, source_filename, file_hash, library_status, uploaded_by_id)
       VALUES (?, ?, ?, ?, '', '[]', 'scan', 'dup-sample.png', ?, 'pending_review', ?)`
    ).run(seededId, -1234567, 0, 'Processing — dup-sample.png', hash, user.userId);
    seededRowIds.push(seededId);

    const countBefore = (
      db
        .prepare('SELECT COUNT(*) AS n FROM linaw_ordinances WHERE file_hash = ?')
        .get(hash) as { n: number }
    ).n;
    assert.equal(countBefore, 1);

    const { status, body } = await postFiles([fileFrom(png, 'dup-sample.png', 'image/png')]);
    assert.equal(status, 200);
    assert.equal(body.duplicates, 1);
    assert.equal(body.accepted, 0);
    assert.equal(body.files.length, 1);
    assert.equal(body.files[0].status, 'duplicate');
    assert.equal(body.files[0].hash, hash);

    const countAfter = (
      db
        .prepare('SELECT COUNT(*) AS n FROM linaw_ordinances WHERE file_hash = ?')
        .get(hash) as { n: number }
    ).n;
    assert.equal(countAfter, 1);
  });

  await t.test('single PNG happy path — contract-only (works with or without API key)', async () => {
    // Unique bytes: the fixture's exact hash is seeded in the duplicate case above.
    const png = Buffer.concat([
      readLinawFixture('sample-scan.png'),
      Buffer.from('-contract-' + crypto.randomUUID()),
    ]);
    const startedAt = Date.now();
    const { status, body } = await postFiles([fileFrom(png, 'contract-sample.png', 'image/png')]);
    assert.equal(status, 200);
    assert.ok(body.batchId);
    if (body.batchId) createdBatchIds.push(body.batchId);
    assert.equal(body.files.length, 1);

    const fileResult = body.files[0];
    assert.ok(['accepted', 'ocr_failed'].includes(fileResult.status));
    assert.ok(fileResult.id);
    assert.equal(fileResult.hash, crypto.createHash('sha256').update(png).digest('hex'));
    createdRecordIds.push(fileResult.id);

    // Row transitioned fully out of processing.
    const row = db
      .prepare('SELECT * FROM linaw_ordinances WHERE id = ?')
      .get(fileResult.id) as Record<string, unknown>;
    assert.equal(row.source_type, 'scan');
    assert.equal(row.library_status, 'pending_review');
    assert.ok(String(row.file_hash).length === 64);
    assert.equal(row.uploaded_by_id, user.userId);

    // Stored file exists at the reconstructed deterministic path.
    const sanitized = 'contract-sample.png'.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedPath = path.join(UPLOAD_DIR, `${fileResult.id}__${sanitized}`);
    assert.ok(fs.existsSync(storedPath));

    // No row left at 'processing' after the response (for this batch window).
    const stuck = db
      .prepare(
        `SELECT COUNT(*) AS n FROM linaw_ordinances
          WHERE library_status = 'processing' AND uploaded_by_id = ?
            AND created_at >= datetime('now', '-10 minutes')`
      )
      .get(user.userId) as { n: number };
    assert.equal(stuck.n, 0);

    // Audit: start + complete pair for the batchId.
    const audits = db
      .prepare(
        `SELECT action, agent_id, agent_name, module FROM agent_decisions
          WHERE pipeline_id = ? ORDER BY created_at`
      )
      .all(body.batchId) as Array<Record<string, unknown>>;
    assert.equal(audits.length, 2);
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[1].action, 'complete');
    for (const a of audits) {
      assert.equal(a.module, 'linaw');
      assert.equal(a.agent_id, 0);
      assert.equal(a.agent_name, 'Ingestion');
    }
    assert.ok(Date.now() - startedAt < 150_000);
  });
});
