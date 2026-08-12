// tests/integration/likha-classification.test.ts
// Sprint 4 (S4-C6) — L007 server classification tests (hermetic).
// Temp DB + temp index set BEFORE the dynamic imports; the LLM seam is injected
// (decision D32 — no real model calls asserted). Covers: agent 4 in the runner
// (persistence + low_confidence_classification gate + audit), the standalone
// classifyLikhaRecords engine (eligibility/skip/provenance), and admin
// overrides via applyClassificationOverride (REPLACE semantics, confidence NULL).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { tempDbPath, tempIndexPath } from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
const INDEX_FILE = tempIndexPath();
process.env.DB_PATH = DB_FILE;
process.env.LIKHA_SEARCH_INDEX_PATH = INDEX_FILE;

const FIXTURE_SCAN = 'tests/fixtures/likha/sample-ordinance.pdf';

const STUB_META_CONFIDENCE = {
  ordinanceNumber: 0.95,
  seriesYear: 0.95,
  title: 0.95,
  sectionCount: 0.95,
};

interface ClassRow {
  id: string;
  category: string;
  confidence: number | null;
  assigned_by: string;
}

test('likha classification server suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const {
    runLikhaPipeline,
    classifyLikhaRecords,
    applyClassificationOverride,
  } = await import('../../src/lib/likha/agents');
  const { seedPublishedRecord, seedPendingReviewRecord } = await import(
    '../helpers/likha-test-util'
  );

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `classify-test-${Date.now()}@example.com`,
    'test-not-used',
    'Classify Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  function seedProcessingRow(ordinanceNumber: number): string {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, source_type,
          original_filename, scan_file_path, file_hash, archive_status, uploaded_by_id)
       VALUES (?, ?, 2022, 'Processing', '', 'scan', 'sample-ordinance.pdf', ?, ?, 'processing', ?)`
    ).run(
      id,
      ordinanceNumber,
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

  const stubOcr = async () => ({ text: 'Section 1. Taxation text.', model: 'stub', attempts: 1 });
  // Ordinance number increments per call — a constant value would collide on
  // UNIQUE(ordinance_number, series_year) in multi-file runs.
  let stubMetaSeq = 0;
  const stubMeta = async () => ({
    ordinanceNumber: 900 + (stubMetaSeq += 1),
    seriesYear: 2022,
    title: 'An ordinance levying a local tax',
    sectionCount: 3,
    confidence: { ...STUB_META_CONFIDENCE },
  });

  function classRows(recordId: string): ClassRow[] {
    return db
      .prepare(
        `SELECT id, category, confidence, assigned_by FROM classifications
         WHERE ordinance_id = ? ORDER BY created_at, rowid`
      )
      .all(recordId) as ClassRow[];
  }

  function agentRows(pipelineId: string, agentId: number) {
    return db
      .prepare(
        `SELECT action, input_snapshot, output_snapshot, reason
         FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = ? AND agent_id = ?
         ORDER BY created_at, rowid`
      )
      .all(pipelineId, agentId) as Array<{
      action: string;
      input_snapshot: string | null;
      output_snapshot: string | null;
      reason: string | null;
    }>;
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

  await t.test('runner agent 4 persists AI classifications + gate fires (<0.6)', async () => {
    const id1 = seedProcessingRow(101);
    const id2 = seedProcessingRow(102);

    const res = await runLikhaPipeline({
      pipelineId: 'p4',
      userId,
      files: [fileInput(id1), fileInput(id2)],
      ocr: stubOcr,
      extractMetadata: stubMeta,
      classify: async () => [{ label: 'Taxation & Revenue', confidence: 0.42 }],
    });

    assert.equal(res.processed, 2);
    for (const f of res.files) {
      assert.equal(f.ok, true);
      assert.equal(f.archiveStatus, 'pending_review');
      assert.ok(f.classification, 'classification result attached');
      assert.equal(f.classification?.hitlRequired, true, 'gate fires at 0.42');
      assert.equal(f.classification?.gate, 'low_confidence_classification');
    }

    for (const id of [id1, id2]) {
      const rows = classRows(id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].category, 'Taxation & Revenue');
      assert.equal(rows[0].assigned_by, 'ai');
      assert.equal(rows[0].confidence, 0.42);
    }

    const a4 = agentRows('p4', 4);
    const starts = a4.filter((r) => r.action === 'start');
    const completes = a4.filter((r) => r.action === 'complete');
    const hitls = a4.filter((r) => r.action === 'hitl');
    assert.equal(starts.length, 2);
    assert.equal(completes.length, 2);
    assert.ok(
      starts.every((r) => (r.input_snapshot ?? '').includes('"mode":"s4-stub"')),
      'seam injected → s4-stub mode'
    );
    assert.ok(
      completes.every((r) => (r.output_snapshot ?? '').includes('Taxation & Revenue')),
      'complete snapshot carries subjects'
    );
    assert.equal(hitls.length, 2, 'one hitl row per gated record');
    assert.ok(hitls.every((r) => (r.reason ?? '').includes('low_confidence_classification')));
  });

  await t.test('runner gate silent above threshold; empty suggestions fire the gate', async () => {
    const hiId = seedProcessingRow(103);
    const hi = await runLikhaPipeline({
      pipelineId: 'p4hi',
      userId,
      files: [fileInput(hiId)],
      ocr: stubOcr,
      extractMetadata: stubMeta,
      classify: async () => [{ label: 'Taxation & Revenue', confidence: 0.81 }],
    });
    assert.equal(hi.files[0].classification?.hitlRequired, false);
    assert.equal(agentRows('p4hi', 4).filter((r) => r.action === 'hitl').length, 0);
    assert.equal(classRows(hiId).length, 1, 'classification persisted above threshold');

    const emptyId = seedProcessingRow(104);
    const empty = await runLikhaPipeline({
      pipelineId: 'p4empty',
      userId,
      files: [fileInput(emptyId)],
      ocr: stubOcr,
      extractMetadata: stubMeta,
      classify: async () => [],
    });
    assert.equal(empty.files[0].classification?.hitlRequired, true, 'no suggestions → gate');
    assert.equal(empty.files[0].classification?.gate, 'low_confidence_classification');
    assert.equal(classRows(emptyId).length, 0);
  });

  // Standalone engine (classify route's backing function).
  const pubId = seedPublishedRecord(db, userId, { ordinanceNumber: 201, seriesYear: 2021 });
  const pendId = seedPendingReviewRecord(db, userId, { ordinanceNumber: 202, seriesYear: 2021 });
  const flagId = seedPendingReviewRecord(db, userId, {
    ordinanceNumber: 203,
    seriesYear: 2021,
    archiveStatus: 'flagged',
  });

  await t.test('classifyLikhaRecords: eligibility, skip reasons, provenance, audit', async () => {
    const resp = await classifyLikhaRecords({
      recordIds: [pubId, pendId, flagId, 'missing-id'],
      userId,
      pipelineId: 'cls-1',
      db,
      classify: async () => [{ label: 'Title III - Taxation & Fiscal Affairs', confidence: 0.9 }],
    });

    assert.equal(resp.classified, 2, 'published + pending_review classified');
    const skippedReasons = new Map(resp.skipped.map((s) => [s.recordId, s.reason]));
    assert.ok(
      (skippedReasons.get(flagId) ?? '').startsWith('not_classifiable'),
      'flagged skipped as not_classifiable'
    );
    assert.equal(skippedReasons.get('missing-id'), 'not_found');

    assert.equal(resp.results.length, 2);
    for (const item of resp.results) {
      assert.equal(typeof item.ordinanceNumber, 'number');
      assert.equal(typeof item.seriesYear, 'number');
      assert.ok(Array.isArray(item.suggestions));
      assert.equal(item.hitlRequired, false, '0.9 confidence → no gate');
    }

    for (const id of [pubId, pendId]) {
      const rows = classRows(id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].assigned_by, 'ai');
      assert.equal(rows[0].category, 'Title III - Taxation & Fiscal Affairs');
    }
    assert.equal(classRows(flagId).length, 0, 'flagged never classified');

    const a4 = agentRows('cls-1', 4);
    assert.ok(a4.some((r) => r.action === 'start'));
    assert.ok(a4.some((r) => r.action === 'complete'));

    // Re-classify REPLACES AI rows (no duplicates accumulate).
    await classifyLikhaRecords({
      recordIds: [pubId],
      userId,
      pipelineId: 'cls-2',
      db,
      classify: async () => [
        { label: 'Taxation & Revenue', confidence: 0.8 },
        { label: 'Budget & Appropriations', confidence: 0.7 },
      ],
    });
    const after = classRows(pubId);
    assert.equal(after.length, 2, 'AI rows replaced, not duplicated');
    assert.ok(after.every((r) => r.assigned_by === 'ai'));
  });

  await t.test('override persists user provenance (REPLACE, confidence NULL)', async () => {
    const outcome = applyClassificationOverride({
      recordId: pubId,
      userId,
      categories: ['Title III - Taxation & Fiscal Affairs', 'Taxation & Revenue'],
      db,
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.response.recordId, pubId);
      assert.equal(outcome.response.assignedBy, userId);
      assert.deepEqual(outcome.response.categories, [
        'Title III - Taxation & Fiscal Affairs',
        'Taxation & Revenue',
      ]);
    }

    const rows = classRows(pubId);
    assert.equal(rows.length, 2, 'REPLACE — exactly the override categories');
    for (const r of rows) {
      assert.equal(r.assigned_by, userId);
      assert.equal(r.confidence, null, 'human rows carry no model confidence');
    }

    const audit = db
      .prepare(
        `SELECT agent_id, agent_name, action, reason, user_id, output_snapshot
         FROM agent_decisions
         WHERE module = 'likha' AND action = 'confirm' AND reason = 'override'
         ORDER BY created_at DESC`
      )
      .all() as Array<{
      agent_id: number;
      agent_name: string;
      action: string;
      reason: string;
      user_id: string | null;
      output_snapshot: string | null;
    }>;
    assert.ok(audit.length >= 1);
    assert.equal(audit[0].agent_id, 4);
    assert.equal(audit[0].agent_name, 'Subject Classifier');
    assert.equal(audit[0].user_id, userId);
    assert.ok((audit[0].output_snapshot ?? '').includes('Taxation & Revenue'));

    // Invalid / empty / unknown / processing outcomes.
    const invalid = applyClassificationOverride({
      recordId: pubId,
      userId,
      categories: ['Not A Real Category'],
      db,
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.kind, 'invalid');

    const empty = applyClassificationOverride({ recordId: pubId, userId, categories: [], db });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.kind, 'invalid');

    const notFound = applyClassificationOverride({
      recordId: 'nope',
      userId,
      categories: ['Taxation & Revenue'],
      db,
    });
    assert.equal(notFound.ok, false);
    if (!notFound.ok) assert.equal(notFound.kind, 'not_found');

    const processingId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 204,
      seriesYear: 2021,
      archiveStatus: 'processing',
    });
    const conflict = applyClassificationOverride({
      recordId: processingId,
      userId,
      categories: ['Taxation & Revenue'],
      db,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.kind, 'conflict');

    // A later AI run must NOT delete override rows (replaces only 'ai' rows).
    await classifyLikhaRecords({
      recordIds: [pubId],
      userId,
      pipelineId: 'cls-3',
      db,
      classify: async () => [{ label: 'Education', confidence: 0.9 }],
    });
    const mixed = classRows(pubId);
    const overrideRows = mixed.filter((r) => r.assigned_by === userId);
    const aiRows = mixed.filter((r) => r.assigned_by === 'ai');
    assert.equal(overrideRows.length, 2, 'override rows survive later AI runs');
    assert.equal(aiRows.length, 1, 'only AI rows were replaced');
  });

  await t.test('logging: likha_classify + likha_classification_override present', () => {
    const classifyLogs = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM interaction_logs
         WHERE module = 'likha' AND interaction_type = 'likha_classify'`
      )
      .get() as { cnt: number };
    assert.ok(classifyLogs.cnt >= 1, 'likha_classify logged');

    const overrideLogs = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM interaction_logs
         WHERE module = 'likha' AND interaction_type = 'likha_classification_override'`
      )
      .get() as { cnt: number };
    assert.ok(overrideLogs.cnt >= 1, 'likha_classification_override logged');
  });
});
