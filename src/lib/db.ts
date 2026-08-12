import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "workshop.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure the data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
    initSchema(db);
    seedDefaultAdmin();
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    -- ========== EXISTING TABLES ==========

    CREATE TABLE IF NOT EXISTS workshop_sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT,
      started_at  TEXT DEFAULT (datetime('now')),
      ended_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS participant_sessions (
      id                  TEXT PRIMARY KEY,
      workshop_session_id TEXT NOT NULL,
      participant_name    TEXT,
      ip_address          TEXT,
      module              TEXT NOT NULL,
      started_at          TEXT DEFAULT (datetime('now')),
      last_active_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workshop_session_id) REFERENCES workshop_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS interaction_logs (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_session_id TEXT NOT NULL,
      workshop_session_id    TEXT NOT NULL,
      module                 TEXT NOT NULL,
      interaction_type       TEXT NOT NULL,
      role                   TEXT,
      content                TEXT,
      topic_tags             TEXT,
      obra_template          TEXT,
      obra_compliance_score  INTEGER,
      obra_draft_length      INTEGER,
      created_at             TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (participant_session_id) REFERENCES participant_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_logs_workshop
      ON interaction_logs(workshop_session_id);
    CREATE INDEX IF NOT EXISTS idx_logs_module
      ON interaction_logs(module);
    CREATE INDEX IF NOT EXISTS idx_logs_created
      ON interaction_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_type
      ON interaction_logs(interaction_type);
    CREATE INDEX IF NOT EXISTS idx_ps_workshop
      ON participant_sessions(workshop_session_id);

    -- ========== AUTH TABLES ==========

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'lgu_admin' CHECK(role IN ('super_admin', 'lgu_admin')),
      lgu_id TEXT,
      province_id TEXT,
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
      ON admin_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
      ON admin_sessions(expires_at);

    -- ========== USER AUTH TABLES ==========

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      lgu_name TEXT NOT NULL,
      lgu_type TEXT CHECK(lgu_type IN ('municipality', 'city', 'component_city', 'huc')),
      lgu_class TEXT CHECK(lgu_class IN ('1st', '2nd', '3rd', '4th', '5th', '6th')),
      province TEXT NOT NULL,
      mobile_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      approved_by TEXT,
      approved_at TEXT,
      last_login_at TEXT,
      login_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (approved_by) REFERENCES admin_users(id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status
      ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_province
      ON users(province);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user
      ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
      ON user_sessions(expires_at);

    -- ========== KNOWLEDGE BASE TABLES ==========

    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY,
      lgu_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('ordinance', 'ra7160', 'irr', 'dilg_opinion', 'jurisprudence', 'policy', 'context')),
      title TEXT NOT NULL,
      content TEXT,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      metadata TEXT,
      section_number TEXT,
      ordinance_number TEXT,
      series_year INTEGER,
      ordinance_type TEXT,
      rule_number INTEGER,
      topics TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'indexed', 'error')),
      error_message TEXT,
      indexed_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES admin_users(id)
    );

    CREATE TABLE IF NOT EXISTS kb_index_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lgu_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'error')),
      documents_indexed INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      triggered_by TEXT,
      FOREIGN KEY (triggered_by) REFERENCES admin_users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_kb_docs_lgu
      ON kb_documents(lgu_id);
    CREATE INDEX IF NOT EXISTS idx_kb_docs_type
      ON kb_documents(doc_type);
    CREATE INDEX IF NOT EXISTS idx_kb_docs_status
      ON kb_documents(status);
    CREATE INDEX IF NOT EXISTS idx_kb_index_runs_lgu
      ON kb_index_runs(lgu_id);

    -- ========== INFRASTRUCTURE TABLES ==========

    CREATE TABLE IF NOT EXISTS ecs_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      province TEXT NOT NULL,
      region TEXT,
      public_ip TEXT,
      ssh_port INTEGER DEFAULT 22,
      ssh_user TEXT DEFAULT 'root',
      ssh_key_path TEXT,
      ssh_key_encrypted TEXT,
      api_token TEXT,
      status TEXT DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'error', 'unknown')),
      last_health_check TEXT,
      metadata TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lgu_deployments (
      id TEXT PRIMARY KEY,
      lgu_id TEXT NOT NULL,
      lgu_name TEXT NOT NULL,
      lgu_type TEXT NOT NULL CHECK(lgu_type IN ('municipality', 'city', 'component_city', 'huc')),
      lgu_class TEXT CHECK(lgu_class IN ('1st', '2nd', '3rd', '4th', '5th', '6th')),
      province TEXT NOT NULL,
      ecs_instance_id TEXT NOT NULL,
      container_name TEXT NOT NULL,
      container_port INTEGER DEFAULT 3000,
      image_tag TEXT DEFAULT 'latest',
      status TEXT DEFAULT 'stopped' CHECK(status IN ('running', 'stopped', 'error', 'building', 'unknown')),
      domain TEXT,
      openrouter_api_key TEXT,
      lightrag_service_url TEXT,
      env_vars TEXT,
      last_deployed_at TEXT,
      last_health_check TEXT,
      health_status TEXT,
      error_message TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ecs_instance_id) REFERENCES ecs_instances(id),
      FOREIGN KEY (created_by) REFERENCES admin_users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_ecs
      ON lgu_deployments(ecs_instance_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_lgu
      ON lgu_deployments(lgu_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status
      ON lgu_deployments(status);
    CREATE INDEX IF NOT EXISTS idx_deployments_province
      ON lgu_deployments(province);

    -- ========== LIKHA + LINAW SHARED FOUNDATION (Sprint 1 — additive, idempotent) ==========
    -- LIKHA-owned tables
    CREATE TABLE IF NOT EXISTS archived_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'scan', original_filename TEXT, scan_file_path TEXT, file_hash TEXT, archive_status TEXT DEFAULT 'processing' CHECK(archive_status IN ('processing','pending_review','published','flagged')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, dilg_submitted INTEGER DEFAULT 0, dilg_submitted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_arch_ord_year ON archived_ordinances(series_year);
    CREATE INDEX IF NOT EXISTS idx_arch_ord_status ON archived_ordinances(status);
    CREATE INDEX IF NOT EXISTS idx_arch_ord_astat ON archived_ordinances(archive_status);

    CREATE TABLE IF NOT EXISTS classifications ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL, category TEXT NOT NULL, confidence REAL, assigned_by TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES archived_ordinances(id) ON DELETE CASCADE );

    CREATE TABLE IF NOT EXISTS amendment_links ( id TEXT PRIMARY KEY, amending_id TEXT NOT NULL, amended_id TEXT NOT NULL, relationship_type TEXT NOT NULL, detected_by TEXT NOT NULL, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(amending_id) REFERENCES archived_ordinances(id), FOREIGN KEY(amended_id) REFERENCES archived_ordinances(id) );

    -- LINAW-owned tables
    CREATE TABLE IF NOT EXISTS linaw_ordinances ( id TEXT PRIMARY KEY, ordinance_number INTEGER NOT NULL, series_year INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, subject_tags TEXT DEFAULT '[]', status TEXT DEFAULT 'active' CHECK(status IN ('active','amended','repealed','superseded','expired')), source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('scan','import','manual')), source_filename TEXT, file_hash TEXT, library_status TEXT DEFAULT 'pending_review' CHECK(library_status IN ('processing','pending_review','ready','rejected')), uploaded_by_id TEXT NOT NULL, verified_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(ordinance_number, series_year), FOREIGN KEY(uploaded_by_id) REFERENCES users(id), FOREIGN KEY(verified_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_linaw_ord_year ON linaw_ordinances(series_year);
    CREATE INDEX IF NOT EXISTS idx_linaw_ord_lstat ON linaw_ordinances(library_status);

    CREATE TABLE IF NOT EXISTS codification_records ( id TEXT PRIMARY KEY, ordinance_id TEXT NOT NULL UNIQUE, title_number INTEGER, chapter_number INTEGER, article_number INTEGER, section_in_code INTEGER, cod_status TEXT DEFAULT 'unclassified' CHECK(cod_status IN ('unclassified','classified','reviewed','approved','codified')), ai_suggestion TEXT, human_override TEXT, reviewed_by_id TEXT, approved_by_id TEXT, approved_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(ordinance_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(reviewed_by_id) REFERENCES users(id), FOREIGN KEY(approved_by_id) REFERENCES users(id) );

    CREATE TABLE IF NOT EXISTS ordinance_relationships ( id TEXT PRIMARY KEY, source_id TEXT NOT NULL, target_id TEXT NOT NULL, relationship_type TEXT NOT NULL, section_ref TEXT, confidence REAL NOT NULL, confirmed INTEGER DEFAULT 0, confirmed_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(source_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(target_id) REFERENCES linaw_ordinances(id), FOREIGN KEY(confirmed_by_id) REFERENCES users(id) );
    CREATE INDEX IF NOT EXISTS idx_ord_rel_source ON ordinance_relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_ord_rel_target ON ordinance_relationships(target_id);
    CREATE INDEX IF NOT EXISTS idx_ord_rel_type ON ordinance_relationships(relationship_type);

    CREATE TABLE IF NOT EXISTS code_volumes ( id TEXT PRIMARY KEY, title TEXT NOT NULL, edition TEXT NOT NULL, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','under_review','published')), structure TEXT NOT NULL, generated_at TEXT, published_at TEXT, generated_by_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(generated_by_id) REFERENCES users(id) );

    -- Shared audit table (module-scoped rows: module='likha'|'linaw'); IF NOT EXISTS makes it safe whichever module builds first
    CREATE TABLE IF NOT EXISTS agent_decisions ( id TEXT PRIMARY KEY, module TEXT NOT NULL, pipeline_id TEXT NOT NULL, agent_id INTEGER NOT NULL, agent_name TEXT NOT NULL, action TEXT NOT NULL, input_snapshot TEXT, output_snapshot TEXT, confidence REAL, user_id TEXT, reason TEXT, created_at TEXT DEFAULT (datetime('now')) );
    CREATE INDEX IF NOT EXISTS idx_agent_dec_pipeline ON agent_decisions(pipeline_id);
    CREATE INDEX IF NOT EXISTS idx_agent_dec_module ON agent_decisions(module, created_at);
  `);

  // Sprint 7 (decision D1): rejection marker for the N005 workflow — additive,
  // idempotent; existing rows keep DEFAULT 0 semantics. First db.ts edit since
  // Sprint 1; justified because N006's assembly gate must distinguish
  // pending (no action) from rejected (human refused) without polluting
  // `confirmed`, which N015 exports (confirmed-only).
  const ordRelCols = database.prepare(`PRAGMA table_info(ordinance_relationships)`).all() as Array<{ name: string }>;
  if (!ordRelCols.some((c) => c.name === 'rejected')) {
    try {
      database.prepare(`ALTER TABLE ordinance_relationships ADD COLUMN rejected INTEGER DEFAULT 0`).run();
    } catch {
      // Another process added the column concurrently (multi-process init race) — ignore.
    }
  }

  // Migration: add user_id to interaction_logs if not present
  try {
    database.exec(`ALTER TABLE interaction_logs ADD COLUMN user_id TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add rag_context to interaction_logs for storing RAG retrieval context
  try {
    database.exec(`ALTER TABLE interaction_logs ADD COLUMN rag_context TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: add citations_json to interaction_logs for storing citation data
  try {
    database.exec(`ALTER TABLE interaction_logs ADD COLUMN citations_json TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration (Sprint 2, L003): per-field extraction confidence for LIKHA metadata parsing
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN extraction_confidence TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // Migration (Sprint 3, L004): section count home + rejection reason for verified records
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN section_count INTEGER`);
  } catch {
    // Column already exists — ignore
  }
  try {
    database.exec(`ALTER TABLE archived_ordinances ADD COLUMN rejection_reason TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

// ========== PASSWORD HASHING (Node.js built-in crypto) ==========

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === verifyHash;
}

// ========== SEED DATA ==========

const DEFAULT_ADMIN_USERNAME = "admin";

export function seedDefaultAdmin(): void {
  if (!db) return;

  const count = db
    .prepare("SELECT COUNT(*) as cnt FROM admin_users")
    .get() as { cnt: number };

  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (count.cnt === 0) {
    if (!password) {
      console.warn(
        "[db] No admin users exist and DEFAULT_ADMIN_PASSWORD is not set. Skipping default admin seed."
      );
      return;
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    db.prepare(
      `INSERT INTO admin_users (id, username, password_hash, display_name, role)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, DEFAULT_ADMIN_USERNAME, passwordHash, "Super Admin", "super_admin");

    console.log(
      "[db] Seeded default super_admin user from DEFAULT_ADMIN_PASSWORD env var."
    );
    return;
  }

  // Security migration: disable the default admin if it still uses the
  // compromised password that was shipped in earlier builds.
  const row = db
    .prepare("SELECT password_hash FROM admin_users WHERE username = ?")
    .get(DEFAULT_ADMIN_USERNAME) as { password_hash: string } | undefined;

  if (row && verifyPassword("esangguni-admin-2026", row.password_hash)) {
    console.warn(
      "[db] Default admin still uses the compromised password. Disabling account until reset."
    );
    db.prepare(
      `UPDATE admin_users
       SET is_active = 0, updated_at = datetime('now')
       WHERE username = ?`
    ).run(DEFAULT_ADMIN_USERNAME);
  }
}
