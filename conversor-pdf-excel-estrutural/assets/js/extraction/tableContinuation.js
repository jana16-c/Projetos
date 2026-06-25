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

  return compatibleColumns && (headerSimilarity >= 0.7 || anchorDistance <= 0.04);
}

export function combineTables(previous, current) {
  const dropHeader = shouldDropRepeatedHeader(previous, current);
  const currentMatrix = dropHeader ? current.matrix.slice(1) : current.matrix;
  const currentCells = dropHeader ? current.cells.slice(1) : current.cells;
  const currentRowMeta = dropHeader ? current.rowMeta.slice(1) : current.rowMeta;

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
          row: current.matrix[0],
          cells: current.cells[0],
          rowMeta: current.rowMeta[0],
        } : null,
        originalRowCount: current.matrix.length,
      },
    ],
    confidence: Math.round((((previous.confidence || 0) + (current.confidence || 0)) / 2) * 100) / 100,
    continuedFromPreviousPage: previous.continuedFromPreviousPage,
  };
}

function shouldDropRepeatedHeader(previous, current) {
  const previousHeader = previous.headerSignature || [];
  const currentHeader = current.headerSignature || [];
  if (!previousHeader.length || !currentHeader.length) return false;
  return jaccardSimilarity(previousHeader, currentHeader) >= 0.9;
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
