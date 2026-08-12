// tests/integration/likha-archive.test.ts
// Sprint 3 (S3-C6) — L006 archive list/search/stats API-level tests.
// Runs against the live dev server (npm run dev) exactly like Sprint 2's
// likha-upload.test.ts: helper seeds an approved user + session directly into
// data/workshop.db, test records go in via better-sqlite3, and the server-side
// Archiver indexes the SEARCH records through the real HTTP approve flow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BASE_URL,
  assertServerReachable,
  seedApprovedUser,
} from '../helpers/likha-test-util';

const SUBJECT_TAX = 'Taxation & Revenue';
const PHRASE = 'business permit fees';

interface ArchiveItem {
  id: string;
  ordinanceNumber: number;
  seriesYear: number;
  title: string;
  status: string;
  archiveStatus: string;
  subjectTags: string[];
  sectionCount: number | null;
  createdAt: string;
  snippet: string;
  score?: number;
}

interface ArchiveResponse {
  items: ArchiveItem[];
  total: number;
  page: number;
  limit: number;
  tookMs: number;
}

interface StatsResponse {
  archived: number;
  published: number;
  pendingReview: number;
  flagged: number;
  byYear: Record<string, number>;
  byStatus: Record<string, number>;
  bySubject: Record<string, number>;
  bm25Indexed: number;
}

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

test('likha archive suite', async (t) => {
  await assertServerReachable();
  const { userId, cookie, cleanup } = seedApprovedUser();

  const db = new Database(path.join(process.cwd(), 'data', 'workshop.db'));
  // The dev server applies initSchema() lazily on its first DB-backed route.
  // When this suite runs standalone against a fresh server, mirror the same
  // idempotent Sprint-3 migrations here (identical ALTER pattern to db.ts).
  for (const migration of [
    'ALTER TABLE archived_ordinances ADD COLUMN section_count INTEGER',
    'ALTER TABLE archived_ordinances ADD COLUMN rejection_reason TEXT',
  ]) {
    try {
      db.exec(migration);
    } catch {
      // Column already exists — ignore
    }
  }
  const authed = { headers: { Cookie: cookie, 'Content-Type': 'application/json' } };

  // Distinctive ordinance numbers so UNIQUE(ordinance_number, series_year)
  // never collides with pre-existing dev rows.
  const base = 910_000 + crypto.randomInt(0, 80_000);

  const seededIds: string[] = [];
  function seedRow(opts: {
    ordinanceNumber: number;
    seriesYear: number;
    title: string;
    content: string;
    archiveStatus?: 'processing' | 'pending_review' | 'published' | 'flagged';
    status?: string;
    subjectTags?: string[];
    rejectionReason?: string;
  }): string {
    const id = crypto.randomUUID();
    seededIds.push(id);
    db.prepare(
      `INSERT INTO archived_ordinances
         (id, ordinance_number, series_year, title, content, section_count,
          subject_tags, status, source_type, original_filename, scan_file_path,
          file_hash, archive_status, rejection_reason, extraction_confidence, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, 8, ?, ?, 'scan', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      opts.ordinanceNumber,
      opts.seriesYear,
      opts.title,
      opts.content,
      JSON.stringify(opts.subjectTags ?? []),
      opts.status ?? 'active',
      `ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      `data/uploads/likha/${id}__ord-${opts.ordinanceNumber}-s${opts.seriesYear}.pdf`,
      crypto.createHash('sha256').update(id).digest('hex'),
      opts.archiveStatus ?? 'published',
      opts.rejectionReason ?? null,
      JSON.stringify({ ordinanceNumber: 0.9, seriesYear: 0.9, title: 0.9, sectionCount: 0.9 }),
      userId
    );
    return id;
  }

  // Three directly-seeded PUBLISHED rows (SQL-side list/filter/stats tests).
  const pub2019 = seedRow({
    ordinanceNumber: base + 1,
    seriesYear: 2019,
    status: 'active',
    title: 'An ordinance establishing the municipal market code',
    content:
      'Section 1. Title. This ordinance establishes the municipal market code. ' +
      'Section 2. Market fees shall be collected by the treasurer.',
  });
  const pub2023 = seedRow({
    ordinanceNumber: base + 2,
    seriesYear: 2023,
    status: 'amended',
    subjectTags: [SUBJECT_TAX],
    title: 'An ordinance regulating public market stalls and concessions',
    content:
      'Section 1. Title. This ordinance regulates public market stalls. ' +
      'Section 2. Concession rentals are hereby revised.',
  });
  const pub2024 = seedRow({
    ordinanceNumber: base + 3,
    seriesYear: 2024,
    status: 'active',
    title: 'An ordinance appropriating funds for road maintenance',
    content:
      'Section 1. Title. Funds are appropriated for road maintenance. ' +
      'Section 2. The engineer shall supervise the works.',
  });

  // PENDING rows: one approved over HTTP so the server-side Archiver indexes
  // it (SEARCH test), the rest exercised by the PUT round-trip subtest.
  const pendBpf = seedRow({
    ordinanceNumber: base + 4,
    seriesYear: 2020,
    archiveStatus: 'pending_review',
    title: 'An ordinance revising the schedule of business permit fees',
    content:
      'Section 1. Title. This ordinance revises the schedule of business permit fees. ' +
      'Section 2. The business permit fees shall be collected annually.',
  });
  const pendRound = seedRow({
    ordinanceNumber: base + 5,
    seriesYear: 2018,
    archiveStatus: 'pending_review',
    title: 'An ordinance fixing the rate of community tax certificates',
    content: 'Section 1. Title. Community tax certificate rates are fixed hereby.',
  });
  const pendReject = seedRow({
    ordinanceNumber: base + 6,
    seriesYear: 2017,
    archiveStatus: 'pending_review',
    title: 'An ordinance creating the local tourism council',
    content: 'Section 1. Title. The local tourism council is hereby created.',
  });
  const pendInvalid = seedRow({
    ordinanceNumber: base + 7,
    seriesYear: 2016,
    archiveStatus: 'pending_review',
    title: 'An ordinance reorganizing the barangay health stations',
    content: 'Section 1. Title. Barangay health stations are reorganized.',
  });

  // One FLAGGED (rejected) row with a rejection reason.
  const flaggedId = seedRow({
    ordinanceNumber: base + 8,
    seriesYear: 2015,
    archiveStatus: 'flagged',
    rejectionReason: 'Unreadable scan',
    title: 'An ordinance granting franchise privileges (rejected copy)',
    content: 'Section 1. Title. Unreadable scan placeholder text.',
  });

  t.after(() => {
    try {
      for (const id of seededIds) {
        db.prepare('DELETE FROM archived_ordinances WHERE id = ?').run(id);
        db.prepare(
          `DELETE FROM agent_decisions WHERE module = 'likha' AND pipeline_id IN (?, ?)`
        ).run('verification-' + id, 'publish-' + id);
      }
    } finally {
      db.close();
      // User/session rows last: seeded records reference the user via
      // uploaded_by_id / verified_by_id (FKs enforced by this SQLite build).
      cleanup();
    }
  });

  await t.test('auth: both routes require a session (401 envelope)', async () => {
    const list = await api('/api/likha/archive');
    assert.equal(list.status, 401);
    assert.equal(list.body?.error, 'Authentication required');
    assert.equal(list.body?.code, 'NO_SESSION');

    const stats = await api('/api/likha/stats');
    assert.equal(stats.status, 401);
    assert.equal(stats.body?.error, 'Authentication required');
    assert.equal(stats.body?.code, 'NO_SESSION');
  });

  await t.test('list default = published only (no pending/flagged leaks)', async () => {
    const res = await api('/api/likha/archive?limit=100', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const data = res.body as ArchiveResponse;
    assert.ok(Array.isArray(data.items), 'items array');
    assert.equal(typeof data.total, 'number');
    assert.equal(typeof data.page, 'number');
    assert.equal(typeof data.limit, 'number');
    assert.equal(typeof data.tookMs, 'number');

    assert.ok(data.items.length >= 3, 'seeded published rows listed');
    for (const item of data.items) {
      assert.equal(item.archiveStatus, 'published', 'every listed item is published');
    }
    const ids = data.items.map((i) => i.id);
    for (const publishedId of [pub2019, pub2023, pub2024]) {
      assert.ok(ids.includes(publishedId), `seeded published row ${publishedId} listed`);
    }
    for (const hiddenId of [pendBpf, pendRound, pendReject, pendInvalid, flaggedId]) {
      assert.ok(!ids.includes(hiddenId), `non-published row ${hiddenId} must not leak`);
    }
  });

  await t.test('search q: HTTP approve -> Archiver indexes -> highlighted snippet <500ms', async () => {
    // Approve the business-permit-fees record over HTTP: the server-side
    // Archiver publishes it and creates/updates its BM25 entry.
    const approve = await api('/api/likha/archive/' + pendBpf, {
      method: 'PUT',
      ...authed,
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));
    assert.equal(approve.body?.published, true, 'approve publishes via the Archiver');
    assert.equal(approve.body?.archiveStatus, 'published');

    const res = await api('/api/likha/archive?q=' + encodeURIComponent(PHRASE), {
      headers: { Cookie: cookie },
    });
    assert.equal(res.status, 200);
    const data = res.body as ArchiveResponse;
    assert.ok(data.items.length >= 1, 'at least one search hit');
    assert.ok(data.tookMs < 500, `tookMs ${data.tookMs} < 500ms contract`);

    const hit = data.items.find((i) => i.id === pendBpf);
    assert.ok(hit, 'the approved record is searchable');
    assert.equal(typeof hit!.score, 'number');
    assert.ok((hit!.score ?? 0) > 0);
    assert.ok(
      hit!.snippet.toLowerCase().includes('<mark>' + PHRASE + '</mark>') ||
        /<mark>[^<]*(business|permit|fees)[^<]*<\/mark>/i.test(hit!.snippet),
      `snippet wraps matched terms in <mark>, got: ${hit!.snippet}`
    );
  });

  await t.test('filters: yearFrom/yearTo, legal status, subject, archiveStatus queue', async () => {
    // Year range excludes the 2019 doc.
    const years = await api('/api/likha/archive?yearFrom=2023&yearTo=2024&limit=100', {
      headers: { Cookie: cookie },
    });
    assert.equal(years.status, 200);
    const yearItems = (years.body as ArchiveResponse).items;
    assert.ok(!yearItems.some((i) => i.id === pub2019), '2019 doc excluded');
    for (const item of yearItems) {
      assert.ok(
        item.seriesYear >= 2023 && item.seriesYear <= 2024,
        `year ${item.seriesYear} inside range`
      );
    }

    // Legal-status filter returns only amended docs (seeded amended row present).
    const amended = await api('/api/likha/archive?status=amended&limit=100', {
      headers: { Cookie: cookie },
    });
    assert.equal(amended.status, 200);
    const amendedItems = (amended.body as ArchiveResponse).items;
    assert.ok(amendedItems.some((i) => i.id === pub2023), 'amended seeded row returned');
    for (const item of amendedItems) {
      assert.equal(item.status, 'amended');
    }

    // Subject filter returns the tagged doc.
    const subject = await api('/api/likha/archive?subject=' + encodeURIComponent(SUBJECT_TAX) + '&limit=100', {
      headers: { Cookie: cookie },
    });
    assert.equal(subject.status, 200);
    const subjectItems = (subject.body as ArchiveResponse).items;
    assert.ok(subjectItems.some((i) => i.id === pub2023), 'tagged row returned');
    for (const item of subjectItems) {
      assert.ok(item.subjectTags.includes(SUBJECT_TAX));
    }

    // Verification queue: archiveStatus=pending_review (decision D18).
    const queue = await api('/api/likha/archive?archiveStatus=pending_review&limit=100', {
      headers: { Cookie: cookie },
    });
    assert.equal(queue.status, 200);
    const queueItems = (queue.body as ArchiveResponse).items;
    for (const item of queueItems) {
      assert.equal(item.archiveStatus, 'pending_review');
    }
    const queueIds = queueItems.map((i) => i.id);
    assert.ok(queueIds.includes(pendRound), 'pending row listed in the queue');
    assert.ok(queueIds.includes(pendReject), 'pending row listed in the queue');
    assert.ok(!queueIds.includes(flaggedId), 'flagged row never in the review queue');
  });

  await t.test('pagination: page/limit honored, limit clamps at 100', async () => {
    const page1 = await api('/api/likha/archive?page=1&limit=2', { headers: { Cookie: cookie } });
    assert.equal(page1.status, 200);
    const data = page1.body as ArchiveResponse;
    assert.ok(data.items.length <= 2, 'limit honored');
    assert.ok(data.total >= 4, 'total reflects ALL published matches');
    assert.equal(data.page, 1);
    assert.equal(data.limit, 2);

    const clamped = await api('/api/likha/archive?limit=500', { headers: { Cookie: cookie } });
    assert.equal(clamped.status, 200);
    assert.equal((clamped.body as ArchiveResponse).limit, 100, 'limit clamps at 100');
  });

  await t.test('stats: counts + byYear/byStatus/bySubject + bm25Indexed', async () => {
    const res = await api('/api/likha/stats', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const stats = res.body as StatsResponse;

    assert.ok(stats.published >= 4, `published >= 4 (got ${stats.published})`);
    assert.ok(stats.pendingReview >= 3, `pendingReview >= 3 (got ${stats.pendingReview})`);
    assert.ok(stats.flagged >= 1, `flagged >= 1 (got ${stats.flagged})`);
    assert.ok(
      stats.archived >= stats.published + stats.pendingReview + stats.flagged,
      'archived folds processing + all other states'
    );
    assert.ok((stats.byYear['2023'] ?? 0) >= 1, 'byYear includes 2023');
    assert.ok((stats.byStatus['amended'] ?? 0) >= 1, 'byStatus includes amended');
    assert.ok((stats.bySubject[SUBJECT_TAX] ?? 0) >= 1, 'bySubject includes Taxation & Revenue');
    assert.ok(stats.bm25Indexed >= 1, 'bm25Indexed reflects the LIKHA index size');
  });

  await t.test('PUT round-trip over HTTP: approve 200, re-approve 409, reject 400/200', async () => {
    // Approve a fresh pending row → 200 published:true.
    const approve = await api('/api/likha/archive/' + pendRound, {
      method: 'PUT',
      ...authed,
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));
    assert.equal(approve.body?.published, true);
    assert.equal(approve.body?.archiveStatus, 'published');

    // Approve AGAIN → 409 CONFLICT (already finalized).
    const again = await api('/api/likha/archive/' + pendRound, {
      method: 'PUT',
      ...authed,
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(again.status, 409);
    assert.equal(again.body?.code, 'CONFLICT');

    // Reject WITHOUT reason → 400 VALIDATION.
    const noReason = await api('/api/likha/archive/' + pendReject, {
      method: 'PUT',
      ...authed,
      body: JSON.stringify({ action: 'reject' }),
    });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body?.code, 'VALIDATION');

    // Reject WITH reason → 200 flagged.
    const reject = await api('/api/likha/archive/' + pendReject, {
      method: 'PUT',
      ...authed,
      body: JSON.stringify({ action: 'reject', reason: 'Duplicate of an existing record' }),
    });
    assert.equal(reject.status, 200);
    assert.equal(reject.body?.archiveStatus, 'flagged');
    assert.equal(reject.body?.published, false);
  });
});
