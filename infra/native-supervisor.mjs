import { spawn } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  fstatSync,
  ftruncateSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = process.env;
if (!env.DATABASE_URL || env.APP_ENV !== 'production' || env.BIND_ADDRESS !== '127.0.0.1') {
  throw new Error('Load the protected production environment with loopback binding first.');
}
const pidFile = resolve(root, '.runtime/supervisor.pid');
writeFileSync(pidFile, `${process.pid}\n`, { mode: 0o600 });
let stopping = false;
const services = [
  {
    name: 'postgres',
    executable: resolve(root, '.tools/postgres/bin/postgres'),
    args: ['-D', resolve(root, '.runtime/postgres')],
    signal: 'SIGINT',
  },
  {
    name: 'api',
    executable: process.execPath,
    args: ['dist/main.js'],
    cwd: resolve(root, 'apps/api'),
  },
  {
    name: 'web',
    executable: process.execPath,
    args: ['server.js'],
    cwd: resolve(root, 'apps/web/.next/standalone/apps/web'),
    extraEnv: { PORT: '33000', HOSTNAME: '127.0.0.1' },
  },
  {
    name: 'proxy',
    executable: resolve(root, '.tools/caddy'),
    args: ['run', '--config', resolve(root, 'infra/native.Caddyfile'), '--adapter', 'caddyfile'],
  },
];
if (existsSync(resolve(root, '.runtime/cloudflared.yml'))) {
  services.push({
    name: 'tunnel',
    executable: resolve(root, '.tools/cloudflared'),
    args: [
      '--no-autoupdate',
      'tunnel',
      '--config',
      resolve(root, '.runtime/cloudflared.yml'),
      'run',
    ],
  });
}
for (const service of services) {
  service.log = resolve(root, `.runtime/logs/${service.name}.log`);
  service.fd = openSync(service.log, 'a', 0o600);
}
function launch(service) {
  if (stopping) return;
  service.started = Date.now();
  const child = spawn(service.executable, service.args, {
    cwd: service.cwd ?? root,
    env: { ...env, ...service.extraEnv },
    stdio: ['ignore', service.fd, service.fd],
  });
  service.child = child;
  console.log(`${new Date().toISOString()} started ${service.name} PID=${child.pid}`);
  child.on('error', () => console.error(`${service.name} failed to start; inspect its log.`));
  child.on('close', (code, signal) => {
    service.child = null;
    if (stopping) return;
    service.failures = Date.now() - service.started > 60_000 ? 0 : (service.failures ?? 0) + 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(service.failures, 5));
    console.log(`${service.name} exited (${code ?? signal}); restarting in ${delay}ms`);
    service.timer = setTimeout(() => launch(service), delay);
  });
}
// The API retries on initial database startup; migrations happen before this supervisor.
for (const service of services) launch(service);
const rotation = setInterval(() => {
  for (const service of services) {
    if (fstatSync(service.fd).size > 10 * 1024 * 1024) {
      copyFileSync(service.log, `${service.log}.1`);
      ftruncateSync(service.fd, 0);
    }
  }
}, 30_000);

async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(rotation);
  // Shut down applications before PostgreSQL; never signal another user's processes.
  for (const service of [...services].reverse()) {
    clearTimeout(service.timer);
    const child = service.child;
    if (!child) continue;
    await new Promise((done) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 20_000);
      child.once('exit', () => {
        clearTimeout(timeout);
        done();
      });
      child.kill(service.signal ?? 'SIGTERM');
    });
  }
  for (const service of services) closeSync(service.fd);
  unlinkSync(pidFile);
  process.exitCode = 0;
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
