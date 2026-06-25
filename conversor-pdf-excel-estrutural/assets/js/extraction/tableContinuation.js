import { jaccardSimilarity } from './geometry.js';

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
  if (current.pageNumber - previous.pageNumber !== 1) return false;
  if (previous.confidence < 0.6 || current.confidence < 0.6) return false;

  const headerSimilarity = jaccardSimilarity(previous.headerSignature || [], current.headerSignature || []);
  const anchorDistance = averageAnchorDistance(previous.columnModel?.anchors || [], current.columnModel?.anchors || [], previous.width || current.width || 1);
  const compatibleColumns = Math.abs((previous.matrix[0]?.length || 0) - (current.matrix[0]?.length || 0)) <= 1;
  const hasComparableHeaders = Boolean(previous.headerSignature?.length && current.headerSignature?.length);

  if (!compatibleColumns) return false;
  if (hasComparableHeaders) {
    return headerSimilarity >= 0.72 && anchorDistance <= 0.08;
  }
  return anchorDistance <= 0.025;
}

export function combineTables(previous, current) {
  const headerDropIndex = getRepeatedHeaderDropIndex(previous, current);
  const dropHeader = headerDropIndex >= 0;
  const currentMatrix = dropRowAtIndex(current.matrix, headerDropIndex);
  const currentCells = dropRowAtIndex(current.cells, headerDropIndex);
  const currentRowMeta = dropRowAtIndex(current.rowMeta, headerDropIndex);

  return {
    ...previous,
    sourcePages: [...new Set([...previous.sourcePages, ...current.sourcePages])],
    matrix: [...previous.matrix, ...currentMatrix],
    cells: [...previous.cells, ...currentCells],
    rowMeta: [...previous.rowMeta, ...currentRowMeta],
    warnings: [...new Set([...previous.warnings, ...current.warnings])],
    continuesOnNextPage: current.continuesOnNextPage,
    pageBreaks: [
      ...(previous.pageBreaks || []),
      {
        pageNumber: current.pageNumber,
        startRow: previous.matrix.length,
        rowCount: currentMatrix.length,
        removedHeader: dropHeader ? {
          row: current.matrix[headerDropIndex],
          cells: current.cells[headerDropIndex],
          rowMeta: current.rowMeta[headerDropIndex],
          rowIndex: headerDropIndex,
        } : null,
        originalRowCount: current.matrix.length,
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
