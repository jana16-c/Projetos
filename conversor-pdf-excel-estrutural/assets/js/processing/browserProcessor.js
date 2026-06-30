import { extractDocumentTables } from '../extraction/tableExtractor.js?v=2026-06-30-livepreview-6';
import { attachRuntimePageArtifacts, hydrateDocumentResult } from '../model/resultModel.js?v=2026-06-30-livepreview-6';
import { createOcrWorkerPool } from '../ocr/ocrWorkerPool.js?v=2026-06-30-livepreview-6';
import { extractPageTextItemsWithOptions } from '../pdf/pdfLoader.js?v=2026-06-30-livepreview-6';
import { renderPdfPageToPng } from '../pdf/pageRenderer.js?v=2026-06-30-livepreview-6';
import { scoreTextLayerQuality } from '../pdf/textLayerQuality.js?v=2026-06-30-livepreview-6';

const OCR_TEXT_MIN_ITEMS = 3;
let workerSequence = 0;

export async function processDocumentInBrowser({
  pdf,
  file,
  settings,
  pages,
  onProgress = () => {},
}) {
  const pagesData = [];
  const ocrPool = await createOcrWorkerPool({
    languages: settings.ocrLanguages || 'por+eng',
  });

  try {
    for (let index = 0; index < pages.length; index++) {
      const pageNumber = pages[index];
      const page = await pdf.getPage(pageNumber);
      const pageProgressBase = Math.round((index / Math.max(1, pages.length)) * 90);

      onProgress({
        stage: 'extracting-text',
        pageNumber,
        progress: pageProgressBase,
        message: `Lendo pagina ${index + 1}/${pages.length}...`,
      });

      const extracted = await extractPageTextItemsWithOptions(pdf, pageNumber, {
        ignoreMargins: {
          top: settings.ignoreTopPct / 100,
          bottom: settings.ignoreBottomPct / 100,
          left: settings.ignoreLeftPct / 100,
          right: settings.ignoreRightPct / 100,
        },
      });

      const textQuality = scoreTextLayerQuality(extracted);
      const pagePlan = planPageProcessing({ settings, extracted, textQuality });
      let renderedPage = null;

      if (pagePlan.shouldRenderPage) {
        onProgress({
          stage: 'rendering-page',
          pageNumber,
          progress: Math.min(95, pageProgressBase + 5),
          message: `Renderizando pagina ${index + 1}/${pages.length}...`,
        });
        renderedPage = await renderPdfPageToPng(page, { dpi: settings.ocrDpi });
      }

      const sourceResult = await resolvePageSource({
        pageNumber,
        renderedPage,
        extracted,
        textQuality,
        pagePlan,
        settings,
        onProgress,
        ocrPool,
      });

      pagesData.push({
        pageNumber,
        width: extracted.width,
        height: extracted.height,
        rotation: extracted.rotation,
        items: sourceResult.items,
        allItems: sourceResult.allItems,
        filteredOutItems: extracted.filteredOutItems || [],
        textLayerDetected: extracted.textLayerDetected,
        ocrApplied: sourceResult.ocrApplied,
        visualRequired: pagePlan.keepRenderedPage,
        diagnostics: {
          sourceMode: sourceResult.sourceMode,
          reason: sourceResult.reason,
          ocrWarnings: sourceResult.ocrWarnings,
          textQuality,
          renderSkipped: !pagePlan.shouldRenderPage,
          autoDecision: pagePlan.autoDecision,
        },
        renderedPage: pagePlan.keepRenderedPage ? renderedPage : null,
      });
    }
  } finally {
    await ocrPool.close();
  }

  onProgress({
    stage: 'validating-content',
    progress: 96,
    message: 'Consolidando tabelas...',
  });

  const rawDocumentResult = await processWithWorkerFallback({
    pagesData: serializePagesForWorker(pagesData),
    settings,
    sourceFileName: file.name,
    totalPages: pdf.numPages,
  });

  const documentResult = hydrateDocumentResult(rawDocumentResult);
  attachRuntimePageArtifacts(documentResult, pagesData);

  onProgress({
    stage: 'completed',
    progress: 100,
    message: 'Convertido.',
  });

  return documentResult;
}

export function planPageProcessing({ settings = {}, extracted = {}, textQuality = null } = {}) {
  const requestedMode = String(settings.sourceMode || 'auto').toLowerCase();
  const quality = textQuality || scoreTextLayerQuality(extracted);
  const textSufficient = (extracted.allItems || extracted.items || []).length >= OCR_TEXT_MIN_ITEMS;
  let effectiveSourceMode = requestedMode;
  let autoDecision = 'manual';

  if (requestedMode === 'auto') {
    if (quality.classification === 'good' && textSufficient) {
      effectiveSourceMode = 'text';
      autoDecision = 'good-text';
    } else if (quality.classification === 'suspect') {
      effectiveSourceMode = 'hybrid';
      autoDecision = 'suspect-hybrid';
    } else {
      effectiveSourceMode = 'ocr';
      autoDecision = textSufficient ? 'bad-ocr' : 'fallback-min-items-ocr';
    }
  }

  const visualRequested = String(settings.outputMode || 'clean-table') === 'visual-replica' || Boolean(settings.keepPageImagesInAudit);
  const shouldRunOcr = effectiveSourceMode === 'ocr' || effectiveSourceMode === 'hybrid';
  const shouldRenderPage = visualRequested || shouldRunOcr;

  return {
    requestedMode,
    effectiveSourceMode,
    shouldRunOcr,
    shouldRenderPage,
    keepRenderedPage: visualRequested,
    visualRequested,
    autoDecision,
    textQuality: quality,
  };
}

export function mergeOcrAndPdfItems({ pdfItems = [], ocrItems = [] } = {}) {
  const merged = [...pdfItems.map(item => ({ ...item, sourceType: 'pdf-text' }))];
  const occupied = merged.map(item => buildItemSignature(item));

  for (const item of ocrItems) {
    const signature = buildItemSignature(item);
    if (occupied.some(entry => entry.pageNumber === signature.pageNumber && overlapRatio(entry, signature) >= 0.72)) {
      continue;
    }

    occupied.push(signature);
    merged.push({
      ...item,
      sourceType: 'ocr',
    });
  }

  return merged.sort((left, right) => (left.pageNumber - right.pageNumber) || (left.y - right.y) || (left.x - right.x));
}

async function resolvePageSource({
  pageNumber,
  renderedPage,
  extracted,
  textQuality,
  pagePlan,
  settings,
  onProgress,
  ocrPool,
}) {
  const pdfItems = extracted.items || [];
  const allPdfItems = extracted.allItems || pdfItems;
  const ocrWarnings = [];
  let ocrItems = [];
  let ocrApplied = false;

  if (pagePlan.shouldRunOcr) {
    onProgress({
      stage: 'running-ocr',
      pageNumber,
      progress: null,
      message: `Avaliando OCR na pagina ${pageNumber}...`,
    });

    const ocrResult = await tryRunOcr({
      pageNumber,
      renderedPage,
      settings,
      ocrPool,
    });
    ocrItems = ocrResult.items;
    ocrApplied = ocrResult.applied;
    ocrWarnings.push(...ocrResult.warnings);
  }

  if (pagePlan.effectiveSourceMode === 'ocr') {
    if (ocrItems.length) {
      return {
        items: ocrItems,
        allItems: ocrItems,
        ocrApplied,
        ocrWarnings,
        sourceMode: 'ocr',
        reason: pagePlan.requestedMode === 'auto' ? pagePlan.autoDecision : 'ocr',
      };
    }

    ocrWarnings.push('OCR solicitado, mas nenhum texto foi extraido. Mantido texto do PDF como fallback.');
    return {
      items: pdfItems,
      allItems: allPdfItems,
      ocrApplied,
      ocrWarnings,
      sourceMode: 'text',
      reason: pagePlan.requestedMode === 'auto' ? `${pagePlan.autoDecision}-fallback-texto` : 'ocr-fallback-texto',
    };
  }

  if (pagePlan.effectiveSourceMode === 'hybrid') {
    const hybridItems = mergeOcrAndPdfItems({ pdfItems, ocrItems });
    return {
      items: hybridItems.length ? hybridItems : pdfItems,
      allItems: hybridItems.length ? mergeOcrAndPdfItems({ pdfItems: allPdfItems, ocrItems }) : allPdfItems,
      ocrApplied,
      ocrWarnings,
      sourceMode: hybridItems.length ? 'hybrid' : 'text',
      reason: hybridItems.length ? (ocrApplied ? 'texto+ocr' : 'texto-sem-ocr') : 'hybrid-fallback-texto',
    };
  }

  if (pagePlan.requestedMode === 'auto' && textQuality.classification !== 'good') {
    ocrWarnings.push('Texto do PDF mantido por fallback apos decisao automatica sem OCR util.');
  }

  return {
    items: pdfItems,
    allItems: allPdfItems,
    ocrApplied,
    ocrWarnings,
    sourceMode: 'text',
    reason: pagePlan.requestedMode === 'auto' ? pagePlan.autoDecision : 'texto-pdf',
  };
}

async function tryRunOcr({ pageNumber, renderedPage, settings, ocrPool }) {
  if (!renderedPage?.dataUrl) {
    return {
      applied: false,
      items: [],
      warnings: ['OCR nao foi executado porque a imagem da pagina nao foi gerada.'],
    };
  }

  const result = await ocrPool.recognize(renderedPage.dataUrl);
  const warnings = [...(result.warnings || [])];
  if (!result.ok || !result.data) {
    return {
      applied: false,
      items: [],
      warnings,
    };
  }

  const words = result.data?.data?.words || [];
  const minConfidence = Number(settings.ocrMinConfidence || 0);
  const scale = Number(renderedPage.dpi || 300) / 72;
  const items = words
    .filter(word => String(word?.text || '').trim())
    .filter(word => Number(word?.confidence || 0) >= minConfidence)
    .map((word, index) => normalizeOcrWord(word, index, pageNumber, scale));

  return {
    applied: items.length > 0,
    items,
    warnings: items.length ? warnings : [...warnings, 'OCR executado sem texto confiavel suficiente.'],
  };
}

function normalizeOcrWord(word, index, pageNumber, scale) {
  const left = Number(word?.bbox?.x0 || 0) / scale;
  const top = Number(word?.bbox?.y0 || 0) / scale;
  const right = Number(word?.bbox?.x1 || left) / scale;
  const bottom = Number(word?.bbox?.y1 || top) / scale;

  return {
    id: `ocr:${pageNumber}:${index}`,
    pageNumber,
    index,
    text: String(word?.text || '').replace(/\s+/g, ' ').trim(),
    rawText: String(word?.text || '').trim(),
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    right,
    bottom,
    fontName: 'OCR',
    fontSize: Math.max(8, (bottom - top) * 0.8),
    dir: 'ltr',
    hasEOL: false,
    ocrConfidence: Number(word?.confidence || 0),
  };
}

async function processWithWorkerFallback(payload) {
  if (typeof Worker === 'undefined') {
    return extractDocumentTables(payload);
  }

  try {
    return await runWorker(payload);
  } catch (error) {
    console.warn('Worker local indisponivel. Usando fallback no thread principal.', error);
    return extractDocumentTables(payload);
  }
}

function runWorker(payload) {
  return new Promise((resolve, reject) => {
    const requestId = `req-${Date.now()}-${++workerSequence}`;
    const worker = new Worker(new URL('./processingWorker.js', import.meta.url), { type: 'module' });

    worker.addEventListener('message', event => {
      const message = event.data || {};
      if (message.requestId !== requestId) return;
      worker.terminate();

      if (message.ok) {
        resolve(message.documentResult);
        return;
      }

      reject(new Error(message.error?.message || 'Falha no worker local.'));
    }, { once: true });

    worker.addEventListener('error', event => {
      worker.terminate();
      reject(event.error || new Error('Falha no worker local.'));
    }, { once: true });

    worker.postMessage({ requestId, payload });
  });
}

function serializePagesForWorker(pagesData) {
  return pagesData.map(page => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    rotation: page.rotation,
    items: page.items,
    allItems: page.allItems,
    filteredOutItems: page.filteredOutItems,
    textLayerDetected: page.textLayerDetected,
    ocrApplied: page.ocrApplied,
    diagnostics: page.diagnostics,
    visualRequired: page.visualRequired,
  }));
}

function buildItemSignature(item) {
  return {
    pageNumber: Number(item?.pageNumber || 0),
    left: Number(item?.x || 0),
    top: Number(item?.y || 0),
    right: Number(item?.right || (Number(item?.x || 0) + Number(item?.width || 0))),
    bottom: Number(item?.bottom || (Number(item?.y || 0) + Number(item?.height || 0))),
  };
}

function overlapRatio(left, right) {
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  const overlap = width * height;
  if (!overlap) return 0;

  const leftArea = Math.max(1, (left.right - left.left) * (left.bottom - left.top));
  const rightArea = Math.max(1, (right.right - right.left) * (right.bottom - right.top));
  return overlap / Math.min(leftArea, rightArea);
}
