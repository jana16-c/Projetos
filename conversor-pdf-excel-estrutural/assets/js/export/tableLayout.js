import { median } from '../extraction/geometry.js?v=2026-06-30-livepreview-3';

const DECORATIVE_ROW_RE = /\b(c[aá]lculo liquidado|p[aá]g\.\s*\d+|vers[aã]o\s+\d+\.\d+)\b/i;

export function buildRenderableTable(table) {
  const sourceMatrix = table.displayMatrix || table.matrix || [];
  const sourceCells = table.displayCells || table.cells || [];
  const sourceRowMeta = table.displayRowMeta || table.rowMeta || [];
  const pageBreaks = normalizePageBreaks(table, sourceMatrix.length);
  const mainHeaderSignature = Number.isInteger(table.headerRowIndex) && table.headerRowIndex >= 0
    ? normalizeHeaderSignature(sourceMatrix[table.headerRowIndex] || [])
    : [];

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

  for (let pageBreakIndex = 0; pageBreakIndex < pageBreaks.length; pageBreakIndex++) {
    const pageBreak = pageBreaks[pageBreakIndex];
    let segmentIndexes = [];
    for (let index = 0; index < pageBreak.rowCount; index++) {
      const logicalIndex = pageBreak.startRow + index;
      if (logicalIndex >= sourceMatrix.length) break;
      segmentIndexes.push(logicalIndex);
    }
    if (pageBreakIndex > 0) {
      segmentIndexes = dropRepeatedContinuationPrelude(segmentIndexes, sourceMatrix, mainHeaderSignature);
    }
    const segmentHeaderPosition = resolveSegmentHeaderPosition(segmentIndexes, sourceMatrix, mainHeaderSignature, pageBreakIndex === 0 ? table.headerRowIndex : -1);
    const compactedSegment = compactSegmentLeadingColumns(segmentIndexes, sourceMatrix, sourceCells, sourceRowMeta, segmentHeaderPosition);
    compactedSegment.matrix.forEach((row, segmentRowIndex) => {
      const meta = cloneRowMeta(compactedSegment.rowMeta[segmentRowIndex]);
      const logicalIndex = segmentIndexes[segmentRowIndex];
      meta.isHeader = pageBreakIndex === 0 && segmentRowIndex === compactedSegment.headerRowIndex;
      if (meta.isHeader && headerRowIndex < 0) headerRowIndex = matrix.length;
      matrix.push(row);
      cells.push(cloneCellRow(compactedSegment.cells[segmentRowIndex]));
      rowMeta.push(meta);
    });
  }

  if (!matrix.length) {
    return { matrix: sourceMatrix, cells: sourceCells, rowMeta: sourceRowMeta, headerRowIndex: table.headerRowIndex ?? -1 };
  }

  return normalizeRenderableLayout({ matrix, cells, rowMeta, headerRowIndex });
}

export function deriveColumnWidths(table, columnCount) {
  const contentProfile = deriveContentColumnProfile(table, columnCount);
  const visualWidths = deriveVisualColumnWidths(table, columnCount);
  const contentWidths = contentProfile.widths;
  if (visualWidths.length) {
    return visualWidths.map((width, index) => harmonizeColumnWidth(width, contentProfile, index));
  }

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
    return harmonizeColumnWidth(width, contentProfile, index);
  });
}

export function deriveRowHeights(table, rowCount) {
  const columnWidths = deriveColumnWidths(table, Math.max(1, ...((table.displayMatrix || table.matrix || []).map(row => row.length))));
  const visualHeights = (table.visualModel?.rowHeightsPt || [])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);

  if (visualHeights.length) {
    return Array.from({ length: rowCount }, (_, index) => {
      const visualHeight = clamp(Math.round(visualHeights[index] || visualHeights[visualHeights.length - 1] || 15), 12, 120);
      const contentHeight = estimateRowHeight(table, index, columnWidths);
      return Math.max(visualHeight, contentHeight);
    });
  }

  return Array.from({ length: rowCount }, (_, index) => estimateRowHeight(table, index, columnWidths));
}

export function buildTableMerges(table, renderable = null) {
  const visualMerges = normalizeVisualMerges(table.visualModel?.merges || []);
  if (visualMerges.length) return visualMerges;

  const matrix = renderable?.matrix || buildRenderableTable(table).matrix;
  return buildHorizontalMerges(matrix).map(merge => ({
    startRow: merge.rowIndex,
    endRow: merge.rowIndex,
    startColumn: merge.startColumn,
    endColumn: merge.endColumn,
  }));
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

function deriveVisualColumnWidths(table, columnCount) {
  const widths = (table.visualModel?.columnWidthsPt || [])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);

  if (!widths.length || columnCount <= 0) return [];

  return Array.from({ length: columnCount }, (_, index) => {
    const width = widths[index] || widths[widths.length - 1] || 42;
    return clamp(Math.round(width / 7.2), 6, 60);
  });
}

function deriveContentColumnProfile(table, columnCount) {
  const renderableMatrix = table.displayMatrix || table.matrix || [];
  const rowMeta = table.displayRowMeta || table.rowMeta || [];
  const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
    let maxLength = 0;
    let filledCount = 0;
    for (let rowIndex = 0; rowIndex < renderableMatrix.length; rowIndex++) {
      const row = renderableMatrix[rowIndex] || [];
      const meta = rowMeta[rowIndex] || {};
      if (shouldIgnoreWidthContribution(row, meta)) continue;
      const valueLength = String(row?.[columnIndex] ?? '').trim().length;
      if (!valueLength) continue;
      filledCount += 1;
      maxLength = Math.max(maxLength, valueLength);
    }
    if (!filledCount) {
      for (const row of renderableMatrix) {
        maxLength = Math.max(maxLength, String(row?.[columnIndex] ?? '').trim().length);
      }
    }
    return clamp(Math.ceil((maxLength * 1.06) + 2), 5, 48);
  });
  const fillRatios = Array.from({ length: columnCount }, (_, columnIndex) => {
    const meaningfulRows = renderableMatrix.filter((row, rowIndex) => !shouldIgnoreWidthContribution(row, rowMeta[rowIndex] || {}));
    if (!meaningfulRows.length) return 0;
    const filled = meaningfulRows.filter(row => String(row?.[columnIndex] ?? '').trim()).length;
    return filled / meaningfulRows.length;
  });
  return { widths, fillRatios };
}

function estimateRowHeight(table, rowIndex, columnWidths) {
  const row = (table.displayMatrix || table.matrix || [])[rowIndex] || [];
  const rowMeta = (table.displayRowMeta || table.rowMeta || [])[rowIndex] || {};
  const cells = (table.displayCells || table.cells || [])[rowIndex] || [];
  let tallest = 15;
  const rowIsWideText = shouldUseFullRowWidth(row, rowMeta);
  const totalWidthChars = Math.max(10, columnWidths.reduce((sum, value) => sum + Number(value || 0), 0));

  for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
    const text = String(row[columnIndex] ?? '').trim();
    if (!text) continue;

    const widthChars = rowIsWideText
      ? totalWidthChars
      : Math.max(6, Number(columnWidths[columnIndex] || 10));
    const cell = cells[columnIndex] || {};
    const cellMeta = rowMeta.cellMeta?.[columnIndex] || {};
    const fontSize = Number(cellMeta.fontSize || rowMeta.maxFontSize || cell.fontSize || (rowMeta.isTitle ? 11 : 9));
    const explicitBreaks = text.split(/\r?\n/).length;
    const estimatedLines = Math.max(explicitBreaks, Math.ceil(text.length / Math.max(1, widthChars * (rowIsWideText ? 1.35 : 1.18))));
    const padding = rowMeta.isHeader ? 4 : 3;
    const estimatedHeight = Math.round((fontSize * (rowIsWideText ? 1.15 : 1.28) * estimatedLines) + padding);
    tallest = Math.max(tallest, estimatedHeight);
  }

  return clamp(tallest, rowMeta.isTitle ? 15 : 14, rowIsWideText ? 42 : 84);
}

function normalizeVisualMerges(merges = []) {
  return merges
    .map(merge => ({
      startRow: Number(merge?.startRow),
      endRow: Number(merge?.endRow),
      startColumn: Number(merge?.startColumn),
      endColumn: Number(merge?.endColumn),
    }))
    .filter(merge => (
      Number.isInteger(merge.startRow)
      && Number.isInteger(merge.endRow)
      && Number.isInteger(merge.startColumn)
      && Number.isInteger(merge.endColumn)
      && merge.endRow >= merge.startRow
      && merge.endColumn >= merge.startColumn
    ));
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

function dropRepeatedContinuationPrelude(segmentIndexes, sourceMatrix, mainHeaderSignature) {
  if (!segmentIndexes.length || !mainHeaderSignature.length) return segmentIndexes;
  const maxProbe = Math.min(segmentIndexes.length, 5);
  for (let probe = 0; probe < maxProbe; probe++) {
    const logicalIndex = segmentIndexes[probe];
    const signature = normalizeHeaderSignature(sourceMatrix[logicalIndex] || []);
    if (!signature.length) continue;
    if (sameHeaderSignature(signature, mainHeaderSignature)) {
      return segmentIndexes.slice(probe + 1);
    }
  }
  return segmentIndexes;
}

function normalizeRenderableLayout(renderable) {
  let matrix = renderable.matrix.map(row => [...row]);
  let cells = renderable.cells.map(row => cloneCellRow(row));
  let rowMeta = renderable.rowMeta.map(meta => cloneRowMeta(meta));
  let headerRowIndex = renderable.headerRowIndex;

  ({ matrix, cells, rowMeta, headerRowIndex } = dropBlankRows(matrix, cells, rowMeta, headerRowIndex));
  ({ matrix, cells, rowMeta, headerRowIndex } = dropDecorativeRows(matrix, cells, rowMeta, headerRowIndex));
  collapsePreludeRows(matrix, cells, rowMeta, headerRowIndex);
  ({ matrix, cells, rowMeta, headerRowIndex } = dropDuplicatePreludeRows(matrix, cells, rowMeta, headerRowIndex));
  ({ matrix, cells, rowMeta } = compactColumnsAgainstHeader(matrix, cells, rowMeta, headerRowIndex));

  return { matrix, cells, rowMeta, headerRowIndex };
}

function dropDecorativeRows(matrix, cells, rowMeta, headerRowIndex) {
  const nextMatrix = [];
  const nextCells = [];
  const nextRowMeta = [];
  let nextHeaderIndex = headerRowIndex;

  for (let index = 0; index < matrix.length; index++) {
    const row = matrix[index] || [];
    const text = row.map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
    if (DECORATIVE_ROW_RE.test(text)) {
      if (index < nextHeaderIndex) nextHeaderIndex -= 1;
      continue;
    }
    nextMatrix.push([...row]);
    nextCells.push(cloneCellRow(cells[index]));
    nextRowMeta.push(cloneRowMeta(rowMeta[index]));
  }

  return {
    matrix: nextMatrix,
    cells: nextCells,
    rowMeta: nextRowMeta,
    headerRowIndex: nextHeaderIndex,
  };
}

function resolveSegmentHeaderPosition(segmentIndexes, sourceMatrix, mainHeaderSignature, preferredLogicalHeaderIndex = -1) {
  if (!segmentIndexes.length) return -1;
  if (preferredLogicalHeaderIndex >= 0) {
    const localIndex = segmentIndexes.indexOf(preferredLogicalHeaderIndex);
    if (localIndex >= 0) return localIndex;
  }
  const probeLimit = Math.min(segmentIndexes.length, 5);
  for (let probe = 0; probe < probeLimit; probe++) {
    const signature = normalizeHeaderSignature(sourceMatrix[segmentIndexes[probe]] || []);
    if (sameHeaderSignature(signature, mainHeaderSignature)) return probe;
  }
  return -1;
}

function compactSegmentLeadingColumns(segmentIndexes, sourceMatrix, sourceCells, sourceRowMeta, headerRowIndex) {
  const matrix = segmentIndexes.map(index => [...(sourceMatrix[index] || [])]);
  const cells = segmentIndexes.map(index => cloneCellRow(sourceCells[index]));
  const rowMeta = segmentIndexes.map(index => cloneRowMeta(sourceRowMeta[index]));
  if (headerRowIndex < 0) {
    return { matrix, cells, rowMeta, headerRowIndex };
  }

  const columnCount = Math.max(1, ...matrix.map(row => row.length));
  const paddedMatrix = matrix.map(row => padRow(row, columnCount, ''));
  const paddedCells = cells.map(row => padRow(row, columnCount, createEmptyLayoutCell));
  const paddedMeta = rowMeta.map(meta => ({
    ...meta,
    cellMeta: padRow((meta.cellMeta || []).map(cell => ({ ...(cell || {}) })), columnCount, createEmptyLayoutMeta),
  }));
  const removableLeading = countRemovableLeadingColumns(paddedMatrix, headerRowIndex);
  if (!removableLeading) {
    return { matrix: paddedMatrix, cells: paddedCells, rowMeta: paddedMeta, headerRowIndex };
  }

  for (let rowIndex = headerRowIndex; rowIndex < paddedMatrix.length; rowIndex++) {
    paddedMatrix[rowIndex] = paddedMatrix[rowIndex].slice(removableLeading);
    paddedCells[rowIndex] = paddedCells[rowIndex].slice(removableLeading);
    paddedMeta[rowIndex].cellMeta = paddedMeta[rowIndex].cellMeta.slice(removableLeading);
  }

  return { matrix: paddedMatrix, cells: paddedCells, rowMeta: paddedMeta, headerRowIndex };
}

function dropBlankRows(matrix, cells, rowMeta, headerRowIndex) {
  const nextMatrix = [];
  const nextCells = [];
  const nextRowMeta = [];
  let nextHeaderIndex = headerRowIndex;

  for (let index = 0; index < matrix.length; index++) {
    const row = matrix[index] || [];
    const hasContent = row.some(value => String(value ?? '').trim());
    if (!hasContent) {
      if (index < nextHeaderIndex) nextHeaderIndex -= 1;
      continue;
    }
    nextMatrix.push([...row]);
    nextCells.push(cloneCellRow(cells[index]));
    nextRowMeta.push(cloneRowMeta(rowMeta[index]));
  }

  return {
    matrix: nextMatrix,
    cells: nextCells,
    rowMeta: nextRowMeta,
    headerRowIndex: Math.max(-1, nextHeaderIndex),
  };
}

function collapsePreludeRows(matrix, cells, rowMeta, headerRowIndex) {
  const limit = headerRowIndex < 0 ? matrix.length : headerRowIndex;
  const maxCols = Math.max(1, ...matrix.map(row => row.length));
  for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
    const filled = getFilledColumnIndexes(matrix[rowIndex]);
    if (!filled.length) continue;
    const text = filled.map(columnIndex => String(matrix[rowIndex][columnIndex] ?? '').trim()).join(' ');
    if (/\bjuros sobre verbas\b/i.test(text)) {
      rewritePreludeRow(matrix, cells, rowMeta, rowIndex, ['Demonstrativo de Juros sobre Verbas'], maxCols);
      continue;
    }
    if (filled.length === 2 && /:\s*$/.test(String(matrix[rowIndex][filled[0]] ?? '').trim())) {
      const merged = `${String(matrix[rowIndex][filled[0]] ?? '').trim()} ${String(matrix[rowIndex][filled[1]] ?? '').trim()}`.trim();
      rewritePreludeRow(matrix, cells, rowMeta, rowIndex, [merged], maxCols);
    }
  }
}

function dropDuplicatePreludeRows(matrix, cells, rowMeta, headerRowIndex) {
  const limit = headerRowIndex < 0 ? matrix.length : headerRowIndex;
  const nextMatrix = [];
  const nextCells = [];
  const nextRowMeta = [];
  let nextHeaderIndex = headerRowIndex;
  let previousPreludeText = '';

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex] || [];
    const text = normalizeAsciiText(row.map(value => String(value ?? '').trim()).filter(Boolean).join(' '));
    const inPrelude = rowIndex < limit;
    const isDuplicatePrelude = inPrelude && text && text === previousPreludeText;

    if (isDuplicatePrelude) {
      if (rowIndex < nextHeaderIndex) nextHeaderIndex -= 1;
      continue;
    }

    nextMatrix.push([...row]);
    nextCells.push(cloneCellRow(cells[rowIndex]));
    nextRowMeta.push(cloneRowMeta(rowMeta[rowIndex]));
    if (inPrelude && text) previousPreludeText = text;
  }

  return {
    matrix: nextMatrix,
    cells: nextCells,
    rowMeta: nextRowMeta,
    headerRowIndex: nextHeaderIndex,
  };
}

function rewritePreludeRow(matrix, cells, rowMeta, rowIndex, values, columnCount) {
  matrix[rowIndex] = padRow([...values], columnCount, '');
  const firstCell = cells[rowIndex]?.find(cell => String(cell?.value ?? '').trim()) || cells[rowIndex]?.[0] || {};
  const nextCells = values.map((value, index) => (index === 0 ? { ...firstCell, value, normalizedValue: value } : createEmptyLayoutCell()));
  cells[rowIndex] = padRow(nextCells, columnCount, createEmptyLayoutCell);
  const nextMeta = [...(rowMeta[rowIndex]?.cellMeta || [])].map(cell => ({ ...(cell || {}) }));
  rowMeta[rowIndex] = {
    ...(rowMeta[rowIndex] || {}),
    isTitle: true,
    cellMeta: padRow(nextMeta, columnCount, createEmptyLayoutMeta),
  };
}

function compactColumnsAgainstHeader(matrix, cells, rowMeta, headerRowIndex) {
  if (!Number.isInteger(headerRowIndex) || headerRowIndex < 0) return { matrix, cells, rowMeta };
  const columnCount = Math.max(1, ...matrix.map(row => row.length));
  const normalizedMatrix = matrix.map(row => padRow([...row], columnCount, ''));
  const normalizedCells = cells.map(row => padRow(cloneCellRow(row), columnCount, createEmptyLayoutCell));
  const normalizedRowMeta = rowMeta.map(meta => ({
    ...meta,
    cellMeta: padRow((meta.cellMeta || []).map(cell => ({ ...(cell || {}) })), columnCount, createEmptyLayoutMeta),
  }));
  const removableLeading = countRemovableLeadingColumns(normalizedMatrix, headerRowIndex);

  if (removableLeading > 0) {
    for (let rowIndex = headerRowIndex; rowIndex < normalizedMatrix.length; rowIndex++) {
      normalizedMatrix[rowIndex] = normalizedMatrix[rowIndex].slice(removableLeading);
      normalizedCells[rowIndex] = normalizedCells[rowIndex].slice(removableLeading);
      normalizedRowMeta[rowIndex].cellMeta = normalizedRowMeta[rowIndex].cellMeta.slice(removableLeading);
    }
  }

  trimGloballyEmptyTrailingColumns(normalizedMatrix, normalizedCells, normalizedRowMeta);
  return { matrix: normalizedMatrix, cells: normalizedCells, rowMeta: normalizedRowMeta };
}

function countRemovableLeadingColumns(matrix, headerRowIndex) {
  const headerRow = matrix[headerRowIndex] || [];
  let removable = 0;
  while (removable < headerRow.length && !String(headerRow[removable] ?? '').trim()) {
    const usedLater = matrix.slice(headerRowIndex).some(row => String(row?.[removable] ?? '').trim());
    if (usedLater) break;
    removable += 1;
  }
  return removable;
}

function trimGloballyEmptyTrailingColumns(matrix, cells, rowMeta) {
  let trailing = Math.max(0, ...matrix.map(row => row.length));
  while (trailing > 1) {
    const columnIndex = trailing - 1;
    const hasContent = matrix.some(row => String(row?.[columnIndex] ?? '').trim());
    if (hasContent) break;
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
      matrix[rowIndex].pop();
      cells[rowIndex].pop();
      rowMeta[rowIndex].cellMeta.pop();
    }
    trailing -= 1;
  }
}

function normalizeHeaderSignature(row = []) {
  return row.map(normalizeAsciiText).filter(Boolean);
}

function sameHeaderSignature(left = [], right = []) {
  if (!left.length || !right.length) return false;
  if (left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

function getFilledColumnIndexes(row = []) {
  return row.flatMap((value, index) => (String(value ?? '').trim() ? [index] : []));
}

function padRow(row, targetLength, filler) {
  const output = [...row];
  while (output.length < targetLength) {
    output.push(typeof filler === 'function' ? filler() : filler);
  }
  return output;
}

function createEmptyLayoutCell() {
  return {
    value: '',
    normalizedValue: '',
    sourceItemIds: [],
  };
}

function createEmptyLayoutMeta() {
  return {
    bold: false,
    italic: false,
    fontSize: 0,
    x: 0,
    sourceItemIds: [],
  };
}

function normalizeAsciiText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function harmonizeColumnWidth(baseWidth, profile, index) {
  const contentWidth = Number(profile.widths[index] || 8);
  const fillRatio = Number(profile.fillRatios[index] || 0);
  const maxFromStructure = fillRatio < 0.18
    ? contentWidth + 2
    : fillRatio < 0.32
      ? contentWidth + 3
      : fillRatio < 0.55
        ? contentWidth + 7
        : contentWidth + 10;
  const preferred = Math.min(Number(baseWidth || 0), maxFromStructure);
  return clamp(Math.max(contentWidth, preferred || contentWidth), 5, 52);
}

function shouldIgnoreWidthContribution(row = [], meta = {}) {
  if (meta.isTitle) return true;
  const filled = row.filter(value => String(value ?? '').trim());
  return row.length > 2 && filled.length <= 1;
}

function shouldUseFullRowWidth(row = [], meta = {}) {
  if (meta.isTitle) return true;
  const filled = row.filter(value => String(value ?? '').trim());
  return row.length > 2 && filled.length === 1;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
