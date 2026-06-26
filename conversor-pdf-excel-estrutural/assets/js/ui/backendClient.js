import { hydrateDocumentResult } from '../model/resultModel.js';

const POLL_INTERVAL_MS = 350;
const DEFAULT_BACKEND_ORIGIN = 'http://127.0.0.1:8787';

export async function processPdfWithBackend({ file, settings, onProgress } = {}) {
  if (!file) {
    throw new Error('Nenhum PDF foi informado para o backend.');
  }

  const backendBaseUrl = await resolveBackendBaseUrl();
  if (!backendBaseUrl) {
    const unavailable = new Error('Backend indisponivel.');
    unavailable.code = 'BACKEND_UNAVAILABLE';
    throw unavailable;
  }

  const formData = buildJobFormData(file, settings);
  let jobId = null;

  try {
    const createResponse = await fetch(buildApiUrl(backendBaseUrl, '/api/jobs'), {
      method: 'POST',
      body: formData,
    });
    await ensureJsonResponse(createResponse);
    const createdJob = await createResponse.json();
    jobId = createdJob.jobId;
    notifyProgress(onProgress, createdJob);

    const job = await pollJob(backendBaseUrl, jobId, onProgress);
    const documentResult = await readDocumentResult(backendBaseUrl, jobId);

    return {
      job,
      documentResult: hydrateDocumentResult(documentResult),
      backendUsed: true,
    };
  } catch (error) {
    if (isBackendUnavailable(error)) {
      const unavailable = new Error('Backend indisponivel.');
      unavailable.code = 'BACKEND_UNAVAILABLE';
      throw unavailable;
    }
    throw error;
  } finally {
    if (jobId) void cleanupJob(backendBaseUrl, jobId);
  }
}

export async function resolveBackendBaseUrl() {
  const candidates = buildBackendCandidates();

  for (const candidate of candidates) {
    if (await canReachBackend(candidate)) return candidate;
  }

  return '';
}

async function pollJob(backendBaseUrl, jobId, onProgress) {
  for (;;) {
    const response = await fetch(buildApiUrl(backendBaseUrl, `/api/jobs/${encodeURIComponent(jobId)}`), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    await ensureJsonResponse(response);
    const job = await response.json();
    notifyProgress(onProgress, job);

    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error || job.message || 'Falha no processamento.');
    if (job.status === 'cancelled') throw new Error(job.message || 'Processamento cancelado.');

    await delay(POLL_INTERVAL_MS);
  }
}

async function readDocumentResult(backendBaseUrl, jobId) {
  const response = await fetch(buildApiUrl(backendBaseUrl, `/api/jobs/${encodeURIComponent(jobId)}/document-result`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  await ensureJsonResponse(response);
  return response.json();
}

async function cleanupJob(backendBaseUrl, jobId) {
  try {
    await fetch(buildApiUrl(backendBaseUrl, `/api/jobs/${encodeURIComponent(jobId)}`), {
      method: 'DELETE',
    });
  } catch {
    // limpeza oportunistica
  }
}

function buildJobFormData(file, settings = {}) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('pageSpec', settings.pageSpec || '');

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'pageSpec' || value === undefined || value === null) continue;
    formData.append(key, String(value));
  }

  return formData;
}

function buildBackendCandidates() {
  const candidates = [];
  const sameOrigin = window.location.origin;
  const samePort = String(window.location.port || '') === '8787';

  if (sameOrigin && /^https?:/i.test(sameOrigin) && samePort) {
    candidates.push(sameOrigin);
  }

  if (!candidates.includes(DEFAULT_BACKEND_ORIGIN)) {
    candidates.push(DEFAULT_BACKEND_ORIGIN);
  }

  return candidates;
}

async function canReachBackend(baseUrl) {
  if (!baseUrl) return false;

  try {
    const response = await fetch(buildApiUrl(baseUrl, '/api/health'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.status === 'ok';
  } catch {
    return false;
  }
}

function buildApiUrl(baseUrl, path) {
  return new URL(path, `${String(baseUrl).replace(/\/+$/, '')}/`).href;
}

async function ensureJsonResponse(response) {
  if (response.ok) return;

  let message = `Falha HTTP ${response.status}.`;
  try {
    const data = await response.clone().json();
    if (data?.error) message = data.error;
  } catch {
    try {
      const text = await response.text();
      if (text) message = text;
    } catch {
      // ignora leitura secundaria
    }
  }

  const error = new Error(message);
  error.status = response.status;
  throw error;
}

function notifyProgress(onProgress, job) {
  if (typeof onProgress !== 'function') return;
  onProgress({
    status: job.status || '',
    stage: job.stage || '',
    progress: Number(job.progress || 0),
    message: job.message || '',
  });
}

function isBackendUnavailable(error) {
  return error?.code === 'BACKEND_UNAVAILABLE'
    || error?.status === 404
    || error?.status === 405
    || error?.name === 'TypeError';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
