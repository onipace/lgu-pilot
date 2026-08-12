// tests/helpers/likha-test-util.ts
// Sprint 2 (S2-C3) — shared test scaffolding for the LIKHA test harness.
// Uses ONLY Node built-ins + better-sqlite3 with relative/package imports
// (tests must not rely on the @/ alias). Zero business logic.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

export const BASE_URL = process.env.LIKHA_TEST_BASE_URL || 'http://localhost:3000';

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
 * both rows and closes the DB handle.
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
  const email = `likha-test-${Date.now()}@example.com`;

  db.prepare(
    `INSERT INTO users
       (id, email, password_hash, full_name, lgu_name, lgu_type, province, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    email,
    'test-not-used',
    'Likha Integration Test',
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

/** Reads a LIKHA test fixture from tests/fixtures/likha/ relative to process.cwd(). */
export function readFixture(name: 'sample-ordinance.pdf' | 'sample-scan.png'): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'likha', name));
}

/**
 * Fresh temp DB path for hermetic in-process tests. Callers set
 * process.env.DB_PATH to the returned value BEFORE dynamically importing
 * any module that depends on @/lib/db (it reads DB_PATH at module load).
 */
export function tempDbPath(): string {
  return path.join(os.tmpdir(), `esangguni-likha-test-${randomUUID()}.db`);
}

/** Fresh temp path for the LIKHA BM25 index file (hermetic search tests — decision D13). */
export function tempIndexPath(): string {
  return path.join(os.tmpdir(), `esangguni-likha-index-${randomUUID()}.json`);
}

/**
 * Inserts one archived_ordinances row in archive_status='pending_review' with
 * realistic Sprint-2-shaped metadata (extraction_confidence JSON, file_hash,
 * scan_file_path) directly into the DB handle the CALLER passes (the hermetic
 * tests' dynamically-imported getDb()). Returns the new record id.
 */
export function seedPendingReviewRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    confidence?: { ordinanceNumber: number; seriesYear: number; title: number; sectionCount: number };
    archiveStatus?: 'processing' | 'pending_review' | 'published' | 'flagged';
  }
): string {
  const id = randomUUID();
  const confidence = overrides?.confidence ?? {
    ordinanceNumber: 0.92, seriesYear: 0.95, title: 0.9, sectionCount: 0.88,
  };
  db.prepare(
    `INSERT INTO archived_ordinances
       (id, ordinance_number, series_year, title, content, section_count,
        subject_tags, source_type, original_filename, scan_file_path, file_hash,
        archive_status, extraction_confidence, uploaded_by_id)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 'scan', ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides?.ordinanceNumber ?? 5,
    overrides?.seriesYear ?? 2023,
    overrides?.title ?? 'An ordinance revising the schedule of business permit fees',
    overrides?.content ?? 'Section 1. Title. This ordinance revises business permit fees.',
    12,
    'ord-05-s2023.pdf',
    'data/uploads/likha/' + id + '__ord-05-s2023.pdf',
    'deadbeef'.repeat(8),
    overrides?.archiveStatus ?? 'pending_review',
    JSON.stringify(confidence),
    userId
  );
  return id;
}

/**
 * Inserts one archived_ordinances row in archive_status='published' with
 * realistic Sprint-3-shaped fields (subject_tags JSON, summary, file_hash,
 * verified_by_id) directly into the DB handle the CALLER passes. Returns the
 * new record id. Sprint 4 exports (L010/L013) and classification tests seed
 * published rows with this.
 */
export function seedPublishedRecord(
  db: import('better-sqlite3').Database,
  userId: string,
  overrides?: {
    ordinanceNumber?: number;
    seriesYear?: number;
    title?: string;
    content?: string;
    summary?: string | null;
    subjectTags?: string[];
    status?: 'active' | 'amended' | 'repealed' | 'superseded' | 'expired';
    sourceType?: string;
    fileHash?: string | null;
  }
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO archived_ordinances
       (id, ordinance_number, series_year, title, content, summary, section_count,
        subject_tags, status, source_type, original_filename, scan_file_path, file_hash,
        archive_status, extraction_confidence, uploaded_by_id, verified_by_id)
     VALUES (?, ?, ?, ?, ?, ?, 8, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`
  ).run(
    id,
    overrides?.ordinanceNumber ?? 12,
    overrides?.seriesYear ?? 2019,
    overrides?.title ?? 'An ordinance regulating the operation of tricycles for hire',
    overrides?.content ?? 'Section 1. Title. This ordinance regulates tricycle franchises and fares.',
    overrides?.summary === undefined ? 'Regulates tricycle franchises and fares.' : overrides.summary,
    JSON.stringify(overrides?.subjectTags ?? []),
    overrides?.status ?? 'active',
    overrides?.sourceType ?? 'scan',
    'ord-12-s2019.pdf',
    'data/uploads/likha/' + id + '__ord-12-s2019.pdf',
    overrides?.fileHash === undefined ? 'cafebabe'.repeat(8) : overrides.fileHash,
    JSON.stringify({ ordinanceNumber: 0.95, seriesYear: 0.95, title: 0.9, sectionCount: 0.9 }),
    userId,
    userId
  );
  return id;
}
