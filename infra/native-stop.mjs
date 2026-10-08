import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pidFile = resolve(root, '.runtime/supervisor.pid');
if (existsSync(pidFile)) {
  const pid = Number(readFileSync(pidFile, 'utf8').trim());
  if (!Number.isInteger(pid) || pid < 2) throw new Error('Invalid supervisor PID file.');
  if (existsSync(`/proc/${pid}/cmdline`)) {
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    if (
      !args.includes(resolve(root, 'infra/native-supervisor.mjs')) ||
      statSync(`/proc/${pid}`).uid !== process.getuid()
    ) {
      throw new Error('PID no longer belongs to this ProView supervisor; refusing to signal it.');
    }
    process.kill(pid, 'SIGTERM');
    console.log('Requested graceful shutdown: applications first, then PostgreSQL.');
  }
} else {
  console.log('No ProView supervisor PID file.');
}
