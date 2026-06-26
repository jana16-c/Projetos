import { parentPort, workerData } from 'node:worker_threads';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePageSpec } from '../../../assets/js/utils/pages.js';
import { extractDocumentTables } from '../../../assets/js/extraction/tableExtractor.js';
import { extractPageTextItemsFromPdf, loadPdfDocumentFromFile } from '../pdf/loadPdf.js';

let cancelled = false;

parentPort?.on('message', message => {
  if (message?.type === 'cancel') cancelled = true;
});

run().catch(error => {
  if (cancelled || error?.code === 'JOB_CANCELLED') {
    parentPort?.postMessage({
      type: 'cancelled',
      message: 'Processamento cancelado.',
    });
    return;
  }

  parentPort?.postMessage({
    type: 'failed',
    error: error?.message || 'Falha desconhecida no worker.',
  });
});

async function run() {
  postProgress('validating', 2, 'Validando arquivo PDF.');
  ensureNotCancelled();

  postProgress('loading-pdf', 8, 'Abrindo o PDF.');
  const pdf = await loadPdfDocumentFromFile(workerData.inputPdfPath);
  ensureNotCancelled();

  const selectedPages = parsePageSpec(workerData.pageSpec || '', pdf.numPages);
  const pagesData = [];
  const pageCount = selectedPages.length;
  const margins = normalizeWorkerMargins(workerData.settings);

  for (let index = 0; index < selectedPages.length; index++) {
    const pageNumber = selectedPages[index];
    const progress = 15 + Math.round((index / Math.max(1, pageCount)) * 55);
    postProgress('extracting-text', progress, `Extraindo texto da pagina ${pageNumber}.`);
    pagesData.push(await extractPageTextItemsFromPdf(pdf, pageNumber, {
      ignoreMargins: margins,
    }));
    ensureNotCancelled();
  }

  postProgress('detecting-regions', 78, 'Reconstruindo tabelas.');
  const documentResult = extractDocumentTables({
    pagesData,
    settings: workerData.settings || {},
    sourceFileName: workerData.sourceFileName,
    totalPages: pdf.numPages,
  });
  ensureNotCancelled();

  postProgress('validating-content', 92, 'Validando conservacao do conteudo.');

  const documentResultPath = join(workerData.tempDir, 'document-result.json');
  const tableIrPath = join(workerData.tempDir, 'table-ir.json');
  await writeFile(documentResultPath, JSON.stringify(documentResult, null, 2), 'utf8');
  await writeFile(tableIrPath, JSON.stringify(documentResult.tableIr, null, 2), 'utf8');

  parentPort?.postMessage({
    type: 'complete',
    progress: 100,
    stage: 'completed',
    message: 'Processamento concluido.',
    resultPath: documentResultPath,
    tableIrPath,
    selectedPages,
    totalPages: pdf.numPages,
    tables: documentResult.tables.length,
  });
}

function postProgress(stage, progress, message) {
  parentPort?.postMessage({
    type: 'progress',
    stage,
    progress,
    message,
  });
}

function ensureNotCancelled() {
  if (!cancelled) return;
  const error = new Error('Processamento cancelado.');
  error.code = 'JOB_CANCELLED';
  throw error;
}

function normalizeWorkerMargins(settings = {}) {
  return {
    top: Number(settings.ignoreTopPct || 0) / 100,
    bottom: Number(settings.ignoreBottomPct || 0) / 100,
    left: Number(settings.ignoreLeftPct || 0) / 100,
    right: Number(settings.ignoreRightPct || 0) / 100,
  };
}
