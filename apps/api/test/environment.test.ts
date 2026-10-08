import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { environmentSchema } from '../src/infrastructure/environment';

const base = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'local-only-replace-this-secret-at-deployment',
};

test('local production build permits explicitly local demo configuration', () => {
  const result = environmentSchema.parse({
    ...base,
    NODE_ENV: 'production',
    APP_ENV: 'local',
    SEED_DEMO: 'true',
    COOKIE_SECURE: 'false',
  });
  assert.equal(result.SEED_DEMO, true);
  assert.equal(result.COOKIE_SECURE, false);
});

test('deployed production rejects demo seed, insecure cookies and example secret', () => {
  const result = environmentSchema.safeParse({
    ...base,
    APP_ENV: 'production',
    SEED_DEMO: 'true',
    COOKIE_SECURE: 'false',
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.deepEqual(
      new Set(result.error.issues.map((issue) => issue.path[0])),
      new Set(['COOKIE_SECURE', 'FRONTEND_URL', 'SEED_DEMO', 'JWT_ACCESS_SECRET']),
    );
});

test('S3 driver requires credentials and upload size is bounded', () => {
  assert.equal(environmentSchema.safeParse({ ...base, STORAGE_DRIVER: 's3' }).success, false);
  assert.equal(environmentSchema.safeParse({ ...base, MAX_UPLOAD_BYTES: '-1' }).success, false);
});
