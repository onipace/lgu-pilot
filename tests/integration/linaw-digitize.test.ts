// tests/integration/linaw-digitize.test.ts
// Sprint 5 (S5-C6) — N014 digitize chain + manual entry + verification
// decisions (HERMETIC, in-process). No server, no network: DB_PATH points at
// a fresh temp DB set BEFORE the dynamic imports; OCR + LLM are injected
// stubs. node:test + node:assert/strict, relative imports only.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tempDbPath } from '../helpers/linaw-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

const createdFiles: string[] = [];

after(() => {
  for (const f of createdFiles) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      // best-effort cleanup of test artifacts
    }
  }
  try {
    fs.rmSync(DB_FILE, { force: true });
    fs.rmSync(DB_FILE + '-wal', { force: true });
    fs.rmSync(DB_FILE + '-shm', { force: true });
  } catch {
    // best-effort
  }
});

const OCR_TEXT =
  'Ordinance No. 9, Series of 2020\n' +
  'An ordinance establishing the municipal night market\n' +
  'Section 1. Title.';

const METADATA_JSON = JSON.stringify({
  ordinanceNumber: 9,
  seriesYear: 2020,
  title: 'An ordinance establishing the municipal night market',
  confidence: { ordinanceNumber: 0.93, seriesYear: 0.95, title: 0.88 },
});

test('linaw digitize chain suite', async (t) => {
  // Dynamic imports AFTER DB_PATH is set.
  const { getDb } = await import('../../src/lib/db');
  const ingest = await import('../../src/lib/linaw/ingest');
  const { OcrTimeoutError } = await import('../../src/lib/linaw/ocr');
  const { parseLinawMetadataResponse } = await import('../../src/lib/linaw/prompts');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `digitize-test-${Date.now()}@example.com`,
    'test-not-used',
    'Digitize Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  const stubOcr = async () => ({ text: OCR_TEXT, model: 'stub', attempts: 1 });
  const stubLlm = async () => METADATA_JSON;

  function rowFor(id: string) {
    return db
      .prepare('SELECT * FROM linaw_ordinances WHERE id = ?')
      .get(id) as Record<string, unknown>;
  }

  await t.test('happy chain → pending_review with real metadata + OCR content + stored file', async () => {
    const buffer = Buffer.from('scan-bytes-1');
    const result = await ingest.digitizeScanFile({
      buffer,
      mimeType: 'image/png',
      filename: 'ord-09-s2020.png',
      uploadedById: userId,
      db,
      ocr: stubOcr,
      llm: stubLlm,
    });
    assert.equal(result.status, 'accepted');
    assert.ok(result.id);
    assert.equal(result.hash, crypto.createHash('sha256').update(buffer).digest('hex'));
    assert.equal(result.ordinanceNumber, 9);
    assert.equal(result.seriesYear, 2020);
    assert.equal(result.title, 'An ordinance establishing the municipal night market');
    assert.deepEqual(result.confidence, { ordinanceNumber: 0.93, seriesYear: 0.95, title: 0.88 });

    const row = rowFor(result.id!);
    assert.equal(row.library_status, 'pending_review');
    assert.equal(row.source_type, 'scan');
    assert.equal(row.ordinance_number, 9);
    assert.equal(row.series_year, 2020);
    assert.equal(row.content, OCR_TEXT);

    const storedPath = path.join(process.cwd(), ingest.linawScanRelPath(result.id!, 'ord-09-s2020.png'));
    createdFiles.push(storedPath);
    assert.ok(fs.existsSync(storedPath));
    assert.deepEqual(fs.readFileSync(storedPath), buffer);
  });

  await t.test('hash duplicate → status duplicate, still one row', async () => {
    const buffer = Buffer.from('scan-bytes-1'); // same bytes as case 1
    const before = (
      db.prepare('SELECT COUNT(*) AS n FROM linaw_ordinances').get() as { n: number }
    ).n;
    const result = await ingest.digitizeScanFile({
      buffer,
      mimeType: 'image/png',
      filename: 'ord-09-s2020-copy.png',
      uploadedById: userId,
      db,
      ocr: stubOcr,
      llm: stubLlm,
    });
    assert.equal(result.status, 'duplicate');
    assert.equal(result.id, undefined);
    const afterCount = (
      db.prepare('SELECT COUNT(*) AS n FROM linaw_ordinances').get() as { n: number }
    ).n;
    assert.equal(afterCount, before);
  });

  await t.test('metadata collision → duplicate_metadata, placeholder row deleted, file removed', async () => {
    const buffer = Buffer.from('scan-bytes-2');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // First upload establishes (9, 2020) — seed a conflicting second buffer.
    const result = await ingest.digitizeScanFile({
      buffer,
      mimeType: 'application/pdf',
      filename: 'colliding.pdf',
      uploadedById: userId,
      db,
      ocr: stubOcr, // stub still parses to (9, 2020)
      llm: stubLlm,
    });
    assert.equal(result.status, 'duplicate_metadata');
    assert.equal(result.hash, hash);

    // Placeholder row must be gone, and no stored file left behind.
    const rows = db
      .prepare('SELECT id, source_filename FROM linaw_ordinances WHERE file_hash = ?')
      .all(hash) as Array<{ id: string; source_filename: string }>;
    assert.equal(rows.length, 0);
    const dir = path.join(process.cwd(), 'data', 'uploads', 'linaw');
    const leftover = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith('__colliding.pdf'))
      : [];
    assert.deepEqual(leftover, []);
  });

  await t.test('OCR failure → row pending_review with placeholders + empty content, status ocr_failed', async () => {
    const buffer = Buffer.from('scan-bytes-3');
    const failingOcr = async (): Promise<{ text: string; model: string; attempts: number }> => {
      throw new OcrTimeoutError();
    };
    const result = await ingest.digitizeScanFile({
      buffer,
      mimeType: 'image/jpeg',
      filename: 'timeout-scan.jpg',
      uploadedById: userId,
      db,
      ocr: failingOcr,
      llm: stubLlm,
    });
    assert.equal(result.status, 'ocr_failed');
    assert.ok(result.id);
    assert.match(result.error ?? '', /timed out/i);

    const row = rowFor(result.id!);
    assert.equal(row.library_status, 'pending_review');
    assert.equal(row.content, '');
    assert.equal(row.series_year, 0);
    assert.ok((row.ordinance_number as number) < 0);
    assert.match(String(row.title), /^Processing — timeout-scan\.jpg$/);

    const storedPath = path.join(process.cwd(), ingest.linawScanRelPath(result.id!, 'timeout-scan.jpg'));
    createdFiles.push(storedPath);
    assert.ok(fs.existsSync(storedPath)); // file kept for the human reviewer
  });

  await t.test('LLM garbage → accepted with placeholders + OCR content present', async () => {
    const buffer = Buffer.from('scan-bytes-4');
    const result = await ingest.digitizeScanFile({
      buffer,
      mimeType: 'image/png',
      filename: 'garbage-parse.png',
      uploadedById: userId,
      db,
      ocr: stubOcr,
      llm: async () => 'not json',
    });
    assert.equal(result.status, 'accepted');
    assert.equal(result.ordinanceNumber, undefined);

    const row = rowFor(result.id!);
    assert.equal(row.library_status, 'pending_review');
    assert.equal(row.content, OCR_TEXT);
    assert.equal(row.series_year, 0);
    assert.ok((row.ordinance_number as number) < 0);

    const storedPath = path.join(process.cwd(), ingest.linawScanRelPath(result.id!, 'garbage-parse.png'));
    createdFiles.push(storedPath);
  });

  await t.test('parseLinawMetadataResponse never throws on garbage', () => {
    const zero = { ordinanceNumber: 0, seriesYear: 0, title: '' };
    for (const garbage of ['```json garbage', '', 'null', '[1,2]', '{"ordinanceNumber": "x"']) {
      const parsed = parseLinawMetadataResponse(garbage);
      assert.equal(parsed.ordinanceNumber, zero.ordinanceNumber);
      assert.equal(parsed.seriesYear, zero.seriesYear);
      assert.equal(parsed.title, '');
    }
    const parsed = parseLinawMetadataResponse('```json\n' + METADATA_JSON + '\n```');
    assert.equal(parsed.ordinanceNumber, 9);
    assert.equal(parsed.seriesYear, 2020);
  });

  await t.test('createManualRecord: happy / invalid / conflict', () => {
    const happy = ingest.createManualRecord({
      userId,
      db,
      fields: {
        ordinanceNumber: 30,
        seriesYear: 2022,
        title: 'An ordinance on solid waste',
        content: 'Section 1. Title.',
        subjectTags: ['environment'],
      },
    });
    assert.equal(happy.ok, true);
    if (happy.ok) {
      assert.equal(happy.record.sourceType, 'manual');
      assert.equal(happy.record.libraryStatus, 'pending_review');
      const row = rowFor(happy.record.id);
      assert.equal(row.source_type, 'manual');
    }

    const invalid = ingest.createManualRecord({
      userId,
      db,
      fields: { ordinanceNumber: 0, seriesYear: 2022, title: 'X', content: 'Y' },
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.kind, 'invalid');

    const conflict = ingest.createManualRecord({
      userId,
      db,
      fields: {
        ordinanceNumber: 30,
        seriesYear: 2022,
        title: 'Duplicate pair',
        content: 'Body.',
      },
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.kind, 'conflict');
      assert.match(conflict.error, /already exists/);
    }
  });

  await t.test('applyLibraryDecision: approve / reject / edit semantics + audit rows', () => {
    // Seed two pending_review records.
    const mk = (ord: number) => {
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO linaw_ordinances
           (id, ordinance_number, series_year, title, content, subject_tags,
            source_type, library_status, uploaded_by_id)
         VALUES (?, ?, ?, ?, ?, '[]', 'import', 'pending_review', ?)`
      ).run(id, ord, 2010, `Ordinance ${ord}`, 'Body.', userId);
      return id;
    };
    const recA = mk(40);
    const recB = mk(41);
    const recC = mk(42);

    // Approve → ready + verified_by_id + audit 'confirm'.
    const approve = ingest.applyLibraryDecision({
      recordId: recA,
      userId,
      db,
      body: { action: 'approve' },
    });
    assert.equal(approve.ok, true);
    if (approve.ok) assert.equal(approve.response.libraryStatus, 'ready');
    const rowA = rowFor(recA);
    assert.equal(rowA.library_status, 'ready');
    assert.equal(rowA.verified_by_id, userId);
    const auditA = db
      .prepare(
        `SELECT module, agent_id, agent_name, action, user_id, pipeline_id
           FROM agent_decisions WHERE pipeline_id = ?`
      )
      .all('verification-' + recA) as Array<Record<string, unknown>>;
    assert.equal(auditA.length, 1);
    assert.equal(auditA[0].module, 'linaw');
    assert.equal(auditA[0].agent_name, 'Library Verification');
    assert.equal(auditA[0].action, 'confirm');
    assert.equal(auditA[0].user_id, userId);

    // Approve again → conflict (already finalized).
    const reApprove = ingest.applyLibraryDecision({
      recordId: recA,
      userId,
      db,
      body: { action: 'approve' },
    });
    assert.equal(reApprove.ok, false);
    if (!reApprove.ok) assert.equal(reApprove.kind, 'conflict');

    // Reject without reason → invalid.
    const noReason = ingest.applyLibraryDecision({
      recordId: recB,
      userId,
      db,
      body: { action: 'reject' },
    });
    assert.equal(noReason.ok, false);
    if (!noReason.ok) assert.equal(noReason.kind, 'invalid');

    // Reject with reason → rejected + reason persisted in agent_decisions.reason.
    const reject = ingest.applyLibraryDecision({
      recordId: recB,
      userId,
      db,
      body: { action: 'reject', reason: 'Duplicate of an earlier record' },
    });
    assert.equal(reject.ok, true);
    if (reject.ok) assert.equal(reject.response.libraryStatus, 'rejected');
    assert.equal(rowFor(recB).library_status, 'rejected');
    const auditB = db
      .prepare('SELECT action, reason FROM agent_decisions WHERE pipeline_id = ?')
      .all('verification-' + recB) as Array<{ action: string; reason: string | null }>;
    assert.equal(auditB.length, 1);
    assert.equal(auditB[0].action, 'reject');
    assert.equal(auditB[0].reason, 'Duplicate of an earlier record');

    // Rejected row can never become ready.
    const approveRejected = ingest.applyLibraryDecision({
      recordId: recB,
      userId,
      db,
      body: { action: 'approve' },
    });
    assert.equal(approveRejected.ok, false);
    if (!approveRejected.ok) assert.equal(approveRejected.kind, 'conflict');

    // Edit title+content → persists, stays pending_review.
    const edit = ingest.applyLibraryDecision({
      recordId: recC,
      userId,
      db,
      body: {
        action: 'edit',
        fields: { title: 'Corrected title', content: 'Corrected content.' },
      },
    });
    assert.equal(edit.ok, true);
    if (edit.ok) assert.equal(edit.response.libraryStatus, 'pending_review');
    const rowC = rowFor(recC);
    assert.equal(rowC.title, 'Corrected title');
    assert.equal(rowC.content, 'Corrected content.');
    assert.equal(rowC.library_status, 'pending_review');

    // Edit onto an existing (ord#, series) pair → conflict.
    const collidingEdit = ingest.applyLibraryDecision({
      recordId: recC,
      userId,
      db,
      body: { action: 'edit', fields: { ordinanceNumber: 40, seriesYear: 2010 } },
    });
    assert.equal(collidingEdit.ok, false);
    if (!collidingEdit.ok) assert.equal(collidingEdit.kind, 'conflict');

    // expectedUpdatedAt mismatch → conflict.
    const stale = ingest.applyLibraryDecision({
      recordId: recC,
      userId,
      db,
      body: { action: 'approve', expectedUpdatedAt: '2000-01-01 00:00:00' },
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.kind, 'conflict');

    // Missing record → not_found.
    const missing = ingest.applyLibraryDecision({
      recordId: crypto.randomUUID(),
      userId,
      db,
      body: { action: 'approve' },
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.kind, 'not_found');
  });
});
