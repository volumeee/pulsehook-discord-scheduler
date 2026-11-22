import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureBackendGunicorn,
  runBackendMigrations,
  waitForBackend,
} from './ensure-backend.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = resolve(projectRoot, 'frontend');

function loadRootEnv(rootDir) {
  const envPath = resolve(rootDir, '.env');
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadRootEnv(projectRoot);

const backendPort = process.env.BACKEND_PORT || '5001';
const frontendPort = process.env.PORT || '3000';
const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:${backendPort}`;

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child && !child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  const gunicornBin = await ensureBackendGunicorn(projectRoot);
  runBackendMigrations(projectRoot);

  const backend = spawn(gunicornBin, ['-c', 'gunicorn.conf.py', 'wsgi:app'], {
    cwd: resolve(projectRoot, 'backend'),
    env: { ...process.env, BACKEND_PORT: backendPort, PYTHONUNBUFFERED: '1' },
    stdio: 'inherit',
  });
  children.push(backend);
  backend.on('error', (err) => {
    console.error('[pulsehook] Failed to spawn backend process:', err.message);
    shutdown(1);
  });
  backend.on('exit', (code) => {
    if (!shuttingDown) shutdown(code || 1);
  });

  await waitForBackend(backendUrl, 20000);

  const standaloneServer = resolve(frontendDir, '.next/standalone/server.js');
  const useStandalone = existsSync(standaloneServer);
  const frontendCmd = useStandalone
    ? process.execPath
    : resolve(frontendDir, 'node_modules/.bin/next');
  const frontendArgs = useStandalone
    ? [standaloneServer]
    : ['start', '-p', frontendPort, '-H', '0.0.0.0'];

  const frontend = spawn(frontendCmd, frontendArgs, {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: frontendPort,
      HOSTNAME: '0.0.0.0',
      BACKEND_URL: backendUrl,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
  });
  children.push(frontend);
  frontend.on('error', (err) => {
    console.error('[pulsehook] Failed to spawn Next.js production server:', err.message);
    shutdown(1);
  });
  frontend.on('exit', (code) => {
    if (!shuttingDown) shutdown(code || 1);
  });
}

main().catch((err) => {
  console.error('[pulsehook] Failed to start PulseHook:', err);
  shutdown(1);
});
