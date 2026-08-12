// tests/unit/middleware-matcher.test.ts
// SYSTEM_TEST D-1 regression — platform middleware (module-neutral).
// Hermetic: imports src/middleware directly — no server, no DB. Next.js only
// RUNS middleware for paths matched by config.matcher, so the matcher list is
// asserted explicitly, and the middleware function itself is exercised with
// real NextRequest objects to prove /likha and /linaw redirect unauthenticated
// visitors exactly like the established /ella behavior (302 → /login).

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('middleware matcher + page-route redirect suite (SYSTEM_TEST D-1)', async (t) => {
  const { middleware, config } = await import('../../src/middleware');
  const { NextRequest } = await import('next/server');

  const matcher = config.matcher as string[];

  await t.test('config.matcher covers every protected page route', () => {
    assert.ok(Array.isArray(matcher), 'config.matcher is an array');
    // The established shape for protected pages is '/<page>/:path*'.
    for (const entry of [
      '/ella/:path*',
      '/obra/:path*',
      '/yala/:path*',
      '/likha/:path*', // D-1: was missing — /likha served 200 unauthenticated
      '/linaw/:path*', // D-1: was missing — /linaw served 200 unauthenticated
      '/admin/:path*',
    ]) {
      assert.ok(matcher.includes(entry), `config.matcher missing '${entry}'`);
    }
  });

  const protectedPages = ['/ella', '/likha', '/linaw'];

  for (const page of protectedPages) {
    await t.test(`unauthenticated GET ${page} → 302 /login?returnUrl=${page}`, () => {
      const req = new NextRequest('http://localhost:3000' + page);
      const res = middleware(req);
      assert.equal(res.status, 302, `${page} must redirect when unauthenticated`);
      const location = res.headers.get('location') ?? '';
      assert.ok(
        location.includes('/login?returnUrl=' + encodeURIComponent(page)),
        `redirect target must be /login with returnUrl=${page} (got ${location})`
      );
    });

    await t.test(`unauthenticated GET ${page}/deep/path → 302 as well`, () => {
      const req = new NextRequest('http://localhost:3000' + page + '/deep/path');
      const res = middleware(req);
      assert.equal(res.status, 302);
      const location = res.headers.get('location') ?? '';
      assert.ok(location.includes('/login'), location);
    });

    await t.test(`authenticated GET ${page} passes through (no redirect)`, () => {
      const req = new NextRequest('http://localhost:3000' + page, {
        headers: { cookie: 'esangguni_user_session=test-session-id' },
      });
      const res = middleware(req);
      assert.notEqual(res.status, 302, 'session cookie present → no redirect');
      assert.equal(res.headers.get('x-middleware-next'), '1', 'NextResponse.next()');
    });
  }

  await t.test('public paths are never intercepted', () => {
    for (const page of ['/', '/login', '/register']) {
      const req = new NextRequest('http://localhost:3000' + page);
      const res = middleware(req);
      assert.notEqual(res.status, 302, `${page} must not redirect`);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    }
  });
});
