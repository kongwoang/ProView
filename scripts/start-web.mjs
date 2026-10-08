import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const standalone = resolve(root, 'apps/web/.next/standalone/apps/web');
await mkdir(resolve(standalone, '.next'), { recursive: true });
await cp(resolve(root, 'apps/web/.next/static'), resolve(standalone, '.next/static'), {
  recursive: true,
});
await cp(resolve(root, 'apps/web/public'), resolve(standalone, 'public'), { recursive: true });
const web = spawn(process.execPath, [resolve(standalone, 'server.js')], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0', NEXT_TELEMETRY_DISABLED: '1' },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => web.kill(signal));
web.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
