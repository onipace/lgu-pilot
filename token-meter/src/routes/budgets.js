'use strict';

const { db } = require('../db');

/**
 * GET /api/budgets
 * Returns daily and monthly budget usage vs configured thresholds.
 *
 * PUT /api/budgets
 * Updates budget thresholds. Body: { period, max_tokens, max_cost_usd, alert_percentage }
 */
module.exports = async (req, res, query, body, method) => {
  try {
    if (method === 'GET') {
      // Get thresholds
      const thresholds = db.prepare(`
        SELECT period, max_tokens, max_cost_usd, alert_percentage, is_active
        FROM budget_thresholds WHERE is_active = 1
      `).all();

      const result = {};

      for (const t of thresholds) {
        // Calculate usage for this period
        let rangeStart;
        if (t.period === 'daily') {
          rangeStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
        } else {
          // Monthly: first day of current month
          const now = new Date();
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 19).replace('T', ' ');
        }

        const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const usage = db.prepare(`
          SELECT
            COALESCE(SUM(total_tokens), 0) AS used_tokens,
            COALESCE(SUM(cost_usd), 0)    AS used_usd
          FROM token_usage_events
          WHERE datetime(recorded_at) BETWEEN ? AND ?
        `).get(rangeStart, nowStr);

        const tokenPct = t.max_tokens > 0 ? (usage.used_tokens / t.max_tokens) * 100 : 0;
        const costPct = t.max_cost_usd > 0 ? (usage.used_usd / t.max_cost_usd) * 100 : 0;
        const maxPct = Math.max(tokenPct, costPct);

        result[t.period] = {
          limit_tokens: t.max_tokens,
          limit_usd: t.max_cost_usd,
          used_tokens: usage.used_tokens,
          used_usd: Math.round(usage.used_usd * 1000000) / 1000000,
          percentage: Math.round(maxPct * 10) / 10,
          alert: maxPct >= t.alert_percentage,
          alert_percentage: t.alert_percentage,
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } else if (method === 'PUT') {
      // Update threshold
      const { period, max_tokens, max_cost_usd, alert_percentage } = body;

      if (!period || !['daily', 'monthly'].includes(period)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid period. Must be "daily" or "monthly".' }));
        return;
      }

      db.prepare(`
        UPDATE budget_thresholds
        SET max_tokens = ?, max_cost_usd = ?, alert_percentage = ?, updated_at = datetime('now')
        WHERE period = ?
      `).run(
        max_tokens !== undefined ? Number(max_tokens) : null,
        max_cost_usd !== undefined ? Number(max_cost_usd) : null,
        alert_percentage !== undefined ? Number(alert_percentage) : 80,
        period
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }
  } catch (err) {
    console.error('[budgets] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
