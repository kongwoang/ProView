import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const roots = [
  'apps/web/app',
  'apps/web/components',
  'apps/web/features',
  'apps/web/lib',
  'apps/web/providers',
  'apps/api/src',
];
const forbidden = /(?:https?:)?\/\/(?:api2?\.)?openreview\.net\b/i;
const failures = [];
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (
      /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) &&
      forbidden.test(await readFile(file, 'utf8'))
    )
      failures.push(file);
  }
}
for (const root of roots) await scan(root);
if (failures.length) throw new Error(`OpenReview runtime URLs found: ${failures.join(', ')}`);
console.log(
  'PASS source scan: no OpenReview production endpoints in active runtime sources. Browser network tests are still required.',
);
