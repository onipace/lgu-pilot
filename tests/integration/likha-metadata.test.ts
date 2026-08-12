// tests/integration/likha-metadata.test.ts
// Sprint 2 (S2-C7) — L003 metadata parsing + persistence test (hermetic).
// No server, no network: DB_PATH points at a fresh temp DB set BEFORE the
// dynamic imports (db.ts reads DB_PATH at module load); OCR + extraction are
// injected stubs. node:test + node:assert/strict, relative imports only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { tempDbPath } from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

const FIXTURE_SCAN = 'tests/fixtures/likha/sample-ordinance.pdf';

interface MinimalParsed {
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  sectionCount: number;
  confidence: {
    ordinanceNumber: number;
    seriesYear: number;
    title: number;
    sectionCount: number;
  };
}

const STUB_CONFIDENCE = {
  ordinanceNumber: 0.92,
  seriesYear: 0.95,
  title: 0.9,
  sectionCount: 0.88,
};

test('likha metadata pipeline suite', async (t) => {
  // Dynamic imports AFTER DB_PATH is set.
  const { getDb } = await import('../../src/lib/db');
  const { runLikhaPipeline } = await import('../../src/lib/likha/agents');
  const prompts = await import('../../src/lib/likha/prompts');

  const db = getDb();

  // Seed one approved uploader.
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `meta-test-${Date.now()}@example.com`,
    'test-not-used',
    'Metadata Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  /** Seed a D6-placeholder processing row with an OLD updated_at so the UPDATE is observable. */
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

  const stubOcr = async () => ({ text: 'FAKE RAW TEXT', model: 'stub', attempts: 1 });

  t.after(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(DB_FILE, { force: true });
      fs.rmSync(DB_FILE + '-wal', { force: true });
      fs.rmSync(DB_FILE + '-shm', { force: true });
    } catch {
      // ignore
    }
  });

  await t.test('parse + persist: rows reach pending_review with metadata + confidence', async () => {
    const id1 = seedProcessingRow();
    const id2 = seedProcessingRow();

    // UNIQUE(ordinance_number, series_year) means two rows cannot share (5, 2023);
    // the stub therefore yields distinct metadata per call (file1 → 5/2023, file2 → 6/2023).
    let callCount = 0;
    const stubExtract = async (_rawText: string): Promise<MinimalParsed> => {
      callCount += 1;
      return {
        ordinanceNumber: callCount === 1 ? 5 : 6,
        seriesYear: 2023,
        title: 'An ordinance revising business permit fees',
        sectionCount: 12,
        confidence: { ...STUB_CONFIDENCE },
      };
    };

    const res = await runLikhaPipeline({
      pipelineId: 'p1',
      userId,
      files: [fileInput(id1), fileInput(id2)],
      ocr: stubOcr,
      extractMetadata: stubExtract,
      // Sprint 4 (D24/D32): agent 4 is real — hermetic tests inject the seam.
      // (p2/p3 below fail at agents 2/3 and never reach the classifier.)
      classify: async () => [{ label: 'General Provisions', confidence: 0.9 }],
    });

    assert.equal(res.processed, 2);
    assert.equal(res.failed, 0);
    assert.equal(res.files.length, 2);
    for (const f of res.files) {
      assert.equal(f.ok, true);
      assert.equal(f.archiveStatus, 'pending_review');
      assert.equal(f.rawTextLength, 'FAKE RAW TEXT'.length);
    }

    const rows = [id1, id2].map(
      (id) =>
        db
          .prepare(
            `SELECT ordinance_number, series_year, title, content, archive_status,
                    extraction_confidence, updated_at
             FROM archived_ordinances WHERE id = ?`
          )
          .get(id) as {
          ordinance_number: number;
          series_year: number;
          title: string;
          content: string;
          archive_status: string;
          extraction_confidence: string | null;
          updated_at: string;
        }
    );

    assert.equal(rows[0].ordinance_number, 5);
    assert.equal(rows[1].ordinance_number, 6);
    for (const row of rows) {
      assert.equal(row.series_year, 2023);
      assert.equal(row.title, 'An ordinance revising business permit fees');
      assert.equal(row.content, 'FAKE RAW TEXT');
      assert.equal(row.archive_status, 'pending_review');
      assert.notEqual(row.updated_at, '2020-01-01 00:00:00', 'updated_at changed');
      const conf = JSON.parse(row.extraction_confidence ?? '{}');
      assert.equal(conf.ordinanceNumber, 0.92);
    }
  });

  await t.test('audit trail: agents 2 + 3 start/complete rows with snapshots', async () => {
    const decisions = db
      .prepare(
        `SELECT agent_id, agent_name, action, output_snapshot, confidence
         FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = 'p1'
         ORDER BY created_at`
      )
      .all() as Array<{
      agent_id: number;
      agent_name: string;
      action: string;
      output_snapshot: string | null;
      confidence: number | null;
    }>;

    for (const agentId of [2, 3]) {
      const forAgent = decisions.filter((d) => d.agent_id === agentId);
      const actions = forAgent.map((d) => d.action);
      assert.ok(actions.includes('start'), `agent ${agentId} start row`);
      assert.ok(actions.includes('complete'), `agent ${agentId} complete row`);
      assert.equal(forAgent[0].agent_name, agentId === 2 ? 'OCR Extractor' : 'Metadata Parser');
    }

    const ocrComplete = decisions.find((d) => d.agent_id === 2 && d.action === 'complete');
    assert.ok(ocrComplete?.output_snapshot);
    const ocrOut = JSON.parse(ocrComplete!.output_snapshot!);
    assert.equal(ocrOut.rawTextLength, 'FAKE RAW TEXT'.length);
    assert.equal(ocrOut.model, 'stub');

    const parserComplete = decisions.find((d) => d.agent_id === 3 && d.action === 'complete');
    assert.ok(parserComplete?.output_snapshot);
    const parsedOut = JSON.parse(parserComplete!.output_snapshot!);
    assert.equal(parsedOut.seriesYear, 2023);
    assert.equal(parsedOut.title, 'An ordinance revising business permit fees');
    assert.equal(parsedOut.sectionCount, 12);

    // confidence column = average of the four field confidences ±0.01
    const expectedAvg =
      (STUB_CONFIDENCE.ordinanceNumber +
        STUB_CONFIDENCE.seriesYear +
        STUB_CONFIDENCE.title +
        STUB_CONFIDENCE.sectionCount) /
      4;
    assert.ok(parserComplete!.confidence !== null);
    assert.ok(Math.abs(parserComplete!.confidence! - expectedAvg) <= 0.01);
  });

  await t.test('OCR failure flags the row and records an agent-2 error row', async () => {
    const id = seedProcessingRow();
    const failingOcr = async () => {
      throw new Error('boom');
    };

    const res = await runLikhaPipeline({
      pipelineId: 'p2',
      userId,
      files: [fileInput(id)],
      ocr: failingOcr,
      extractMetadata: async () => ({
        ordinanceNumber: 9,
        seriesYear: 2023,
        title: 'x',
        sectionCount: 1,
        confidence: { ...STUB_CONFIDENCE },
      }),
    });

    assert.equal(res.failed, 1);
    assert.equal(res.processed, 0);
    const entry = res.files[0];
    assert.equal(entry.ok, false);
    assert.equal(entry.failedAgent, 2);
    assert.match(entry.error ?? '', /boom/);
    assert.equal(entry.archiveStatus, 'flagged');

    const row = db
      .prepare('SELECT archive_status FROM archived_ordinances WHERE id = ?')
      .get(id) as { archive_status: string };
    assert.equal(row.archive_status, 'flagged');

    const errorRow = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM agent_decisions
         WHERE module = 'likha' AND pipeline_id = 'p2' AND agent_id = 2 AND action = 'error'`
      )
      .get() as { cnt: number };
    assert.ok(errorRow.cnt >= 1);
  });

  await t.test('UNIQUE conflict flags the row without crashing the batch', async () => {
    // Existing published holder of (50, 2019) — same target the stub parses.
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, source_type,
          archive_status, uploaded_by_id)
       VALUES (?, 50, 2019, 'Existing holder', 'existing content', 'scan', 'published', ?)`
    ).run(crypto.randomUUID(), userId);

    const id = seedProcessingRow();
    const res = await runLikhaPipeline({
      pipelineId: 'p3',
      userId,
      files: [fileInput(id)],
      ocr: stubOcr,
      extractMetadata: async () => ({
        ordinanceNumber: 50,
        seriesYear: 2019,
        title: 'An ordinance revising business permit fees',
        sectionCount: 12,
        confidence: { ...STUB_CONFIDENCE },
      }),
    });

    assert.equal(res.processed, 0);
    assert.equal(res.failed, 1);
    const entry = res.files[0];
    assert.equal(entry.ok, false);
    assert.equal(entry.archiveStatus, 'flagged');
    assert.match(entry.error ?? '', /duplicate|conflict/i);

    const row = db
      .prepare('SELECT archive_status FROM archived_ordinances WHERE id = ?')
      .get(id) as { archive_status: string };
    assert.equal(row.archive_status, 'flagged');
  });

  await t.test('prompts: fence stripping, garbage tolerance, confidence clamping', async () => {
    const validJson = JSON.stringify({
      ordinanceNumber: 12,
      seriesYear: 2021,
      title: 'An ordinance establishing the municipal library',
      sectionCount: 4,
      confidence: { ordinanceNumber: 0.9, seriesYear: 0.8, title: 0.7, sectionCount: 0.6 },
    });

    const fenced = prompts.parseMetadataResponse('```json\n' + validJson + '\n```');
    assert.equal(fenced.ordinanceNumber, 12);
    assert.equal(fenced.seriesYear, 2021);
    assert.equal(fenced.title, 'An ordinance establishing the municipal library');
    assert.equal(fenced.sectionCount, 4);
    assert.deepEqual(fenced.confidence, {
      ordinanceNumber: 0.9,
      seriesYear: 0.8,
      title: 0.7,
      sectionCount: 0.6,
    });

    const garbage = prompts.parseMetadataResponse('Sorry, I cannot help with that.');
    assert.equal(garbage.ordinanceNumber, 0);
    assert.equal(garbage.seriesYear, 0);
    assert.equal(garbage.title, '');
    assert.equal(garbage.sectionCount, 0);
    assert.deepEqual(garbage.confidence, {
      ordinanceNumber: 0,
      seriesYear: 0,
      title: 0,
      sectionCount: 0,
    });

    const clamped = prompts.parseMetadataResponse(
      JSON.stringify({
        ordinanceNumber: 3,
        seriesYear: 2020,
        title: 't',
        sectionCount: 1,
        confidence: {
          ordinanceNumber: 1.7,
          seriesYear: -0.5,
          title: 'not-a-number',
          sectionCount: null,
        },
      })
    );
    assert.equal(clamped.confidence.ordinanceNumber, 1);
    assert.equal(clamped.confidence.seriesYear, 0);
    assert.equal(clamped.confidence.title, 0);
    assert.equal(clamped.confidence.sectionCount, 0);
  });
});
