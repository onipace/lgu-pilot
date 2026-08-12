// tests/integration/page-auth-redirect.test.ts
// SYSTEM_TEST D-1 verification — unauthenticated page routes redirect.
// Runs against a running dev server: this is the ONLY level that proves the
// fix, because config.matcher decides whether Next.js runs src/middleware.ts
// at all — a missing matcher entry makes the page return 200 no matter what
// the middleware function itself does. Asserts /likha and /linaw now behave
// exactly like the established /ella (and sibling) behavior: 302/307 →
// /login?returnUrl=<path>. Self-contained on purpose (platform-level auth
// gate): imports no module helpers, introduces no likha/linaw cross-module
// references.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.PAGE_AUTH_TEST_BASE_URL || 'http://localhost:3000';

async function assertServerReachable(): Promise<void> {
  try {
    const res = await fetch(BASE_URL + '/api/health');
    if (!res.ok) {
      throw new Error(`health check returned ${res.status}`);
    }
  } catch {
    throw new Error(
      'SKIP-FAIL: start the dev server first (npm run dev) — integration tests run API-level per SPRINT_PLAN'
    );
  }
}

test('page-route auth redirect suite (SYSTEM_TEST D-1)', async (t) => {
  await assertServerReachable();

  // Every PROTECTED_PATHS page must redirect unauthenticated visitors; /ella
  // is the long-established reference behavior the new entries must match.
  for (const page of ['/ella', '/likha', '/linaw']) {
    await t.test(`unauthenticated GET ${page} redirects to /login like /ella`, async () => {
      const res = await fetch(BASE_URL + page, { redirect: 'manual' });
      assert.ok(
        res.status === 302 || res.status === 307,
        `GET ${page} must redirect unauthenticated visitors (302/307), got ${res.status}`
      );
      const location = res.headers.get('location') ?? '';
      assert.ok(location.includes('/login'), `redirect must target /login (got ${location})`);
      assert.ok(
        location.includes('returnUrl=' + encodeURIComponent(page)),
        `redirect must carry returnUrl=${page} (got ${location})`
      );
    });
  }

  // Subpath coverage — the ':path*' shape of each matcher entry.
  await t.test('unauthenticated GET /likha/deep and /linaw/deep also redirect', async () => {
    for (const page of ['/likha/anything-here', '/linaw/anything-here']) {
      const res = await fetch(BASE_URL + page, { redirect: 'manual' });
      assert.ok(
        res.status === 302 || res.status === 307 || res.status === 404,
        `GET ${page} must not serve a 200 page shell unauthenticated, got ${res.status}`
      );
      if (res.status === 302 || res.status === 307) {
        const location = res.headers.get('location') ?? '';
        assert.ok(location.includes('/login'), location);
      }
    }
  });

  // The login page itself must stay reachable (no redirect loop).
  await t.test('GET /login stays 200 (no redirect loop)', async () => {
    const res = await fetch(BASE_URL + '/login', { redirect: 'manual' });
    assert.equal(res.status, 200);
  });
});
