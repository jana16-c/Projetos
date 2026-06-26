export async function registerJobRoutes(app) {
  app.get('/api/health', async () => ({
    status: 'ok',
  }));

  app.post('/api/jobs', async (request, reply) => {
    const payload = await readJobPayload(request);
    const job = await app.jobManager.createJob(payload);
    reply.code(202).send(job);
  });

  app.get('/api/jobs/:jobId', async request => app.jobManager.getJob(request.params.jobId));

  app.get('/api/jobs/:jobId/table-ir', async request => app.jobManager.getTableIr(request.params.jobId));

  app.get('/api/jobs/:jobId/document-result', async request => app.jobManager.getDocumentResult(request.params.jobId));

  app.put('/api/jobs/:jobId/table-ir', async request => app.jobManager.updateTableIr(request.params.jobId, request.body));

  app.post('/api/jobs/:jobId/export', async request => app.jobManager.exportResult(request.params.jobId, {
    kind: request.body?.format === 'document-result' || request.body?.kind === 'document-result'
      ? 'document-result'
      : 'table-ir',
  }));

  app.get('/api/jobs/:jobId/result', async (request, reply) => {
    const result = await app.jobManager.readExport(request.params.jobId);
    reply
      .type(result.mimeType)
      .header('Content-Disposition', `attachment; filename="${result.fileName}"`)
      .send(result.buffer);
  });

  app.delete('/api/jobs/:jobId', async request => app.jobManager.deleteJob(request.params.jobId));
}

async function readJobPayload(request) {
  if (request.isMultipart()) {
    return readMultipartPayload(request);
  }

  const body = request.body || {};
  if (!body.pdfBase64) {
    const error = new Error('Envie um PDF em multipart ou no campo pdfBase64.');
    error.statusCode = 400;
    throw error;
  }

  return {
    pdfBuffer: Buffer.from(body.pdfBase64, 'base64'),
    fileName: body.fileName || 'documento.pdf',
    pageSpec: body.pages || body.pageSpec || '',
    settings: normalizeSettings(body.settings || body),
  };
}

async function readMultipartPayload(request) {
  let pdfBuffer = null;
  let fileName = 'documento.pdf';
  const fields = {};

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (pdfBuffer) {
        const error = new Error('Envie apenas um PDF por job.');
        error.statusCode = 400;
        throw error;
      }

      fileName = part.filename || fileName;
      pdfBuffer = await part.toBuffer();
      continue;
    }

    fields[part.fieldname] = part.value;
  }

  if (!pdfBuffer) {
    const error = new Error('Nenhum arquivo PDF foi enviado.');
    error.statusCode = 400;
    throw error;
  }

  return {
    pdfBuffer,
    fileName,
    pageSpec: fields.pages || fields.pageSpec || '',
    settings: normalizeSettings(fields),
  };
}

function normalizeSettings(source = {}) {
  return {
    mode: source.mode || 'automatic',
    sourceMode: readEnum(source.sourceMode, ['auto', 'text', 'hybrid', 'ocr'], 'auto'),
    outputMode: readEnum(source.outputMode, ['visual-replica', 'clean-table'], 'visual-replica'),
    rowTolerance: readNumber(source.rowTolerance, 0.62),
    columnTolerance: readNumber(source.columnTolerance, 9),
    gapFactor: readNumber(source.gapFactor, 2.3),
    ocrDpi: clamp(readNumber(source.ocrDpi, 300), 200, 450),
    ocrLanguages: sanitizeOcrLanguages(source.ocrLanguages, 'por+eng'),
    ocrMinConfidence: clamp(readNumber(source.ocrMinConfidence, 45), 0, 100),
    detectBorders: readBoolean(source.detectBorders, true),
    detectColors: readBoolean(source.detectColors, true),
    mergeSplitRows: readBoolean(source.mergeSplitRows, true),
    keepPageImagesInAudit: readBoolean(source.keepPageImagesInAudit, false),
    ignoreTopPct: readNumber(source.ignoreTopPct, 0),
    ignoreBottomPct: readNumber(source.ignoreBottomPct, 0),
    ignoreLeftPct: readNumber(source.ignoreLeftPct, 0),
    ignoreRightPct: readNumber(source.ignoreRightPct, 0),
    mergeContinuation: readBoolean(source.mergeContinuation, true),
    hideRepeatedLines: readBoolean(source.hideRepeatedLines, true),
    sheetMode: source.sheetMode || 'table',
  };
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'nao', 'não'].includes(String(value).trim().toLowerCase());
}

function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function sanitizeOcrLanguages(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return /^[a-z0-9_+-]+$/i.test(normalized) ? normalized : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}
