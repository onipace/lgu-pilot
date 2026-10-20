'use strict';

const { db } = require('../db');

/**
 * GET /api/pricing
 * Returns all model pricing entries.
 *
 * PUT /api/pricing
 * Updates pricing for a model. Body: { model, input_price_per_1m, output_price_per_1m }
 */
module.exports = async (req, res, query, body, method) => {
  try {
    if (method === 'GET') {
      const rows = db.prepare(`
        SELECT model, input_price_per_1m, output_price_per_1m, currency, effective_from, is_active
        FROM model_pricing
        ORDER BY model ASC
      `).all();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: rows }));

    } else if (method === 'PUT') {
      const { model, input_price_per_1m, output_price_per_1m } = body;

      if (!model) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'model is required' }));
        return;
      }

      if (input_price_per_1m === undefined || output_price_per_1m === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'input_price_per_1m and output_price_per_1m are required' }));
        return;
      }

      // Upsert: update if exists, insert if not
      db.prepare(`
        INSERT INTO model_pricing (model, input_price_per_1m, output_price_per_1m, effective_from)
        VALUES (?, ?, ?, date('now'))
        ON CONFLICT(model) DO UPDATE SET
          input_price_per_1m = excluded.input_price_per_1m,
          output_price_per_1m = excluded.output_price_per_1m,
          effective_from = date('now')
      `).run(model, Number(input_price_per_1m), Number(output_price_per_1m));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }
  } catch (err) {
    console.error('[pricing] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
