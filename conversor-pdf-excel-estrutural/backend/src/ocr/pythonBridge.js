import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const OCR_ROOT = resolve(PROJECT_ROOT, 'ocr');
const CLI_PATH = join(OCR_ROOT, 'cli.py');

export function runOcrAnalyzePage(options = {}) {
  const pythonExecutable = resolvePythonExecutable();
  const args = [
    '-B',
    CLI_PATH,
    'analyze-page',
    '--pdf', options.pdfPath,
    '--page', String(options.pageNumber),
    '--dpi', String(options.dpi || 300),
    '--languages', String(options.languages || 'por+eng'),
    '--min-confidence', String(options.minConfidence ?? 45),
    '--output', options.outputPath,
    '--image-output', options.imageOutputPath,
  ];

  const child = spawn(pythonExecutable, args, {
    cwd: PROJECT_ROOT,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONPATH: buildPythonPath(process.env.PYTHONPATH),
    },
  });

  let stdout = '';
  let stderr = '';
  let settled = false;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      settled = true;
      rejectPromise(error);
    });

    child.on('close', code => {
      if (settled) return;
      settled = true;

      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || stdout.trim() || `OCR falhou com codigo ${code}.`));
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout.trim()));
      } catch (error) {
        rejectPromise(new Error(`OCR retornou JSON invalido: ${stdout.trim()}`));
      }
    });
  });

  return {
    promise,
    cancel() {
      if (!child.killed) child.kill();
    },
  };
}

function resolvePythonExecutable() {
  const fromEnv = process.env.OCR_PYTHON;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const venvPython = resolve(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
  if (existsSync(venvPython)) return venvPython;

  return process.platform === 'win32' ? 'python' : 'python3';
}

function buildPythonPath(existing = '') {
  return [PROJECT_ROOT, OCR_ROOT, existing].filter(Boolean).join(process.platform === 'win32' ? ';' : ':');
}
