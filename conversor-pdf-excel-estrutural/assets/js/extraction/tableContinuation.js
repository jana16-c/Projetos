import { jaccardSimilarity } from './geometry.js';
import { mergeSplitBoundaryRow } from './splitRowContinuation.js';

const TERMINAL_ROW_RE = /\b(total|subtotal|total geral|fim|encerramento)\b/i;
const DECORATIVE_FOOTER_RE = /\b(c[aá]lculo liquidado|p[aá]g\.\s*\d+|vers[aã]o\s+\d+\.\d+)\b/i;

export function mergeContinuationTables(tables, settings = {}) {
  if (!settings.mergeContinuation) return tables;
  if (tables.length <= 1) return tables;

  const merged = [];

  for (const table of tables) {
    const previous = merged[merged.length - 1];
    if (!previous || !canMergeTables(previous, table)) {
      merged.push(table);
      continue;
    }

    merged[merged.length - 1] = combineTables(previous, table);
  }

  return merged;
}

export function canMergeTables(previous, current) {
  if (!previous || !current) return false;
  const lastSourcePage = getLastSourcePage(previous);
  const samePage = current.pageNumber === lastSourcePage;
  if (!samePage && current.pageNumber - lastSourcePage !== 1) return false;

  const headerSimilarity = jaccardSimilarity(previous.headerSignature || [], current.headerSignature || []);
  const anchorDistance = averageAnchorDistance(previous.columnModel?.anchors || [], current.columnModel?.anchors || [], previous.width || current.width || 1);
  const headerAlignment = resolveHeaderAlignment(previous, current);
  const strongAlignedHeaders = isAlignedHeaderContinuation(headerSimilarity, headerAlignment, current, previous);
  if (!samePage && (previous.confidence < 0.6 || current.confidence < 0.6) && !strongAlignedHeaders) return false;
  if (samePage && (previous.confidence < 0.5 || current.confidence < 0.5) && !strongAlignedHeaders) return false;
  const compatibleColumns = Math.abs(resolveComparableColumnCount(previous) - resolveComparableColumnCount(current)) <= 1;
  const hasComparableHeaders = Boolean(previous.headerSignature?.length && current.headerSignature?.length);
  const geometricallyContinuous = isNearBottom(previous) && isNearTop(current);
  const samePageContinuation = isLikelySamePageContinuation(previous, current, headerSimilarity, anchorDistance);

  if (!compatibleColumns) return false;
  if (endsWithTerminalRow(previous)) return false;
  if (samePage) return samePageContinuation || strongAlignedHeaders;
  if (hasComparableHeaders) {
    return (
      (headerSimilarity >= 0.72 && anchorDistance <= 0.08)
      || (geometricallyContinuous && anchorDistance <= 0.08)
      || (geometricallyContinuous && strongAlignedHeaders)
    );
  }
  return geometricallyContinuous && anchorDistance <= 0.025;
}

export function combineTables(previous, current) {
  const samePage = current.pageNumber === getLastSourcePage(previous);
  const previousTrimInfo = getTrailingDecorativeRowIndexes(previous);
  const dropInfo = getRepeatedHeaderDropInfo(previous, current, { samePage });
  const headerAlignment = resolveHeaderAlignment(previous, current);
  const dropHeader = dropInfo.rowIndexes.length > 0;
  let previousSourceMatrix = cloneRows(previous.sourceMatrix || previous.matrix);
  let previousSourceCells = cloneRows(previous.sourceCells || previous.cells);
  let previousSourceRowMeta = cloneRows(previous.sourceRowMeta || previous.rowMeta);
  let currentSourceMatrix = cloneRows(current.sourceMatrix || current.matrix);
  let currentSourceCells = cloneRows(current.sourceCells || current.cells);
  let currentSourceRowMeta = cloneRows(current.sourceRowMeta || current.rowMeta);
  let previousMatrix = dropRowsAtIndexes(previous.displayMatrix || previous.matrix, previousTrimInfo.rowIndexes);
  let previousCells = dropRowsAtIndexes(previous.displayCells || previous.cells, previousTrimInfo.rowIndexes);
  let previousRowMeta = dropRowsAtIndexes(previous.displayRowMeta || previous.rowMeta, previousTrimInfo.rowIndexes);
  let currentMatrix = dropRowsAtIndexes(current.displayMatrix || current.matrix, dropInfo.rowIndexes);
  let currentCells = dropRowsAtIndexes(current.displayCells || current.cells, dropInfo.rowIndexes);
  let currentRowMeta = dropRowsAtIndexes(current.displayRowMeta || current.rowMeta, dropInfo.rowIndexes);
  const alignmentOffset = Number(headerAlignment.offset || 0);
  if (alignmentOffset > 0) {
    currentSourceMatrix = prependEmptyColumns(currentSourceMatrix, alignmentOffset);
    currentSourceCells = prependEmptyColumns(currentSourceCells, alignmentOffset, createEmptyCell);
    currentSourceRowMeta = prependEmptyColumns(currentSourceRowMeta, alignmentOffset, createEmptyMetaCell);
    currentMatrix = prependEmptyColumns(currentMatrix, alignmentOffset);
    currentCells = prependEmptyColumns(currentCells, alignmentOffset, createEmptyCell);
    currentRowMeta = prependEmptyColumns(currentRowMeta, alignmentOffset, createEmptyMetaCell);
  } else if (alignmentOffset < 0) {
    previousSourceMatrix = prependEmptyColumns(previousSourceMatrix, Math.abs(alignmentOffset));
    previousSourceCells = prependEmptyColumns(previousSourceCells, Math.abs(alignmentOffset), createEmptyCell);
    previousSourceRowMeta = prependEmptyColumns(previousSourceRowMeta, Math.abs(alignmentOffset), createEmptyMetaCell);
    previousMatrix = prependEmptyColumns(previousMatrix, Math.abs(alignmentOffset));
    previousCells = prependEmptyColumns(previousCells, Math.abs(alignmentOffset), createEmptyCell);
    previousRowMeta = prependEmptyColumns(previousRowMeta, Math.abs(alignmentOffset), createEmptyMetaCell);
  }
  const targetColumnCount = Math.max(
    getMaxColumnCount(previousSourceMatrix),
    getMaxColumnCount(currentSourceMatrix),
    getMaxColumnCount(previousMatrix),
    getMaxColumnCount(currentMatrix),
  );
  previousSourceMatrix = ensureColumnCount(previousSourceMatrix, targetColumnCount);
  currentSourceMatrix = ensureColumnCount(currentSourceMatrix, targetColumnCount);
  previousMatrix = ensureColumnCount(previousMatrix, targetColumnCount);
  currentMatrix = ensureColumnCount(currentMatrix, targetColumnCount);
  previousSourceCells = ensureColumnCount(previousSourceCells, targetColumnCount, createEmptyCell);
  currentSourceCells = ensureColumnCount(currentSourceCells, targetColumnCount, createEmptyCell);
  previousCells = ensureColumnCount(previousCells, targetColumnCount, createEmptyCell);
  currentCells = ensureColumnCount(currentCells, targetColumnCount, createEmptyCell);
  previousSourceRowMeta = ensureColumnCount(previousSourceRowMeta, targetColumnCount, createEmptyMetaCell);
  currentSourceRowMeta = ensureColumnCount(currentSourceRowMeta, targetColumnCount, createEmptyMetaCell);
  previousRowMeta = ensureColumnCount(previousRowMeta, targetColumnCount, createEmptyMetaCell);
  currentRowMeta = ensureColumnCount(currentRowMeta, targetColumnCount, createEmptyMetaCell);
  const splitRowMerge = mergeSplitBoundaryRow({
    ...previous,
    displayMatrix: previousMatrix,
    displayCells: previousCells,
    displayRowMeta: previousRowMeta,
    matrix: previousMatrix,
    cells: previousCells,
    rowMeta: previousRowMeta,
  }, {
    ...current,
    displayMatrix: currentMatrix,
    displayCells: currentCells,
    displayRowMeta: currentRowMeta,
    matrix: currentMatrix,
    cells: currentCells,
    rowMeta: currentRowMeta,
    headerRowIndex: dropHeader ? -1 : current.headerRowIndex,
  }, {
    enabled: true,
  });
  const nextPreviousMatrix = splitRowMerge.merged ? splitRowMerge.previousMatrix : previousMatrix;
  const nextPreviousCells = splitRowMerge.merged ? splitRowMerge.previousCells : previousCells;
  const nextPreviousRowMeta = splitRowMerge.merged ? splitRowMerge.previousRowMeta : previousRowMeta;
  const nextCurrentMatrix = splitRowMerge.merged ? splitRowMerge.currentMatrix : currentMatrix;
  const nextCurrentCells = splitRowMerge.merged ? splitRowMerge.currentCells : currentCells;
  const nextCurrentRowMeta = splitRowMerge.merged ? splitRowMerge.currentRowMeta : currentRowMeta;
  const mergedSourceMatrix = [...previousSourceMatrix, ...currentSourceMatrix];
  const mergedSourceCells = [...previousSourceCells, ...currentSourceCells];
  const mergedSourceRowMeta = [...previousSourceRowMeta, ...currentSourceRowMeta];
  const mergedDisplayMatrix = [...nextPreviousMatrix, ...nextCurrentMatrix];
  const mergedDisplayCells = [...nextPreviousCells, ...nextCurrentCells];
  const mergedDisplayRowMeta = [...nextPreviousRowMeta, ...nextCurrentRowMeta];

  return {
    ...previous,
    sourcePages: [...new Set([...previous.sourcePages, ...current.sourcePages])],
    sourceMatrix: mergedSourceMatrix,
    sourceCells: mergedSourceCells,
    sourceRowMeta: mergedSourceRowMeta,
    displayMatrix: mergedDisplayMatrix,
    displayCells: mergedDisplayCells,
    displayRowMeta: mergedDisplayRowMeta,
    matrix: mergedDisplayMatrix,
    cells: mergedDisplayCells,
    rowMeta: mergedDisplayRowMeta,
    warnings: [...new Set([
      ...previous.warnings,
      ...current.warnings,
      ...(splitRowMerge.warning ? [splitRowMerge.warning] : []),
    ])],
    continuesOnNextPage: current.continuesOnNextPage,
    pageBreaks: [
      ...(previous.pageBreaks || []),
      {
        pageNumber: current.pageNumber,
        startRow: splitRowMerge.merged ? Math.max(0, previousMatrix.length - 1) : previousMatrix.length,
        rowCount: nextCurrentMatrix.length,
        removedHeader: dropHeader ? {
          row: (current.sourceMatrix || current.matrix)[dropInfo.primaryRowIndex],
          cells: (current.sourceCells || current.cells)[dropInfo.primaryRowIndex],
          rowMeta: (current.sourceRowMeta || current.rowMeta)[dropInfo.primaryRowIndex],
          rowIndex: dropInfo.primaryRowIndex,
        } : null,
        originalRowCount: (current.sourceMatrix || current.matrix).length,
        continuedRowIndex: splitRowMerge.continuedRowIndex,
      },
    ],
    mergeDecisions: [
      ...(previous.mergeDecisions || []),
      {
        type: samePage ? 'same-page-continuation' : 'page-continuation',
        fromPage: previous.pageNumber,
        toPage: current.pageNumber,
        alignmentOffset,
        droppedTrailingRows: [...previousTrimInfo.rowIndexes],
        droppedRepeatedHeader: dropHeader,
        droppedLeadingRows: [...dropInfo.rowIndexes],
        mergedBoundaryRow: Boolean(splitRowMerge.merged),
      },
    ],
    confidence: Math.round((((previous.confidence || 0) + (current.confidence || 0)) / 2) * 100) / 100,
    continuedFromPreviousPage: previous.continuedFromPreviousPage,
  };
}

function getRepeatedHeaderDropInfo(previous, current, { samePage = false } = {}) {
  const previousHeader = previous.headerSignature || [];
  const currentHeader = current.headerSignature || [];
  if (!previousHeader.length || !currentHeader.length) return { rowIndexes: [], primaryRowIndex: -1 };
  if (jaccardSimilarity(previousHeader, currentHeader) < 0.9) return { rowIndexes: [], primaryRowIndex: -1 };

  const headerRowIndex = Number.isInteger(current.headerRowIndex) && current.headerRowIndex >= 0 ? current.headerRowIndex : 0;
  if (!samePage) {
    const leadingDecorative = collectLeadingDecorativeRows(current, headerRowIndex);
    return {
      rowIndexes: [...leadingDecorative, headerRowIndex],
      primaryRowIndex: headerRowIndex,
    };
  }

  return {
    rowIndexes: Array.from({ length: headerRowIndex + 1 }, (_, index) => index),
    primaryRowIndex: headerRowIndex,
  };
}

function averageAnchorDistance(left, right, pageWidth) {
  if (!left.length || !right.length) return 1;
  const size = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < size; index++) {
    total += Math.abs((left[index]?.x || 0) - (right[index]?.x || 0));
  }
  return (total / size) / Math.max(1, pageWidth);
}

function isAlignedHeaderContinuation(headerSimilarity, headerAlignment, current, previous) {
  if (headerSimilarity < 0.84) return false;
  if (!headerAlignment.matched) return false;
  if (Math.abs(headerAlignment.offset) > 2) return false;
  if ((current.headerSignature || []).length < 3 || (previous.headerSignature || []).length < 3) return false;
  return true;
}

function getLastSourcePage(table) {
  return Math.max(
    Number(table?.pageNumber || 0),
    ...((table?.sourcePages || []).map(page => Number(page || 0))),
  );
}

function isNearBottom(table) {
  return Number(table?.bounds?.bottom || 0) >= Number(table?.height || 1) * 0.72;
}

function isNearTop(table) {
  return Number(table?.bounds?.top || 0) <= Number(table?.height || 1) * 0.35;
}

function endsWithTerminalRow(table) {
  const lastRow = getLastEffectiveRow(table) || [];
  const text = lastRow.map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  return TERMINAL_ROW_RE.test(text);
}

function dropRowAtIndex(rows = [], index) {
  if (!Array.isArray(rows)) return [];
  if (index < 0) return rows.map(row => cloneRow(row));
  return rows.flatMap((row, rowIndex) => (rowIndex === index ? [] : [cloneRow(row)]));
}

function dropRowsAtIndexes(rows = [], indexes = []) {
  if (!Array.isArray(rows)) return [];
  if (!indexes.length) return rows.map(row => cloneRow(row));
  const skip = new Set(indexes);
  return rows.flatMap((row, rowIndex) => (skip.has(rowIndex) ? [] : [cloneRow(row)]));
}

function cloneRow(row) {
  if (Array.isArray(row)) return row.map(cell => (cell && typeof cell === 'object' ? { ...cell } : cell));
  if (row && typeof row === 'object') return { ...row };
  return row;
}

function cloneRows(rows = []) {
  return rows.map(row => cloneRow(row));
}

function isLikelySamePageContinuation(previous, current, headerSimilarity, anchorDistance) {
  if (previous.pageNumber !== current.pageNumber) return false;
  if (!Number.isInteger(current.headerRowIndex) || current.headerRowIndex < 0) return false;
  if (headerSimilarity < 0.84 || anchorDistance > 0.08) return false;
  if (current.bounds?.top <= previous.bounds?.top) return false;

  const pageHeight = Math.max(1, Number(previous.height || current.height || 1));
  const verticalGap = Math.max(0, Number(current.bounds?.top || 0) - Number(previous.bounds?.bottom || 0));
  if (verticalGap > Math.max(180, pageHeight * 0.24)) return false;

  const previousTitle = readTitleText(previous);
  const currentTitle = readTitleText(current);
  const currentLeadingRows = readLeadingRowsBeforeHeader(current);
  if (!currentLeadingRows.every(isDecorativeLeadingRow)) return false;

  if (previousTitle && currentTitle) {
    const left = normalizeLooseText(previousTitle);
    const right = normalizeLooseText(currentTitle);
    if (left === right) return true;
    if (left.includes(right) || right.includes(left)) return true;
    if (jaccardSimilarity(tokenizeLooseText(previousTitle), tokenizeLooseText(currentTitle)) >= 0.35) return true;
  }

  return true;
}

function readTitleText(table) {
  const titleIndex = (table.rowMeta || []).findIndex(meta => meta?.isTitle);
  if (titleIndex < 0) return '';
  return (table.matrix?.[titleIndex] || []).map(value => String(value || '').trim()).filter(Boolean).join(' ');
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeLooseText(value) {
  return normalizeLooseText(value).split(' ').filter(Boolean);
}

function readLeadingRowsBeforeHeader(table) {
  const headerIndex = Number.isInteger(table?.headerRowIndex) ? table.headerRowIndex : -1;
  if (headerIndex <= 0) return [];
  return (table.matrix || []).slice(0, headerIndex);
}

function isDecorativeLeadingRow(row = []) {
  const filled = row.map(value => String(value ?? '').trim()).filter(Boolean);
  if (!filled.length) return true;
  if (filled.length === 1) return true;
  return filled.length <= 2 && filled.join(' ').length <= 160;
}

function resolveComparableColumnCount(table) {
  if (table?.columnModel?.columnCount) return Number(table.columnModel.columnCount);
  if (Array.isArray(table?.headerSignature) && table.headerSignature.length) return table.headerSignature.length;
  return Math.max(0, ...((table?.matrix || []).map(row => row.length)));
}

function collectLeadingDecorativeRows(table, headerRowIndex) {
  const rows = table.matrix || [];
  const indexes = [];
  for (let index = 0; index < headerRowIndex; index++) {
    if (isDecorativeLeadingRow(rows[index])) indexes.push(index);
  }
  return indexes;
}

function resolveHeaderAlignment(previous, current) {
  const previousIndexes = getNonEmptyIndexes(getHeaderRow(previous, previous.headerRowIndex));
  const currentIndexes = getNonEmptyIndexes(getHeaderRow(current, current.headerRowIndex));
  const count = Math.min(previousIndexes.length, currentIndexes.length, previous.headerSignature?.length || 0, current.headerSignature?.length || 0);
  if (count < 2) return { offset: 0, matched: false };

  const offsets = [];
  for (let index = 0; index < count; index++) {
    offsets.push(previousIndexes[index] - currentIndexes[index]);
  }

  const medianOffset = Math.round(offsets.sort((left, right) => left - right)[Math.floor(offsets.length / 2)] || 0);
  const stableMatches = offsets.filter(offset => Math.abs(offset - medianOffset) <= 1).length;
  return {
    offset: medianOffset,
    matched: stableMatches >= Math.max(2, Math.ceil(count * 0.6)),
  };
}

function getHeaderRow(table, rowIndex) {
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return [];
  return table.matrix?.[rowIndex] || table.displayMatrix?.[rowIndex] || [];
}

function getNonEmptyIndexes(row = []) {
  return row.flatMap((value, index) => (String(value ?? '').trim() ? [index] : []));
}

function getTrailingDecorativeRowIndexes(table) {
  const rows = table.displayMatrix || table.matrix || [];
  const rowMeta = table.displayRowMeta || table.rowMeta || [];
  const indexes = [];

  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index] || [];
    const meta = rowMeta[index] || {};
    if (meta.isHeader) break;
    if (!isDecorativeTrailingRow(row)) break;
    indexes.unshift(index);
  }

  return {
    rowIndexes: indexes,
  };
}

function isDecorativeTrailingRow(row = []) {
  const text = row.map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  if (!text) return true;
  if (DECORATIVE_FOOTER_RE.test(text)) return true;
  return /^[Pp][áa]g\.\s*\d+/.test(text);
}

function getLastEffectiveRow(table) {
  const rows = table.displayMatrix || table.matrix || [];
  for (let index = rows.length - 1; index >= 0; index--) {
    if (!isDecorativeTrailingRow(rows[index])) return rows[index];
  }
  return rows[rows.length - 1] || [];
}

function prependEmptyColumns(rows = [], count = 0, factory = null) {
  if (!count) return cloneRows(rows);
  return rows.map(row => prependToRow(row, count, factory));
}

function prependToRow(row, count, factory) {
  if (Array.isArray(row)) {
    const padding = Array.from({ length: count }, () => factory ? factory() : '');
    return [...padding, ...cloneRow(row)];
  }
  if (row && typeof row === 'object') {
    const cellMeta = Array.isArray(row.cellMeta)
      ? [...Array.from({ length: count }, () => createEmptyMetaCell()), ...row.cellMeta.map(cell => ({ ...(cell || {}) }))]
      : row.cellMeta;
    return {
      ...row,
      cellMeta,
    };
  }
  return row;
}

function ensureColumnCount(rows = [], columnCount = 0, factory = null) {
  return rows.map(row => extendRow(row, columnCount, factory));
}

function extendRow(row, columnCount, factory) {
  if (Array.isArray(row)) {
    const output = cloneRow(row);
    while (output.length < columnCount) {
      output.push(factory ? factory() : '');
    }
    return output;
  }
  if (row && typeof row === 'object') {
    const cellMeta = Array.isArray(row.cellMeta)
      ? row.cellMeta.map(cell => ({ ...(cell || {}) }))
      : [];
    while (cellMeta.length < columnCount) {
      cellMeta.push(createEmptyMetaCell());
    }
    return {
      ...row,
      cellMeta,
    };
  }
  return row;
}

function getMaxColumnCount(rows = []) {
  return Math.max(0, ...rows.map(row => Array.isArray(row) ? row.length : (Array.isArray(row?.cellMeta) ? row.cellMeta.length : 0)));
}

function createEmptyCell() {
  return {
    value: '',
    normalizedValue: '',
    sourceItemIds: [],
  };
}

function createEmptyMetaCell() {
  return {
    bold: false,
    italic: false,
    fontSize: 0,
    x: 0,
    sourceItemIds: [],
  };
}
