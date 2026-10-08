import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { Client } = require('pg');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

export function objectPath(directory, key) {
  if (typeof key !== 'string' || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.pdf$/.test(key))
    throw new Error('Invalid backup object key');
  const path = resolve(directory, key);
  if (!path.startsWith(`${resolve(directory)}${sep}`))
    throw new Error('Invalid backup object path');
  return path;
}

export function validateManifest(manifest) {
  if (
    manifest?.format !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.dumpSha256) ||
    !Array.isArray(manifest.tables) ||
    !Array.isArray(manifest.files)
  )
    throw new Error('Invalid or empty backup manifest');
  const keys = new Set();
  for (const file of manifest.files) {
    objectPath('/backup', file.storageKey);
    if (
      !['SubmissionFile', 'SimilarityResultFile'].includes(file.table) ||
      typeof file.id !== 'string' ||
      typeof file.parentId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes <= 0 ||
      keys.has(file.storageKey)
    )
      throw new Error('Invalid file manifest');
    keys.add(file.storageKey);
  }
  const tables = new Set();
  for (const table of manifest.tables) {
    if (
      typeof table.name !== 'string' ||
      !Number.isSafeInteger(table.count) ||
      table.count < 0 ||
      !/^[a-f0-9]{32}$/.test(table.digest) ||
      tables.has(table.name)
    )
      throw new Error('Invalid table manifest');
    tables.add(table.name);
  }
  if (!tables.has('SubmissionVersion') || !tables.has('_prisma_migrations'))
    throw new Error('Backup is not a migrated ProView database');
  return manifest;
}

async function checksum(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

function databaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL required');
  if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')
    throw new Error('Only the ProView public schema is supported');
  url.searchParams.delete('schema');
  return url;
}

async function connect() {
  const db = new Client({ connectionString: databaseUrl().toString() });
  await db.connect();
  await db.query("SET TIME ZONE 'UTC'");
  return db;
}

async function postgresTool(tool, args, file, direction) {
  const url = databaseUrl();
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}),
  };
  const container = process.env.BACKUP_POSTGRES_CONTAINER;
  const command = container
    ? 'docker'
    : process.env[tool === 'pg_dump' ? 'PG_DUMP' : 'PG_RESTORE'] || tool;
  const commandArgs = container
    ? [
        'exec',
        '-i',
        ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE']
          .filter((key) => env[key] !== undefined)
          .flatMap((key) => ['-e', key]),
        container,
        tool,
        ...args,
      ]
    : args;
  const child = spawn(command, commandArgs, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  // Tool stderr can contain credentials/connection details; never echo it.
  child.stderr.resume();
  const completed = new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${tool} failed`)),
    );
  });
  const transferred =
    direction === 'dump'
      ? pipeline(child.stdout, createWriteStream(file, { flags: 'wx', mode: 0o600 }))
      : pipeline(createReadStream(file), child.stdin);
  if (direction === 'dump') child.stdin.end();
  else child.stdout.resume();
  try {
    await Promise.all([completed, transferred]);
  } catch (error) {
    child.kill();
    throw error;
  }
}

function storage() {
  const driver = process.env.STORAGE_DRIVER || 'local';
  const directory = resolve(
    root,
    'apps/api',
    process.env.STORAGE_LOCAL_PATH || '../../.data/files',
  );
  const Bucket = process.env.S3_BUCKET || 'proview-private';
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
  if (!['local', 's3'].includes(driver)) throw new Error('Invalid storage driver');
  return {
    async assertEmpty() {
      if (client) {
        const response = await client.send(new ListObjectsV2Command({ Bucket, MaxKeys: 1 }));
        if (response.KeyCount) throw new Error('Restore requires an empty storage bucket');
      } else {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        if ((await readdir(directory)).length)
          throw new Error('Restore requires an empty storage directory');
      }
    },
    async read(key) {
      objectPath(directory, key);
      if (client) {
        const response = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return Buffer.from(await response.Body.transformToByteArray());
      }
      return readFile(objectPath(directory, key));
    },
    async write(file, bytes) {
      if (client)
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: file.storageKey,
            Body: bytes,
            ContentType: 'application/pdf',
            Metadata: { sha256: file.sha256 },
            IfNoneMatch: '*',
          }),
        );
      else {
        const path = objectPath(directory, file.storageKey);
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
      }
    },
  };
}

async function fileMetadata(db) {
  const { rows } = await db.query(`
    SELECT 'SubmissionFile' AS "table", id, "submissionVersionId" AS "parentId",
           "storageKey", "sizeBytes", sha256 FROM "SubmissionFile" WHERE state = 'READY'
    UNION ALL
    SELECT 'SimilarityResultFile', id, "similarityCheckId", "storageKey", "sizeBytes", sha256
      FROM "SimilarityResultFile" WHERE state = 'READY'
    ORDER BY "table", id`);
  return rows;
}

async function tableEvidence(db) {
  const { rows } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const tables = [];
  for (const { tablename } of rows) {
    const {
      rows: [evidence],
    } = await db.query(`SELECT count(*)::int AS count,
      md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) AS digest
      FROM ${identifier(tablename)} t`);
    tables.push({ name: tablename, ...evidence });
  }
  return tables;
}

function verifyBytes(file, bytes) {
  if (bytes.length !== file.sizeBytes || hash(bytes) !== file.sha256)
    throw new Error('PDF checksum or size mismatch');
}

async function readBundle(directory) {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Backup must be a real directory');
  const manifest = validateManifest(
    JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')),
  );
  if ((await checksum(resolve(directory, 'database.dump'))) !== manifest.dumpSha256)
    throw new Error('Database dump checksum mismatch');
  for (const file of manifest.files) {
    const path = objectPath(resolve(directory, 'objects'), file.storageKey);
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Backup object cannot be a symlink');
    verifyBytes(file, await readFile(path));
  }
  return manifest;
}

async function backup(directory) {
  await mkdir(directory, { mode: 0o700 }); // Exclusive: never overwrite a previous backup.
  const db = await connect();
  const objects = storage();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const {
      rows: [{ snapshot }],
    } = await db.query('SELECT pg_export_snapshot() AS snapshot');
    const files = await fileMetadata(db);
    const tables = await tableEvidence(db);
    await postgresTool(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshot}`],
      resolve(directory, 'database.dump'),
      'dump',
    );
    for (const file of files) {
      const bytes = await objects.read(file.storageKey);
      verifyBytes(file, bytes);
      const path = objectPath(resolve(directory, 'objects'), file.storageKey);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    }
    await db.query('COMMIT');
    const manifest = validateManifest({
      format: 1,
      createdAt: new Date().toISOString(),
      dumpSha256: await checksum(resolve(directory, 'database.dump')),
      tables,
      files,
    });
    // The manifest is the completion marker. A failed/incomplete backup cannot be restored.
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`PASS backup: ${tables.length} tables, ${files.length} ready PDFs.`);
  } finally {
    await db.end();
  }
}

async function verifyDatabaseAndStorage(db, objects, manifest) {
  if (
    JSON.stringify(await tableEvidence(db)) !== JSON.stringify(manifest.tables) ||
    JSON.stringify(await fileMetadata(db)) !== JSON.stringify(manifest.files)
  )
    throw new Error('Restored database differs from backup snapshot');
  for (const file of manifest.files) verifyBytes(file, await objects.read(file.storageKey));
}

async function restore(directory) {
  const manifest = await readBundle(directory); // Verify the whole bundle before any mutation.
  const db = await connect();
  const objects = storage();
  try {
    const {
      rows: [{ count }],
    } = await db.query(`SELECT count(*)::int AS count FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','p','v','m','S','f') AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'`);
    if (count) throw new Error('Restore requires a new empty database');
    await objects.assertEmpty();
    for (const file of manifest.files)
      await objects.write(
        file,
        await readFile(objectPath(resolve(directory, 'objects'), file.storageKey)),
      );
    await postgresTool(
      'pg_restore',
      [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-privileges',
        '--dbname',
        decodeURIComponent(databaseUrl().pathname.slice(1)),
      ],
      resolve(directory, 'database.dump'),
      'restore',
    );
    await verifyDatabaseAndStorage(db, objects, manifest);
    console.log(
      `PASS restore: all ${manifest.tables.length} table fingerprints and ${manifest.files.length} PDF checksums match.`,
    );
  } finally {
    await db.end();
  }
}

async function main() {
  const [operation, destination] = process.argv.slice(2);
  if (!['backup', 'restore', 'verify'].includes(operation) || !destination)
    throw new Error('Usage: pnpm backup[:restore|:verify] /absolute/bundle/path');
  // Do not load .env implicitly: operators must select the exact database/storage.
  const directory = resolve(destination);
  if (operation === 'backup') await backup(directory);
  else if (operation === 'restore') await restore(directory);
  else {
    const manifest = await readBundle(directory);
    const db = await connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await verifyDatabaseAndStorage(db, storage(), manifest);
      await db.query('COMMIT');
      console.log('PASS restored database and object verification.');
    } finally {
      await db.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    // Keep secrets and driver errors out of operational logs.
    const safe =
      /^(Usage:|Invalid |Backup |Database dump checksum|PDF checksum|Restored database|Restore requires|No ready|Only the ProView|PostgreSQL required|pg_dump failed|pg_restore failed)/;
    console.error(
      safe.test(error.message)
        ? error.message
        : 'Backup operation failed. Check configuration and private operator diagnostics.',
    );
    process.exitCode = 1;
  });
