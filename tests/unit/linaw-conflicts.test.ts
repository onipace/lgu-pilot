// tests/unit/linaw-conflicts.test.ts
// Sprint 6 (S6-C9) — N004 Conflict Detector + runLinawPipeline orchestrator
// (HERMETIC, in-process). DB_PATH → fresh temp DB before dynamic imports;
// conflictLlm/classify/refine seams injected — NO real LLM. Covers candidate
// pairing (shared subject tags), evidence shaping caps (D9), conflict-marker
// persistence (D1), non-fatal LLM degradation (D12), idempotency, ready-only
// scope (rule 4), and the sequential 1→4 orchestrator as the Sprint-7 seam.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
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

test('linaw conflicts suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { parseLinawConflictResponse } = await import('../../src/lib/linaw/prompts');
  const {
    detectConflicts,
    shapeConflictEvidence,
    runLinawPipeline,
    reviewRelationships,
    assembleCode,
    LINAW_CONFLICT_RELATIONSHIP_TYPE,
  } = await import('../../src/lib/linaw/agents');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `conflicts-test-${Date.now()}@example.com`,
    'test-not-used',
    'Conflicts Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  // ── Orchestrator corpus (runs FIRST so inventory math is exact) ───────────

  const ORCH_TARGET_NO = 71;
  const orchTarget = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: ORCH_TARGET_NO,
    seriesYear: 2019,
    title: 'An ordinance setting the base market fee schedule',
    content: 'Section 1. Title. Base market fees are five pesos per stall.',
    subjectTags: ['Taxation & Revenue'],
  });
  const orchSource = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 72,
    seriesYear: 2021,
    title: 'An ordinance adjusting the market fee schedule',
    content: `Section 1. Title. This ordinance amends Ordinance No. ${ORCH_TARGET_NO}, S. 2019 to raise fees.`,
    subjectTags: ['Taxation & Revenue'],
  });
  seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 73,
    seriesYear: 2021,
    title: 'An ordinance on tricycle franchises',
    content: 'Section 1. Title. Tricycle franchises are granted yearly.',
    subjectTags: ['Permits'],
  });

  await t.test('orchestrator: agents 1-4 under ONE pipeline id + composed response', async () => {
    const pipelineId = 'pipeline-orchestrated';
    const res = await runLinawPipeline({
      ordinanceIds: [orchTarget, orchSource],
      userId,
      db,
      pipelineId,
      classify: async () => ({ titleNumber: 3, chapterNumber: 1, confidence: 0.9 }),
      refine: async () => null,
      conflictLlm: async () => ({
        conflict: true,
        reason: 'Fee amounts contradict',
        confidence: 0.81,
        excerptsA: ['fees are five pesos per stall'],
        excerptsB: ['raise fees to ten pesos'],
      }),
    });

    assert.equal(res.pipelineId, pipelineId);
    assert.equal(res.inventory.totals.ordinances, 3, 'whole ready library inventoried');
    assert.equal(res.classification.classified, 2, 'scope restricted to the given ids');
    assert.ok(res.detection.relationshipsPersisted >= 1, 'amending reference persisted');
    assert.equal(res.detection.conflicts.length, 1);
    const conflictPair = [res.detection.conflicts[0].ordinanceAId, res.detection.conflicts[0].ordinanceBId].sort();
    assert.deepEqual(conflictPair, [orchTarget, orchSource].sort());
    assert.equal(res.detection.hitlRequired, true);
    assert.equal(res.hitlRequired, true);

    // Audit rows for agents 1..5 all exist under the ONE pipeline id — agent
    // 5 (Sprint 7) raises its gate over the two pending detections, and agent
    // 6 is gated off (assembly omitted) exactly like the route precondition.
    const agentIds = db
      .prepare(
        `SELECT DISTINCT agent_id FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = ? ORDER BY agent_id`
      )
      .all(pipelineId) as Array<{ agent_id: number }>;
    assert.deepEqual(agentIds.map((r) => r.agent_id), [1, 2, 3, 4, 5]);

    // Sprint 7 (N005): agent 5 is REAL — it counts the decision queue (the
    // orchestrator run above persisted one pending amends row + one pending
    // conflict row). Sprint 7 (N006): agent 6 is REAL too — it refuses to
    // assemble while those rows remain pending (D5 gate).
    const review = reviewRelationships({ userId, db, pipelineId: 'review-sprint6-regression' });
    assert.equal(review.pending, 2, 'amends + conflict rows both pending');
    assert.equal(review.confirmed, 0);
    assert.equal(review.rejected, 0);
    assert.equal(review.hitlRequired, true);

    const assembled = assembleCode({
      edition: 'Sprint 6 Regression',
      userId,
      db,
      pipelineId: 'assemble-sprint6-regression',
    });
    assert.equal(assembled.ok, false, 'agent 6 blocks on pending detections');
    if (!assembled.ok) {
      assert.equal(assembled.kind, 'pending_relationships');
      assert.equal(assembled.pending, 2);
    }
  });

  // ── Conflict parser (pure, never throws) ──────────────────────────────────

  await t.test('parseLinawConflictResponse: valid / fenced / garbage / clamps', () => {
    const valid = parseLinawConflictResponse(
      '{"conflict": true, "reason": "r", "confidence": 0.7, "excerptsA": ["a"], "excerptsB": ["b"]}'
    );
    assert.equal(valid.conflict, true);
    assert.equal(valid.confidence, 0.7);
    assert.deepEqual(valid.excerptsA, ['a']);

    const clamped = parseLinawConflictResponse(
      '{"conflict": true, "reason": "r", "confidence": 2.5, "excerptsA": [], "excerptsB": []}'
    );
    assert.equal(clamped.confidence, 1);

    const garbage = parseLinawConflictResponse('utter garbage');
    assert.deepEqual(garbage, { conflict: false, reason: '', confidence: 0, excerptsA: [], excerptsB: [] });
  });

  // ── Candidate pairing corpus ──────────────────────────────────────────────

  const pairA = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 81,
    seriesYear: 2020,
    subjectTags: ['Markets'],
  });
  const pairB = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 82,
    seriesYear: 2020,
    subjectTags: ['Markets'],
  });
  const loneC = seedLinawReadyRecord(db, userId, {
    ordinanceNumber: 83,
    seriesYear: 2020,
    subjectTags: ['Permits'],
  });

  await t.test('candidate pairing: only the shared-tag pair; seam counted', async () => {
    let seamCalls = 0;
    const res = await detectConflicts({
      ordinanceIds: [pairA, pairB, loneC],
      userId,
      db,
      pipelineId: 'conflict-pairing',
      conflictLlm: async () => {
        seamCalls += 1;
        return { conflict: false, reason: '', confidence: 0, excerptsA: [], excerptsB: [] };
      },
    });
    assert.equal(res.candidates, 1, 'exactly one candidate pair (A,B)');
    assert.equal(seamCalls, 1);
    assert.equal(res.detected, 0);
  });

  await t.test('no shared tags → zero candidates + zero seam invocations', async () => {
    const soloX = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 84,
      seriesYear: 2020,
      subjectTags: ['Zoning'],
    });
    const soloY = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 85,
      seriesYear: 2020,
      subjectTags: ['Health'],
    });
    let seamCalls = 0;
    const res = await detectConflicts({
      ordinanceIds: [soloX, soloY],
      userId,
      db,
      pipelineId: 'conflict-none',
      conflictLlm: async () => {
        seamCalls += 1;
        return { conflict: false, reason: '', confidence: 0, excerptsA: [], excerptsB: [] };
      },
    });
    assert.equal(res.candidates, 0);
    assert.equal(seamCalls, 0);
  });

  // ── Evidence shaping (pure, D9 caps) ──────────────────────────────────────

  await t.test('shapeConflictEvidence: 300-char passages, 2-per-side cap, blanks dropped, default reason', () => {
    const judgement = {
      conflict: true,
      reason: '',
      confidence: 0.9,
      excerptsA: ['A'.repeat(350), '   ', '', 'short A2', 'A3'],
      excerptsB: ['B1', 'B2', 'B3'],
    };
    const shaped = shapeConflictEvidence(judgement, 'id-a', 'id-b');
    assert.equal(shaped.reason, 'Unspecified contradiction', 'empty reason → default literal');
    assert.equal(shaped.excerpts.length, 4, '2 per side after blank-dropping');
    assert.equal(shaped.excerpts[0].ordinanceId, 'id-a');
    assert.equal(shaped.excerpts[0].passage.length, 300, 'long passage truncated');
    assert.equal(shaped.excerpts[1].passage, 'short A2', 'blanks dropped before the cap');
    assert.equal(shaped.excerpts[2].ordinanceId, 'id-b');
    assert.equal(shaped.excerpts[3].ordinanceId, 'id-b');
    assert.ok(shaped.excerpts.every((e) => e.passage.length <= 300));

    const longReason = shapeConflictEvidence(
      { conflict: true, reason: 'R'.repeat(600), confidence: 0.5, excerptsA: [], excerptsB: [] },
      'a',
      'b'
    );
    assert.equal(longReason.reason.length, 500, 'reason capped at 500');
  });

  // ── Persistence (decision D1) ─────────────────────────────────────────────

  await t.test('persistence: conflict marker row + evidence JSON in section_ref', async () => {
    const res = await detectConflicts({
      ordinanceIds: [pairA, pairB],
      userId,
      db,
      pipelineId: 'conflict-persist',
      conflictLlm: async () => ({
        conflict: true,
        reason: 'Fee schedules contradict',
        confidence: 0.77,
        excerptsA: ['five pesos per stall'],
        excerptsB: ['ten pesos per stall'],
      }),
    });

    assert.equal(res.detected, 1);
    assert.equal(res.persisted, 1);
    assert.equal(res.exceptions.length, 0);
    assert.equal(res.conflicts.length, 1);

    const rec = res.conflicts[0];
    assert.deepEqual([rec.ordinanceAId, rec.ordinanceBId].sort(), [pairA, pairB].sort());
    assert.equal(rec.reason, 'Fee schedules contradict');
    assert.equal(rec.confidence, 0.77);
    assert.equal(rec.confirmed, 0);
    assert.ok(rec.createdAt);
    assert.equal(rec.excerpts.length, 2);
    assert.ok(rec.excerpts.some((e) => e.ordinanceId === pairA && e.passage === 'five pesos per stall'));
    assert.ok(rec.excerpts.some((e) => e.ordinanceId === pairB && e.passage === 'ten pesos per stall'));

    const row = db
      .prepare(`SELECT * FROM ordinance_relationships WHERE id = ?`)
      .get(rec.id) as Record<string, any>;
    assert.equal(row.relationship_type, LINAW_CONFLICT_RELATIONSHIP_TYPE);
    assert.equal(row.relationship_type, 'conflict');
    assert.equal(row.confirmed, 0);
    assert.ok(Math.abs(row.confidence - 0.77) < 0.001);
    const evidence = JSON.parse(row.section_ref);
    assert.equal(evidence.reason, 'Fee schedules contradict');
    assert.equal(evidence.excerpts.length, 2);

    const audits = db
      .prepare(
        `SELECT action FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 4 AND pipeline_id = ? ORDER BY rowid`
      )
      .all('conflict-persist') as Array<{ action: string }>;
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[audits.length - 1].action, 'complete');
  });

  await t.test('idempotency: re-run over the same pair persists nothing', async () => {
    const res = await detectConflicts({
      ordinanceIds: [pairA, pairB],
      userId,
      db,
      pipelineId: 'conflict-idempotent',
      conflictLlm: async () => ({
        conflict: true,
        reason: 'again',
        confidence: 0.9,
        excerptsA: [],
        excerptsB: [],
      }),
    });
    assert.equal(res.persisted, 0);
    assert.equal(res.candidates, 0, 'already-represented pairs are skipped');
  });

  // ── Non-fatal LLM failure (decision D12) ──────────────────────────────────

  await t.test('seam throwing → detected 0 + degradation exception, no throw escapes', async () => {
    const throwA = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 86,
      seriesYear: 2020,
      subjectTags: ['Festivals'],
    });
    const throwB = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 87,
      seriesYear: 2020,
      subjectTags: ['Festivals'],
    });
    const res = await detectConflicts({
      ordinanceIds: [throwA, throwB],
      userId,
      db,
      pipelineId: 'conflict-throw',
      conflictLlm: async () => {
        throw new Error('llm boom');
      },
    });
    assert.equal(res.detected, 0);
    assert.equal(res.persisted, 0);
    assert.ok(
      res.exceptions.some((e) => e.includes('LLM unavailable')),
      'degradation message recorded'
    );
  });

  await t.test('seam returning null → same degradation path, recorded once', async () => {
    const nullA = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 88,
      seriesYear: 2020,
      subjectTags: ['Drainage'],
    });
    const nullB = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 89,
      seriesYear: 2020,
      subjectTags: ['Drainage'],
    });
    const res = await detectConflicts({
      ordinanceIds: [nullA, nullB],
      userId,
      db,
      pipelineId: 'conflict-null',
      conflictLlm: async () => null,
    });
    assert.equal(res.detected, 0);
    assert.equal(res.exceptions.length, 1, 'exception recorded ONCE per run');
  });

  // ── Ready-only scope (boundary rule 4) ────────────────────────────────────

  await t.test('a pending_review row sharing tags is never a candidate', async () => {
    const pendingTwin = seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 90,
      seriesYear: 2020,
      libraryStatus: 'pending_review',
      subjectTags: ['Markets'],
    });
    let seamCalls = 0;
    const res = await detectConflicts({
      ordinanceIds: [pairA, pendingTwin],
      userId,
      db,
      pipelineId: 'conflict-ready-only',
      conflictLlm: async () => {
        seamCalls += 1;
        return { conflict: true, reason: 'x', confidence: 0.9, excerptsA: [], excerptsB: [] };
      },
    });
    assert.equal(res.candidates, 0, 'non-ready row excluded from scope');
    assert.equal(seamCalls, 0);
  });
});
