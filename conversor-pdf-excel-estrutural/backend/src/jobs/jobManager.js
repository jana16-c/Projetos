import { randomUUID } from 'node:crypto';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { ensureDirectory, removeDirectory } from './jobCleanup.js';

export class JobManager {
  constructor(options = {}) {
    this.tempRoot = options.tempRoot || buildDefaultTempRoot();
    this.workerPath = options.workerPath || fileURLToPath(new URL('./jobWorker.js', import.meta.url));
    this.jobs = new Map();
  }

  async createJob({ pdfBuffer, fileName = 'documento.pdf', pageSpec = '', settings = {} }) {
    ensurePdfSignature(pdfBuffer);
    await ensureDirectory(this.tempRoot);

    const jobId = randomUUID();
    const tempDir = join(this.tempRoot, jobId);
    await ensureDirectory(tempDir);

    const safeName = sanitizeFileName(fileName);
    const inputPdfPath = join(tempDir, safeName);
    await writeFile(inputPdfPath, pdfBuffer);

    const job = {
      jobId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: 'Job criado.',
      sourceFileName: safeName,
      pageSpec,
      settings,
      tempDir,
      inputPdfPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worker: null,
      resultPath: null,
      tableIrPath: null,
      exportPath: null,
      exportFileName: null,
      selectedPages: [],
      totalPages: 0,
      tables: 0,
      error: null,
    };

    this.jobs.set(jobId, job);
    this.startWorker(job);
    return this.serializeJob(job);
  }

  async getJob(jobId) {
    return this.serializeJob(this.requireJob(jobId));
  }

  async getTableIr(jobId) {
    const job = this.requireCompletedJob(jobId);
    return JSON.parse(await readFile(job.tableIrPath, 'utf8'));
  }

  async getDocumentResult(jobId) {
    const job = this.requireCompletedJob(jobId);
    return JSON.parse(await readFile(job.resultPath, 'utf8'));
  }

  async updateTableIr(jobId, tableIr) {
    const job = this.requireCompletedJob(jobId);
    await writeFile(job.tableIrPath, JSON.stringify(tableIr, null, 2), 'utf8');
    return this.serializeJob(job);
  }

  async exportResult(jobId, options = {}) {
    const job = this.requireCompletedJob(jobId);
    const exportKind = options.kind === 'document-result' ? 'document-result' : 'table-ir';
    const exportFileName = exportKind === 'table-ir'
      ? `${stripExtension(job.sourceFileName)}.table-ir.json`
      : `${stripExtension(job.sourceFileName)}.resultado.json`;
    const exportPath = join(job.tempDir, exportFileName);
    const sourcePath = exportKind === 'table-ir' ? job.tableIrPath : job.resultPath;

    await copyFile(sourcePath, exportPath);
    job.exportPath = exportPath;
    job.exportFileName = exportFileName;
    job.updatedAt = new Date().toISOString();

    return {
      fileName: exportFileName,
      path: exportPath,
      mimeType: 'application/json; charset=utf-8',
    };
  }

  async readExport(jobId) {
    const job = this.requireCompletedJob(jobId);
    if (!job.exportPath) {
      await this.exportResult(jobId, { kind: 'table-ir' });
    }

    await stat(job.exportPath);
    return {
      fileName: job.exportFileName,
      mimeType: 'application/json; charset=utf-8',
      buffer: await readFile(job.exportPath),
    };
  }

  async deleteJob(jobId) {
    const job = this.requireJob(jobId);

    if (job.worker) {
      try {
        job.status = 'cancelled';
        job.stage = 'cancelled';
        job.message = 'Job cancelado.';
        job.worker.postMessage({ type: 'cancel' });
        await Promise.race([
          onceExit(job.worker),
          new Promise(resolve => setTimeout(resolve, 1200)),
        ]);
        await job.worker.terminate();
      } catch {
        // cleanup continua mesmo se o worker ja tiver encerrado
      }
    }

    this.jobs.delete(jobId);
    await removeDirectory(job.tempDir);
    return { jobId, status: 'deleted' };
  }

  async close() {
    const jobIds = [...this.jobs.keys()];
    for (const jobId of jobIds) {
      await this.deleteJob(jobId);
    }
  }

  startWorker(job) {
    job.status = 'validating';
    job.stage = 'validating';
    job.progress = 1;
    job.message = 'Preparando processamento.';
    job.updatedAt = new Date().toISOString();

    const worker = new Worker(this.workerPath, {
      workerData: {
        jobId: job.jobId,
        inputPdfPath: job.inputPdfPath,
        tempDir: job.tempDir,
        pageSpec: job.pageSpec,
        settings: job.settings,
        sourceFileName: job.sourceFileName,
      },
    });

    job.worker = worker;

    worker.on('message', message => {
      job.updatedAt = new Date().toISOString();

      if (message?.type === 'progress') {
        job.status = mapStageToStatus(message.stage);
        job.stage = message.stage;
        job.progress = Number(message.progress || 0);
        job.message = message.message || job.message;
        return;
      }

      if (message?.type === 'complete') {
        job.status = 'completed';
        job.stage = 'completed';
        job.progress = 100;
        job.message = message.message || 'Processamento concluido.';
        job.resultPath = message.resultPath;
        job.tableIrPath = message.tableIrPath;
        job.selectedPages = message.selectedPages || [];
        job.totalPages = Number(message.totalPages || 0);
        job.tables = Number(message.tables || 0);
        job.worker = null;
        void worker.terminate().catch(() => {});
        return;
      }

      if (message?.type === 'cancelled') {
        job.status = 'cancelled';
        job.stage = 'cancelled';
        job.message = message.message || 'Processamento cancelado.';
        job.worker = null;
        void worker.terminate().catch(() => {});
        return;
      }

      if (message?.type === 'failed') {
        job.status = 'failed';
        job.stage = 'failed';
        job.error = message.error || 'Falha no worker.';
        job.message = job.error;
        job.worker = null;
        void worker.terminate().catch(() => {});
      }
    });

    worker.on('error', error => {
      job.status = 'failed';
      job.stage = 'failed';
      job.error = error.message;
      job.message = error.message;
      job.worker = null;
      job.updatedAt = new Date().toISOString();
    });

    worker.on('exit', code => {
      if (job.worker === worker) job.worker = null;
      if (code !== 0 && !['failed', 'completed', 'cancelled'].includes(job.status)) {
        job.status = 'failed';
        job.stage = 'failed';
        job.error = `Worker encerrado com codigo ${code}.`;
        job.message = job.error;
        job.updatedAt = new Date().toISOString();
      }
    });
  }

  requireJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      const error = new Error('Job nao encontrado.');
      error.statusCode = 404;
      throw error;
    }
    return job;
  }

  requireCompletedJob(jobId) {
    const job = this.requireJob(jobId);
    if (job.status !== 'completed') {
      const error = new Error(`Job ainda nao concluido. Status atual: ${job.status}.`);
      error.statusCode = 409;
      throw error;
    }
    return job;
  }

  serializeJob(job) {
    return {
      jobId: job.jobId,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      sourceFileName: job.sourceFileName,
      selectedPages: [...(job.selectedPages || [])],
      totalPages: job.totalPages,
      tables: job.tables,
      error: job.error,
      settings: job.settings,
    };
  }
}

function ensurePdfSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 5) {
    throw buildValidationError('Arquivo PDF invalido ou vazio.');
  }

  if (buffer.subarray(0, 5).toString('utf8') !== '%PDF-') {
    throw buildValidationError('O arquivo enviado nao possui assinatura PDF valida.');
  }
}

function buildValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sanitizeFileName(fileName) {
  const normalized = String(fileName || 'documento.pdf').trim() || 'documento.pdf';
  return normalized.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}

function stripExtension(fileName) {
  return String(fileName || 'arquivo').replace(/\.[^.]+$/i, '');
}

function onceExit(worker) {
  return new Promise(resolve => {
    worker.once('exit', () => resolve());
  });
}

function mapStageToStatus(stage) {
  return ['failed', 'completed', 'cancelled'].includes(stage) ? stage : 'processing';
}

function buildDefaultTempRoot() {
  const fromEnv = process.env.CONVERSOR_TEMP_ROOT;
  if (fromEnv) return resolve(fromEnv);
  return join(tmpdir(), 'conversor-pdf-excel-estrutural', 'jobs');
}
