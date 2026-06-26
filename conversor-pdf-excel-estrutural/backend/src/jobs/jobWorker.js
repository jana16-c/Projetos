import { parentPort, workerData } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePageSpec } from '../../../assets/js/utils/pages.js';
import { extractDocumentTables } from '../../../assets/js/extraction/tableExtractor.js';
import { extractPageTextItemsFromPdf, loadPdfDocumentFromFile } from '../pdf/loadPdf.js';
import { shouldUseOcr } from '../ocr/ocrDecision.js';
import { runOcrAnalyzePage } from '../ocr/pythonBridge.js';
import { normalizeOcrPage } from '../ocr/normalizeOcrPage.js';
import { reconcileTextItems } from '../ocr/reconcileItems.js';

let cancelled = false;
let activeOcrRun = null;

parentPort?.on('message', message => {
  if (message?.type === 'cancel') {
    cancelled = true;
    activeOcrRun?.cancel?.();
  }
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
    const pdfPageData = await extractPageTextItemsFromPdf(pdf, pageNumber, {
      ignoreMargins: margins,
    });
    ensureNotCancelled();

    const decision = shouldUseOcr(pdfPageData, workerData.settings || {});
    const pageData = {
      ...pdfPageData,
      sourceMode: decision.mode,
      ocrApplied: false,
      visualTables: [],
      visualLines: [],
      diagnostics: {
        sourceMode: decision.mode,
        reason: decision.reason,
      },
      imagePath: null,
    };

    if (decision.shouldRun) {
      postProgress('rendering-page', Math.min(85, progress + 5), `Renderizando pagina ${pageNumber}.`);
      const outputPath = join(workerData.tempDir, `page-${pageNumber}.ocr.json`);
      const imageOutputPath = join(workerData.tempDir, `page-${pageNumber}.png`);
      activeOcrRun = runOcrAnalyzePage({
        pdfPath: workerData.inputPdfPath,
        pageNumber,
        dpi: workerData.settings?.ocrDpi || 300,
        languages: workerData.settings?.ocrLanguages || 'por+eng',
        minConfidence: workerData.settings?.ocrMinConfidence ?? 45,
        outputPath,
        imageOutputPath,
      });
      postProgress('running-ocr', Math.min(88, progress + 10), `Executando OCR na pagina ${pageNumber}.`);
      const rawOcr = await activeOcrRun.promise;
      activeOcrRun = null;
      ensureNotCancelled();

      postProgress('detecting-grid', Math.min(91, progress + 14), `Detectando grade visual na pagina ${pageNumber}.`);
      const ocrPage = normalizeOcrPage(await readJsonResult(rawOcr.output), {
        pageNumber,
        dpi: workerData.settings?.ocrDpi || 300,
        languages: workerData.settings?.ocrLanguages || 'por+eng',
      });
      const reconciled = reconcileTextItems({
        pdfItems: decision.mode === 'ocr' ? [] : pdfPageData.items,
        ocrItems: ocrPage.ocrWords,
        minOcrConfidence: workerData.settings?.ocrMinConfidence ?? 45,
      });
      postProgress('reconciling', Math.min(94, progress + 17), `Consolidando texto da pagina ${pageNumber}.`);

      pageData.items = reconciled.items;
      pageData.allItems = reconciled.items;
      pageData.textLayerDetected = pdfPageData.textLayerDetected || reconciled.items.length >= 3;
      pageData.ocrApplied = true;
      pageData.visualTables = ocrPage.visualTables;
      pageData.visualLines = [...ocrPage.horizontalLines, ...ocrPage.verticalLines];
      pageData.diagnostics = {
        ...pageData.diagnostics,
        ...reconciled.diagnostics,
        ocrWarnings: ocrPage.warnings,
      };
      pageData.imagePath = workerData.settings?.keepPageImagesInAudit ? (rawOcr.image || imageOutputPath) : null;
    }

    pagesData.push(pageData);
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

async function readJsonResult(resultPath) {
  const json = await readFile(resultPath, 'utf8');
  return JSON.parse(json);
}

function normalizeWorkerMargins(settings = {}) {
  return {
    top: Number(settings.ignoreTopPct || 0) / 100,
    bottom: Number(settings.ignoreBottomPct || 0) / 100,
    left: Number(settings.ignoreLeftPct || 0) / 100,
    right: Number(settings.ignoreRightPct || 0) / 100,
  };
}
