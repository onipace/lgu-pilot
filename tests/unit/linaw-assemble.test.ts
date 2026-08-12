// tests/unit/linaw-assemble.test.ts
// Sprint 7 (S7-C9) — N006 Code Assembler (agent 6) + full 1→6 orchestrator
// (HERMETIC, in-process). Covers: agent-5 precondition blocking (D5 — pending
// rows refuse with the exact count; rejected rows do NOT block), hierarchy
// validity (Titles→Chapters→Articles→Sections from LINAW_CODE_TITLES),
// chapter-scoped sequential auto-numbering (chapter-level sections first —
// D6/D11), status exclusions (repealed/superseded/expired reported),
// unclassified non-blocking exceptions, persistence (section_in_code +
// cod_status='codified' + draft code_volumes row), the final_code_export HITL
// raise, nothing_to_assemble, out-of-range title fallback, and the extended
// orchestrator with DI seams.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawCodificationRecord,
  seedLinawRelationship,
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

test('linaw assemble suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const {
    assembleCode,
    decideRelationship,
    reviewRelationships,
    runLinawPipeline,
  } = await import('../../src/lib/linaw/agents');

  const db = getDb();
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `assemble-test-${Date.now()}@example.com`,
    'test-not-used',
    'Assemble Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  function volumeCount(): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM code_volumes`).get() as { n: number }).n;
  }
  function latestVolume(): Record<string, unknown> {
    return db
      .prepare(`SELECT * FROM code_volumes ORDER BY rowid DESC LIMIT 1`)
      .get() as Record<string, unknown>;
  }

  // ── (a) pending relationship blocks assembly (exact count, no volume) ─────

  const a = seedLinawReadyRecord(db, userId, { ordinanceNumber: 301, seriesYear: 2020 });
  const b = seedLinawReadyRecord(db, userId, { ordinanceNumber: 302, seriesYear: 2021 });
  seedLinawCodificationRecord(db, a, { titleNumber: 3, chapterNumber: 1 });
  seedLinawCodificationRecord(db, b, { titleNumber: 3, chapterNumber: 1 });
  const pendingRel = seedLinawRelationship(db, b, a, { type: 'amends' });

  await t.test('pending relationship → pending_relationships, no volume row', () => {
    const before = volumeCount();
    const outcome = assembleCode({ edition: 'Blocked Edition', userId, db, pipelineId: 'assemble-blocked' });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.kind, 'pending_relationships');
      assert.equal(outcome.pending, 1, 'exact pending count');
      assert.match(outcome.error, /1 detected relationships\/conflicts await human decision/);
    }
    assert.equal(volumeCount(), before, 'no volume written');

    // Agent-5 hitl audit row raised by the precondition.
    const hitl = db
      .prepare(
        `SELECT agent_id, reason FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'assemble-blocked' AND action = 'hitl'`
      )
      .all() as Array<{ agent_id: number; reason: string }>;
    assert.ok(hitl.some((h) => h.agent_id === 5 && h.reason.includes('detected_relationship')));
  });

  // ── (h) nothing to assemble (zero placements yet beyond blocked state) ────
  // Reject the row, then remove placements → eligible set empty.

  await t.test('reject clears the gate; zero eligible → nothing_to_assemble', () => {
    const decided = decideRelationship({
      relationshipId: pendingRel,
      userId,
      body: { action: 'reject', reason: 'Test pairing rejected' },
      db,
    });
    assert.equal(decided.ok, true);

    // Remove the placements so nothing is classified.
    db.prepare(`DELETE FROM codification_records`).run();

    const before = volumeCount();
    const outcome = assembleCode({ edition: 'Empty Edition', userId, db, pipelineId: 'assemble-empty' });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.kind, 'nothing_to_assemble');
      assert.equal(outcome.error, 'No classified ready ordinances to assemble');
    }
    assert.equal(volumeCount(), before, 'no volume written');

    // Agent-6 start + complete rows still audited (refusal recorded).
    const actions = db
      .prepare(
        `SELECT agent_id, action FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'assemble-empty' AND agent_id = 6 ORDER BY rowid`
      )
      .all() as Array<{ agent_id: number; action: string }>;
    assert.ok(actions.some((r) => r.action === 'start'));
    assert.ok(actions.some((r) => r.action === 'complete'));
  });

  // ── (b)+(f)+(g) rejected rows do NOT block; persistence + gate raise ──────

  await t.test('rejected row does not block; volume persisted + final_code_export raised', () => {
    seedLinawCodificationRecord(db, a, { titleNumber: 3, chapterNumber: 1 });
    seedLinawCodificationRecord(db, b, { titleNumber: 3, chapterNumber: 1 });

    const outcome = assembleCode({
      edition: 'First Edition',
      userId,
      db,
      pipelineId: 'assemble-first',
    });
    assert.equal(outcome.ok, true, 'rejected rows do not block assembly');
    if (!outcome.ok) return;

    const res = outcome.response;
    assert.equal(res.title, 'Municipal Code of Ordinances');
    assert.equal(res.edition, 'First Edition');
    assert.equal(res.hitlRequired, true);
    assert.equal(res.gate, 'final_code_export');
    assert.ok(res.codeVolumeId.length > 0);
    assert.equal(res.counts.titles, 1);
    assert.equal(res.counts.chapters, 1);
    assert.equal(res.counts.sections, 2);

    // (f) codification side effects.
    const codA = db.prepare(`SELECT section_in_code, cod_status FROM codification_records WHERE ordinance_id = ?`).get(a) as {
      section_in_code: number;
      cod_status: string;
    };
    const codB = db.prepare(`SELECT section_in_code, cod_status FROM codification_records WHERE ordinance_id = ?`).get(b) as {
      section_in_code: number;
      cod_status: string;
    };
    assert.equal(codA.section_in_code, 1, 'ordinance order: (2020, 301) first');
    assert.equal(codB.section_in_code, 2);
    assert.equal(codA.cod_status, 'codified');
    assert.equal(codB.cod_status, 'codified');

    // Volume row: draft + structure parses back to the toc.
    const volume = latestVolume();
    assert.equal(volume.id, res.codeVolumeId);
    assert.equal(volume.status, 'draft');
    assert.equal(volume.title, 'Municipal Code of Ordinances');
    assert.equal(volume.edition, 'First Edition');
    assert.equal(volume.generated_by_id, userId);
    assert.ok(volume.generated_at);
    assert.deepEqual(
      JSON.parse(String(volume.structure)),
      JSON.parse(JSON.stringify(res.toc)),
      'structure parses back to the toc (undefined optionals dropped by JSON)'
    );

    // (g) agent-6 final_code_export HITL audit row.
    const hitl = db
      .prepare(
        `SELECT agent_id, action, reason FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'assemble-first' AND agent_id = 6 AND action = 'hitl'`
      )
      .all() as Array<{ agent_id: number; action: string; reason: string }>;
    assert.equal(hitl.length, 1);
    assert.match(hitl[0].reason, /^final_code_export:/);
  });

  // ── (c) hierarchy validity: titles/chapters/articles/sections + numbering ─

  const c = seedLinawReadyRecord(db, userId, { ordinanceNumber: 310, seriesYear: 2019 });
  const d = seedLinawReadyRecord(db, userId, { ordinanceNumber: 311, seriesYear: 2019 });
  const e = seedLinawReadyRecord(db, userId, { ordinanceNumber: 312, seriesYear: 2018 });
  const f = seedLinawReadyRecord(db, userId, { ordinanceNumber: 313, seriesYear: 2017 });
  const g = seedLinawReadyRecord(db, userId, { ordinanceNumber: 320, seriesYear: 2022 });
  seedLinawCodificationRecord(db, c, { titleNumber: 3, chapterNumber: 2, articleNumber: 1 });
  seedLinawCodificationRecord(db, d, { titleNumber: 3, chapterNumber: 2, articleNumber: 1 });
  seedLinawCodificationRecord(db, e, { titleNumber: 3, chapterNumber: 2, articleNumber: 2 });
  seedLinawCodificationRecord(db, f, { titleNumber: 3, chapterNumber: 2 });
  seedLinawCodificationRecord(db, g, { titleNumber: 6, chapterNumber: 1 });

  await t.test('hierarchy: names, grouping, chapter-scoped numbering, order', () => {
    const outcome = assembleCode({ edition: 'Hierarchy Edition', userId, db, pipelineId: 'assemble-hierarchy' });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    const toc = outcome.response.toc;

    // Titles ordered ascending + named from LINAW_CODE_TITLES.
    assert.deepEqual(
      toc.map((node) => node.title),
      ['Title 3 — Taxation and Revenue', 'Title 6 — Public Works and Infrastructure']
    );

    const title3 = toc[0];
    assert.deepEqual(
      title3.chapters.map((ch) => ch.name),
      ['Chapter 1', 'Chapter 2']
    );

    const chapter2 = title3.chapters[1];
    // Chapter-level section FIRST (f, S.2017), then article 1 (c,d), article 2 (e).
    assert.ok(chapter2.sections, 'chapter-level sections present (D11)');
    assert.equal(chapter2.sections.length, 1);
    assert.equal(chapter2.sections[0].ordinanceId, f);
    assert.equal(chapter2.sections[0].label, 'Section 1', 'chapter-level numbered first');

    assert.ok(chapter2.articles);
    assert.deepEqual(chapter2.articles.map((art) => art.name), ['Article 1', 'Article 2']);
    const art1 = chapter2.articles[0];
    assert.deepEqual(
      art1.sections.map((s) => s.ordinanceId),
      [c, d],
      'same-year ordinance order: number ascending'
    );
    assert.deepEqual(
      art1.sections.map((s) => s.label),
      ['Section 2', 'Section 3'],
      'article sections continue the chapter counter'
    );
    const art2 = chapter2.articles[1];
    assert.equal(art2.sections.length, 1);
    assert.equal(art2.sections[0].ordinanceId, e);
    assert.equal(art2.sections[0].label, 'Section 4');

    // Section refs carry additive display fields (D11).
    assert.equal(art1.sections[0].ordinanceNumber, 310);
    assert.equal(art1.sections[0].seriesYear, 2019);
    assert.equal(typeof art1.sections[0].title, 'string');

    // Second title is independent (own chapter).
    const title6 = toc[1];
    assert.equal(title6.chapters.length, 1);
    assert.equal(title6.chapters[0].name, 'Chapter 1');
    assert.equal(title6.chapters[0].sections?.length, 1);
    assert.equal(title6.chapters[0].sections?.[0].ordinanceId, g);
    assert.equal(title6.chapters[0].sections?.[0].label, 'Section 1', 'numbering restarts per chapter');

    assert.equal(outcome.response.counts.titles, 2);
    assert.equal(outcome.response.counts.chapters, 3);
    assert.equal(outcome.response.counts.sections, 7);
  });

  // ── (d) repealed ordinances excluded + reported ────────────────────────────

  const h = seedLinawReadyRecord(db, userId, { ordinanceNumber: 330, seriesYear: 2016 });
  seedLinawCodificationRecord(db, h, { titleNumber: 3, chapterNumber: 5 });

  await t.test('repealed ordinance: excluded + reported, absent from toc', () => {
    db.prepare(`UPDATE linaw_ordinances SET status = 'repealed' WHERE id = ?`).run(h);

    const outcome = assembleCode({ edition: 'Exclusion Edition', userId, db, pipelineId: 'assemble-excluded' });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;

    const excluded = outcome.response.excluded.find((x) => x.recordId === h);
    assert.ok(excluded, 'repealed row reported');
    assert.equal(excluded.status, 'repealed');
    assert.ok(outcome.response.exceptions.some((x) => x.includes('excluded')));

    const flat = JSON.stringify(outcome.response.toc);
    assert.ok(!flat.includes(h), 'repealed ordinance absent from the toc');
  });

  // ── (e) unclassified ready rows: reported, non-blocking ───────────────────

  const i = seedLinawReadyRecord(db, userId, { ordinanceNumber: 331, seriesYear: 2016 });

  await t.test('unclassified row: reported, assembly proceeds', () => {
    db.prepare(
      `INSERT INTO codification_records (id, ordinance_id, title_number, chapter_number, cod_status)
       VALUES (?, ?, NULL, NULL, 'unclassified')`
    ).run(crypto.randomUUID(), i);

    const outcome = assembleCode({ edition: 'Unclassified Edition', userId, db, pipelineId: 'assemble-unclassified' });
    assert.equal(outcome.ok, true, 'unclassified does not block');
    if (!outcome.ok) return;

    const unclassified = outcome.response.unclassified.find((u) => u.recordId === i);
    assert.ok(unclassified);
    assert.equal(unclassified.ordinanceNumber, 331);
    assert.ok(outcome.response.exceptions.some((x) => x.includes('unclassified')));
    assert.ok(!JSON.stringify(outcome.response.toc).includes(i));
  });

  // ── (i) out-of-range title number → 'Title N' fallback ────────────────────

  const j = seedLinawReadyRecord(db, userId, { ordinanceNumber: 332, seriesYear: 2015 });

  await t.test('out-of-range title number falls back to Title N', () => {
    seedLinawCodificationRecord(db, j, { titleNumber: 99, chapterNumber: 1 });
    const outcome = assembleCode({ edition: 'Fallback Edition', userId, db, pipelineId: 'assemble-fallback' });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.response.toc.some((node) => node.title === 'Title 99'));
  });

  // ── re-assembly creates a NEW draft volume (history preserved) ─────────────

  await t.test('each assemble writes a NEW volume row', () => {
    const before = volumeCount();
    const outcome = assembleCode({ edition: 'Repeat Edition', userId, db });
    assert.equal(outcome.ok, true);
    assert.equal(volumeCount(), before + 1);
    assert.equal(latestVolume().edition, 'Repeat Edition');
  });

  // ── (j) orchestrator 1→6 end-to-end with DI seams ─────────────────────────

  await t.test('runLinawPipeline: full 1→6 with review + assembly', async () => {
    const k = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 340,
      seriesYear: 2024,
      title: 'An ordinance on community gardens',
      content: 'Section 1. Title. Community gardens are established.',
      subjectTags: ['Agriculture'],
    });
    const l = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 341,
      seriesYear: 2024,
      title: 'An ordinance on composting programs',
      content: 'Section 1. Title. Composting programs are funded.',
      subjectTags: ['Agriculture'],
    });

    const pipelineId = 'pipeline-full-six';
    const res = await runLinawPipeline({
      ordinanceIds: [k, l],
      userId,
      db,
      pipelineId,
      edition: 'Pipeline Edition Test',
      classify: async () => ({ titleNumber: 9, chapterNumber: 2, confidence: 0.95 }),
      refine: async () => null,
      conflictLlm: async () => ({
        conflict: false,
        reason: '',
        confidence: 0,
        excerptsA: [],
        excerptsB: [],
      }),
    });

    // Review present + clear (all prior rows decided; DI seams persist none).
    assert.equal(res.review.pending, 0);
    assert.equal(res.review.hitlRequired, false);
    assert.ok(res.assembly, 'assembly ran (review clear)');
    assert.equal(res.assembly?.ok, true);
    if (res.assembly?.ok) {
      assert.equal(res.assembly.response.gate, 'final_code_export');
      assert.equal(res.assembly.response.edition, 'Pipeline Edition Test');
    }

    // Agents 1..6 all audited under the ONE pipeline id.
    const agentIds = db
      .prepare(
        `SELECT DISTINCT agent_id FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = ? ORDER BY agent_id`
      )
      .all(pipelineId) as Array<{ agent_id: number }>;
    assert.deepEqual(agentIds.map((r) => r.agent_id), [1, 2, 3, 4, 5, 6]);
  });

  // ── reviewRelationships counts after the full run (sanity) ────────────────

  await t.test('reviewRelationships reflects decided queue state', () => {
    const res = reviewRelationships({ userId, db, pipelineId: 'review-final-state' });
    assert.equal(res.pending, 0, 'everything decided over the suite');
    assert.ok(res.confirmed + res.rejected >= 1);
    assert.equal(res.hitlRequired, false);
  });
});
