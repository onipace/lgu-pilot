// tests/integration/linaw-inventory.test.ts
// Sprint 6 (S6-C5) — N001 GET /api/linaw/inventory API-level suite.
// Runs against a running dev server: helper seeds an approved user + session
// directly into data/workshop.db, test rows go in via better-sqlite3 with
// DISTINCTIVE ordinance numbers AND series years, and every seeded row +
// audit row is cleaned up in t.after.
//
// Concurrency note: tsx --test runs the integration files in parallel against
// the SAME data/workshop.db, so this suite asserts on its own distinctive
// years (2987–2989 — no other suite seeds there) instead of absolute global
// totals. The ready-only law is proven by the pending_review year surfacing
// as a WHOLE MISSING year (boundary rule 4); the ≤2s SLA (PRD §6.8 feature 1)
// and agent-1 audit rows are asserted per-user.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { BASE_URL, assertServerReachable, seedApprovedUser } from '../helpers/linaw-test-util';

const INVENTORY_URL = BASE_URL + '/api/linaw/inventory';

async function api(urlPath: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(BASE_URL + urlPath, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

test('linaw inventory api suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  const authed = { headers: { Cookie: cookie } };

  // Distinctive ordinance numbers — never collide with pre-existing dev rows.
  const base = 960_000 + crypto.randomInt(0, 30_000);
  // Distinctive SERIES YEARS — no other suite seeds linaw rows anywhere near
  // 2987–2989, which keeps the assertions safe under parallel test files.
  const YEAR_A = 2987;
  const YEAR_GAP = 2988; // seeded pending_review only → must surface as a gap
  const YEAR_B = 2989;

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    libraryStatus: 'pending_review' | 'ready';
  }): string {
    const id = crypto.randomUUID();
    seededIds.push(id);
    db.prepare(
      `INSERT INTO linaw_ordinances
         (id, ordinance_number, series_year, title, content, subject_tags,
          source_type, source_filename, file_hash, library_status, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, '[]', 'import', NULL, NULL, ?, ?)`
    ).run(
      id,
      opts.ordinanceNumber,
      opts.seriesYear,
      'An ordinance for the inventory integration suite',
      'Section 1. Title. Integration test body.',
      opts.libraryStatus,
      userId
    );
    return id;
  }

  // Ready rows at YEARS A and B; the pending_review row sits in the YEAR_GAP
  // between them — its year must count as MISSING (ready-only law, rule 4).
  seedRow({ ordinanceNumber: base + 1, seriesYear: YEAR_A, libraryStatus: 'ready' });
  seedRow({ ordinanceNumber: base + 2, seriesYear: YEAR_B, libraryStatus: 'ready' });
  seedRow({ ordinanceNumber: base + 3, seriesYear: YEAR_GAP, libraryStatus: 'pending_review' });

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM ordinance_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        db.prepare('DELETE FROM codification_records WHERE ordinance_id = ?').run(id);
        db.prepare('DELETE FROM linaw_ordinances WHERE id = ?').run(id);
      }
      db.prepare(`DELETE FROM agent_decisions WHERE module = 'linaw' AND user_id = ?`).run(userId);
      db.prepare(`DELETE FROM interaction_logs WHERE participant_session_id = ?`).run('linaw-' + userId);
      db.prepare(`DELETE FROM participant_sessions WHERE id = ?`).run('linaw-' + userId);
    } finally {
      db.close();
      cleanup();
    }
  });

  await t.test('401 without cookie (exact NO_SESSION envelope)', async () => {
    const res = await api('/api/linaw/inventory');
    assert.equal(res.status, 401);
    assert.equal(res.body?.error, 'Authentication required');
    assert.equal(res.body?.code, 'NO_SESSION');
  });

  await t.test('ready-only math over HTTP + ≤2s SLA + audit rows', async () => {
    const wallStart = Date.now();
    const res = await api('/api/linaw/inventory', authed);
    const wallMs = Date.now() - wallStart;

    assert.equal(res.status, 200);
    const body = res.body;

    // Shape + SLA fields.
    assert.equal(typeof body.totals.ordinances, 'number');
    assert.ok(body.totals.ordinances >= 2, 'at least the two seeded ready rows');
    assert.ok(Array.isArray(body.byYear));
    assert.ok(Array.isArray(body.yearGaps));

    // SYSTEM_TEST D-2 contract: gap emission is bounded — never more than 500
    // yearGaps entries, every missing[] list capped at 500, and `truncated`
    // reports whether either cap tripped.
    assert.ok(body.yearGaps.length <= 500, 'yearGaps bounded at 500 entries');
    assert.equal(typeof body.truncated, 'boolean', 'truncated flag always present');
    for (const g of body.yearGaps) {
      assert.ok(Array.isArray(g.missing) && g.missing.length <= 500);
    }

    // Ready-only proof: the seeded ready years appear with count 1; the
    // pending_review year NEVER appears in byYear and instead surfaces as a
    // whole missing year in yearGaps — unless the shared ready corpus
    // (parallel suites + pre-existing residue rows) stretches the window far
    // enough that the 500-entry cap is exhausted before reaching it, in
    // which case truncated must say so.
    const yearA = body.byYear.find((y: any) => y.year === YEAR_A);
    const yearB = body.byYear.find((y: any) => y.year === YEAR_B);
    assert.equal(yearA?.count, 1, 'ready year A counted');
    assert.equal(yearB?.count, 1, 'ready year B counted');
    assert.ok(
      !body.byYear.some((y: any) => y.year === YEAR_GAP),
      'pending_review year never enters byYear'
    );
    const gap = body.yearGaps.find((g: any) => g.year === YEAR_GAP);
    if (gap) {
      assert.deepEqual(gap, { year: YEAR_GAP, missing: [] }, 'pending year = missing year');
    } else {
      assert.equal(
        body.truncated,
        true,
        'YEAR_GAP beyond the capped window requires truncated:true'
      );
    }

    // Completeness score is a sane percentage (its exact value depends on the
    // whole shared ready library, which parallel suites also seed).
    assert.equal(typeof body.completenessScore, 'number');
    assert.ok(body.completenessScore >= 0 && body.completenessScore <= 100);

    // ≤2s SLA (PRD §6.8 feature 1): server-side + wall clock.
    assert.equal(typeof body.tookMs, 'number');
    assert.ok(body.tookMs <= 2000, `tookMs ${body.tookMs} <= 2000`);
    assert.ok(wallMs < 2000, `wall clock ${wallMs}ms < 2000ms`);

    // Audit over HTTP: agent-1 rows exist for the seeded user (scoped query).
    const audits = db
      .prepare(
        `SELECT agent_name, action FROM agent_decisions
         WHERE module = 'linaw' AND agent_id = 1 AND user_id = ?`
      )
      .all(userId) as Array<{ agent_name: string; action: string }>;
    assert.ok(audits.length >= 1, 'agent-1 audit rows present');
    assert.ok(audits.every((a) => a.agent_name === 'Inventory Analyst'));
    assert.ok(audits.some((a) => a.action === 'start'));
    assert.ok(audits.some((a) => a.action === 'complete'));
  });
});
