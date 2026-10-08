import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Run only against a disposable cluster. The API itself runs APP_ENV=production
// so this checks production cookies and the native trusted-proxy configuration.
const base = new URL(process.env.PROXY_TEST_URL ?? 'http://127.0.0.1:34080');
const database = new URL(process.env.DATABASE_URL);
if (
  process.env.APP_ENV !== 'test' ||
  base.hostname !== '127.0.0.1' ||
  base.port !== '34080' ||
  database.hostname !== '127.0.0.1' ||
  database.port !== '35433' ||
  database.pathname !== '/proview_test' ||
  !process.env.FRONTEND_URL?.startsWith('https://')
)
  throw new Error('Use the isolated native verification cluster/proxy and HTTPS origin.');
const origin = process.env.FRONTEND_URL;
const require = createRequire(resolve('apps/api/package.json'));
const { Client } = require('pg');
database.searchParams.delete('schema');
const db = new Client({ connectionString: database.toString() });
await db.connect();
let assertions = 0;
async function request(path, expected, options = {}) {
  const response = await fetch(new URL(`/api/v1${path}`, base), {
    ...options,
    headers: {
      Origin: origin,
      'Cf-Connecting-Ip': '198.51.100.10',
      'X-Forwarded-For': '203.0.113.99',
      ...options.headers,
    },
  });
  assert.equal(response.status, expected, `${options.method ?? 'GET'} ${path}`);
  assertions++;
  return response;
}
const login = (identifier, password, ip = '198.51.100.10') => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Cf-Connecting-Ip': ip },
  body: JSON.stringify({ identifier, password }),
});
const check = (value) => {
  assert.ok(value);
  assertions++;
};
try {
  const health = await request('/health/ready', 200, {
    headers: { 'X-Request-ID': 'invalid<script>' },
  });
  check(/^[a-f0-9-]{36}$/.test(health.headers.get('x-request-id')));
  check(health.headers.get('cache-control') === 'no-store');
  check(health.headers.get('x-content-type-options') === 'nosniff');
  await request('/me', 401);
  check((await fetch(new URL('/api/docs', base))).status === 404);
  const response = await request(
    '/auth/login',
    200,
    login('student3', process.env.DEMO_PASSWORD ?? 'ProViewDemo!2026'),
  );
  const session = await response.json();
  const cookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/v1/auth'])
    check(cookie?.includes(flag));
  check(!cookie.includes('Domain='));
  check(!('refreshToken' in session));
  const stored = await db.query(
    'SELECT "ipAddress" FROM "AuthSession" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1',
    [session.user.id],
  );
  check(stored.rows[0]?.ipAddress === '198.51.100.10');
  const cookieHeader = cookie.split(';')[0];
  await request('/auth/refresh', 403, {
    method: 'POST',
    headers: { Cookie: cookieHeader, Origin: 'https://untrusted.invalid' },
  });
  const renewed = await request('/auth/refresh', 200, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  const renewedCookie = renewed.headers.get('set-cookie').split(';')[0];
  check(renewedCookie !== cookieHeader);
  const renewedSession = await renewed.json();
  await request('/auth/logout', 403, {
    method: 'POST',
    headers: { Cookie: renewedCookie, Origin: 'https://untrusted.invalid' },
  });
  await request('/me', 200, {
    headers: { Authorization: `Bearer ${renewedSession.accessToken}` },
  });
  const oversizedPdf = new FormData();
  oversizedPdf.append(
    'file',
    new Blob([Buffer.alloc(20 * 1024 * 1024 + 1)], { type: 'application/pdf' }),
    'oversized.pdf',
  );
  await request('/submissions/00000000-0000-4000-a000-000000000001/versions', 413, {
    method: 'POST',
    headers: { Authorization: `Bearer ${renewedSession.accessToken}` },
    body: oversizedPdf,
  });
  await request('/auth/logout', 200, {
    method: 'POST',
    headers: { Cookie: renewedCookie },
  });
  await request('/auth/refresh', 401, {
    method: 'POST',
    headers: { Cookie: renewedCookie },
  });
  await request('/me', 401, {
    headers: { Authorization: `Bearer ${renewedSession.accessToken}` },
  });
  for (let n = 1; n <= 31; n++)
    await request(
      '/auth/login',
      n <= 30 ? 401 : 429,
      login('does-not-exist', 'WrongPassword!2026', '198.51.100.11'),
    );
  // Same forged X-Forwarded-For, different trusted CF client IP: distinct bucket.
  await request('/auth/login', 401, login('does-not-exist', 'WrongPassword!2026', '198.51.100.12'));
  await request('/auth/login', 413, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.alloc(21 * 1024 * 1024 + 1),
  });
  for (const path of [
    '/.env',
    '/.runtime/secrets/pgpass',
    '/.runtime/files/submissions/private.pdf',
  ]) {
    const response = await fetch(new URL(path, base));
    check(response.status === 404);
    check(!response.headers.get('content-type')?.includes('application/pdf'));
  }
  console.log(`PASS ${assertions} native proxy/security assertions.`);
} finally {
  await db.end();
}
