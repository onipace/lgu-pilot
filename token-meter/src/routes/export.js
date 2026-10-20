'use strict';

const { db } = require('../db');
const fs = require('fs');

/**
 * GET /api/export?format=csv|json&from=YYYY-MM-DD&to=YYYY-MM-DD&module=ella&route=/api/chat&user_id=xxx
 * Returns all token usage events in the specified range as CSV or JSON.
 */
module.exports = async (req, res, query) => {
  try {
    const format = query.format || 'json';
    const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT event_id, model, input_tokens, output_tokens, total_tokens,
             module, route, user_id, user_name, session_id, cost_usd, recorded_at
      FROM token_usage_events
      WHERE date(recorded_at) BETWEEN ? AND ?
    `;
    const params = [from, to];

    if (query.module) {
      sql += ` AND module = ?`;
      params.push(query.module);
    }
    if (query.route) {
      sql += ` AND route = ?`;
      params.push(query.route);
    }
    if (query.user_id) {
      sql += ` AND user_id = ?`;
      params.push(query.user_id);
    }

    sql += ` ORDER BY recorded_at DESC LIMIT 10000`;

    const rows = db.prepare(sql).all(...params);

    if (format === 'csv') {
      const headers = [
        'event_id', 'model', 'input_tokens', 'output_tokens', 'total_tokens',
        'module', 'route', 'user_id', 'user_name', 'session_id', 'cost_usd', 'recorded_at'
      ];

      const csvLines = [headers.join(',')];

      for (const row of rows) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          // Escape CSV values containing commas, quotes, or newlines
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvLines.push(values.join(','));
      }

      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="token-usage-${from}_to_${to}.csv"`,
      });
      res.end(csvLines.join('\n'));
    } else {
      // JSON format
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="token-usage-${from}_to_${to}.json"`,
      });
      res.end(JSON.stringify(rows));
    }
  } catch (err) {
    console.error('[export] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
};
