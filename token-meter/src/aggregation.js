'use strict';

const { db } = require('./db');

// ── Debounced Aggregation ──────────────────────────────────
//
// After each record insertion, triggerAggregation() is called.
// Instead of aggregating immediately on every insert (which could
// cause many redundant rollups during burst traffic), we use a
// debounce timer: wait 10 seconds after the last record before
// running the aggregation. This means a burst of 50 calls in 10s
// triggers only ONE rollup, not 50.

let aggregationTimer = null;
const AGGREGATION_DEBOUNCE_MS = 10000;

/**
 * Roll up today's raw events into token_daily_aggregates.
 * Uses INSERT OR REPLACE with ON CONFLICT to upsert.
 */
function runAggregation() {
  try {
    db.exec(`
      INSERT OR REPLACE INTO token_daily_aggregates
        (date, model, module, route, total_input, total_output, total_tokens, total_cost_usd, call_count)
      SELECT
        date(recorded_at) AS date,
        model,
        module,
        route,
        SUM(input_tokens)  AS total_input,
        SUM(output_tokens) AS total_output,
        SUM(total_tokens)  AS total_tokens,
        SUM(cost_usd)      AS total_cost_usd,
        COUNT(*)            AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) = date('now')
      GROUP BY date(recorded_at), model, module, route
    `);
    console.log('[aggregation] Rolled up today\'s events into daily aggregates');
  } catch (err) {
    console.error('[aggregation] Rollup failed:', err.message);
  }
}

/**
 * Trigger debounced aggregation. Called after each record insertion.
 * If a timer is already pending, it will be cancelled and a new one set.
 */
function triggerAggregation() {
  if (aggregationTimer) {
    clearTimeout(aggregationTimer);
  }
  aggregationTimer = setTimeout(() => {
    aggregationTimer = null;
    runAggregation();
  }, AGGREGATION_DEBOUNCE_MS);
}

// ── Daily Cleanup ──────────────────────────────────────────
//
// Raw token_usage_events are kept for 90 days, then deleted.
// Daily aggregates are kept indefinitely (they are compact).
// This runs every 60 seconds, but only performs the delete at midnight.

let lastCleanupDate = null;

function runCleanup() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Only run once per day (at first check after midnight)
  if (lastCleanupDate === today) return;

  try {
    const result = db.prepare(`
      DELETE FROM token_usage_events
      WHERE recorded_at < datetime('now', '-90 days')
    `).run();

    if (result.changes > 0) {
      console.log(`[cleanup] Deleted ${result.changes} events older than 90 days`);
    }

    lastCleanupDate = today;
  } catch (err) {
    console.error('[cleanup] Failed:', err.message);
  }
}

/**
 * Start the cleanup interval. Checks every 60 seconds.
 */
function startCleanupInterval() {
  // Run initial check
  runCleanup();

  // Check every 60 seconds
  setInterval(runCleanup, 60000);

  console.log('[aggregation] Cleanup interval started (60s, daily delete at midnight)');
}

module.exports = { triggerAggregation, startCleanupInterval, runAggregation };
