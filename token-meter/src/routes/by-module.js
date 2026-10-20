'use strict';

const { db } = require('../db');

/**
 * GET /api/by-module?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns token usage breakdown by module (ella, obra, yala) with percentages.
 */
module.exports = async (req, res, query) => {
  try {
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT
        module,
        SUM(total_tokens)  AS total_tokens,
        SUM(input_tokens)  AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(cost_usd)      AS cost_usd,
        COUNT(*)            AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
      GROUP BY module
      ORDER BY total_tokens DESC
    `).all(from, to);

    const grandTotal = rows.reduce((sum, r) => sum + r.total_tokens, 0);

    const modules = rows.map(r => ({
      module: r.module,
      total_tokens: r.total_tokens,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: Math.round(r.cost_usd * 1000000) / 1000000,
      call_count: r.call_count,
      percentage: grandTotal > 0 ? Math.round((r.total_tokens / grandTotal) * 1000) / 10 : 0,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ modules }));
  } catch (err) {
    console.error('[by-module] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
