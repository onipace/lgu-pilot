// tests/helpers/linaw-test-util.ts
// Sprint 5 (S5-C2) — LINAW's OWN test scaffolding. Duplicates the proven
// harness pattern of the sibling archive module but is an independent file:
// ZERO imports from any other module's helpers or src/ code. Uses ONLY Node
// built-ins + better-sqlite3 with relative/package imports (tests must not
// rely on the @/ alias). Zero business logic.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';

export const BASE_URL = process.env.LINAW_TEST_BASE_URL || 'http://localhost:3000';

/**
 * Asserts the dev server is up (GET /api/health). Throws with an exact,
 * greppable message when it is not — integration tests run API-level
 * against a running `npm run dev`.
 */
export async function assertServerReachable(): Promise<void> {
  try {
    const res = await fetch(BASE_URL + '/api/health');
    if (!res.ok) {
      throw new Error(`health check returned ${res.status}`);
    }
  } catch {
    throw new Error(
      'SKIP-FAIL: start the dev server first (npm run dev) — integration tests run API-level per SPRINT_PLAN'
    );
  }
}

/**
 * Seeds an approved user + live session directly into the SQLite DB used by
 * the running server (default: data/workshop.db relative to process.cwd()).
 * Returns an auth cookie ready for fetch headers and a cleanup() that removes
 * both rows (session first — FK order) and closes the DB handle.
 */
export function seedApprovedUser(dbFile?: string): {
  userId: string;
  sessionId: string;
  cookie: string;
  cleanup: () => void;
} {
  const dbPath = dbFile || path.join(process.cwd(), 'data', 'workshop.db');
  const db = new Database(dbPath);

  const userId = randomUUID();
  const sessionId = randomUUID();
  // Unique even for concurrent seeders in the same millisecond (users.email
  // is UNIQUE; tsx --test runs the integration files in parallel).
  const email = `linaw-test-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;

  db.prepare(
    `INSERT INTO users
       (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    email,
    'test-not-used',
    'Linaw Integration Test',
    'Municipality of Pitogo',
    'municipality',
    'Quezon',
    'approved'
  );

  db.prepare(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(sessionId, userId, new Date(Date.now() + 3600_000).toISOString());

  return {
    userId,
    sessionId,
    cookie: 'esangguni_user_session=' + sessionId,
    cleanup: () => {
      try {
        // Session row first: user_sessions.user_id references users.id.
        db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId);
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      } finally {
        db.close();
      }
    },
  };
}

/**
 * Fresh temp DB path for hermetic in-process tests. Callers set
 * process.env.DB_PATH to the returned value BEFORE dynamically importing
 * any module that depends on @/lib/db (it reads DB_PATH at module load).
 */
export function tempDbPath(): string {
  return path.join(os.tmpdir(), `esangguni-linaw-test-${randomUUID()}.db`);
}

/** Reads a LINAW test fixture from tests/fixtures/linaw/ relative to process.cwd(). */
export function readLinawFixture(name: 'sample-ordinance.pdf' | 'sample-scan.png'): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'linaw', name));
}

/**
 * Inserts one linaw_ordinances row (default library_status='pending_review',
 * source_type='scan') directly into the DB handle the CALLER passes. Uses ONLY
 * columns present in the frozen Sprint-1 DDL. Returns the new record id.
 */
export function seedLinawPendingReviewRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    sourceType?: 'scan' | 'import' | 'manual';
    libraryStatus?: 'processing' | 'pending_review' | 'ready' | 'rejected';
    sourceFilename?: string | null;
    fileHash?: string | null;
    /** Sprint 6: subject metadata (JSON-encoded into subject_tags). */
    subjectTags?: string[];
    /** Sprint 7 (N007): pre-set plain-language summary (NULL when absent). */
    summary?: string;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO linaw_ordinances
       (id, ordinance_number, series_year, title, content, summary, subject_tags,
        source_type, source_filename, file_hash, library_status, uploaded_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides?.ordinanceNumber ?? 7,
    overrides?.seriesYear ?? 2021,
    overrides?.title ?? 'An ordinance establishing the municipal library system',
    overrides?.content ??
      'Section 1. Title. This ordinance establishes the municipal library system.',
    overrides?.summary ?? null,
    JSON.stringify(overrides?.subjectTags ?? []),
    overrides?.sourceType ?? 'scan',
    overrides?.sourceFilename === undefined ? 'ord-07-s2021.pdf' : overrides.sourceFilename,
    overrides?.fileHash === undefined ? 'deadbeef'.repeat(8) : overrides.fileHash,
    overrides?.libraryStatus ?? 'pending_review',
    userId
  );
  return id;
}

/**
 * Sprint 6 (S6-C2) — seeds one READY linaw_ordinances row (the agents' only
 * input). Same signature/behavior as seedLinawPendingReviewRecord with
 * ready-library defaults; implementation delegates to the base seeder.
 */
export function seedLinawReadyRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    sourceType?: 'scan' | 'import' | 'manual';
    libraryStatus?: 'processing' | 'pending_review' | 'ready' | 'rejected';
    sourceFilename?: string | null;
    fileHash?: string | null;
    subjectTags?: string[];
    /** Sprint 7 (N007): pre-set plain-language summary (NULL when absent). */
    summary?: string;
  }
): string {
  return seedLinawPendingReviewRecord(db, userId, {
    ordinanceNumber: 11,
    seriesYear: 2022,
    title: 'An ordinance regulating the municipal market fees',
    content: 'Section 1. Title. This ordinance regulates market fees.',
    sourceType: 'import',
    libraryStatus: 'ready',
    sourceFilename: null,
    fileHash: null,
    subjectTags: ['Taxation & Revenue'],
    ...overrides,
  });
}

/**
 * Sprint 6 (S6-C2) — seeds one codification_records row (frozen Sprint-1 DDL
 * columns only). Defaults: Title 3 / Chapter 1, cod_status='classified',
 * ai_suggestion JSON {"titleNumber":3,"chapterNumber":1,"confidence":0.9}.
 * Returns the new row id.
 */
export function seedLinawCodificationRecord(
  db: import('better-sqlite3').Database,
  ordinanceId: string,
  overrides?: {
    titleNumber?: number;
    chapterNumber?: number;
    articleNumber?: number;
    codStatus?: string;
    aiSuggestion?: string;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO codification_records
       (id, ordinance_id, title_number, chapter_number, article_number,
        cod_status, ai_suggestion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    ordinanceId,
    overrides?.titleNumber ?? 3,
    overrides?.chapterNumber ?? 1,
    overrides?.articleNumber ?? null,
    overrides?.codStatus ?? 'classified',
    overrides?.aiSuggestion ??
      JSON.stringify({ titleNumber: 3, chapterNumber: 1, confidence: 0.9 })
  );
  return id;
}

/**
 * Sprint 7 (S7-C2) — seeds one ordinance_relationships row (frozen Sprint-1
 * DDL columns + the Sprint-7 additive `rejected` column). Defaults: type
 * 'amends', confidence 0.85, confirmed 0, rejected 0. Returns the new row id.
 */
export function seedLinawRelationship(
  db: import('better-sqlite3').Database,
  sourceId: string,
  targetId: string,
  overrides?: {
    type?: string;
    sectionRef?: string | null;
    confidence?: number;
    confirmed?: 0 | 1;
    confirmedById?: string | null;
    rejected?: 0 | 1;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO ordinance_relationships
       (id, source_id, target_id, relationship_type, section_ref, confidence,
        confirmed, confirmed_by_id, rejected)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sourceId,
    targetId,
    overrides?.type ?? 'amends',
    overrides?.sectionRef ?? null,
    overrides?.confidence ?? 0.85,
    overrides?.confirmed ?? 0,
    overrides?.confirmedById ?? null,
    overrides?.rejected ?? 0
  );
  return id;
}

// ── Minimal DOCX builder (dependency-free ZIP writer — decision D1 support) ──

let crcTable: Uint32Array | null = null;

/** Standard table-based CRC-32 (polynomial 0xEDB88320). */
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Builds a minimal but structurally valid DOCX (ZIP) buffer containing
 * `[Content_Types].xml` and `word/document.xml`. The input text is split on
 * `\n` into `<w:p>` paragraphs. Local file headers carry bit 3 UNSET, sizes
 * inline, DEFLATE (method 8) entries, a matching central directory + EOCD —
 * readable by Sprint 5's extractDocxText and by basic ZIP layout readers.
 */
export function buildMinimalDocx(text: string): Buffer {
  const paragraphs = text
    .split('\n')
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paragraphs}</w:body></w:document>`;

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ];

  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const compressed = zlib.deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // general-purpose flags — bit 3 UNSET
    local.writeUInt16LE(8, 8); // compression method: DEFLATE
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x0021, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    localChunks.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(0, 12); // time
    central.writeUInt16LE(0x0021, 14); // date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra length / comment length / disk / attrs stay zero
    central.writeUInt32LE(offset, 42); // local header offset
    centralChunks.push(central, nameBuf);

    offset += 30 + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localChunks, centralDir, eocd]);
}
