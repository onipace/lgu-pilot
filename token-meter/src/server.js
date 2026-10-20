'use strict';

const http = require('http');
const url = require('url');

// Initialize database (triggers schema creation + seed on first run)
require('./db');
const { startCleanupInterval } = require('./aggregation');

// ── Route Handlers ─────────────────────────────────────────
const routes = {
  // POST routes
  'POST /api/record': require('./routes/record'),

  // GET routes
  'GET /api/stats': require('./routes/stats'),
  'GET /api/by-module': require('./routes/by-module'),
  'GET /api/by-route': require('./routes/by-route'),
  'GET /api/by-user': require('./routes/by-user'),
  'GET /api/timeseries': require('./routes/timeseries'),
  'GET /api/costs': require('./routes/costs'),
  'GET /api/export': require('./routes/export'),

  // GET/PUT routes (dual method)
  'GET /api/budgets': require('./routes/budgets'),
  'PUT /api/budgets': require('./routes/budgets'),
  'GET /api/pricing': require('./routes/pricing'),
  'PUT /api/pricing': require('./routes/pricing'),

  // Health
  'GET /health': require('./routes/health'),
};

// ── Helpers ────────────────────────────────────────────────

/**
 * Parse JSON body from request with size limit.
 */
function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let totalSize = 0;
    const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });

    req.on('error', () => resolve(null));
  });
}

/**
 * Send JSON error response.
 */
function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

// ── HTTP Server ────────────────────────────────────────────

const PORT = parseInt(process.env.PORT) || 3084;

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();

  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    const query = parsedUrl.query;
    const routeKey = `${method} ${pathname}`;

    // Find handler
    const handler = routes[routeKey];

    if (!handler) {
      sendError(res, 404, 'Not found');
      return;
    }

    // Parse body for POST/PUT
    let body = {};
    if (method === 'POST' || method === 'PUT') {
      body = await parseJsonBody(req);
      if (body === null) {
        sendError(res, 400, 'Invalid JSON body or body too large');
        return;
      }
    }

    // Call handler
    await handler(req, res, query, body, method);

    // Log request
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      console.log(`[${method}] ${pathname} ${res.statusCode} ${duration}ms`);
    }
  } catch (err) {
    console.error('[server] Unhandled error:', err);
    if (!res.headersSent) {
      sendError(res, 500, 'internal_error');
    }
  }
});

// ── Start Server ───────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[token-meter] Server listening on port ${PORT}`);
  console.log(`[token-meter] DB path: ${process.env.DB_PATH || '/data/token-meter.db'}`);
  console.log(`[token-meter] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start cleanup interval
  startCleanupInterval();
});

// ── Graceful Shutdown ──────────────────────────────────────

function shutdown(signal) {
  console.log(`[token-meter] ${signal} received, shutting down...`);
  server.close(() => {
    console.log('[token-meter] Server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds if connections don't close
  setTimeout(() => {
    console.error('[token-meter] Force exit after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch uncaught errors to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[token-meter] Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[token-meter] Unhandled rejection:', err);
});
