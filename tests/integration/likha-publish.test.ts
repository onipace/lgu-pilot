// tests/integration/likha-publish.test.ts
// Sprint 3 (S3-C5) — L005 Archiver publish + BM25 entry tests (hermetic).
// Temp DB + temp LIKHA index path set BEFORE the dynamic imports; the dev
// index file is never touched (decision D13). The Archiver-gating subtest is
// the hard-gate proof: NOTHING publishes without a pending_review row that a
// human approved — processing/flagged/published rows are all refused.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { tempDbPath, tempIndexPath, seedPendingReviewRecord } from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
const INDEX_FILE = tempIndexPath();
process.env.DB_PATH = DB_FILE;
process.env.LIKHA_SEARCH_INDEX_PATH = INDEX_FILE;

const EXPECTED_HASH = 'deadbeef'.repeat(8);

test('likha publish suite', async (t) => {
  // Dynamic imports AFTER env is set (db.ts reads DB_PATH at module load).
  const { getDb } = await import('../../src/lib/db');
  const { publishApprovedRecord } = await import('../../src/lib/likha/archiver');
  const { createLikhaSearch } = await import('../../src/lib/likha/search');

  const db = getDb();

  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `publish-test-${Date.now()}@example.com`,
    'test-not-used',
    'Publish Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  /** Fresh reader over the shared temp index file (reads what the Archiver wrote). */
  const indexChecker = () => createLikhaSearch({ indexPath: INDEX_FILE });

  function agentRows(pipelineId: string): Array<{
    agent_id: number;
    agent_name: string;
    action: string;
    output_snapshot: string | null;
  }> {
    return db
      .prepare(
        `SELECT agent_id, agent_name, action, output_snapshot
         FROM agent_decisions WHERE module = 'likha' AND pipeline_id = ?
         ORDER BY created_at, rowid`
      )
      .all(pipelineId) as Array<{
      agent_id: number;
      agent_name: string;
      action: string;
      output_snapshot: string | null;
    }>;
  }

  t.after(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm', INDEX_FILE, INDEX_FILE + '.tmp']) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        // ignore
      }
    }
  });

  let approvedId = '';

  await t.test('publish on approval: published row + BM25 entry + agent-6 audit', () => {
    approvedId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 70,
      seriesYear: 2023,
      title: 'An ordinance revising the schedule of business permit fees',
    });

    const outcome = publishApprovedRecord({
      recordId: approvedId,
      userId,
      pipelineId: 'pub-ok',
      db,
    });
    assert.equal(outcome.ok, true);

    const row = db
      .prepare(
        `SELECT archive_status, file_hash, verified_by_id
         FROM archived_ordinances WHERE id = ?`
      )
      .get(approvedId) as {
      archive_status: string;
      file_hash: string;
      verified_by_id: string | null;
    };
    assert.equal(row.archive_status, 'published');
    assert.equal(row.file_hash, EXPECTED_HASH, 'hash stays cached — never cleared');
    assert.equal(row.verified_by_id, userId);

    // BM25 entry created in LIKHA's own namespace.
    const checker = indexChecker();
    assert.equal(checker.stats().totalDocs, 1);
    const found = checker.search('business permit fees', {});
    assert.equal(found.items.length, 1);
    assert.equal(found.items[0].id, approvedId);

    // Agent 6 audit: start + complete with bm25Indexed: true.
    const rows = agentRows('pub-ok');
    const starts = rows.filter((r) => r.agent_id === 6 && r.action === 'start');
    const completes = rows.filter((r) => r.agent_id === 6 && r.action === 'complete');
    assert.equal(starts.length, 1);
    assert.equal(completes.length, 1);
    assert.equal(completes[0].agent_name, 'Archiver');
    assert.ok(
      completes[0].output_snapshot?.includes('"bm25Indexed":true'),
      `complete snapshot records the index entry, got: ${completes[0].output_snapshot}`
    );

    // Publish is logged (module='likha').
    const logs = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM interaction_logs
         WHERE module = 'likha' AND interaction_type = 'likha_publish'`
      )
      .get() as { cnt: number };
    assert.ok(logs.cnt >= 1, 'likha_publish interaction log present');
  });

  await t.test('GATING: cannot publish without approval (processing/flagged/published refused)', () => {
    const before = indexChecker().stats().totalDocs;

    const processingId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 71,
      seriesYear: 2023,
      archiveStatus: 'processing',
    });
    const flaggedId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 72,
      seriesYear: 2023,
      archiveStatus: 'flagged',
    });
    const publishedId = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 73,
      seriesYear: 2023,
      archiveStatus: 'published',
    });

    const cases: Array<{ recordId: string; seededStatus: string }> = [
      { recordId: processingId, seededStatus: 'processing' },
      { recordId: flaggedId, seededStatus: 'flagged' },
      { recordId: publishedId, seededStatus: 'published' },
    ];

    for (const { recordId, seededStatus } of cases) {
      const outcome = publishApprovedRecord({ recordId, userId, db });
      assert.equal(outcome.ok, false, `row ${recordId} refused`);
      if (!outcome.ok) {
        assert.equal(outcome.kind, 'conflict');
        assert.match(outcome.error, /refused|not approved/i);
      }

      // No status change — the refusal leaves the row exactly where it was.
      const row = db
        .prepare('SELECT archive_status FROM archived_ordinances WHERE id = ?')
        .get(recordId) as { archive_status: string };
      assert.equal(row.archive_status, seededStatus, 'status untouched by refusal');
    }

    // No index entries created by refusals.
    assert.equal(indexChecker().stats().totalDocs, before);

    // No agent-6 complete rows for the refused attempts.
    for (const recordId of [processingId, flaggedId, publishedId]) {
      const completes = agentRows('publish-' + recordId).filter(
        (r) => r.agent_id === 6 && r.action === 'complete'
      );
      assert.equal(completes.length, 0, 'no Archiver complete row without approval');
    }

    // Rejected (flagged) records never publish — the hard gate.
    const flaggedRow = db
      .prepare('SELECT archive_status FROM archived_ordinances WHERE id = ?')
      .get(flaggedId) as { archive_status: string };
    assert.equal(flaggedRow.archive_status, 'flagged');
  });

  await t.test('re-publish updates the entry (never duplicates)', () => {
    // Simulate edit-approve again: reset the approved row to pending_review
    // with a corrected title, then publish once more.
    db.prepare(
      `UPDATE archived_ordinances
       SET archive_status = 'pending_review', title = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run('Revised business permit fee ordinance of 2023', approvedId);

    const outcome = publishApprovedRecord({
      recordId: approvedId,
      userId,
      pipelineId: 'pub-re',
      db,
    });
    assert.equal(outcome.ok, true);

    const checker = indexChecker();
    assert.equal(checker.stats().totalDocs, 1, 'entry updated, not duplicated');
    const res = checker.search('revised business permit fee', {});
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].id, approvedId);
    assert.equal(res.items[0].title, 'Revised business permit fee ordinance of 2023');
  });
});
