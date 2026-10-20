'use strict';

const { db } = require('../db');

/**
 * GET /api/timeseries?granularity=daily&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns time-series token usage data.
 * Granularity options: hourly, daily, weekly, monthly
 */
module.exports = async (req, res, query) => {
  try {
    const granularity = query.granularity || 'daily';
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);

    let dateFormat;
    switch (granularity) {
      case 'hourly':
        // strftime to get YYYY-MM-DD HH:00
        dateFormat = "strftime('%Y-%m-%d %H:00', recorded_at)";
        break;
      case 'weekly':
        // ISO week: YYYY-Www
        dateFormat = "strftime('%Y-W%W', recorded_at)";
        break;
      case 'monthly':
        dateFormat = "strftime('%Y-%m', recorded_at)";
        break;
      case 'daily':
      default:
        dateFormat = "date(recorded_at)";
        break;
    }

    const rows = db.prepare(`
      SELECT
        ${dateFormat} AS period,
        SUM(total_tokens)  AS total_tokens,
        SUM(input_tokens)  AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(cost_usd)      AS cost_usd,
        COUNT(*)            AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
      GROUP BY period
      ORDER BY period ASC
    `).all(from, to);

    const data = rows.map(r => ({
      period: r.period,
      total_tokens: r.total_tokens,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: Math.round(r.cost_usd * 1000000) / 1000000,
      call_count: r.call_count,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ granularity, data }));
  } catch (err) {
    console.error('[timeseries] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
