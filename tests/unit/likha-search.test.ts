// tests/unit/likha-search.test.ts
// Sprint 3 (S3-C5) — LIKHA BM25 namespace contract tests (hermetic).
// Every instance injects a temp index path (decision D13) — the dev index file
// (src/lib/data/likha-search-index.json) is NEVER touched by these tests.
// node:test + node:assert/strict, relative imports only (no @/ alias).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  tempDbPath,
  tempIndexPath,
  seedPendingReviewRecord,
} from '../helpers/likha-test-util';

const DB_FILE = tempDbPath();
process.env.DB_PATH = DB_FILE;

const SUBJECT_TAX = 'Taxation & Revenue';
const SUBJECT_HEALTH = 'Health & Sanitation';

interface SeedOverrides {
  id?: string;
  ordinanceNumber?: number;
  seriesYear?: number;
  title?: string;
  content?: string;
  status?: string;
  subjectTags?: string[];
  sectionCount?: number | null;
}

/** Deterministic indexable record for the search-module contract tests. */
function seedRecord(overrides?: SeedOverrides) {
  const id = overrides?.id ?? crypto.randomUUID();
  return {
    id,
    ordinanceNumber: overrides?.ordinanceNumber ?? 1,
    seriesYear: overrides?.seriesYear ?? 2020,
    title: overrides?.title ?? 'An ordinance regulating municipal markets',
    content:
      overrides?.content ??
      'Section 1. Title. This ordinance regulates municipal markets. Section 2. Penalties apply.',
    status: overrides?.status ?? 'active',
    subjectTags: overrides?.subjectTags ?? [],
    sectionCount: overrides?.sectionCount ?? 4,
    createdAt: '2020-01-15 00:00:00',
  };
}

test('likha search suite', async (t) => {
  // Dynamic import AFTER env is set (module reads DB_PATH at load).
  const { createLikhaSearch } = await import('../../src/lib/likha/search');

  const tempFiles: string[] = [];
  function freshIndexPath(): string {
    const p = tempIndexPath();
    tempFiles.push(p);
    return p;
  }

  t.after(() => {
    for (const f of [...tempFiles, DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) {
      try {
        fs.rmSync(f, { force: true });
        fs.rmSync(f + '.tmp', { force: true });
      } catch {
        // ignore
      }
    }
  });

  await t.test('index entry create/update (upsert by id)', () => {
    const s = createLikhaSearch({ indexPath: freshIndexPath() });
    s.indexRecord(seedRecord({ id: 'a', title: 'Fee ordinance' }));
    assert.equal(s.stats().totalDocs, 1);

    s.indexRecord(seedRecord({ id: 'a', title: 'Fee ordinance (revised)' }));
    assert.equal(s.stats().totalDocs, 1, 're-index same id updates, never duplicates');

    const res = s.search('fee ordinance', {});
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].title, 'Fee ordinance (revised)');
  });

  await t.test('index file shape mirrors the sibling pattern', () => {
    const indexPath = freshIndexPath();
    const s = createLikhaSearch({ indexPath });
    s.indexRecord(seedRecord({ id: 'shape-1' }));

    const onDisk = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(onDisk).sort(),
      ['avgDocLength', 'documents', 'idf', 'totalDocs'].sort(),
      'same four keys as src/lib/data/search-index.json'
    );
    assert.equal(onDisk.totalDocs, 1);
    assert.ok(Array.isArray(onDisk.documents));
    assert.equal(typeof onDisk.avgDocLength, 'number');
    assert.equal(typeof onDisk.idf, 'object');
  });

  await t.test('BM25 ranking + year/status/subject filters', () => {
    const s = createLikhaSearch({ indexPath: freshIndexPath() });

    // The phrase-match record: phrase in BOTH title and content.
    s.indexRecord(
      seedRecord({
        id: 'bp-title',
        ordinanceNumber: 5,
        seriesYear: 2023,
        status: 'active',
        subjectTags: [SUBJECT_TAX],
        title: 'An ordinance revising the schedule of business permit fees',
        content:
          'Section 1. Title. This ordinance revises the schedule of business permit fees. ' +
          'Section 2. Rates. The business permit fees shall be collected annually.',
      })
    );
    // Phrase in content ONLY (title-match must outrank it via the x2 title weight).
    s.indexRecord(
      seedRecord({
        id: 'bp-content',
        ordinanceNumber: 6,
        seriesYear: 2022,
        status: 'amended',
        title: 'Fee structure update ordinance',
        content:
          'Section 1. Title. Fee structure update. Section 3. The schedule of business permit ' +
          'fees is hereby amended insofar as collections go.',
      })
    );
    // Ten filler records with varied years / statuses / subjects.
    const statuses = ['active', 'amended', 'repealed', 'superseded', 'expired'];
    for (let i = 0; i < 10; i += 1) {
      s.indexRecord(
        seedRecord({
          id: `filler-${i}`,
          ordinanceNumber: 100 + i,
          seriesYear: 2015 + i,
          status: statuses[i % statuses.length],
          subjectTags: i % 2 === 0 ? [SUBJECT_HEALTH] : [],
          title: `Municipal ordinance number ${100 + i} concerning local governance`,
          content: `Section 1. Title. Ordinance ${100 + i} provisions for local governance and administration.`,
        })
      );
    }
    assert.equal(s.stats().totalDocs, 12);

    // Ranking: the title-match outranks the content-only match.
    const ranked = s.search('business permit fees', {});
    assert.ok(ranked.items.length >= 2, 'both phrase matches returned');
    assert.equal(ranked.items[0].id, 'bp-title', 'title-match ranks first (x2 title weight)');
    assert.ok(ranked.items.every((item) => typeof item.score === 'number' && item.score > 0));

    // Year range excludes out-of-range docs.
    const years = s.search('ordinance', { yearFrom: 2020, yearTo: 2023 });
    assert.ok(years.items.length >= 1);
    for (const item of years.items) {
      assert.ok(
        item.seriesYear >= 2020 && item.seriesYear <= 2023,
        `year ${item.seriesYear} inside range`
      );
    }

    // Legal-status filter.
    const amended = s.search('ordinance', { status: 'amended' });
    assert.ok(amended.items.length >= 1);
    assert.ok(amended.items.every((item) => item.status === 'amended'));

    // Subject filter.
    const taxed = s.search('ordinance', { subject: SUBJECT_TAX });
    assert.ok(taxed.items.length >= 1);
    assert.ok(taxed.items.every((item) => item.subjectTags.includes(SUBJECT_TAX)));

    // Empty query returns [] (listing without q is SQL-side).
    assert.deepEqual(s.search('', {}).items, []);
    assert.deepEqual(s.search('   ', {}).items, []);
  });

  await t.test('highlighted snippets are escape-safe and bounded', () => {
    const s = createLikhaSearch({ indexPath: freshIndexPath() });
    s.indexRecord(
      seedRecord({
        id: 'bp-snippet',
        seriesYear: 2023,
        title: 'An ordinance revising the schedule of business permit fees',
        content:
          'Section 1. Title. This ordinance revises the schedule of business permit fees. ' +
          'Section 2. Rates. The fees apply to all businesses.',
      })
    );
    s.indexRecord(
      seedRecord({
        id: 'xss',
        seriesYear: 2021,
        title: 'Sanitation enforcement ordinance',
        content:
          'Section 1. <script>alert(1)</script> sanitation permit inspection fees and sanitation enforcement.',
      })
    );

    const res = s.search('business permit fees', {});
    const snippet = res.items[0].snippet;
    assert.ok(
      snippet.includes('<mark>business permit fees</mark>'),
      `phrase wrapped in <mark>, got: ${snippet}`
    );
    assert.ok(snippet.length <= 280, `snippet bounded (got ${snippet.length} chars)`);

    const xss = s.search('sanitation', {});
    const xssItem = xss.items.find((item) => item.id === 'xss');
    assert.ok(xssItem, 'xss record found');
    assert.ok(!xssItem!.snippet.includes('<script>'), 'no raw <script> in snippet');
    assert.ok(
      xssItem!.snippet.includes('&lt;script&gt;'),
      'source angle brackets escaped before marking'
    );
    assert.ok(xssItem!.snippet.length <= 280);
  });

  await t.test('<500ms search over 500 seeded docs (first call after load)', () => {
    const sharedPath = freshIndexPath();
    const writer = createLikhaSearch({ indexPath: sharedPath });
    const topics = ['markets', 'tricycles', 'sanitation', 'zoning', 'health', 'budget', 'personnel', 'environment'];
    for (let i = 0; i < 500; i += 1) {
      writer.indexRecord(
        seedRecord({
          id: `bulk-${i}`,
          ordinanceNumber: i + 1,
          seriesYear: 1990 + (i % 35),
          status: i % 4 === 0 ? 'amended' : 'active',
          title: `Ordinance ${i + 1} concerning ${topics[i % topics.length]}`,
          content:
            `Section 1. Title. Ordinance ${i + 1} concerning ${topics[i % topics.length]}. ` +
            (i % 3 === 0
              ? 'Section 2. The permit fees schedule for business permits is revised. '
              : 'Section 2. General provisions apply to this enactment. ') +
            'Section 3. Effectivity. This ordinance takes effect upon approval.',
        })
      );
    }
    assert.equal(writer.stats().totalDocs, 500);

    // Fresh instance → includes the lazy file load in the timed first call.
    const reader = createLikhaSearch({ indexPath: sharedPath });
    const startedAt = Date.now();
    const res = reader.search('permit fees', {});
    const tookMs = Date.now() - startedAt;
    assert.ok(res.items.length > 0, 'matches found in the seeded set');
    assert.ok(tookMs < 500, `search took ${tookMs}ms (<500ms contract)`);
  });

  await t.test('lazy rebuild from published DB rows', async () => {
    const { getDb } = await import('../../src/lib/db');
    const db = getDb();

    const userId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
    ).run(
      userId,
      `search-rebuild-${Date.now()}@example.com`,
      'test-not-used',
      'Search Rebuild Test',
      'Municipality of Pitogo',
      'municipality',
      'Quezon'
    );

    const idA = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 101,
      seriesYear: 2010,
      title: 'An ordinance adopting the local disaster plan',
      archiveStatus: 'published',
    });
    const idB = seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 102,
      seriesYear: 2011,
      title: 'An ordinance creating the youth council',
      archiveStatus: 'published',
    });
    // A pending row must NOT be rebuilt into the index.
    seedPendingReviewRecord(db, userId, {
      ordinanceNumber: 103,
      seriesYear: 2012,
      title: 'An ordinance still under review',
      archiveStatus: 'pending_review',
    });

    const rebuildPath = freshIndexPath();
    const s = createLikhaSearch({ indexPath: rebuildPath, db: () => db });
    await s.rebuildIndex();
    assert.equal(s.stats().totalDocs, 2, 'only published rows rebuilt');

    const res = s.search('disaster plan', {});
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].id, idA);
    const res2 = s.search('youth council', {});
    assert.equal(res2.items.length, 1);
    assert.equal(res2.items[0].id, idB);

    db.close();
  });
});
