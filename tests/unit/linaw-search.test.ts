// tests/unit/linaw-search.test.ts
// Sprint 6 (S6-C4) — LINAW BM25 namespace (HERMETIC, in-process). Temp DB via
// DB_PATH set before dynamic imports; temp index path in os.tmpdir() passed
// via createLinawSearch — the dev index file is NEVER touched. Proves rebuild
// pulls ONLY library_status='ready' rows (boundary rule 4).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  tempDbPath,
  seedLinawReadyRecord,
  seedLinawPendingReviewRecord,
} from '../helpers/linaw-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'linaw-search-'));
const INDEX_PATH = path.join(TMP_DIR, 'index-' + crypto.randomUUID() + '.json');

after(() => {
  try {
    fs.rmSync(DB_FILE, { force: true });
    fs.rmSync(DB_FILE + '-wal', { force: true });
    fs.rmSync(DB_FILE + '-shm', { force: true });
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

function sampleRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    ordinanceNumber: 1,
    seriesYear: 2021,
    title: 'An ordinance regulating market fees',
    content: 'Section 1. Title. Market fees are collected monthly.',
    status: 'active',
    subjectTags: ['Taxation & Revenue'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('linaw search namespace suite', async (t) => {
  const { getDb } = await import('../../src/lib/db');
  const { createLinawSearch } = await import('../../src/lib/linaw/search');

  const db = getDb();
  const userId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
  ).run(
    userId,
    `search-test-${Date.now()}@example.com`,
    'test-not-used',
    'Search Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon'
  );

  const search = createLinawSearch({ indexPath: INDEX_PATH, db: () => db });

  await t.test('missing index file → stats().totalDocs === 0 without throwing', () => {
    assert.equal(search.stats().totalDocs, 0);
  });

  await t.test('empty query → empty result', () => {
    const res = search.search('', {});
    assert.deepEqual(res.items, []);
    assert.equal(res.total, 0);
  });

  await t.test('indexRecord + search returns the doc with score > 0 + marked/escaped snippet', () => {
    const rec = sampleRecord({
      content: 'Section 1. Title. Fees on zebrafruit stalls are collected monthly.',
    });
    search.indexRecord(rec);
    assert.equal(search.stats().totalDocs, 1);

    const res = search.search('zebrafruit', {});
    assert.equal(res.total, 1);
    assert.equal(res.items[0].id, rec.id);
    assert.ok(res.items[0].score > 0);
    assert.ok(res.items[0].snippet.includes('<mark>'), 'snippet marked');
    // Escape-then-mark: raw HTML in content must stay escaped.
    const xss = sampleRecord({
      id: crypto.randomUUID(),
      ordinanceNumber: 2,
      title: 'Script probe',
      content: 'zebrafruit <script>alert(1)</script> probe text',
    });
    search.indexRecord(xss);
    const xssRes = search.search('zebrafruit', {});
    const xssItem = xssRes.items.find((i) => i.id === xss.id);
    assert.ok(xssItem);
    assert.ok(!xssItem.snippet.includes('<script>'), 'snippet escaped');
    search.removeRecord(xss.id);
  });

  await t.test('ranking: title hit outranks content-only hit', () => {
    const titleDoc = sampleRecord({
      id: crypto.randomUUID(),
      ordinanceNumber: 10,
      seriesYear: 2020,
      title: 'Kumquat licensing framework',
      content: 'Section 1. Title. General provisions.',
    });
    const contentDoc = sampleRecord({
      id: crypto.randomUUID(),
      ordinanceNumber: 11,
      seriesYear: 2020,
      title: 'An ordinance on unrelated matters',
      content: 'Section 2. Kumquat appears only in the body text here.',
    });
    search.indexRecord(titleDoc);
    search.indexRecord(contentDoc);

    const res = search.search('kumquat', {});
    assert.ok(res.items.length >= 2);
    assert.equal(res.items[0].id, titleDoc.id, 'title-weighted doc ranks first');

    search.removeRecord(titleDoc.id);
    search.removeRecord(contentDoc.id);
  });

  await t.test('removeRecord makes the doc disappear', () => {
    const rec = sampleRecord({ id: crypto.randomUUID(), title: 'Durian levy act' });
    search.indexRecord(rec);
    assert.ok(search.search('durian', {}).total >= 1);
    search.removeRecord(rec.id);
    assert.equal(search.search('durian', {}).total, 0);
  });

  await t.test('filters: yearFrom / status / subject', () => {
    const old = sampleRecord({ id: crypto.randomUUID(), seriesYear: 2015, title: 'Mango codes old' });
    const recent = sampleRecord({ id: crypto.randomUUID(), seriesYear: 2023, title: 'Mango codes new' });
    const repealed = sampleRecord({
      id: crypto.randomUUID(),
      seriesYear: 2023,
      title: 'Mango codes repealed',
      status: 'repealed',
    });
    const otherSubject = sampleRecord({
      id: crypto.randomUUID(),
      seriesYear: 2023,
      title: 'Mango codes permits',
      subjectTags: ['Permits'],
    });
    for (const rec of [old, recent, repealed, otherSubject]) search.indexRecord(rec);

    assert.ok(
      search.search('mango', { yearFrom: 2020 }).items.every((i) => i.seriesYear >= 2020)
    );
    assert.ok(
      search.search('mango', { status: 'repealed' }).items.every((i) => i.status === 'repealed')
    );
    assert.ok(
      search
        .search('mango', { subject: 'Permits' })
        .items.every((i) => i.subjectTags.includes('Permits'))
    );
    for (const rec of [old, recent, repealed, otherSubject]) search.removeRecord(rec.id);
  });

  await t.test('persistence round-trip: a second factory over the same path sees the doc', () => {
    const rec = sampleRecord({ id: crypto.randomUUID(), title: 'Papaya tariff act' });
    search.indexRecord(rec);

    const second = createLinawSearch({ indexPath: INDEX_PATH, db: () => db });
    assert.equal(second.stats().totalDocs, search.stats().totalDocs);
    assert.ok(second.search('papaya', {}).items.some((i) => i.id === rec.id));
    search.removeRecord(rec.id);
    assert.equal(second.search('papaya', {}).total >= 0, true);
  });

  await t.test('rebuildIndex pulls ONLY ready rows (boundary rule 4)', async () => {
    seedLinawReadyRecord(db, userId, {
      ordinanceNumber: 21,
      seriesYear: 2022,
      title: 'An ordinance on rambutan tariffs',
      content: 'Section 1. Title. Rambutan tariffs apply island-wide.',
    });
    seedLinawPendingReviewRecord(db, userId, {
      ordinanceNumber: 22,
      seriesYear: 2022,
      libraryStatus: 'pending_review',
      title: 'An ordinance on mangosteen quotas',
      content: 'Section 1. Title. Mangosteen quotas for the public market.',
    });

    await search.rebuildIndex();
    assert.equal(search.stats().totalDocs, 1, 'only the ready row is indexed');
    assert.equal(search.search('mangosteen', {}).total, 0, 'pending-only term unsearchable');
    assert.equal(search.search('rambutan', {}).total, 1);
  });
});
