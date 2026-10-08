import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'apps/web/public/source');
const staging = await mkdtemp(join(tmpdir(), 'proview-source-'));
const files = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Explicit source roots: never archive the checkout, runtime, credentials or backend.
async function copySource(path) {
  const source = join(root, path);
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) throw new Error(`Source symlink refused: ${path}`);
  if (stat.isDirectory()) {
    for (const entry of (await readdir(source)).sort()) await copySource(`${path}/${entry}`);
    return;
  }
  if (!stat.isFile()) throw new Error(`Non-file source refused: ${path}`);
  const destination = join(staging, path);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  files.push({ path, sha256: hash(await readFile(destination)) });
}

try {
  for (const path of [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
    'packages/config/package.json',
    'packages/config/eslint.mjs',
    'packages/config/tsconfig.json',
    'scripts/start-web.mjs',
    'scripts/source-bundle.mjs',
    'docs/frontend-source.md',
    'docs/upstream-openreview.md',
    'docs/openreview-adaptation.md',
    'docs/branding.md',
    'apps/web/package.json',
    'apps/web/LICENSE.md',
    'apps/web/NOTICE.md',
    'apps/web/tsconfig.json',
    'apps/web/eslint.config.mjs',
    'apps/web/next.config.js',
    'apps/web/app',
    'apps/web/components',
    'apps/web/features',
    'apps/web/lib',
    'apps/web/providers',
    'apps/web/tests',
    'apps/web/upstream',
    'apps/web/public/brand',
    'apps/web/public/fonts',
  ])
    await copySource(path);
  files.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(join(staging, 'SOURCE-FILES.json'), JSON.stringify(files, null, 2) + '\n');
  // Neither Git nor an operator-provided revision is needed to identify the exact source.
  execFileSync(
    'tar',
    [
      '-czf',
      join(staging, 'frontend.tar.gz'),
      ...files.map((file) => file.path),
      'SOURCE-FILES.json',
    ],
    {
      cwd: staging,
      stdio: 'pipe',
    },
  );
  const archive = await readFile(join(staging, 'frontend.tar.gz'));
  await mkdir(output, { recursive: true });
  await cp(join(root, 'apps/web/LICENSE.md'), join(output, 'LICENSE.txt'));
  await cp(join(staging, 'frontend.tar.gz'), join(output, 'frontend.tar.gz.tmp'));
  await rename(join(output, 'frontend.tar.gz.tmp'), join(output, 'frontend.tar.gz'));
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify(
      {
        format: 1,
        createdAt: new Date().toISOString(),
        sha256: hash(archive),
        bytes: archive.length,
        files,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Frontend source prepared: ${files.length} files, SHA-256 ${hash(archive)}.`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
