import { ensurePdfJsRuntime } from '../vendor/vendorLoader.js';

export async function ensurePdfJs() {
  await ensurePdfJsRuntime();
  return window.pdfjsLib;
}

export async function loadPdfDocument(file) {
  const pdfjsLib = await ensurePdfJs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function extractPageTextItems(pdf, pageNumber) {
  return extractPageTextItemsWithOptions(pdf, pageNumber, {});
}

export async function extractPageTextItemsWithOptions(pdf, pageNumber, options = {}) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
    includeMarkedContent: true,
  });

  const allItems = textContent.items
    .filter(item => item && typeof item.str === 'string' && item.str.trim())
    .map((item, index) => normalizeTextItem(item, index, pageNumber, viewport));

  const items = filterItemsByMargins(allItems, viewport, options.ignoreMargins);

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    allItems,
    items,
    textLayerDetected: allItems.length >= 3,
    ignoredMargins: normalizeMargins(options.ignoreMargins),
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

function filterItemsByMargins(items, viewport, margins) {
  const normalized = normalizeMargins(margins);
  if (!items.length) return items;

  const left = viewport.width * normalized.left;
  const right = viewport.width * (1 - normalized.right);
  const top = viewport.height * normalized.top;
  const bottom = viewport.height * (1 - normalized.bottom);

  return items.filter(item => (
    item.x >= left
    && item.right <= right
    && item.y >= top
    && item.bottom <= bottom
  ));
}

function normalizeMargins(margins = {}) {
  return {
    top: clampPercent(margins.top, 0, 0.3),
    bottom: clampPercent(margins.bottom, 0, 0.3),
    left: clampPercent(margins.left, 0, 0.2),
    right: clampPercent(margins.right, 0, 0.2),
  };
}

function clampPercent(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
