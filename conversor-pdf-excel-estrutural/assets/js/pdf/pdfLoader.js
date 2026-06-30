import { ensurePdfJsRuntime } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-3';

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
  const rotation = Number(page.rotate || 0);
  const viewport = page.getViewport({ scale: 1, rotation });
  const textContent = await page.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
    includeMarkedContent: true,
  });

  const allItems = textContent.items
    .filter(item => item && typeof item.str === 'string' && item.str.trim())
    .map((item, index) => normalizeTextItem(item, index, pageNumber, viewport));

  const items = filterItemsByMargins(allItems, viewport, options.ignoreMargins);
  const filteredOutItems = allItems.filter(item => !items.some(kept => kept.id === item.id));

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    rotation,
    allItems,
    items,
    filteredOutItems,
    textLayerDetected: allItems.length >= 3,
    ignoredMargins: normalizeMargins(options.ignoreMargins),
  };
}

function normalizeTextItem(item, index, pageNumber, viewport) {
  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const fontSize = Math.hypot(transform[2] || 0, transform[3] || 0) || Math.abs(transform[3]) || item.height || 10;
  const rawWidth = Number.isFinite(item.width) ? item.width : estimateWidth(item.str, fontSize);
  const rawHeight = Number.isFinite(item.height) && item.height > 0 ? item.height : fontSize;
  const bounds = normalizeItemBounds(transform, rawWidth, rawHeight, viewport);

  return {
    id: `${pageNumber}:${index}`,
    pageNumber,
    index,
    text: cleanPdfText(item.str),
    rawText: item.str,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    right: bounds.right,
    bottom: bounds.bottom,
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

function normalizeItemBounds(transform, rawWidth, rawHeight, viewport) {
  const origin = viewport.convertToViewportPoint(transform[4] || 0, transform[5] || 0);
  const topRight = viewport.convertToViewportPoint((transform[4] || 0) + rawWidth, transform[5] || 0);
  const bottomLeft = viewport.convertToViewportPoint(transform[4] || 0, (transform[5] || 0) + rawHeight);
  const bottomRight = viewport.convertToViewportPoint((transform[4] || 0) + rawWidth, (transform[5] || 0) + rawHeight);

  const xs = [origin[0], topRight[0], bottomLeft[0], bottomRight[0]];
  const ys = [origin[1], topRight[1], bottomLeft[1], bottomRight[1]];
  const x = Math.min(...xs);
  const right = Math.max(...xs);
  const y = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    x,
    y,
    right,
    bottom,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

export function filterItemsByMargins(items, viewport, margins) {
  const normalized = softenMargins(normalizeMargins(margins));
  if (!items.length) return items;

  const left = viewport.width * normalized.left;
  const right = viewport.width * (1 - normalized.right);
  const top = viewport.height * normalized.top;
  const bottom = viewport.height * (1 - normalized.bottom);

  return items.filter(item => {
    return (
      item.right > left
      && item.x < right
      && item.bottom > top
      && item.y < bottom
    );
  });
}

function normalizeMargins(margins = {}) {
  return {
    top: clampPercent(margins.top, 0, 0.3),
    bottom: clampPercent(margins.bottom, 0, 0.3),
    left: clampPercent(margins.left, 0, 0.2),
    right: clampPercent(margins.right, 0, 0.2),
  };
}

function softenMargins(margins = {}) {
  return {
    top: margins.top * 0.5,
    bottom: margins.bottom * 0.5,
    left: margins.left * 0.5,
    right: margins.right * 0.5,
  };
}

function clampPercent(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
