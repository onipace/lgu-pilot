// tests/unit/linaw-summaries.test.ts
// Sprint 7 (S7-C6) — N007 plain-language summary prompt builder + never-throws
// parser (pure functions — no DB). S7-C7 extends this suite with the hermetic
// engine subtests (summarizeReadyOrdinances + applySummaryEdit).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tempDbPath } from '../helpers/linaw-test-util';

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

test('linaw summaries suite', async (t) => {
  const {
    LINAW_SUMMARY_SYSTEM_PROMPT,
    buildLinawSummaryUserPrompt,
    parseLinawSummaryResponse,
  } = await import('../../src/lib/linaw/prompts');

  // ── Parser contract (pure, never throws) ──────────────────────────────────

  await t.test('plain passthrough', () => {
    const text = 'This ordinance regulates market fees for municipal stalls.';
    assert.equal(parseLinawSummaryResponse(text), text);
  });

  await t.test('strips markdown fences', () => {
    const parsed = parseLinawSummaryResponse(
      '```summary\nThis ordinance regulates market fees.\n```'
    );
    assert.equal(parsed, 'This ordinance regulates market fees.');
    const plainFence = parseLinawSummaryResponse('```\nPlain text body.\n```');
    assert.equal(plainFence, 'Plain text body.');
  });

  await t.test('drops leading labels', () => {
    assert.equal(
      parseLinawSummaryResponse('Summary: This ordinance regulates market fees.'),
      'This ordinance regulates market fees.'
    );
    assert.equal(
      parseLinawSummaryResponse('Plain-language summary: The measure sets market fees.'),
      'The measure sets market fees.'
    );
  });

  await t.test('strips surrounding quotes', () => {
    assert.equal(
      parseLinawSummaryResponse('"This ordinance regulates market fees."'),
      'This ordinance regulates market fees.'
    );
    assert.equal(
      parseLinawSummaryResponse('\u201CThis ordinance regulates market fees.\u201D'),
      'This ordinance regulates market fees.'
    );
  });

  await t.test('collapses internal whitespace runs', () => {
    assert.equal(
      parseLinawSummaryResponse('This   ordinance\n\nregulates\tmarket   fees.'),
      'This ordinance regulates market fees.'
    );
  });

  await t.test('600-char cap at a word boundary with ellipsis', () => {
    const words = Array.from({ length: 120 }, (_, i) => 'word' + i);
    const long = words.join(' '); // ~779 chars
    const parsed = parseLinawSummaryResponse(long);
    assert.ok(parsed.endsWith('\u2026'), 'trailing ellipsis added');
    assert.ok(parsed.length <= 601, `capped (got ${parsed.length})`);
    // Never mid-word: the char before the ellipsis ends a whole word.
    const body = parsed.slice(0, -1);
    assert.ok(long.startsWith(body), 'body is an exact prefix');
    assert.ok(body.endsWith(' '), 'cut happened at a space');
  });

  await t.test('short text is not capped or ellipsized', () => {
    const short = 'Short summary text.';
    assert.equal(parseLinawSummaryResponse(short), short);
  });

  await t.test('empty / whitespace / garbage → empty string (never throws)', () => {
    assert.equal(parseLinawSummaryResponse(''), '');
    assert.equal(parseLinawSummaryResponse('   \n\t '), '');
    assert.equal(parseLinawSummaryResponse('```'), '');
    assert.equal(parseLinawSummaryResponse('""'), '');
    assert.equal(parseLinawSummaryResponse(undefined as unknown as string), '');
    assert.equal(parseLinawSummaryResponse(null as unknown as string), '');
    assert.equal(parseLinawSummaryResponse(42 as unknown as string), '');
    assert.equal(parseLinawSummaryResponse('Summary:'), '');
  });

  // ── System prompt + builder (deterministic) ───────────────────────────────

  await t.test('system prompt: plain-language, summary-only posture', () => {
    assert.match(LINAW_SUMMARY_SYSTEM_PROMPT, /plain language/i);
    assert.match(LINAW_SUMMARY_SYSTEM_PROMPT, /2-3 sentences/);
  });

  await t.test('builder: includes number/year/title and truncates to 12,000', () => {
    const content = 'x'.repeat(20_000);
    const prompt = buildLinawSummaryUserPrompt({
      ordinanceNumber: 5,
      seriesYear: 2023,
      title: 'An ordinance regulating tricycle routes',
      content,
    });
    assert.ok(prompt.includes('Ordinance No. 5, Series of 2023'));
    assert.ok(prompt.includes('Title: An ordinance regulating tricycle routes'));
    assert.ok(prompt.includes('x'.repeat(12_000)));
    assert.ok(!prompt.includes('x'.repeat(12_001)), 'content capped at 12,000 chars');
  });

  // ── Engine subtests (S7-C7 — hermetic DB + DI summarize seam) ─────────────

  const { getDb } = await import('../../src/lib/db');
  const { summarizeReadyOrdinances, applySummaryEdit, LINAW_AGENT_NAMES } = await import(
    '../../src/lib/linaw/agents'
  );
  const { seedLinawReadyRecord, seedLinawPendingReviewRecord } = await import(
    '../helpers/linaw-test-util'
  );

  const db = getDb();
  const userId = 'summary-user';
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `summaries-test-${Date.now()}@example.com`,
    'test-not-used',
    'Summaries Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  function summaryOf(id: string): string | null {
    const row = db.prepare(`SELECT summary FROM linaw_ordinances WHERE id = ?`).get(id) as {
      summary: string | null;
    };
    return row.summary;
  }

  await t.test('LINAW_AGENT_NAMES[0] is the pre-pipeline Summary Generation name', () => {
    assert.equal(LINAW_AGENT_NAMES[0], 'Summary Generation');
  });

  await t.test('DI seam success: summary parsed + persisted + audited (agent 0)', async () => {
    const plain = seedLinawReadyRecord(db, userId, { ordinanceNumber: 201, seriesYear: 2021 });
    const labeled = seedLinawReadyRecord(db, userId, { ordinanceNumber: 202, seriesYear: 2021 });

    const res = await summarizeReadyOrdinances({
      ordinanceIds: [plain, labeled],
      userId,
      db,
      pipelineId: 'summarize-seam-ok',
      summarize: async (input) =>
        input.ordinanceNumber === 201
          ? 'Plain summary of the ordinance.'
          : 'Summary: Labeled output gets cleaned.',
    });

    assert.equal(res.summarized, 2);
    assert.equal(res.results.length, 2);
    assert.equal(res.failed.length, 0);
    assert.equal(summaryOf(plain), 'Plain summary of the ordinance.');
    assert.equal(summaryOf(labeled), 'Labeled output gets cleaned.', 'parser applied to seam output');

    const audits = db
      .prepare(
        `SELECT agent_id, agent_name, action FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'summarize-seam-ok' ORDER BY rowid`
      )
      .all() as Array<{ agent_id: number; agent_name: string; action: string }>;
    assert.equal(audits[0].action, 'start');
    assert.equal(audits[0].agent_id, 0);
    assert.equal(audits[0].agent_name, 'Summary Generation');
    assert.equal(audits[audits.length - 1].action, 'complete');
  });

  await t.test('throwing seam → failed entry, batch continues, never throws', async () => {
    const boom = seedLinawReadyRecord(db, userId, { ordinanceNumber: 203, seriesYear: 2021 });
    const fine = seedLinawReadyRecord(db, userId, { ordinanceNumber: 204, seriesYear: 2021 });

    const res = await summarizeReadyOrdinances({
      ordinanceIds: [boom, fine],
      userId,
      db,
      pipelineId: 'summarize-seam-throw',
      summarize: async (input) => {
        if (input.ordinanceNumber === 203) throw new Error('llm unavailable');
        return 'Recovered summary for the second record.';
      },
    });

    assert.equal(res.summarized, 1);
    assert.equal(res.failed.length, 1);
    assert.equal(res.failed[0].recordId, boom);
    assert.match(res.failed[0].reason, /llm unavailable/);
    assert.equal(summaryOf(boom), null, 'failed record keeps NULL summary');
    assert.equal(summaryOf(fine), 'Recovered summary for the second record.');
  });

  await t.test('empty parse result → failed entry (never a blank summary)', async () => {
    const blank = seedLinawReadyRecord(db, userId, { ordinanceNumber: 205, seriesYear: 2021 });
    const res = await summarizeReadyOrdinances({
      ordinanceIds: [blank],
      userId,
      db,
      pipelineId: 'summarize-seam-empty',
      summarize: async () => '```',
    });
    assert.equal(res.summarized, 0);
    assert.equal(res.failed.length, 1);
    assert.equal(summaryOf(blank), null);
  });

  await t.test('implicit batch skips has_summary rows; explicit ids regenerate', async () => {
    const withSummary = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 206,
      seriesYear: 2021,
      summary: 'A human-authored summary already on file.',
    });
    const withoutSummary = seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 207,
      seriesYear: 2021,
    });

    let seamCalls = 0;
    const implicit = await summarizeReadyOrdinances({
      userId,
      db,
      pipelineId: 'summarize-implicit',
      summarize: async () => {
        seamCalls += 1;
        return 'Generated implicitly.';
      },
    });

    // Scope = ALL ready rows without a summary at this point (201..207 minus the
    // ones already summarized above; only their skip/generation posture matters).
    const skippedWithSummary = implicit.skipped.filter((s) => s.recordId === withSummary);
    assert.equal(skippedWithSummary.length, 1);
    assert.equal(skippedWithSummary[0].reason, 'has_summary');
    assert.ok(
      implicit.results.some((r) => r.recordId === withoutSummary),
      'summary-less row was generated'
    );
    assert.equal(summaryOf(withSummary), 'A human-authored summary already on file.', 'untouched');
    assert.ok(seamCalls >= 1);

    // Explicit ids regenerate EVEN WHEN a summary exists.
    const explicit = await summarizeReadyOrdinances({
      ordinanceIds: [withSummary],
      userId,
      db,
      pipelineId: 'summarize-explicit-regen',
      summarize: async () => 'Regenerated on demand.',
    });
    assert.equal(explicit.summarized, 1);
    assert.equal(explicit.skipped.length, 0);
    assert.equal(summaryOf(withSummary), 'Regenerated on demand.');
  });

  await t.test('non-ready rows are never summarized (rule 4)', async () => {
    const pending = seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 208,
      seriesYear: 2021,
      libraryStatus: 'pending_review',
    });

    const explicit = await summarizeReadyOrdinances({
      ordinanceIds: [pending],
      userId,
      db,
      pipelineId: 'summarize-pending',
      summarize: async () => 'Should never run.',
    });
    assert.equal(explicit.summarized, 0);
    assert.equal(explicit.results.length, 0);
    const skipped = explicit.skipped.find((s) => s.recordId === pending);
    assert.ok(skipped);
    assert.equal(skipped.reason, 'not_summarizable:pending_review');
    assert.equal(summaryOf(pending), null);

    // Implicit scope never even lists non-ready rows.
    const implicit = await summarizeReadyOrdinances({
      userId,
      db,
      pipelineId: 'summarize-implicit-scope',
      summarize: async () => 'Should never run either.',
    });
    assert.ok(!implicit.results.some((r) => r.recordId === pending));
    assert.ok(!implicit.skipped.some((s) => s.recordId === pending));

    // Unknown explicit id → skipped not_found.
    const missing = await summarizeReadyOrdinances({
      ordinanceIds: ['does-not-exist'],
      userId,
      db,
      pipelineId: 'summarize-missing',
      summarize: async () => 'nope',
    });
    assert.equal(missing.skipped.length, 1);
    assert.equal(missing.skipped[0].reason, 'not_found');
  });

  await t.test('applySummaryEdit: round-trip + invalid/not_found/conflict', async () => {
    const ready = seedLinawReadyRecord(db, userId, { ordinanceNumber: 209, seriesYear: 2021 });
    const pending = seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 210,
      seriesYear: 2021,
      libraryStatus: 'pending_review',
    });

    const ok = applySummaryEdit({
      ordinanceId: ready,
      summary: '  Human-edited plain-language summary.  ',
      userId,
      db,
      pipelineId: 'summary-edit-ok',
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.response.recordId, ready);
      assert.equal(ok.response.summary, 'Human-edited plain-language summary.');
      assert.equal(ok.response.editedById, userId);
    }
    assert.equal(summaryOf(ready), 'Human-edited plain-language summary.');

    const editAudit = db
      .prepare(
        `SELECT agent_id, agent_name, action FROM agent_decisions
         WHERE module = 'linaw' AND pipeline_id = 'summary-edit-ok'`
      )
      .all() as Array<{ agent_id: number; agent_name: string; action: string }>;
    assert.equal(editAudit.length, 1);
    assert.equal(editAudit[0].agent_id, 0);
    assert.equal(editAudit[0].agent_name, 'Summary Edit');
    assert.equal(editAudit[0].action, 'confirm');

    const invalid = applySummaryEdit({ ordinanceId: ready, summary: '   ', userId, db });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.kind, 'invalid');

    const missing = applySummaryEdit({
      ordinanceId: 'no-such-ordinance',
      summary: 'Anything.',
      userId,
      db,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.kind, 'not_found');

    const conflict = applySummaryEdit({ ordinanceId: pending, summary: 'Anything.', userId, db });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.kind, 'conflict');
    assert.equal(summaryOf(pending), null, 'non-ready row untouched');
  });
});
