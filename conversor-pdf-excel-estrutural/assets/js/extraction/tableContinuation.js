import { jaccardSimilarity } from './geometry.js';
import { mergeSplitBoundaryRow } from './splitRowContinuation.js';

const TERMINAL_ROW_RE = /\b(total|subtotal|total geral|fim|encerramento)\b/i;

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
  if (current.pageNumber - getLastSourcePage(previous) !== 1) return false;
  if (previous.confidence < 0.6 || current.confidence < 0.6) return false;

  const headerSimilarity = jaccardSimilarity(previous.headerSignature || [], current.headerSignature || []);
  const anchorDistance = averageAnchorDistance(previous.columnModel?.anchors || [], current.columnModel?.anchors || [], previous.width || current.width || 1);
  const compatibleColumns = Math.abs((previous.matrix[0]?.length || 0) - (current.matrix[0]?.length || 0)) <= 1;
  const hasComparableHeaders = Boolean(previous.headerSignature?.length && current.headerSignature?.length);
  const geometricallyContinuous = isNearBottom(previous) && isNearTop(current);

  if (!compatibleColumns) return false;
  if (endsWithTerminalRow(previous)) return false;
  if (hasComparableHeaders) {
    return (headerSimilarity >= 0.72 && anchorDistance <= 0.08) || (geometricallyContinuous && anchorDistance <= 0.08);
  }
  return geometricallyContinuous && anchorDistance <= 0.025;
}

export function combineTables(previous, current) {
  const headerDropIndex = getRepeatedHeaderDropIndex(previous, current);
  const dropHeader = headerDropIndex >= 0;
  const currentMatrix = dropRowAtIndex(current.matrix, headerDropIndex);
  const currentCells = dropRowAtIndex(current.cells, headerDropIndex);
  const currentRowMeta = dropRowAtIndex(current.rowMeta, headerDropIndex);
  const splitRowMerge = mergeSplitBoundaryRow(previous, {
    ...current,
    matrix: currentMatrix,
    cells: currentCells,
    rowMeta: currentRowMeta,
    headerRowIndex: dropHeader ? -1 : current.headerRowIndex,
  }, {
    enabled: true,
  });
  const nextPreviousMatrix = splitRowMerge.merged ? splitRowMerge.previousMatrix : previous.matrix;
  const nextPreviousCells = splitRowMerge.merged ? splitRowMerge.previousCells : previous.cells;
  const nextPreviousRowMeta = splitRowMerge.merged ? splitRowMerge.previousRowMeta : previous.rowMeta;
  const nextCurrentMatrix = splitRowMerge.merged ? splitRowMerge.currentMatrix : currentMatrix;
  const nextCurrentCells = splitRowMerge.merged ? splitRowMerge.currentCells : currentCells;
  const nextCurrentRowMeta = splitRowMerge.merged ? splitRowMerge.currentRowMeta : currentRowMeta;

  return {
    ...previous,
    sourcePages: [...new Set([...previous.sourcePages, ...current.sourcePages])],
    matrix: [...nextPreviousMatrix, ...nextCurrentMatrix],
    cells: [...nextPreviousCells, ...nextCurrentCells],
    rowMeta: [...nextPreviousRowMeta, ...nextCurrentRowMeta],
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
        startRow: splitRowMerge.merged ? Math.max(0, previous.matrix.length - 1) : previous.matrix.length,
        rowCount: nextCurrentMatrix.length,
        removedHeader: dropHeader ? {
          row: current.matrix[headerDropIndex],
          cells: current.cells[headerDropIndex],
          rowMeta: current.rowMeta[headerDropIndex],
          rowIndex: headerDropIndex,
        } : null,
        originalRowCount: current.matrix.length,
        continuedRowIndex: splitRowMerge.continuedRowIndex,
      },
    ],
    confidence: Math.round((((previous.confidence || 0) + (current.confidence || 0)) / 2) * 100) / 100,
    continuedFromPreviousPage: previous.continuedFromPreviousPage,
  };
}

function getRepeatedHeaderDropIndex(previous, current) {
  const previousHeader = previous.headerSignature || [];
  const currentHeader = current.headerSignature || [];
  if (!previousHeader.length || !currentHeader.length) return -1;
  if (jaccardSimilarity(previousHeader, currentHeader) < 0.9) return -1;
  return Number.isInteger(current.headerRowIndex) && current.headerRowIndex >= 0 ? current.headerRowIndex : 0;
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

function getLastSourcePage(table) {
  return Math.max(
    Number(table?.pageNumber || 0),
    ...((table?.sourcePages || []).map(page => Number(page || 0))),
  );
}

function isNearBottom(table) {
  return Number(table?.bounds?.bottom || 0) >= Number(table?.height || 1) * 0.76;
}

function isNearTop(table) {
  return Number(table?.bounds?.top || 0) <= Number(table?.height || 1) * 0.30;
}

function endsWithTerminalRow(table) {
  const lastRow = table?.matrix?.[table.matrix.length - 1] || [];
  const text = lastRow.map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  return TERMINAL_ROW_RE.test(text);
}

function dropRowAtIndex(rows = [], index) {
  if (!Array.isArray(rows)) return [];
  if (index < 0) return rows.map(row => cloneRow(row));
  return rows.flatMap((row, rowIndex) => (rowIndex === index ? [] : [cloneRow(row)]));
}

function cloneRow(row) {
  if (Array.isArray(row)) return row.map(cell => (cell && typeof cell === 'object' ? { ...cell } : cell));
  if (row && typeof row === 'object') return { ...row };
  return row;
}
