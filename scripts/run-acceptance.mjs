import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.env.APP_ENV === 'production')
  throw new Error('Acceptance tests must never run against production.');
const selected = process.env.ACCEPTANCE_SUITE;
if (selected && !['courses', 'grading', 'reviews', 'browser'].includes(selected))
  throw new Error('Invalid ACCEPTANCE_SUITE');
const host = 'http://127.0.0.1:3001';
try {
  const response = await fetch(`${host}/api/v1/health/live`);
  if (response.ok)
    throw new Error(
      'Port3001 already has an API. Stop it before running the isolated acceptance runner.',
    );
} catch (error) {
  if (!(error instanceof TypeError)) throw error;
}
await mkdir('test-results', { recursive: true });
async function execute(command, args, env = {}) {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`${command} exited ${code}`);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), setTimeout(5000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}
async function withApi(label, action) {
  if (selected && selected !== label) return;
  const log = createWriteStream(`test-results/api-${label}.log`);
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: 'apps/api',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3001',
      OPENAPI_OUTPUT: resolve('test-results/openapi.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.pipe(log);
  api.stderr.pipe(log);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (api.exitCode !== null)
        throw new Error(`API startup failed: see test-results/api-${label}.log`);
      ready = await fetch(`${host}/api/v1/health/ready`)
        .then((response) => response.ok)
        .catch(() => false);
      if (ready) break;
      await setTimeout(100);
    }
    if (!ready) throw new Error('API readiness timeout');
    const spec = JSON.parse(await readFile('test-results/openapi.json', 'utf8'));
    if (
      !spec.components.schemas.LoginDto.properties.identifier ||
      !spec.components.schemas.ReviewDraftDto.properties.responses.items.$ref ||
      !spec.paths['/api/v1/submissions/{id}/versions'].post.requestBody.content[
        'multipart/form-data'
      ]
    )
      throw new Error('OpenAPI request schemas are incomplete');
    await action();
  } finally {
    await stop(api);
    log.end();
  }
}
await withApi('courses', () =>
  execute(process.execPath, ['scripts/acceptance-courses-submissions.mjs']),
);
await withApi('grading', () =>
  execute(process.execPath, ['scripts/acceptance-auth-grading-archive.mjs']),
);
await withApi('reviews', () =>
  execute(
    'pnpm',
    [
      '--filter',
      '@proview/api',
      'exec',
      'node',
      '--import',
      'tsx',
      '--test',
      'test/review-http.test.ts',
    ],
    { RUN_HTTP_TESTS: 'true' },
  ),
);
async function browserChecks(args) {
  const webLog = createWriteStream('test-results/web.log');
  const web = spawn(process.execPath, ['scripts/start-web.mjs'], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  web.stdout.pipe(webLog);
  web.stderr.pipe(webLog);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (web.exitCode !== null) throw new Error('Web startup failed');
      ready = await fetch('http://localhost:3000/login')
        .then((response) => response.ok)
        .catch(() => false);
      if (ready) break;
      await setTimeout(100);
    }
    if (!ready) throw new Error('Web readiness timeout');
    await execute('pnpm', ['exec', 'playwright', 'test', ...args]);
  } finally {
    await stop(web);
    webLog.end();
  }
}
await withApi('browser', () =>
  browserChecks(['--grep-invert', '@lifecycle', '--output=test-results/focused']),
);
await withApi('browser', () =>
  browserChecks(['--grep', '@lifecycle', '--output=test-results/lifecycle']),
);
console.log('PASS selected isolated acceptance suites.');
