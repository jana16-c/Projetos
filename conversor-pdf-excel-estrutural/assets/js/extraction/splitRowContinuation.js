import { cellLooksNumeric } from './geometry.js';

const MIN_CONFIDENCE = 0.78;
const TERMINAL_ROW_RE = /\b(total|subtotal|total geral|fim|encerramento)\b/i;

export function mergeSplitBoundaryRow(previous, current, options = {}) {
  const previousSourceMatrix = cloneMatrix(previous?.sourceMatrix || previous?.matrix || []);
  const previousSourceCells = cloneCellGrid(previous?.sourceCells || previous?.cells || []);
  const previousSourceRowMeta = cloneRowMetaList(previous?.sourceRowMeta || previous?.rowMeta || []);
  const currentSourceMatrix = cloneMatrix(current?.sourceMatrix || current?.matrix || []);
  const currentSourceCells = cloneCellGrid(current?.sourceCells || current?.cells || []);
  const currentSourceRowMeta = cloneRowMetaList(current?.sourceRowMeta || current?.rowMeta || []);
  const previousMatrix = cloneMatrix(previous?.displayMatrix || previous?.matrix || []);
  const previousCells = cloneCellGrid(previous?.displayCells || previous?.cells || []);
  const previousRowMeta = cloneRowMetaList(previous?.displayRowMeta || previous?.rowMeta || []);
  const currentMatrix = cloneMatrix(current?.displayMatrix || current?.matrix || []);
  const currentCells = cloneCellGrid(current?.displayCells || current?.cells || []);
  const currentRowMeta = cloneRowMetaList(current?.displayRowMeta || current?.rowMeta || []);

  if (!previousMatrix.length || !currentMatrix.length) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, 0, null);
  }

  const previousRowIndex = previousMatrix.length - 1;
  const currentRowIndex = resolveCurrentBoundaryRowIndex(current, currentRowMeta);

  if (currentRowIndex < 0) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, 0, null);
  }

  if (!isNearBottom(previous) || !isNearTop(current)) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, 0, 'Borda entre paginas sem proximidade suficiente.');
  }

  if (isHeaderLike(previous, previousRowIndex, previousRowMeta) || isHeaderLike(current, currentRowIndex, currentRowMeta)) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, 0, 'Linha candidata parece cabecalho.');
  }

  if (isTerminalRow(previousMatrix[previousRowIndex]) || isTerminalRow(currentMatrix[currentRowIndex])) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, 0, 'Linha terminal nao deve ser unida.');
  }

  const signals = gatherSignals(
    previousMatrix[previousRowIndex],
    currentMatrix[currentRowIndex],
    options,
  );

  if (signals.conflict) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, signals.confidence, 'Conflito entre colunas da linha dividida.');
  }

  if (signals.confidence < MIN_CONFIDENCE) {
    return result(false, previousSourceMatrix, previousSourceCells, previousSourceRowMeta, previousMatrix, previousCells, previousRowMeta, currentSourceMatrix, currentSourceCells, currentSourceRowMeta, currentMatrix, currentCells, currentRowMeta, null, signals.confidence, 'Confianca insuficiente para unir a linha dividida.');
  }

  const mergedRow = [];
  const mergedCells = [];
  const columnCount = Math.max(previousMatrix[previousRowIndex]?.length || 0, currentMatrix[currentRowIndex]?.length || 0);

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    mergedRow[columnIndex] = mergeCellValue(
      previousMatrix[previousRowIndex]?.[columnIndex],
      currentMatrix[currentRowIndex]?.[columnIndex],
    );
    mergedCells[columnIndex] = mergeCellModel(
      previousCells[previousRowIndex]?.[columnIndex],
      currentCells[currentRowIndex]?.[columnIndex],
      previous.pageNumber,
      current.pageNumber,
    );
  }

  previousMatrix[previousRowIndex] = mergedRow;
  previousCells[previousRowIndex] = mergedCells;
  previousRowMeta[previousRowIndex] = {
    ...(previousRowMeta[previousRowIndex] || {}),
    continuedAcrossPage: true,
    sourcePages: [previous.pageNumber, current.pageNumber],
    originalRowIds: [
      ...(previousRowMeta[previousRowIndex]?.originalRowIds || [`${previous.pageNumber}:${previousRowIndex}`]),
      ...(currentRowMeta[currentRowIndex]?.originalRowIds || [`${current.pageNumber}:${currentRowIndex}`]),
    ],
  };

  currentMatrix.splice(currentRowIndex, 1);
  currentCells.splice(currentRowIndex, 1);
  currentRowMeta.splice(currentRowIndex, 1);

  return result(
    true,
    previousSourceMatrix,
    previousSourceCells,
    previousSourceRowMeta,
    previousMatrix,
    previousCells,
    previousRowMeta,
    currentSourceMatrix,
    currentSourceCells,
    currentSourceRowMeta,
    currentMatrix,
    currentCells,
    currentRowMeta,
    previousRowIndex,
    signals.confidence,
    null,
  );
}

export function mergeCellValue(left, right) {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  return `${a} ${b}`.replace(/\s+/g, ' ').trim();
}

function gatherSignals(previousRow = [], currentRow = [], options = {}) {
  const columnCount = Math.max(previousRow.length, currentRow.length);
  let trailingEmpty = 0;
  let leadingEmpty = 0;
  let complementaryColumns = 0;
  let textContinuation = 0;
  let conflictingColumns = 0;

  for (let index = previousRow.length - 1; index >= 0; index--) {
    if (String(previousRow[index] ?? '').trim()) break;
    trailingEmpty += 1;
  }

  for (let index = 0; index < currentRow.length; index++) {
    if (String(currentRow[index] ?? '').trim()) break;
    leadingEmpty += 1;
  }

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const left = String(previousRow[columnIndex] ?? '').trim();
    const right = String(currentRow[columnIndex] ?? '').trim();

    if (!left || !right) {
      if (left || right) complementaryColumns += 1;
      continue;
    }

    if (left === right) continue;

    if (looksLikeTextContinuation(left, right)) {
      textContinuation += 1;
      continue;
    }

    if (isValueConflict(left, right)) {
      conflictingColumns += 1;
    }
  }

  let confidence = 0.25;
  if (trailingEmpty > 0) confidence += 0.18;
  if (leadingEmpty > 0) confidence += 0.18;
  if (complementaryColumns >= 2) confidence += 0.22;
  if (textContinuation > 0) confidence += 0.12;
  if (conflictingColumns === 0) confidence += 0.13;
  if (options.forceBoundaryMerge) confidence = 1;

  return {
    trailingEmpty,
    leadingEmpty,
    complementaryColumns,
    textContinuation,
    conflict: conflictingColumns > 0,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

function looksLikeTextContinuation(left, right) {
  if (cellLooksNumeric(left) || cellLooksNumeric(right)) return false;
  return /[A-Za-zÀ-ÿ0-9)]$/.test(left) && /^[A-Za-zÀ-ÿ0-9(]/.test(right);
}

function isValueConflict(left, right) {
  if (!left || !right || left === right) return false;
  if (cellLooksNumeric(left) || cellLooksNumeric(right)) return true;
  const normalizedLeft = normalizeToken(left);
  const normalizedRight = normalizeToken(right);
  return normalizedLeft !== normalizedRight;
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function mergeCellModel(left = {}, right = {}, previousPageNumber, currentPageNumber) {
  const leftBox = readBounds(left);
  const rightBox = readBounds(right);
  const bounds = mergeBounds(leftBox, rightBox);

  return {
    ...left,
    ...right,
    value: mergeCellValue(left.value, right.value),
    normalizedValue: mergeCellValue(left.normalizedValue ?? left.value, right.normalizedValue ?? right.value),
    sourcePage: left.sourcePage || previousPageNumber,
    sourcePages: [...new Set([left.sourcePage || previousPageNumber, right.sourcePage || currentPageNumber].filter(Boolean))],
    sourceItemIds: [...new Set([...(left.sourceItemIds || []), ...(right.sourceItemIds || [])])],
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    right: bounds.right,
    bottom: bounds.bottom,
    confidence: average(left.confidence, right.confidence),
    warnings: [...new Set([...(left.warnings || []), ...(right.warnings || [])])],
  };
}

function readBounds(cell = {}) {
  const x = Number(cell.x || 0);
  const y = Number(cell.y || 0);
  const right = Number.isFinite(cell.right) ? Number(cell.right) : x + Number(cell.width || 0);
  const bottom = Number.isFinite(cell.bottom) ? Number(cell.bottom) : y + Number(cell.height || 0);
  return {
    x,
    y,
    right,
    bottom,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function mergeBounds(left, right) {
  const x = Math.min(left.x || 0, right.x || Number.POSITIVE_INFINITY);
  const y = Math.min(left.y || 0, right.y || Number.POSITIVE_INFINITY);
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const mergedRight = Math.max(left.right || safeX, right.right || safeX);
  const mergedBottom = Math.max(left.bottom || safeY, right.bottom || safeY);

  return {
    x: safeX,
    y: safeY,
    right: mergedRight,
    bottom: mergedBottom,
    width: Math.max(0, mergedRight - safeX),
    height: Math.max(0, mergedBottom - safeY),
  };
}

function resolveCurrentBoundaryRowIndex(current, rowMeta) {
  for (let index = 0; index < rowMeta.length; index++) {
    if (!isHeaderLike(current, index, rowMeta)) return index;
  }
  return -1;
}

function isHeaderLike(table, rowIndex, rowMeta = table?.rowMeta || []) {
  if (rowIndex < 0) return true;
  if (Number.isInteger(table?.headerRowIndex) && table.headerRowIndex === rowIndex) return true;
  return Boolean(rowMeta[rowIndex]?.isProbablyHeader || rowMeta[rowIndex]?.isHeader);
}

function isTerminalRow(row = []) {
  const text = row.map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  return TERMINAL_ROW_RE.test(text);
}

function average(left, right) {
  const values = [left, right].map(Number).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function cloneCellGrid(grid) {
  return grid.map(row => row.map(cell => ({ ...(cell || {}) })));
}

function cloneRowMetaList(list) {
  return list.map(meta => ({
    ...(meta || {}),
    cellMeta: (meta?.cellMeta || []).map(cell => ({ ...(cell || {}) })),
  }));
}

function result(
  merged,
  previousSourceMatrix,
  previousSourceCells,
  previousSourceRowMeta,
  previousMatrix,
  previousCells,
  previousRowMeta,
  currentSourceMatrix,
  currentSourceCells,
  currentSourceRowMeta,
  currentMatrix,
  currentCells,
  currentRowMeta,
  continuedRowIndex,
  confidence,
  warning,
) {
  return {
    merged,
    previousSourceMatrix,
    previousSourceCells,
    previousSourceRowMeta,
    previousMatrix,
    previousCells,
    previousRowMeta,
    currentSourceMatrix,
    currentSourceCells,
    currentSourceRowMeta,
    currentMatrix,
    currentCells,
    currentRowMeta,
    continuedRowIndex,
    confidence,
    warning,
  };
}

function isNearBottom(table) {
  return Number(table?.bounds?.bottom || 0) >= Number(table?.height || 1) * 0.76;
}

function isNearTop(table) {
  return Number(table?.bounds?.top || 0) <= Number(table?.height || 1) * 0.30;
}
