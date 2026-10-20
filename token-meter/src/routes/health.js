'use strict';

const { db } = require('../db');
const fs = require('fs');
const path = require('path');

const startTime = Date.now();

/**
 * GET /health
 * Returns service health status.
 */
module.exports = async (req, res) => {
  try {
    const dbPath = process.env.DB_PATH || '/data/token-meter.db';
    let dbSizeKb = 0;

    try {
      const stats = fs.statSync(dbPath);
      dbSizeKb = Math.round(stats.size / 1024);
    } catch {
      // DB file might not exist yet
    }

    const row = db.prepare('SELECT COUNT(*) AS cnt FROM token_usage_events').get();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      db_size_kb: dbSizeKb,
      total_events: row.cnt,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    }));
  } catch (err) {
    console.error('[health] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: err.message }));
  }
};
