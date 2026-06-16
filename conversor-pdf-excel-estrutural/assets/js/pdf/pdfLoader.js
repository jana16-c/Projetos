import { PDFJS_WORKER } from '../config/settings.js';

export async function ensurePdfJs() {
  if (!window.pdfjsLib) {
    throw new Error('pdf.js não foi carregado. Adicione os arquivos da biblioteca na pasta assets/js/vendor.');
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return window.pdfjsLib;
}

export async function loadPdfDocument(file) {
  const pdfjsLib = await ensurePdfJs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function extractPageTextItems(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
    includeMarkedContent: true,
  });

  const items = textContent.items
    .filter(item => item && typeof item.str === 'string' && item.str.trim())
    .map((item, index) => normalizeTextItem(item, index, pageNumber, viewport));

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    items,
  };
}

function normalizeTextItem(item, index, pageNumber, viewport) {
  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const x = transform[4] || 0;
  const baselineY = transform[5] || 0;
  const y = viewport.height - baselineY;
  const fontSize = Math.hypot(transform[2] || 0, transform[3] || 0) || Math.abs(transform[3]) || item.height || 10;
  const width = Number.isFinite(item.width) ? item.width : estimateWidth(item.str, fontSize);
  const height = Number.isFinite(item.height) && item.height > 0 ? item.height : fontSize;

  return {
    id: `${pageNumber}:${index}`,
    pageNumber,
    index,
    text: cleanPdfText(item.str),
    rawText: item.str,
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    fontName: item.fontName || '',
    fontSize,
    dir: item.dir || 'ltr',
    hasEOL: Boolean(item.hasEOL),
  };
}

function cleanPdfText(text) {
  return String(text)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateWidth(text, fontSize) {
  return String(text || '').length * fontSize * 0.48;
}
