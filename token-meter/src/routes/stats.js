'use strict';

const { db } = require('../db');

/**
 * GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns aggregated stats for today, this week, this month, this year.
 */
module.exports = async (req, res, query) => {
  try {
    // Compute period ranges (SQLite datetime strings)
    const now = new Date();
    const todayStart = now.toISOString().slice(0, 10) + ' 00:00:00';
    const todayEnd = now.toISOString().slice(0, 10) + ' 23:59:59';

    // Week: last 7 days
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Month: last 30 days
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Year: last 365 days
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

    const periods = {
      today: [todayStart, todayEnd],
      this_week: [weekAgo, nowStr],
      this_month: [monthAgo, nowStr],
      this_year: [yearAgo, nowStr],
    };

    const selectStmt = db.prepare(`
      SELECT
        COALESCE(SUM(total_tokens), 0)  AS total_tokens,
        COALESCE(SUM(input_tokens), 0)  AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(cost_usd), 0)     AS cost_usd,
        COUNT(*)                        AS call_count
      FROM token_usage_events
      WHERE datetime(recorded_at) BETWEEN ? AND ?
    `);

    const result = {};
    for (const [period, [start, end]] of Object.entries(periods)) {
      const row = selectStmt.get(start, end);
      result[period] = {
        total_tokens: row.total_tokens,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        cost_usd: Math.round(row.cost_usd * 1000000) / 1000000,
        call_count: row.call_count,
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[stats] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
