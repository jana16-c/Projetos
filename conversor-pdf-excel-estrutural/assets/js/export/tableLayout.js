import { median } from '../extraction/geometry.js';

export function buildRenderableTable(table) {
  const sourceMatrix = table.matrix || [];
  const sourceCells = table.cells || [];
  const sourceRowMeta = table.rowMeta || [];
  const pageBreaks = normalizePageBreaks(table, sourceMatrix.length);

  const matrix = [];
  const cells = [];
  const rowMeta = [];
  let headerRowIndex = -1;

  const pushLogicalRow = logicalIndex => {
    if (logicalIndex < 0 || logicalIndex >= sourceMatrix.length) return;
    const meta = cloneRowMeta(sourceRowMeta[logicalIndex]);
    meta.isHeader = logicalIndex === table.headerRowIndex;
    if (meta.isHeader && headerRowIndex < 0) headerRowIndex = matrix.length;
    matrix.push([...(sourceMatrix[logicalIndex] || [])]);
    cells.push(cloneCellRow(sourceCells[logicalIndex]));
    rowMeta.push(meta);
  };

  for (const pageBreak of pageBreaks) {
    const segmentIndexes = [];
    for (let index = 0; index < pageBreak.rowCount; index++) {
      const logicalIndex = pageBreak.startRow + index;
      if (logicalIndex >= sourceMatrix.length) break;
      segmentIndexes.push(logicalIndex);
    }
    segmentIndexes.forEach(pushLogicalRow);
  }

  if (!matrix.length) {
    return { matrix: sourceMatrix, cells: sourceCells, rowMeta: sourceRowMeta, headerRowIndex: table.headerRowIndex ?? -1 };
  }

  return { matrix, cells, rowMeta, headerRowIndex };
}

export function deriveColumnWidths(table, columnCount) {
  const anchors = (table.columnModel?.anchors || [])
    .map(anchor => Number(anchor?.x))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (!anchors.length || columnCount <= 0) return [];

  const gaps = [];
  for (let index = 1; index < anchors.length; index++) {
    gaps.push(anchors[index] - anchors[index - 1]);
  }

  const medianGap = Math.max(42, median(gaps, 72));
  const rightBound = Number.isFinite(table.bounds?.right)
    ? Math.max(table.bounds.right, anchors[anchors.length - 1] + medianGap)
    : anchors[anchors.length - 1] + medianGap;

  return Array.from({ length: columnCount }, (_, index) => {
    const left = anchors[index] ?? (anchors[anchors.length - 1] + (medianGap * (index - anchors.length + 1)));
    const next = anchors[index + 1] ?? rightBound;
    const width = Math.max(2, Math.round(Math.max(10, next - left) / 7.2));
    return Math.min(40, width);
  });
}

export function buildHorizontalMerges(matrix = []) {
  const merges = [];

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex] || [];
    const filled = row
      .map((value, columnIndex) => ({ value: String(value ?? '').trim(), columnIndex }))
      .filter(cell => cell.value);

    if (!filled.length) continue;

    if (filled.length === 1 && row.length > 1) {
      merges.push({
        rowIndex,
        startColumn: 0,
        endColumn: row.length - 1,
      });
      continue;
    }

    for (let index = 0; index < filled.length; index++) {
      const current = filled[index];
      const next = filled[index + 1];
      const endColumn = next ? next.columnIndex - 1 : row.length - 1;
      if (endColumn > current.columnIndex) {
        merges.push({
          rowIndex,
          startColumn: current.columnIndex,
          endColumn,
        });
      }
    }
  }

  return merges;
}

function normalizePageBreaks(table, rowCount) {
  if (!Array.isArray(table.pageBreaks) || !table.pageBreaks.length) {
    return [{
      pageNumber: table.pageNumber,
      startRow: 0,
      rowCount,
      removedHeader: null,
    }];
  }

  return table.pageBreaks.map(pageBreak => ({
    pageNumber: pageBreak.pageNumber,
    startRow: clamp(pageBreak.startRow ?? 0, 0, rowCount),
    rowCount: clamp(pageBreak.rowCount ?? rowCount, 0, rowCount),
    removedHeader: pageBreak.removedHeader ? {
      row: [...(pageBreak.removedHeader.row || [])],
      cells: cloneCellRow(pageBreak.removedHeader.cells),
      rowMeta: cloneRowMeta(pageBreak.removedHeader.rowMeta),
      rowIndex: pageBreak.removedHeader.rowIndex ?? 0,
    } : null,
  }));
}

function cloneCellRow(row = []) {
  return row.map(cell => ({ ...(cell || {}) }));
}

function cloneRowMeta(meta = {}) {
  return {
    ...meta,
    cellMeta: (meta.cellMeta || []).map(cell => ({ ...(cell || {}) })),
  };
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
