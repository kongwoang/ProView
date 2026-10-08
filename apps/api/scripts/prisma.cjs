const { config } = require('dotenv');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
config({ path: [resolve(__dirname, '../.env'), resolve(__dirname, '../../../.env')], quiet: true });
const result = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);
if (result.error) {
  console.error('Unable to start Prisma CLI');
  process.exitCode = 1;
} else process.exitCode = result.status ?? 1;
