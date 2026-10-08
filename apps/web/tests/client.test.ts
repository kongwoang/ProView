import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../lib/api/client';
import type { AuthSession } from '../lib/api/contracts';

const session = (id = 'author', token = 'fresh'): AuthSession => ({
  accessToken: token,
  user: { id, email: `${id}@example.test`, username: id, displayName: id, role: 'STUDENT' },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('concurrent expired requests share refresh and retry once with the fresh token', async () => {
  let refreshes = 0;
  const client = new ApiClient((async (url, init) => {
    if (url === '/api/v1/auth/refresh') {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return json(session());
    }
    return new Headers(init?.headers).get('Authorization') === 'Bearer fresh'
      ? json({ ok: true })
      : json({ code: 'UNAUTHORIZED', message: 'Expired' }, 401);
  }) as typeof fetch);
  client.setSession(session('author', 'expired'));
  const result = await Promise.all([client.get('/one'), client.get('/two')]);
  assert.equal(refreshes, 1);
  assert.deepEqual(result, [{ ok: true }, { ok: true }]);
});

test('persistent 401 does not create an infinite refresh loop', async () => {
  let requests = 0;
  const client = new ApiClient((async (url) => {
    requests++;
    return url === '/api/v1/auth/refresh'
      ? json(session())
      : json({ code: 'REVOKED', message: 'Access revoked' }, 401);
  }) as typeof fetch);
  await assert.rejects(
    client.get('/private'),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(requests, 3);
});

test('refresh into another account never retries the previous account action', async () => {
  let actions = 0;
  const states: (string | null)[] = [];
  const client = new ApiClient((async (url) => {
    if (url === '/api/v1/auth/refresh') return json(session('second'));
    actions++;
    return json({ code: 'UNAUTHORIZED', message: 'Expired' }, 401);
  }) as typeof fetch);
  client.onSessionChange((next) => states.push(next?.user.id ?? null));
  client.setSession(session('first', 'expired'));
  await assert.rejects(
    client.post('/private', { action: 'save' }),
    (error: unknown) => error instanceof ApiError && error.details.code === 'SESSION_CHANGED',
  );
  assert.equal(actions, 1);
  assert.deepEqual(states, ['first', 'second']);
});

test('late response from a previous account is discarded', async () => {
  let resolveResponse!: (response: Response) => void;
  const client = new ApiClient(
    (() =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      })) as typeof fetch,
  );
  client.setSession(session('first'));
  const request = client.get('/private');
  client.setSession(session('second'));
  resolveResponse(json({ private: 'first account' }));
  await assert.rejects(
    request,
    (error: unknown) => error instanceof ApiError && error.details.code === 'SESSION_CHANGED',
  );
});

test('late refresh never resurrects a logged-out session', async () => {
  let resolveResponse!: (response: Response) => void;
  const states: (string | null)[] = [];
  const client = new ApiClient(
    (() =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      })) as typeof fetch,
  );
  client.onSessionChange((next) => states.push(next?.user.id ?? null));
  client.setSession(session('first'));
  const refresh = client.refresh();
  client.setSession(null);
  resolveResponse(json(session('first')));
  await assert.rejects(refresh);
  assert.deepEqual(states, ['first', null]);
});

test('private requests use no-store and same-origin credentials without token URLs', async () => {
  const client = new ApiClient((async (url, init) => {
    assert.equal(url, '/api/v1/private');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.credentials, 'same-origin');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer secret');
    return json({ ok: true });
  }) as typeof fetch);
  client.setSession(session('first', 'secret'));
  await client.get('/private');
  await assert.rejects(client.get('//outside.test/private'));
  await assert.rejects(client.get('https://outside.test/private'));
});

test('conflicts retain structured errors for the form to handle', async () => {
  const client = new ApiClient((async () =>
    json(
      { code: 'CONFLICT', message: 'Draft changed', requestId: 'request-1' },
      409,
    )) as typeof fetch);
  await assert.rejects(
    client.put('/review', { revision: 1 }),
    (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.details.requestId === 'request-1',
  );
});
