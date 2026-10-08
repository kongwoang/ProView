import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { objectPath, validateManifest } from './backup.mjs';

if (!['local', 'test'].includes(process.env.APP_ENV)) throw new Error('Test environment required');
const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { Client } = require('pg');
const {
  S3Client,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const driver = process.env.STORAGE_DRIVER || 'local';
const token = randomUUID().replaceAll('-', '');
const name = `proview_restore_${token}`;
const bucket = `proview-restore-${token}`;
const temporary = resolve(root, 'test-results', name);
await mkdir(temporary, { recursive: true, mode: 0o700 });
const sourceUrl = new URL(process.env.DATABASE_URL);
sourceUrl.searchParams.delete('schema');
const db = new Client({ connectionString: sourceUrl.toString() });
await db.connect();
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${name}`;
const target = {
  DATABASE_URL: targetUrl.toString(),
  STORAGE_LOCAL_PATH: resolve(temporary, 'restored-files'),
  S3_BUCKET: bucket,
};
const client =
  driver === 's3'
    ? new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      })
    : undefined;
const bundle = resolve(temporary, 'bundle');

async function execute(operation, overrides = {}, expected = 0, reason) {
  const child = spawn(process.execPath, ['scripts/backup.mjs', operation, bundle], {
    cwd: root,
    env: { ...process.env, ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const code = await new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('exit', resolvePromise);
  });
  assert.equal(code, expected, output);
  if (reason) assert.match(output, reason);
  else process.stdout.write(output);
}

let createdDatabase = false;
let createdBucket = false;
try {
  await db.query(`CREATE DATABASE "${name}"`);
  createdDatabase = true;
  if (client) {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    createdBucket = true;
  }
  await execute('backup');
  const manifest = validateManifest(
    JSON.parse(await readFile(resolve(bundle, 'manifest.json'), 'utf8')),
  );
  assert.ok(manifest.files.length > 0, 'Rehearsal must include real PDFs');
  assert.ok(manifest.tables.find((table) => table.name === 'SubmissionVersion')?.count > 0);
  await execute('restore', target);
  await execute('verify', target);
  await execute('restore', target, 1, /Restore requires a new empty database/);

  // A corrupt bundle must fail before attempting to alter the target.
  const file = manifest.files[0];
  const path = objectPath(resolve(bundle, 'objects'), file.storageKey);
  const bytes = await readFile(path);
  const corrupt = Buffer.from(bytes);
  corrupt[0] ^= 1;
  await writeFile(path, corrupt);
  await execute('restore', target, 1, /PDF checksum or size mismatch/);
  await writeFile(path, bytes);
  await execute('verify', target);

  // Verification must detect a missing restored PDF, even though all DB rows match.
  if (client) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.storageKey }));
  else await rm(objectPath(target.STORAGE_LOCAL_PATH, file.storageKey));
  await execute('verify', target, 1, /Backup operation failed/);
  console.log(
    `PASS ${driver} recovery rehearsal: snapshot/table/version evidence, PDF bytes, occupied-target refusal, corruption and missing-file rejection.`,
  );
} finally {
  if (createdDatabase) await db.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await db.end();
  if (createdBucket) {
    let continuation;
    do {
      const response = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuation }),
      );
      for (const object of response.Contents || [])
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      continuation = response.NextContinuationToken;
    } while (continuation);
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  }
  // Dumps contain accounts/session hashes and stay out of published CI artifacts.
  await rm(temporary, { recursive: true, force: true });
}
