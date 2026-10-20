'use strict';

const { db } = require('../db');

/**
 * GET /api/by-user?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20
 * Returns token usage breakdown by user with avg tokens per call.
 */
module.exports = async (req, res, query) => {
  try {
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);
    const limit = Math.min(parseInt(query.limit) || 20, 100);

    const rows = db.prepare(`
      SELECT
        user_id,
        MAX(user_name)  AS user_name,
        SUM(total_tokens) AS total_tokens,
        SUM(cost_usd)    AS cost_usd,
        COUNT(*)          AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
        AND user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY total_tokens DESC
      LIMIT ?
    `).all(from, to, limit);

    const users = rows.map(r => ({
      user_id: r.user_id,
      user_name: r.user_name || r.user_id,
      total_tokens: r.total_tokens,
      cost_usd: Math.round(r.cost_usd * 1000000) / 1000000,
      call_count: r.call_count,
      avg_tokens_per_call: r.call_count > 0 ? Math.round(r.total_tokens / r.call_count) : 0,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users }));
  } catch (err) {
    console.error('[by-user] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
