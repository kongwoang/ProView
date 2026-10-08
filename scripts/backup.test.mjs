import assert from 'node:assert/strict';
import { test } from 'node:test';
import { objectPath, validateManifest } from './backup.mjs';

const manifest = () => ({
  format: 1,
  dumpSha256: 'a'.repeat(64),
  tables: [
    { name: '_prisma_migrations', count: 2, digest: 'b'.repeat(32) },
    { name: 'SubmissionVersion', count: 1, digest: 'c'.repeat(32) },
  ],
  files: [
    {
      table: 'SubmissionFile',
      id: 'file',
      parentId: 'version',
      storageKey: 'submissions/123.pdf',
      sizeBytes: 12,
      sha256: 'd'.repeat(64),
    },
  ],
});

test('backup objects cannot escape their directory or alias another key', () => {
  assert.equal(objectPath('/safe', 'submissions/123.pdf'), '/safe/submissions/123.pdf');
  for (const key of [
    '../private.pdf',
    '/secret.pdf',
    'submissions//123.pdf',
    'a/../b.pdf',
    'a\\b.pdf',
  ])
    assert.throws(() => objectPath('/safe', key));
});
test('backup manifests reject missing integrity data and duplicate objects/tables', () => {
  assert.equal(validateManifest(manifest()).files.length, 1);
  const duplicateFile = manifest();
  duplicateFile.files.push({ ...duplicateFile.files[0], id: 'another' });
  assert.throws(() => validateManifest(duplicateFile));
  const duplicateTable = manifest();
  duplicateTable.tables.push(duplicateTable.tables[0]);
  assert.throws(() => validateManifest(duplicateTable));
  for (const override of [
    { dumpSha256: 'invalid' },
    { tables: [] },
    { format: 2 },
    { files: [{ ...manifest().files[0], sizeBytes: -1 }] },
  ])
    assert.throws(() => validateManifest({ ...manifest(), ...override }));
  assert.equal(validateManifest({ ...manifest(), files: [] }).files.length, 0);
});
