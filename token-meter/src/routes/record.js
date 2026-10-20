'use strict';

const { db, calculateCost } = require('../db');
const { triggerAggregation } = require('../aggregation');

/**
 * POST /api/record
 * Record a token usage event.
 * Always returns 201 (even on partial failures — caller does not retry).
 */
module.exports = async (req, res, query, body) => {
  try {
    // Validate required fields
    const model = body.model;
    const inputTokens = Number(body.input_tokens) || 0;
    const outputTokens = Number(body.output_tokens) || 0;
    const module = body.module;
    const route = body.route;

    if (!model || !module || !route) {
      // Log warning but still return 201 — fire-and-forget contract
      console.warn('[record] Missing required fields:', { model, module, route });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, event_id: null, warning: 'missing required fields' }));
      return;
    }

    const totalTokens = inputTokens + outputTokens;
    const userId = body.user_id || null;
    const userName = body.user_name || null;
    const sessionId = body.session_id || null;
    const costUsd = calculateCost(model, inputTokens, outputTokens);

    // Use provided timestamp or default to now
    // Normalize to SQLite datetime format (YYYY-MM-DD HH:MM:SS) for correct string comparisons
    const recordedAt = (body.timestamp || new Date().toISOString()).slice(0, 19).replace('T', ' ');

    const result = db.prepare(`
      INSERT INTO token_usage_events
        (model, input_tokens, output_tokens, total_tokens, module, route, user_id, user_name, session_id, cost_usd, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(model, inputTokens, outputTokens, totalTokens, module, route, userId, userName, sessionId, costUsd, recordedAt);

    // Get the auto-generated event_id
    const row = db.prepare('SELECT event_id FROM token_usage_events WHERE id = ?').get(result.lastInsertRowid);

    // Trigger debounced aggregation
    triggerAggregation();

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, event_id: row.event_id }));
  } catch (err) {
    console.error('[record] Error:', err.message);
    // Still return 201 — fire-and-forget contract
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, event_id: null, error: 'internal_error' }));
  }
};
