import { detectHeaderSignature } from './headerSignature.js';
import { attachCellClassification } from './valueClassifier.js';

export function buildTablesFromVisualGrid(pageData, settings = {}) {
  const visualTables = Array.isArray(pageData?.visualTables) ? pageData.visualTables : [];
  if (!visualTables.length) return [];

  return visualTables.map((visualTable, tableIndex) => buildVisualTable(pageData, visualTable, tableIndex));
}

function buildVisualTable(pageData, visualTable, tableIndex) {
  const rowCount = Number(visualTable.rows || 0);
  const columnCount = Number(visualTable.columns || 0);
  const matrix = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''));
  const cells = Array.from({ length: rowCount }, (_, rowIndex) => Array.from({ length: columnCount }, (_, columnIndex) => emptyCell(pageData, visualTable, rowIndex, columnIndex)));
  const rowMeta = Array.from({ length: rowCount }, (_, rowIndex) => ({
    y: visualTable.cells?.find(cell => cell.row === rowIndex)?.y || 0,
    isBold: false,
    isItalic: false,
    maxFontSize: 8,
    sourceText: '',
    cellMeta: Array.from({ length: columnCount }, () => ({})),
    isTitle: false,
    isProbablyHeader: false,
  }));
  const merges = [];

  for (const cell of visualTable.cells || []) {
    const rowIndex = Number(cell.row || 0);
    const columnIndex = Number(cell.column || 0);
    if (!cells[rowIndex]?.[columnIndex]) continue;

    const target = cells[rowIndex][columnIndex];
    target.x = Number(cell.x || 0);
    target.y = Number(cell.y || 0);
    target.width = Number(cell.width || 0);
    target.height = Number(cell.height || 0);
    target.right = target.x + target.width;
    target.bottom = target.y + target.height;
    target.style = { ...(cell.style || {}) };
    target.rowSpan = Number(cell.rowSpan || 1);
    target.columnSpan = Number(cell.columnSpan || 1);

    rowMeta[rowIndex].cellMeta[columnIndex] = {
      x: target.x,
      fontSize: 8,
      sourcePage: pageData.pageNumber,
      sourceItemIds: [],
      fillArgb: target.style.fillArgb || null,
      borders: target.style.borders || {},
    };

    if ((target.rowSpan || 1) > 1 || (target.columnSpan || 1) > 1) {
      merges.push({
        startRow: rowIndex,
        startColumn: columnIndex,
        endRow: rowIndex + Math.max(0, (target.rowSpan || 1) - 1),
        endColumn: columnIndex + Math.max(0, (target.columnSpan || 1) - 1),
      });
    }
  }

  const sortedItems = [...(pageData.items || [])].sort((left, right) => {
    const lineDelta = Number(left.lineNumber || 0) - Number(right.lineNumber || 0);
    return lineDelta || (left.y - right.y) || (left.x - right.x) || (left.index - right.index);
  });

  for (const item of sortedItems) {
    const centerX = item.x + (item.width / 2);
    const centerY = item.y + (item.height / 2);
    const cell = findCellByCenter(cells, centerX, centerY);
    if (!cell) continue;

    const currentValue = String(cell.value || '').trim();
    cell.value = currentValue ? `${currentValue} ${item.text}`.replace(/\s+/g, ' ').trim() : item.text;
    cell.rawText = cell.value;
    cell.normalizedValue = cell.value;
    cell.sourceItemIds = [...new Set([...(cell.sourceItemIds || []), item.id])];
    cell.sourceType = item.sourceType || 'pdf-text';

    const rowIndex = cell.rowIndex;
    const columnIndex = cell.columnIndex;
    matrix[rowIndex][columnIndex] = cell.value;
    rowMeta[rowIndex].cellMeta[columnIndex].sourceItemIds = [...cell.sourceItemIds];
    rowMeta[rowIndex].cellMeta[columnIndex].fontSize = Math.max(rowMeta[rowIndex].cellMeta[columnIndex].fontSize || 0, Number(item.fontSize || 0));
    rowMeta[rowIndex].maxFontSize = Math.max(rowMeta[rowIndex].maxFontSize || 0, Number(item.fontSize || 0));
  }

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    rowMeta[rowIndex].sourceText = matrix[rowIndex].filter(Boolean).join(' ');
    rowMeta[rowIndex].isProbablyHeader = rowMeta[rowIndex].cellMeta.some(meta => meta.fillArgb && meta.fillArgb !== 'FFFFFFFF');
  }

  const headerInfo = detectHeaderSignature(matrix, rowMeta);
  const typedCells = attachCellClassification(matrix, cells, headerInfo.headerRowIndex).map((row, rowIndex) => row.map((cell, columnIndex) => ({
    ...cell,
    style: cells[rowIndex][columnIndex].style,
    rowSpan: cells[rowIndex][columnIndex].rowSpan || 1,
    columnSpan: cells[rowIndex][columnIndex].columnSpan || 1,
  })));

  return {
    id: `P${pageData.pageNumber}_VT${tableIndex + 1}`,
    pageNumber: pageData.pageNumber,
    tableIndex: tableIndex + 1,
    sourcePages: [pageData.pageNumber],
    matrix,
    cells: typedCells,
    rowMeta,
    bounds: visualTable.bounds || inferBounds(visualTable),
    columnModel: {
      anchors: deriveAnchors(visualTable, columnCount),
      columnCount,
      confidence: Number(visualTable.confidence || 0.9),
      warnings: [...(visualTable.warnings || [])],
    },
    headerSignature: headerInfo.signature,
    headerRowIndex: headerInfo.headerRowIndex,
    confidence: Number(visualTable.confidence || 0.9),
    warnings: [...(visualTable.warnings || [])],
    continuedFromPreviousPage: false,
    continuesOnNextPage: false,
    width: pageData.width,
    height: pageData.height,
    pageBreaks: [{
      pageNumber: pageData.pageNumber,
      startRow: 0,
      rowCount: matrix.length,
      removedHeader: null,
      originalRowCount: matrix.length,
    }],
    visualModel: {
      columnWidthsPt: deriveColumnWidths(visualTable, columnCount),
      rowHeightsPt: deriveRowHeights(visualTable, rowCount),
      merges,
      sourceBounds: visualTable.bounds || inferBounds(visualTable),
      gridConfidence: Number(visualTable.confidence || 0.9),
    },
  };
}

function emptyCell(pageData, visualTable, rowIndex, columnIndex) {
  return {
    rowIndex,
    columnIndex,
    value: '',
    rawText: '',
    normalizedValue: '',
    type: 'empty',
    preserveAsText: false,
    sourcePage: pageData.pageNumber,
    sourceItemIds: [],
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    confidence: Number(visualTable.confidence || 0.9),
    style: {},
    rowSpan: 1,
    columnSpan: 1,
  };
}

function findCellByCenter(cells, centerX, centerY) {
  for (const row of cells) {
    for (const cell of row) {
      if (cell.x <= centerX && centerX <= cell.right && cell.y <= centerY && centerY <= cell.bottom) {
        return cell;
      }
    }
  }
  return null;
}

function deriveAnchors(visualTable, columnCount) {
  const anchors = [];
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const first = (visualTable.cells || []).find(cell => Number(cell.column || 0) === columnIndex);
    anchors.push({ x: Number(first?.x || 0), support: 1, score: 1 });
  }
  return anchors;
}

function deriveColumnWidths(visualTable, columnCount) {
  const widths = Array.from({ length: columnCount }, () => 0);
  for (const cell of visualTable.cells || []) {
    const index = Number(cell.column || 0);
    const span = Math.max(1, Number(cell.columnSpan || 1));
    const widthPerColumn = Number(cell.width || 0) / span;
    for (let offset = 0; offset < span; offset++) {
      widths[index + offset] = Math.max(widths[index + offset], widthPerColumn);
    }
  }
  return widths;
}

function deriveRowHeights(visualTable, rowCount) {
  const heights = Array.from({ length: rowCount }, () => 0);
  for (const cell of visualTable.cells || []) {
    const index = Number(cell.row || 0);
    heights[index] = Math.max(heights[index], Number(cell.height || 0));
  }
  return heights;
}

function inferBounds(visualTable) {
  const cells = visualTable.cells || [];
  return {
    left: Math.min(...cells.map(cell => Number(cell.x || 0)), 0),
    right: Math.max(...cells.map(cell => Number(cell.x || 0) + Number(cell.width || 0)), 0),
    top: Math.min(...cells.map(cell => Number(cell.y || 0)), 0),
    bottom: Math.max(...cells.map(cell => Number(cell.y || 0) + Number(cell.height || 0)), 0),
  };
}
