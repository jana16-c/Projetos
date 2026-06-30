import { cellLooksNumeric, normalizeAscii } from './geometry.js?v=2026-06-30-livepreview-4';

export function detectHeaderSignature(matrix, rowMeta = []) {
  const limit = Math.min(3, matrix.length);
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < limit; index++) {
    const row = matrix[index] || [];
    const meta = rowMeta[index] || {};
    const score = headerScore(row, meta);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex < 0 || bestScore < 0.52) {
    return {
      headerRowIndex: -1,
      signature: [],
      confidence: bestScore,
    };
  }

  return {
    headerRowIndex: bestIndex,
    signature: normalizeHeaderRow(matrix[bestIndex]),
    confidence: bestScore,
  };
}

export function normalizeHeaderRow(row = []) {
  return row
    .map(value => normalizeAscii(value))
    .filter(Boolean);
}

function headerScore(row, meta) {
  const filled = row.map(value => String(value || '').trim()).filter(Boolean);
  if (filled.length < 2) return 0;

  const nonNumericRatio = filled.filter(value => !cellLooksNumeric(value)).length / filled.length;
  const uppercaseRatio = filled.filter(value => value.length > 1 && value === value.toUpperCase()).length / filled.length;
  const fontBoost = meta.isBold ? 0.14 : 0;
  const headerFlag = meta.isProbablyHeader ? 0.2 : 0;
  const sizeBoost = meta.maxFontSize >= 10.8 ? 0.08 : 0;

  return Math.min(1, (nonNumericRatio * 0.44) + (uppercaseRatio * 0.14) + fontBoost + headerFlag + sizeBoost + (filled.length >= 3 ? 0.1 : 0));
}

