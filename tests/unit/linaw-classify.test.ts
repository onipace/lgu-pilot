// tests/unit/linaw-classify.test.ts
// Sprint 6 (S6-C6) — N002 Code Classifier engine + override (HERMETIC,
// in-process). DB_PATH → fresh temp DB before dynamic imports; the `classify`
// seam is stubbed everywhere — NO real LLM in this suite (decision D12).
// Covers parser contract, gate thresholds (D5), persistence semantics (D6),
// ready-only eligibility (rule 4), and the human override upsert.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
  seedLinawCodificationRecord,
} from '../helpers/linaw-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

after(() => {
  try {
    fs.rmSync(DB_FILE, { force: true });
    fs.rmSync(DB_FILE + '-wal', { force: true });
    fs.rmSync(DB_FILE + '-shm', { force: true });
  } catch {
    // best-effort
  }
});

test('linaw classify suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { parseLinawClassifyResponse } = await import('../../src/lib/linaw/prompts');
  const { classifyReadyOrdinances, applyClassificationOverride } = await import(
    '../../src/lib/linaw/agents'
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

  // ── Parser (pure, never throws) ───────────────────────────────────────────

  await t.test('parser: valid object / fenced / prose-wrapped / garbage / clamps', () => {
    const valid = parseLinawClassifyResponse(
      '{"titleNumber": 3, "chapterNumber": 2, "articleNumber": 1, "confidence": 0.82}'
    );
    assert.deepEqual(valid, { titleNumber: 3, chapterNumber: 2, articleNumber: 1, confidence: 0.82 });

    const fenced = parseLinawClassifyResponse(
      '```json\n{"titleNumber": 4, "chapterNumber": 1, "articleNumber": null, "confidence": 0.7}\n```'
    );
    assert.equal(fenced.titleNumber, 4);
    assert.equal(fenced.chapterNumber, 1);
    assert.equal(fenced.articleNumber, undefined);
    assert.equal(fenced.confidence, 0.7);

    const prose = parseLinawClassifyResponse(
      'Here is the placement: {"titleNumber": 5, "chapterNumber": 3, "confidence": 0.66} — done.'
    );
    assert.equal(prose.titleNumber, 5);
    assert.equal(prose.chapterNumber, 3);

    const garbage = parseLinawClassifyResponse('no json here at all');
    assert.deepEqual(garbage, { titleNumber: 0, chapterNumber: 0, confidence: 0 });

    const clampHigh = parseLinawClassifyResponse(
      '{"titleNumber": 1, "chapterNumber": 1, "confidence": 1.4}'
    );
    assert.equal(clampHigh.confidence, 1);
    const clampLow = parseLinawClassifyResponse(
      '{"titleNumber": 1, "chapterNumber": 1, "confidence": -0.2}'
    );
    assert.equal(clampLow.confidence, 0);
    const clampNonFinite = parseLinawClassifyResponse(
      '{"titleNumber": 1, "chapterNumber": 1, "confidence": "high"}'
    );
    assert.equal(clampNonFinite.confidence, 0);

    const negative = parseLinawClassifyResponse(
      '{"titleNumber": -2, "chapterNumber": 1, "confidence": 0.9}'
    );
    assert.equal(negative.titleNumber, 0);
  });

  // ── Corpus ─────────────────────────────────────────────────────────────────

  const readyA = seedLinawReadyRecord(db, userId, { ordinanceNumber: 31, seriesYear: 2021 });
  const gateLow = seedLinawReadyRecord(db, userId, { ordinanceNumber: 32, seriesYear: 2021 });
  const gateMid = seedLinawReadyRecord(db, userId, { ordinanceNumber: 33, seriesYear: 2021 });
  const gateHigh = seedLinawReadyRecord(db, userId, { ordinanceNumber: 34, seriesYear: 2021 });
  const pendRow = seedLinawPendingReviewRecord(db, userId, {
    ordinanceNumber: 35,
    seriesYear: 2021,
    libraryStatus: 'pending_review',
  });
  const readyC = seedLinawReadyRecord(db, userId, { ordinanceNumber: 37, seriesYear: 2021 });
  const readyD = seedLinawReadyRecord(db, userId, { ordinanceNumber: 38, seriesYear: 2021 });
  const readyE = seedLinawReadyRecord(db, userId, { ordinanceNumber: 39, seriesYear: 2021 });

  // ── Gate thresholds (decision D5 — mutually exclusive) ────────────────────

  await t.test('gates: 0.55 → low_confidence, 0.65 → code_placement, 0.85 → none', async () => {
    const confidenceByNumber: Record<number, number> = { 32: 0.55, 33: 0.65, 34: 0.85 };
    const pipelineId = 'classify-gates';
    const res = await classifyReadyOrdinances({
      ordinanceIds: [gateLow, gateMid, gateHigh],
      userId,
      db,
      pipelineId,
      classify: async (input) => ({
        titleNumber: 3,
        chapterNumber: 1,
        confidence: confidenceByNumber[input.meta.ordinanceNumber] ?? 0.9,
      }),
    });

    assert.equal(res.classified, 3);
    const byRecord = new Map(res.results.map((r) => [r.recordId, r]));
    assert.equal(byRecord.get(gateLow)?.gate, 'low_confidence_classification');
    assert.equal(byRecord.get(gateLow)?.hitlRequired, true);
    assert.equal(byRecord.get(gateMid)?.gate, 'code_placement');
    assert.equal(byRecord.get(gateMid)?.hitlRequired, true);
    assert.equal(byRecord.get(gateHigh)?.gate, undefined);
    assert.equal(byRecord.get(gateHigh)?.hitlRequired, false);

    const hitlRows = db
      .prepare(
        `SELECT reason FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 2 AND action = 'hitl' AND pipeline_id = ?`
      )
      .all(pipelineId) as Array<{ reason: string }>;
    assert.equal(hitlRows.length, 2, 'hitl rows only for the gated records');
    assert.ok(hitlRows.some((r) => r.reason.startsWith('low_confidence_classification:')));
    assert.ok(hitlRows.some((r) => r.reason.startsWith('code_placement:')));
  });

  // ── Persistence (decision D6) ─────────────────────────────────────────────

  await t.test('persistence: upsert sets AI fields; re-run preserves human_override', async () => {
    const res = await classifyReadyOrdinances({
      ordinanceIds: [readyA],
      userId,
      db,
      pipelineId: 'classify-persist-1',
      classify: async () => ({ titleNumber: 4, chapterNumber: 2, articleNumber: 1, confidence: 0.9 }),
    });
    assert.equal(res.classified, 1);
    assert.equal(res.results[0].placement?.titleNumber, 4);

    let row = db
      .prepare(`SELECT * FROM codification_records WHERE ordinance_id = ?`)
      .get(readyA) as Record<string, any>;
    assert.equal(row.cod_status, 'classified');
    assert.equal(row.title_number, 4);
    assert.equal(row.chapter_number, 2);
    assert.equal(row.article_number, 1);
    const suggestion = JSON.parse(row.ai_suggestion);
    assert.equal(suggestion.titleNumber, 4);
    assert.equal(suggestion.chapterNumber, 2);
    assert.equal(suggestion.confidence, 0.9);
    assert.equal(typeof suggestion.suggestedAt, 'string');

    // Pre-existing human override — a re-classification must NEVER touch it.
    const overrideJson = JSON.stringify({
      titleNumber: 9,
      chapterNumber: 9,
      reason: 'prior human decision',
      overriddenAt: new Date().toISOString(),
    });
    db.prepare(`UPDATE codification_records SET human_override = ? WHERE ordinance_id = ?`).run(
      overrideJson,
      readyA
    );

    await classifyReadyOrdinances({
      ordinanceIds: [readyA],
      userId,
      db,
      pipelineId: 'classify-persist-2',
      classify: async () => ({ titleNumber: 5, chapterNumber: 3, confidence: 0.95 }),
    });

    row = db
      .prepare(`SELECT * FROM codification_records WHERE ordinance_id = ?`)
      .get(readyA) as Record<string, any>;
    assert.equal(row.title_number, 5, 'AI re-run updates placement columns');
    assert.equal(row.chapter_number, 3);
    assert.equal(JSON.parse(row.ai_suggestion).confidence, 0.95);
    assert.equal(row.human_override, overrideJson, 'override history survives re-runs');
    assert.equal(row.cod_status, 'classified');
  });

  // ── Eligibility (boundary rule 4) ─────────────────────────────────────────

  await t.test('eligibility: pending_review skipped, unknown id not_found', async () => {
    const res = await classifyReadyOrdinances({
      ordinanceIds: [pendRow, 'missing-id'],
      userId,
      db,
      pipelineId: 'classify-eligibility',
      classify: async () => ({ titleNumber: 1, chapterNumber: 1, confidence: 0.9 }),
    });
    assert.equal(res.classified, 0);
    const reasons = new Map(res.skipped.map((s) => [s.recordId, s.reason]));
    assert.equal(reasons.get(pendRow), 'not_classifiable:pending_review');
    assert.equal(reasons.get('missing-id'), 'not_found');
  });

  // ── Unparseable output → gate + exception, batch continues ───────────────

  await t.test('unparseable: zeros → placement null, gate fired, nothing persisted, batch continues', async () => {
    const res = await classifyReadyOrdinances({
      ordinanceIds: [readyC, readyE],
      userId,
      db,
      pipelineId: 'classify-unparseable',
      classify: async (input) =>
        input.meta.ordinanceNumber === 37
          ? { titleNumber: 0, chapterNumber: 0, confidence: 0 }
          : { titleNumber: 6, chapterNumber: 1, confidence: 0.88 },
    });

    const itemC = res.results.find((r) => r.recordId === readyC);
    assert.equal(itemC?.placement, null);
    assert.equal(itemC?.hitlRequired, true);
    assert.equal(itemC?.gate, 'low_confidence_classification');
    assert.ok(res.exceptions.length >= 1, 'exceptions entry recorded');
    assert.ok(res.exceptions.some((e) => e.includes(readyC)));

    const codC = db
      .prepare(`SELECT COUNT(*) AS n FROM codification_records WHERE ordinance_id = ?`)
      .get(readyC) as { n: number };
    assert.equal(codC.n, 0, 'nothing persisted for the unparseable record');

    // The batch continued to the next record.
    const itemE = res.results.find((r) => r.recordId === readyE);
    assert.equal(itemE?.placement?.titleNumber, 6);
    assert.equal(itemE?.hitlRequired, false);
  });

  // ── Override (decision D6) ────────────────────────────────────────────────

  await t.test('override happy path: reviewed + reason + audit confirm/override', () => {
    const outcome = applyClassificationOverride({
      ordinanceId: readyD,
      userId,
      body: { titleNumber: 7, chapterNumber: 4, articleNumber: 2, reason: 'Market fees fit Title 7' },
      db,
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.response.recordId, readyD);
      assert.equal(outcome.response.codStatus, 'reviewed');
      assert.equal(outcome.response.reviewedBy, userId);
      assert.equal(outcome.response.titleNumber, 7);
      assert.equal(outcome.response.chapterNumber, 4);
      assert.equal(outcome.response.articleNumber, 2);
    }

    const row = db
      .prepare(`SELECT * FROM codification_records WHERE ordinance_id = ?`)
      .get(readyD) as Record<string, any>;
    assert.equal(row.cod_status, 'reviewed');
    assert.equal(row.reviewed_by_id, userId);
    assert.equal(row.title_number, 7);
    assert.equal(row.chapter_number, 4);
    assert.equal(row.article_number, 2);
    const override = JSON.parse(row.human_override);
    assert.equal(override.reason, 'Market fees fit Title 7');
    assert.equal(override.titleNumber, 7);

    const audits = db
      .prepare(
        `SELECT action, reason, pipeline_id FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 2 AND pipeline_id = ?`
      )
      .all('override-' + readyD) as Array<{ action: string; reason: string | null; pipeline_id: string }>;
    assert.ok(audits.some((a) => a.action === 'confirm' && a.reason === 'override'));
  });

  await t.test('override can create the FIRST placement (upsert, no AI row)', () => {
    const readyF = seedLinawReadyRecord(db, userId, { ordinanceNumber: 40, seriesYear: 2021 });
    const before = db
      .prepare(`SELECT COUNT(*) AS n FROM codification_records WHERE ordinance_id = ?`)
      .get(readyF) as { n: number };
    assert.equal(before.n, 0);

    const outcome = applyClassificationOverride({
      ordinanceId: readyF,
      userId,
      body: { titleNumber: 1, chapterNumber: 2, reason: 'First placement by hand' },
      db,
    });
    assert.equal(outcome.ok, true);
    const row = db
      .prepare(`SELECT * FROM codification_records WHERE ordinance_id = ?`)
      .get(readyF) as Record<string, any>;
    assert.equal(row.cod_status, 'reviewed');
    assert.equal(row.title_number, 1);
    assert.equal(row.chapter_number, 2);
    assert.equal(row.article_number, null);
  });

  await t.test('override errors: missing reason invalid / unknown not_found / non-ready conflict', () => {
    const invalid = applyClassificationOverride({
      ordinanceId: readyD,
      userId,
      body: { titleNumber: 1, chapterNumber: 1, reason: '' },
      db,
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.kind, 'invalid');

    const notFound = applyClassificationOverride({
      ordinanceId: 'does-not-exist',
      userId,
      body: { titleNumber: 1, chapterNumber: 1, reason: 'x' },
      db,
    });
    assert.equal(notFound.ok, false);
    if (!notFound.ok) assert.equal(notFound.kind, 'not_found');

    const conflict = applyClassificationOverride({
      ordinanceId: pendRow,
      userId,
      body: { titleNumber: 1, chapterNumber: 1, reason: 'x' },
      db,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.kind, 'conflict');
  });

  // seedLinawCodificationRecord sanity (harness addition used above by design).
  await t.test('seedLinawCodificationRecord seeds the documented defaults', () => {
    const extra = seedLinawReadyRecord(db, userId, { ordinanceNumber: 41, seriesYear: 2021 });
    const codId = seedLinawCodificationRecord(db, extra);
    const row = db
      .prepare(`SELECT * FROM codification_records WHERE id = ?`)
      .get(codId) as Record<string, any>;
    assert.equal(row.ordinance_id, extra);
    assert.equal(row.title_number, 3);
    assert.equal(row.chapter_number, 1);
    assert.equal(row.cod_status, 'classified');
    assert.equal(JSON.parse(row.ai_suggestion).confidence, 0.9);
  });

  // Runs LAST: it persists an AI row for EVERY ready record (rule 4 scope).
  await t.test('omitted ordinanceIds → whole ready library; pending row untouched', async () => {
    const res = await classifyReadyOrdinances({
      userId,
      db,
      pipelineId: 'classify-whole-library',
      classify: async () => ({ titleNumber: 2, chapterNumber: 1, confidence: 0.9 }),
    });
    const readyCount = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM linaw_ordinances WHERE library_status = 'ready'`)
        .get() as { n: number }
    ).n;
    assert.equal(res.results.length, readyCount, 'every ready row classified');
    assert.equal(res.skipped.length, 0);
    const pendCod = db
      .prepare(`SELECT COUNT(*) AS n FROM codification_records WHERE ordinance_id = ?`)
      .get(pendRow) as { n: number };
    assert.equal(pendCod.n, 0, 'no codification row for the pending_review record');
  });
});
