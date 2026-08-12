// tests/integration/likha-verification.test.ts
// Sprint 3 (S3-C3) — L004 verification server tests (hermetic).
// No server, no network: DB_PATH + LIKHA_SEARCH_INDEX_PATH point at fresh
// temp files set BEFORE the dynamic imports (db.ts reads DB_PATH at module
// load). node:test + node:assert/strict, relative imports only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { tempDbPath, tempIndexPath, seedPendingReviewRecord } from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
const INDEX_FILE = tempIndexPath();
process.env.DB_PATH = DB_FILE;
process.env.LIKHA_SEARCH_INDEX_PATH = INDEX_FILE;

const FIXTURE_SCAN = 'tests/fixtures/likha/sample-ordinance.pdf';

const HIGH_CONFIDENCE = {
  ordinanceNumber: 0.92,
  seriesYear: 0.95,
  title: 0.9,
  sectionCount: 0.88,
};

interface DecisionsRow {
  agent_id: number;
  agent_name: string;
  action: string;
  input_snapshot: string | null;
  output_snapshot: string | null;
  user_id: string | null;
  reason: string | null;
}

test('likha verification suite', async (t) => {
  // Dynamic imports AFTER env is set.
  const { getDb } = await import('../../src/lib/db');
  const { runLikhaPipeline, validateLikhaExtraction, applyVerificationDecision } = await import(
    '../../src/lib/likha/agents'
  );

  const db = getDb();

  // Seed one approved uploader (same pattern as likha-metadata.test.ts).
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `verify-test-${Date.now()}@example.com`,
    'test-not-used',
    'Verification Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  function seedProcessingRow(): string {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, source_type,
          original_filename, scan_file_path, file_hash, archive_status,
          uploaded_by_id, updated_at)
       VALUES (?, ?, 0, ?, '', 'scan', ?, ?, ?, 'processing', ?, '2020-01-01 00:00:00')`
    ).run(
      id,
      -crypto.randomInt(1, 2_000_000_000),
      'Processing — sample-ordinance.pdf',
      'sample-ordinance.pdf',
      FIXTURE_SCAN,
      crypto.createHash('sha256').update(id).digest('hex'),
      userId
    );
    return id;
  }

  function fileInput(recordId: string) {
    return {
      recordId,
      originalFilename: 'sample-ordinance.pdf',
      mimeType: 'application/pdf' as const,
      scanFilePath: FIXTURE_SCAN,
      fileHash: crypto.createHash('sha256').update(recordId).digest('hex'),
    };
  }

  const stubOcr = async () => ({ text: 'Section 1. Title. Real extracted text.', model: 'stub', attempts: 1 });

  function decisionsFor(pipelineId: string): DecisionsRow[] {
    return db
      .prepare(
        `SELECT agent_id, agent_name, action, input_snapshot, output_snapshot, user_id, reason
         FROM agent_decisions WHERE module = 'likha' AND pipeline_id = ?
         ORDER BY created_at, rowid`
      )
      .all(pipelineId) as DecisionsRow[];
  }

  t.after(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm', INDEX_FILE]) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        // ignore
      }
    }
  });

  await t.test('agent 5 validation (pure): gates exactly per PRD §12.4 row 1', () => {
    // All critical fields >= 0.7 and readable content → clean.
    const clean = validateLikhaExtraction({
      content: 'Section 1. Title. This ordinance revises business permit fees.',
      ordinanceNumber: 5,
      extractionConfidence: { ...HIGH_CONFIDENCE },
    });
    assert.equal(clean.hitlRequired, false);
    assert.deepEqual(clean.exceptions, []);
    assert.equal(clean.gate, undefined);

    // One critical field below 0.7 → gate fires with a field-specific exception.
    const low = validateLikhaExtraction({
      content: 'Section 1. Title. This ordinance revises business permit fees.',
      ordinanceNumber: 5,
      extractionConfidence: { ...HIGH_CONFIDENCE, ordinanceNumber: 0.62 },
    });
    assert.equal(low.hitlRequired, true);
    assert.equal(low.gate, 'low_confidence_metadata');
    const matching = low.exceptions.find(
      (e) => e.includes('ordinanceNumber') && e.includes('0.62')
    );
    assert.ok(matching, `expected an ordinanceNumber/0.62 exception, got: ${low.exceptions.join(' | ')}`);

    // Unreadable scan (empty content + zero confidence) → manual-entry exception.
    const unreadable = validateLikhaExtraction({
      content: '   ',
      ordinanceNumber: 0,
      extractionConfidence: { ordinanceNumber: 0, seriesYear: 0, title: 0, sectionCount: 0 },
    });
    assert.equal(unreadable.hitlRequired, true);
    assert.equal(unreadable.gate, 'low_confidence_metadata');
    assert.ok(
      unreadable.exceptions.some((e) => /unreadable/i.test(e)),
      `expected an unreadable-scan exception, got: ${unreadable.exceptions.join(' | ')}`
    );
  });

  await t.test('pipeline runs agents 4-5: pass-through audit + HITL gate rows', async () => {
    const idLow1 = seedProcessingRow();
    const idLow2 = seedProcessingRow();

    let call = 0;
    const stubLow = async () => {
      call += 1;
      return {
        ordinanceNumber: call === 1 ? 11 : 12,
        seriesYear: 2022,
        title: 'An ordinance regulating tricycle franchises',
        sectionCount: 8,
        confidence: { ...HIGH_CONFIDENCE, ordinanceNumber: 0.55 },
      };
    };

    const res = await runLikhaPipeline({
      pipelineId: 'p3',
      userId,
      files: [fileInput(idLow1), fileInput(idLow2)],
      ocr: stubOcr,
      extractMetadata: stubLow,
      // Sprint 4 (D24/D32): agent 4 is real — hermetic tests inject the seam.
      classify: async () => [{ label: 'General Provisions', confidence: 0.9 }],
    });

    assert.equal(res.processed, 2);
    assert.equal(res.failed, 0);
    for (const f of res.files) {
      assert.equal(f.ok, true);
      assert.equal(f.archiveStatus, 'pending_review');
      assert.ok(f.validation, 'validation result attached');
      assert.equal(f.validation!.hitlRequired, true);
      assert.equal(f.validation!.gate, 'low_confidence_metadata');
    }

    const decisions = decisionsFor('p3');

    // Agent 4 — REAL (decision D24): start + complete, s4-stub snapshot (seam injected).
    const agent4 = decisions.filter((d) => d.agent_id === 4);
    const agent4Actions = agent4.map((d) => d.action);
    assert.ok(agent4Actions.includes('start'), 'agent 4 start row');
    assert.ok(agent4Actions.includes('complete'), 'agent 4 complete row');
    assert.equal(agent4[0].agent_name, 'Subject Classifier');
    const agent4Complete = agent4.find((d) => d.action === 'complete');
    assert.ok(agent4Complete?.output_snapshot?.includes('s4-stub'), 'agent 4 Sprint-4 stub snapshot');

    // Agent 5 — start + complete + an action='hitl' row referencing the gate.
    const agent5 = decisions.filter((d) => d.agent_id === 5);
    const agent5Actions = agent5.map((d) => d.action);
    assert.ok(agent5Actions.includes('start'), 'agent 5 start row');
    assert.ok(agent5Actions.includes('complete'), 'agent 5 complete row');
    assert.equal(agent5[0].agent_name, 'Legal Validator');
    const hitlRows = agent5.filter((d) => d.action === 'hitl');
    assert.equal(hitlRows.length, 2, 'one HITL row per gated file');
    for (const row of hitlRows) {
      const combined = (row.reason ?? '') + ' ' + (row.output_snapshot ?? '');
      assert.ok(combined.includes('low_confidence_metadata'), 'hitl row references the gate');
    }

    // Rows still end at pending_review — the human gate, not a terminal state.
    for (const id of [idLow1, idLow2]) {
      const row = db
        .prepare('SELECT archive_status FROM archived_ordinances WHERE id = ?')
        .get(id) as { archive_status: string };
      assert.equal(row.archive_status, 'pending_review');
    }

    // Second run: high confidence → no gate, no 'hitl' action rows.
    const idHigh = seedProcessingRow();
    const res2 = await runLikhaPipeline({
      pipelineId: 'p3b',
      userId,
      files: [fileInput(idHigh)],
      ocr: stubOcr,
      extractMetadata: async () => ({
        ordinanceNumber: 30,
        seriesYear: 2021,
        title: 'An ordinance adopting the municipal development plan',
        sectionCount: 6,
        confidence: { ...HIGH_CONFIDENCE },
      }),
      // Sprint 4 (D24/D32): agent 4 is real — hermetic tests inject the seam.
      classify: async () => [{ label: 'General Provisions', confidence: 0.9 }],
    });
    assert.equal(res2.files[0].validation?.hitlRequired, false);
    const hitlCount = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = 'p3b' AND action = 'hitl'`
      )
      .get() as { cnt: number };
    assert.equal(hitlCount.cnt, 0, 'no hitl rows on a clean run');
  });

  await t.test('approve persists the human decision (audit + verified_by_id)', () => {
    const recordId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 40, seriesYear: 2018 });

    const outcome = applyVerificationDecision({
      recordId,
      userId,
      body: { action: 'approve' },
      db,
    });

    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.response.recordId, recordId);
      assert.equal(outcome.response.action, 'approve');
      assert.equal(outcome.response.published, false, 'publish lands in S3-C5');
      assert.equal(outcome.response.archiveStatus, 'pending_review');
    }

    const row = db
      .prepare('SELECT archive_status, verified_by_id FROM archived_ordinances WHERE id = ?')
      .get(recordId) as { archive_status: string; verified_by_id: string | null };
    assert.equal(row.archive_status, 'pending_review');
    assert.equal(row.verified_by_id, userId);

    const audit = db
      .prepare(
        `SELECT agent_id, agent_name, action, user_id FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = ? AND action = 'confirm'`
      )
      .all('verification-' + recordId) as Array<{
      agent_id: number;
      agent_name: string;
      action: string;
      user_id: string | null;
    }>;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].agent_id, 5);
    assert.equal(audit[0].agent_name, 'Legal Validator');
    assert.equal(audit[0].user_id, userId);

    const logs = db
      .prepare(
        `SELECT interaction_type FROM interaction_logs
         WHERE module = 'likha' AND interaction_type LIKE 'likha_verification%'`
      )
      .all() as Array<{ interaction_type: string }>;
    assert.ok(logs.length >= 1, 'likha_verification interaction log present');
  });

  await t.test('edit persists corrected fields and stays reviewable', () => {
    const recordId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 41, seriesYear: 2017 });

    const outcome = applyVerificationDecision({
      recordId,
      userId,
      body: {
        action: 'edit',
        fields: {
          ordinanceNumber: 7,
          seriesYear: 2024,
          title: 'Corrected title',
          sectionCount: 9,
          subjects: ['Taxation & Revenue'],
        },
      },
      db,
    });

    assert.equal(outcome.ok, true);

    const row = db
      .prepare(
        `SELECT ordinance_number, series_year, title, section_count, subject_tags,
                archive_status, verified_by_id
         FROM archived_ordinances WHERE id = ?`
      )
      .get(recordId) as {
      ordinance_number: number;
      series_year: number;
      title: string;
      section_count: number | null;
      subject_tags: string;
      archive_status: string;
      verified_by_id: string | null;
    };
    assert.equal(row.ordinance_number, 7);
    assert.equal(row.series_year, 2024);
    assert.equal(row.title, 'Corrected title');
    assert.equal(row.section_count, 9);
    assert.deepEqual(JSON.parse(row.subject_tags), ['Taxation & Revenue']);
    assert.equal(row.archive_status, 'pending_review');
    assert.equal(row.verified_by_id, userId);

    const audit = db
      .prepare(
        `SELECT action, reason, output_snapshot FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = ? ORDER BY created_at DESC, rowid DESC`
      )
      .all('verification-' + recordId) as Array<{
      action: string;
      reason: string | null;
      output_snapshot: string | null;
    }>;
    assert.equal(audit[0].action, 'confirm');
    assert.equal(audit[0].reason, 'edit');
    const snapshot = JSON.parse(audit[0].output_snapshot ?? '{}');
    assert.equal(snapshot.ordinanceNumber, 7);
    assert.equal(snapshot.title, 'Corrected title');

    // Invalid subjects are rejected as a validation error (route maps to 400).
    const bad = applyVerificationDecision({
      recordId,
      userId,
      body: { action: 'edit', fields: { subjects: ['Not A Real Subject'] } },
      db,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.kind, 'invalid');
  });

  await t.test('reject terminates the branch: flagged + rejection_reason + audit', () => {
    const recordId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 42, seriesYear: 2016 });

    const outcome = applyVerificationDecision({
      recordId,
      userId,
      body: { action: 'reject', reason: 'Unreadable scan' },
      db,
    });

    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.response.archiveStatus, 'flagged');
      assert.equal(outcome.response.published, false);
    }

    const row = db
      .prepare(
        `SELECT archive_status, rejection_reason, verified_by_id
         FROM archived_ordinances WHERE id = ?`
      )
      .get(recordId) as {
      archive_status: string;
      rejection_reason: string | null;
      verified_by_id: string | null;
    };
    assert.equal(row.archive_status, 'flagged');
    assert.equal(row.rejection_reason, 'Unreadable scan');
    assert.equal(row.verified_by_id, userId);

    const audit = db
      .prepare(
        `SELECT action, reason FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = ? AND action = 'reject'`
      )
      .all('verification-' + recordId) as Array<{ action: string; reason: string | null }>;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].reason, 'Unreadable scan');

    // Follow-up approve on a finalized (flagged) row → conflict signal.
    const again = applyVerificationDecision({ recordId, userId, body: { action: 'approve' }, db });
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.kind, 'conflict');

    // Reject without a reason → invalid (route maps to 400).
    const other = seedPendingReviewRecord(db, userId, { ordinanceNumber: 43, seriesYear: 2015 });
    const noReason = applyVerificationDecision({
      recordId: other,
      userId,
      body: { action: 'reject', reason: '' },
      db,
    });
    assert.equal(noReason.ok, false);
    if (!noReason.ok) assert.equal(noReason.kind, 'invalid');
  });

  await t.test('409 conflicts: finalized statuses, UNIQUE collision, expectedUpdatedAt', () => {
    // Approve on an already-published row → conflict.
    const publishedId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 44,
      seriesYear: 2014,
      archiveStatus: 'published',
    });
    const onPublished = applyVerificationDecision({
      recordId: publishedId,
      userId,
      body: { action: 'approve' },
      db,
    });
    assert.equal(onPublished.ok, false);
    if (!onPublished.ok) assert.equal(onPublished.kind, 'conflict');

    // Approve on an already-flagged row → conflict.
    const flaggedId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 45,
      seriesYear: 2013,
      archiveStatus: 'flagged',
    });
    const onFlagged = applyVerificationDecision({
      recordId: flaggedId,
      userId,
      body: { action: 'approve' },
      db,
    });
    assert.equal(onFlagged.ok, false);
    if (!onFlagged.ok) assert.equal(onFlagged.kind, 'conflict');

    // Edit changing (ordinance_number, series_year) to collide with another row → conflict.
    seedPendingReviewRecord(db, userId, { ordinanceNumber: 60, seriesYear: 2012 });
    const collidingId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 61, seriesYear: 2012 });
    const collision = applyVerificationDecision({
      recordId: collidingId,
      userId,
      body: { action: 'edit', fields: { ordinanceNumber: 60 } },
      db,
    });
    assert.equal(collision.ok, false);
    if (!collision.ok) assert.equal(collision.kind, 'conflict');

    // expectedUpdatedAt mismatch → conflict (optimistic concurrency, decision D17).
    const optimisticId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 62, seriesYear: 2011 });
    const stale = applyVerificationDecision({
      recordId: optimisticId,
      userId,
      body: { action: 'approve', expectedUpdatedAt: '1999-01-01 00:00:00' },
      db,
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.kind, 'conflict');
  });
});
