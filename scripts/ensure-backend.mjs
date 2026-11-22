import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
function runSync(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    ...options,
  });
  return result.status === 0 && !result.error;
}

function findPythonBinary() {
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0 && !probe.error) {
      return candidate;
    }
  }
  return null;
}


export async function ensureBackendGunicorn(projectRoot = process.cwd()) {
  const backendDir = resolve(projectRoot, 'backend');
  const venvDir = resolve(backendDir, '.venv');
  const venvPip = resolve(venvDir, 'bin/pip');
  const venvGunicorn = resolve(venvDir, 'bin/gunicorn');
  const requirementsFile = resolve(backendDir, 'requirements.txt');

  if (existsSync(venvGunicorn)) {
    return venvGunicorn;
  }

  // Fallback check: system gunicorn available and able to import Flask + SQLAlchemy
  const globalProbe = spawnSync('gunicorn', ['--version'], { stdio: 'ignore' });
  if (globalProbe.status === 0 && !globalProbe.error) {
    const importProbe = spawnSync(
      'python3',
      ['-c', 'import flask, sqlalchemy, psycopg, apscheduler, pydantic, requests'],
      { stdio: 'ignore' }
    );
    if (importProbe.status === 0 && !importProbe.error) {
      return 'gunicorn';
    }
  }

  const pythonBin = findPythonBinary();
  if (!pythonBin) {
    throw new Error(
      'Python 3 was not found in PATH. Cannot start the PulseHook Flask backend.'
    );
  }

  console.log('[pulsehook] Bootstrapping Python virtual environment in backend/.venv...');

  if (!existsSync(venvPip)) {
    const stdOk = runSync(pythonBin, ['-m', 'venv', venvDir]);
    if (!stdOk || !existsSync(venvPip)) {
      if (existsSync(venvDir)) {
        rmSync(venvDir, { recursive: true, force: true });
      }
      throw new Error(
        'Failed to create Python virtual environment with pip (python3 -m venv). Install python3-venv and retry.'
      );
    }
  }

  console.log('[pulsehook] Installing Python backend dependencies from backend/requirements.txt...');
  const installOk = runSync(venvPip, [
    'install',
    '--disable-pip-version-check',
    '--no-input',
    '-r',
    requirementsFile,
  ]);
  if (!installOk || !existsSync(venvGunicorn)) {
    throw new Error('Failed to install Python dependencies into backend/.venv.');
  }

  console.log('[pulsehook] Python backend virtual environment is ready.');
  return venvGunicorn;
}

export function runBackendMigrations(projectRoot = process.cwd()) {
  const backendDir = resolve(projectRoot, 'backend');
  const venvAlembic = resolve(backendDir, '.venv/bin/alembic');
  const alembicBin = existsSync(venvAlembic) ? venvAlembic : 'alembic';
  console.log('[pulsehook] Running Alembic database migrations...');
  const ok = runSync(alembicBin, ['upgrade', 'head'], { cwd: backendDir });
  if (!ok) {
    throw new Error('Failed to apply Alembic migrations (alembic upgrade head).');
  }
}

export async function waitForBackend(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // Backend still starting up
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  ensureBackendGunicorn().catch((err) => {
    console.error('[pulsehook] Backend bootstrap failed:', err.message || err);
    process.exit(1);
  });
}
