'use strict';

const { db } = require('../db');

/**
 * GET /api/by-route?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns token usage breakdown by API route with avg tokens per call.
 */
module.exports = async (req, res, query) => {
  try {
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT
        route,
        module,
        SUM(total_tokens)  AS total_tokens,
        SUM(cost_usd)      AS cost_usd,
        COUNT(*)            AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
      GROUP BY route, module
      ORDER BY total_tokens DESC
    `).all(from, to);

    const routes = rows.map(r => ({
      route: r.route,
      module: r.module,
      total_tokens: r.total_tokens,
      cost_usd: Math.round(r.cost_usd * 1000000) / 1000000,
      call_count: r.call_count,
      avg_tokens_per_call: r.call_count > 0 ? Math.round(r.total_tokens / r.call_count) : 0,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ routes }));
  } catch (err) {
    console.error('[by-route] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
