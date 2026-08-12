// tests/integration/likha-upload.test.ts
// Sprint 2 (S2-C4) — L001 batch upload API contract test.
// Runs API-level against a running `npm run dev` server (default
// http://localhost:3000, override LIKHA_TEST_BASE_URL). node:test +
// node:assert/strict; relative imports only (no @/ alias).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  assertServerReachable,
  seedApprovedUser,
  readFixture,
  BASE_URL,
} from '../helpers/likha-test-util';

interface UploadFileResult {
  originalFilename: string;
  status: 'accepted' | 'rejected' | 'duplicate';
  recordId?: string;
  fileHash?: string;
  mimeType?: string;
  sizeBytes: number;
  error?: string;
  existingRecordId?: string;
}

interface UploadResponse {
  batchId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  files: UploadFileResult[];
}

const UPLOAD_URL = BASE_URL + '/api/likha/upload';

test('likha upload suite', async (t) => {
  await assertServerReachable();

  const { userId, cookie, cleanup } = seedApprovedUser();

  const pdfBuffer = Uint8Array.from(readFixture('sample-ordinance.pdf'));
  const pngBuffer = Uint8Array.from(readFixture('sample-scan.png'));

  let batchId = '';
  let pdfRecordId = '';
  const recordIds: string[] = [];
  const hashes: string[] = [];

  // Single teardown with explicit FK-safe order: archive rows + audit rows +
  // uploaded files FIRST, then the seeded user (archived_ordinances.uploaded_by_id
  // references users.id).
  t.after(() => {
    try {
      const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
      try {
        for (const id of recordIds) {
          db.prepare('DELETE FROM archived_ordinances WHERE id = ?').run(id);
        }
        if (batchId) {
          db.prepare(
            "DELETE FROM agent_decisions WHERE module = 'likha' AND pipeline_id = ?"
          ).run(batchId);
        }
      } finally {
        db.close();
      }
      const dir = path.join(process.cwd(), 'data', 'uploads', 'likha');
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir)) {
          if (recordIds.some((id) => entry.startsWith(id + '__'))) {
            fs.rmSync(path.join(dir, entry));
          }
        }
      }
    } catch {
      // Best-effort cleanup — never fail the suite on teardown.
    }
    cleanup();
  });

  await t.test('happy path: two files accepted with SHA-256 hashes', async () => {
    const form = new FormData();
    form.append(
      'files',
      new File([pdfBuffer], 'sample-ordinance.pdf', { type: 'application/pdf' })
    );
    form.append(
      'files',
      new File([pngBuffer], 'sample-scan.png', { type: 'image/png' })
    );

    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 200);
    const body = (await res.json()) as UploadResponse;

    assert.equal(typeof body.batchId, 'string');
    assert.equal(body.accepted, 2);
    assert.equal(body.duplicates, 0);
    assert.equal(body.files.length, 2);

    for (const f of body.files) {
      assert.equal(f.status, 'accepted');
      assert.ok(f.recordId, 'recordId present');
      assert.match(f.fileHash ?? '', /^[0-9a-f]{64}$/, '64-char hex SHA-256');
      recordIds.push(f.recordId!);
      hashes.push(f.fileHash!);
    }
    const pdfEntry = body.files.find((f) => f.originalFilename === 'sample-ordinance.pdf');
    assert.ok(pdfEntry, 'pdf entry present');
    pdfRecordId = pdfEntry.recordId!;
    batchId = body.batchId;
  });

  await t.test('duplicate-hash warning links to the existing record', async () => {
    const form = new FormData();
    form.append(
      'files',
      new File([pdfBuffer], 'sample-ordinance-copy.pdf', { type: 'application/pdf' })
    );

    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 200);
    const body = (await res.json()) as UploadResponse;

    assert.equal(body.duplicates, 1);
    const entry = body.files[0];
    assert.equal(entry.status, 'duplicate');
    assert.equal(entry.existingRecordId, pdfRecordId);
  });

  await t.test('11th file rejects the batch (TOO_MANY_FILES)', async () => {
    const form = new FormData();
    for (let i = 0; i < 11; i += 1) {
      form.append('files', new File([pngBuffer], `tiny-${i}.png`, { type: 'image/png' }));
    }

    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, 'TOO_MANY_FILES');
    assert.ok(body.error);
  });

  await t.test('oversize file rejected (FILE_TOO_LARGE)', async () => {
    const form = new FormData();
    const big = new Uint8Array(21 * 1024 * 1024);
    form.append('files', new File([big], 'big.pdf', { type: 'application/pdf' }));

    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, 'FILE_TOO_LARGE');
  });

  await t.test('unsupported MIME type rejected (UNSUPPORTED_TYPE)', async () => {
    const form = new FormData();
    form.append('files', new File([Buffer.from('plain text')], 'note.txt', { type: 'text/plain' }));

    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { cookie }, body: form });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, 'UNSUPPORTED_TYPE');
  });

  await t.test('auth required — 401 NO_SESSION without cookie', async () => {
    const form = new FormData();
    form.append('files', new File([pngBuffer], 'sample-scan.png', { type: 'image/png' }));

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string; code: string };
    assert.deepEqual(body, { error: 'Authentication required', code: 'NO_SESSION' });
  });

  await t.test('DB side effects: processing rows, agent-1 audit, interaction log', async () => {
    const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
    try {
      for (let i = 0; i < recordIds.length; i += 1) {
        const row = db
          .prepare(
            `SELECT archive_status, file_hash, uploaded_by_id, scan_file_path
             FROM archived_ordinances WHERE id = ?`
          )
          .get(recordIds[i]) as {
          archive_status: string;
          file_hash: string;
          uploaded_by_id: string;
          scan_file_path: string;
        } | undefined;

        assert.ok(row, `archived_ordinances row exists for ${recordIds[i]}`);
        assert.equal(row.archive_status, 'processing');
        assert.equal(row.file_hash, hashes[i]);
        assert.equal(row.uploaded_by_id, userId);
        assert.ok(
          row.scan_file_path.startsWith('data/uploads/likha/'),
          `scan path stored under data/uploads/likha/ (got ${row.scan_file_path})`
        );
      }

      const decisions = db
        .prepare(
          `SELECT COUNT(*) as cnt FROM agent_decisions
           WHERE module = 'likha' AND pipeline_id = ? AND agent_id = 1`
        )
        .get(batchId) as { cnt: number };
      assert.ok(decisions.cnt >= 2, 'agent 1 start + complete audit rows');

      const logs = db
        .prepare(
          `SELECT COUNT(*) as cnt FROM interaction_logs
           WHERE module = 'likha' AND interaction_type = 'likha_upload'`
        )
        .get() as { cnt: number };
      assert.ok(logs.cnt >= 1, 'likha_upload interaction log present');
    } finally {
      db.close();
    }
  });
});
