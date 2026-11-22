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

  console.log(`[pulsehook] Starting Flask + Gunicorn backend on 127.0.0.1:${backendPort}...`);
  const backend = spawn(gunicornBin, ['-c', 'gunicorn.conf.py', 'wsgi:app'], {
    cwd: resolve(projectRoot, 'backend'),
    env: { ...process.env, BACKEND_PORT: backendPort, PYTHONUNBUFFERED: '1' },
    stdio: 'inherit',
  });
  children.push(backend);
  backend.on('error', (err) => {
    console.error('[pulsehook] Backend spawn error:', err.message);
    shutdown(1);
  });
  backend.on('exit', (code) => {
    if (!shuttingDown) shutdown(code || 1);
  });

  const healthy = await waitForBackend(backendUrl);
  console.log(
    healthy
      ? `[pulsehook] Backend healthy at ${backendUrl}/api/health`
      : '[pulsehook] Backend health check timed out; starting Next.js anyway.'
  );

  console.log(`[pulsehook] Starting Next.js dev server on 0.0.0.0:${frontendPort}...`);
  const nextBin = resolve(frontendDir, 'node_modules/.bin/next');
  const frontend = spawn(nextBin, ['dev', '-p', frontendPort, '-H', '0.0.0.0'], {
    cwd: frontendDir,
    env: { ...process.env, PORT: frontendPort, BACKEND_URL: backendUrl, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'inherit',
  });
  children.push(frontend);
  frontend.on('error', (err) => {
    console.error('[pulsehook] Frontend spawn error:', err.message);
    shutdown(1);
  });
  frontend.on('exit', (code) => {
    if (!shuttingDown) shutdown(code || 1);
  });
}

main().catch((err) => {
  console.error('[pulsehook] Failed to start dev environment:', err);
  shutdown(1);
});
