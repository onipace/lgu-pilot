'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || '/data/token-meter.db';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Initialize Database ────────────────────────────────────
const db = new Database(DB_PATH);

// Enable WAL mode for concurrent reads during writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ── Schema ─────────────────────────────────────────────────

/**
 * token_usage_events — Primary event table.
 * Every LLM API call gets one row here.
 * Added user_name (optional) for dashboard display without cross-DB join.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS token_usage_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id         TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    model            TEXT NOT NULL,
    input_tokens     INTEGER NOT NULL DEFAULT 0,
    output_tokens    INTEGER NOT NULL DEFAULT 0,
    total_tokens     INTEGER NOT NULL DEFAULT 0,
    module           TEXT NOT NULL,
    route            TEXT NOT NULL,
    user_id          TEXT,
    user_name        TEXT,
    session_id       TEXT,
    cost_usd         REAL DEFAULT 0,
    recorded_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tue_recorded   ON token_usage_events(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_tue_module     ON token_usage_events(module);
  CREATE INDEX IF NOT EXISTS idx_tue_route      ON token_usage_events(route);
  CREATE INDEX IF NOT EXISTS idx_tue_user       ON token_usage_events(user_id);
  CREATE INDEX IF NOT EXISTS idx_tue_model      ON token_usage_events(model);
  CREATE INDEX IF NOT EXISTS idx_tue_mod_rec    ON token_usage_events(module, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_tue_route_rec  ON token_usage_events(route, recorded_at);
`);

/**
 * token_daily_aggregates — Pre-aggregated daily rollups.
 * Populated by the aggregation worker for fast dashboard queries.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS token_daily_aggregates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    date             TEXT NOT NULL,
    model            TEXT NOT NULL,
    module           TEXT NOT NULL,
    route            TEXT NOT NULL,
    total_input      INTEGER DEFAULT 0,
    total_output     INTEGER DEFAULT 0,
    total_tokens     INTEGER DEFAULT 0,
    total_cost_usd   REAL DEFAULT 0,
    call_count       INTEGER DEFAULT 0,
    UNIQUE(date, model, module, route)
  );

  CREATE INDEX IF NOT EXISTS idx_tda_date ON token_daily_aggregates(date);
`);

/**
 * model_pricing — Configurable per-model cost rates.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS model_pricing (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    model                 TEXT NOT NULL UNIQUE,
    input_price_per_1m    REAL NOT NULL,
    output_price_per_1m   REAL NOT NULL,
    currency              TEXT DEFAULT 'USD',
    effective_from        TEXT NOT NULL DEFAULT (date('now')),
    is_active             INTEGER DEFAULT 1,
    created_at            TEXT DEFAULT (datetime('now'))
  );
`);

/**
 * budget_thresholds — Configurable alert limits.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS budget_thresholds (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    period                TEXT NOT NULL UNIQUE,
    max_tokens            INTEGER,
    max_cost_usd          REAL,
    alert_percentage      INTEGER DEFAULT 80,
    is_active             INTEGER DEFAULT 1,
    updated_at            TEXT DEFAULT (datetime('now'))
  );
`);

// ── Seed Data ──────────────────────────────────────────────

// Seed model pricing (current OpenRouter pricing as of July 2026)
const seedPricing = db.prepare(`
  INSERT OR IGNORE INTO model_pricing (model, input_price_per_1m, output_price_per_1m)
  VALUES (?, ?, ?)
`);

seedPricing.run('qwen/qwen3.7-plus', 0.27, 0.85);
seedPricing.run('qwen/qwen3-235b-a22b', 0.27, 0.85);
seedPricing.run('google/gemini-2.5-flash', 0.15, 0.60);

// Seed budget thresholds
const seedBudget = db.prepare(`
  INSERT OR IGNORE INTO budget_thresholds (period, max_tokens, max_cost_usd, alert_percentage)
  VALUES (?, ?, ?, ?)
`);

seedBudget.run('daily', 5000000, 10.00, 80);
seedBudget.run('monthly', 100000000, 200.00, 80);

// ── Helper Functions ───────────────────────────────────────

/**
 * Calculate the cost in USD for a token usage event.
 * Falls back to 0 if the model is not in the pricing table.
 */
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = db.prepare(
    'SELECT input_price_per_1m, output_price_per_1m FROM model_pricing WHERE model = ? AND is_active = 1'
  ).get(model);

  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000000) * pricing.input_price_per_1m;
  const outputCost = (outputTokens / 1000000) * pricing.output_price_per_1m;
  return Math.round((inputCost + outputCost) * 1000000) / 1000000; // round to 6 decimal places
}

module.exports = { db, calculateCost };
