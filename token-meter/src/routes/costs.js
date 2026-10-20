'use strict';

const { db } = require('../db');

/**
 * GET /api/costs?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns per-model cost breakdown and projected monthly spend.
 */
module.exports = async (req, res, query) => {
  try {
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);

    // Per-model breakdown
    const rows = db.prepare(`
      SELECT
        model,
        SUM(input_tokens)  AS total_input,
        SUM(output_tokens) AS total_output,
        SUM(total_tokens)  AS total_tokens,
        SUM(cost_usd)      AS total_cost,
        COUNT(*)            AS call_count
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
      GROUP BY model
      ORDER BY total_cost DESC
    `).all(from, to);

    const models = rows.map(r => ({
      model: r.model,
      input_tokens: r.total_input,
      output_tokens: r.total_output,
      total_tokens: r.total_tokens,
      cost_usd: Math.round(r.total_cost * 1000000) / 1000000,
      call_count: r.call_count,
    }));

    // Projected monthly spend based on last 7 days velocity
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const velocityRow = db.prepare(`
      SELECT
        COALESCE(SUM(total_tokens), 0) AS weekly_tokens,
        COALESCE(SUM(cost_usd), 0)    AS weekly_cost
      FROM token_usage_events
      WHERE datetime(recorded_at) BETWEEN ? AND ?
    `).get(sevenDaysAgo, nowStr);

    const projectedMonthlyTokens = Math.round(velocityRow.weekly_tokens * (30 / 7));
    const projectedMonthlyCost = Math.round(velocityRow.weekly_cost * (30 / 7) * 1000000) / 1000000;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      models,
      projected_monthly: {
        tokens: projectedMonthlyTokens,
        cost_usd: projectedMonthlyCost,
      },
    }));
  } catch (err) {
    console.error('[costs] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
