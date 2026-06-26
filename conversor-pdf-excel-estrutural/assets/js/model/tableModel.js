import { detectHeaderSignature } from '../extraction/headerSignature.js';
import { attachCellClassification } from '../extraction/valueClassifier.js';
import { combineTables } from '../extraction/tableContinuation.js';
import { reindexTables } from './resultModel.js';

export function updateCell(table, rowIndex, columnIndex, value) {
  withHistory(table, 'edit-cell', { row: rowIndex, column: columnIndex, oldValue: table.matrix[rowIndex]?.[columnIndex] || '', newValue: value }, () => {
    ensureShape(table);
    table.matrix[rowIndex][columnIndex] = value;
    refreshTable(table);
  });
}

export function addRow(table, rowIndex = table.matrix.length - 1) {
  withHistory(table, 'add-row', { row: rowIndex + 1 }, () => {
    ensureShape(table);
    const width = Math.max(...table.matrix.map(row => row.length), 1);
    table.matrix.splice(rowIndex + 1, 0, Array.from({ length: width }, () => ''));
    table.cells.splice(rowIndex + 1, 0, Array.from({ length: width }, () => emptyCell(table)));
    table.rowMeta.splice(rowIndex + 1, 0, emptyRowMeta());
    touchPageBreaks(table, true);
    refreshTable(table);
  });
}

export function deleteRow(table, rowIndex = table.matrix.length - 1) {
  if (table.matrix.length <= 1) return;
  withHistory(table, 'delete-row', { row: rowIndex }, () => {
    table.matrix.splice(rowIndex, 1);
    table.cells.splice(rowIndex, 1);
    table.rowMeta.splice(rowIndex, 1);
    touchPageBreaks(table, true);
    refreshTable(table);
  });
}

export function addColumn(table, columnIndex = -1) {
  withHistory(table, 'add-column', { column: columnIndex + 1 }, () => {
    ensureShape(table);
    for (let rowIndex = 0; rowIndex < table.matrix.length; rowIndex++) {
      table.matrix[rowIndex].splice(columnIndex + 1, 0, '');
      table.cells[rowIndex].splice(columnIndex + 1, 0, emptyCell(table));
      table.rowMeta[rowIndex].cellMeta.splice(columnIndex + 1, 0, {});
    }
    touchPageBreaks(table, true);
    refreshTable(table);
  });
}

export function deleteColumn(table, columnIndex) {
  const maxColumns = Math.max(...table.matrix.map(row => row.length), 1);
  if (maxColumns <= 1) return;
  const targetIndex = columnIndex >= 0 ? columnIndex : maxColumns - 1;
  withHistory(table, 'delete-column', { column: targetIndex }, () => {
    for (let rowIndex = 0; rowIndex < table.matrix.length; rowIndex++) {
      table.matrix[rowIndex].splice(targetIndex, 1);
      table.cells[rowIndex].splice(targetIndex, 1);
      table.rowMeta[rowIndex].cellMeta.splice(targetIndex, 1);
    }
    touchPageBreaks(table, true);
    refreshTable(table);
  });
}

export function undoTableChange(table) {
  const entry = table.history?.pop();
  if (!entry) return false;
  restoreSnapshot(table, entry.snapshot);
  return true;
}

export function resetTable(table) {
  if (!table.initialState) return false;
  table.history = [];
  restoreSnapshot(table, cloneSnapshot(table.initialState));
  return true;
}

export function markFirstRowAsHeader(table) {
  if (!table.rowMeta.length) return;
  withHistory(table, 'mark-header', { row: 0 }, () => {
    table.rowMeta = table.rowMeta.map((meta, index) => ({
      ...meta,
      isProbablyHeader: index === 0,
      isTitle: index === 0 ? false : meta.isTitle,
    }));
    refreshTable(table);
  });
}

export function mergeTableIntoPrevious(documentResult, tableId) {
  const index = documentResult.tables.findIndex(table => table.id === tableId);
  if (index <= 0) return false;
  const merged = combineTables(documentResult.tables[index - 1], documentResult.tables[index]);
  merged.initialState = buildSnapshot(merged);
  merged.history = [];
  documentResult.tables.splice(index - 1, 2, merged);
  documentResult.tables = reindexTables(documentResult.tables);
  documentResult.manualChanges.push({
    action: 'merge-table',
    tableId,
    timestamp: new Date().toISOString(),
  });
  return true;
}

export function splitTableFromPrevious(documentResult, tableId) {
  const index = documentResult.tables.findIndex(table => table.id === tableId);
  if (index < 0) return false;
  const table = documentResult.tables[index];
  if (!table.pageBreaks || table.pageBreaks.length <= 1) return false;

  const rebuilt = [];
  let pointer = 0;

  for (const pageBreak of table.pageBreaks) {
    const matrix = table.matrix.slice(pointer, pointer + pageBreak.rowCount);
    const cells = table.cells.slice(pointer, pointer + pageBreak.rowCount);
    const rowMeta = table.rowMeta.slice(pointer, pointer + pageBreak.rowCount);
    pointer += pageBreak.rowCount;

    if (pageBreak.removedHeader) {
      matrix.unshift(pageBreak.removedHeader.row);
      cells.unshift(pageBreak.removedHeader.cells);
      rowMeta.unshift(pageBreak.removedHeader.rowMeta);
    }

    const part = {
      ...table,
      pageNumber: pageBreak.pageNumber,
      sourcePages: [pageBreak.pageNumber],
      matrix,
      cells,
      rowMeta,
      continuedFromPreviousPage: pageBreak.pageNumber !== table.pageBreaks[0].pageNumber,
      continuesOnNextPage: pageBreak !== table.pageBreaks[table.pageBreaks.length - 1],
      pageBreaks: [{
        pageNumber: pageBreak.pageNumber,
        startRow: 0,
        rowCount: matrix.length,
        removedHeader: null,
        originalRowCount: matrix.length,
      }],
      history: [],
    };
    refreshTable(part);
    part.initialState = buildSnapshot(part);
    rebuilt.push(part);
  }

  documentResult.tables.splice(index, 1, ...rebuilt);
  documentResult.tables = reindexTables(documentResult.tables);
  documentResult.manualChanges.push({
    action: 'split-table',
    tableId,
    timestamp: new Date().toISOString(),
  });
  return true;
}

export function buildSnapshot(table) {
  return {
    matrix: table.matrix.map(row => [...row]),
    cells: table.cells.map(row => row.map(cell => ({ ...cell }))),
    rowMeta: table.rowMeta.map(meta => ({
      ...meta,
      cellMeta: (meta.cellMeta || []).map(cell => ({ ...cell })),
    })),
    headerSignature: [...(table.headerSignature || [])],
    headerRowIndex: table.headerRowIndex,
    pageBreaks: (table.pageBreaks || []).map(pageBreak => ({
      ...pageBreak,
      removedHeader: pageBreak.removedHeader ? {
        row: [...pageBreak.removedHeader.row],
        cells: pageBreak.removedHeader.cells.map(cell => ({ ...cell })),
        rowMeta: {
          ...pageBreak.removedHeader.rowMeta,
          cellMeta: (pageBreak.removedHeader.rowMeta?.cellMeta || []).map(cell => ({ ...cell })),
        },
        rowIndex: pageBreak.removedHeader.rowIndex ?? 0,
      } : null,
    })),
  };
}

function withHistory(table, action, payload, callback) {
  table.history = table.history || [];
  table.history.push({
    action,
    ...payload,
    timestamp: new Date().toISOString(),
    snapshot: buildSnapshot(table),
  });
  callback();
}

function refreshTable(table) {
  ensureShape(table);
  const headerInfo = detectHeaderSignature(table.matrix, table.rowMeta);
  table.headerRowIndex = headerInfo.headerRowIndex;
  table.headerSignature = headerInfo.signature;
  table.cells = attachCellClassification(table.matrix, table.cells, table.headerRowIndex);
}

function ensureShape(table) {
  const width = Math.max(...table.matrix.map(row => row.length), 1);

  while (table.rowMeta.length < table.matrix.length) table.rowMeta.push(emptyRowMeta());
  while (table.cells.length < table.matrix.length) table.cells.push(Array.from({ length: width }, () => emptyCell(table)));

  for (let rowIndex = 0; rowIndex < table.matrix.length; rowIndex++) {
    while (table.matrix[rowIndex].length < width) table.matrix[rowIndex].push('');
    table.rowMeta[rowIndex].cellMeta = table.rowMeta[rowIndex].cellMeta || [];
    while (table.rowMeta[rowIndex].cellMeta.length < width) table.rowMeta[rowIndex].cellMeta.push({});
    while (table.cells[rowIndex].length < width) table.cells[rowIndex].push(emptyCell(table));
  }
}

function touchPageBreaks(table, structuralChange) {
  if (!structuralChange || !table.pageBreaks?.length) return;
  table.pageBreaks = [{
    pageNumber: table.pageNumber,
    startRow: 0,
    rowCount: table.matrix.length,
    removedHeader: null,
    originalRowCount: table.matrix.length,
  }];
}

function restoreSnapshot(table, snapshot) {
  table.matrix = snapshot.matrix.map(row => [...row]);
  table.cells = snapshot.cells.map(row => row.map(cell => ({ ...cell })));
  table.rowMeta = snapshot.rowMeta.map(meta => ({
    ...meta,
    cellMeta: (meta.cellMeta || []).map(cell => ({ ...cell })),
  }));
  table.headerSignature = [...(snapshot.headerSignature || [])];
  table.headerRowIndex = snapshot.headerRowIndex ?? -1;
  table.pageBreaks = (snapshot.pageBreaks || []).map(pageBreak => ({
    ...pageBreak,
    removedHeader: pageBreak.removedHeader ? {
      row: [...pageBreak.removedHeader.row],
      cells: pageBreak.removedHeader.cells.map(cell => ({ ...cell })),
      rowMeta: {
        ...pageBreak.removedHeader.rowMeta,
        cellMeta: (pageBreak.removedHeader.rowMeta?.cellMeta || []).map(cell => ({ ...cell })),
      },
      rowIndex: pageBreak.removedHeader.rowIndex ?? 0,
    } : null,
  }));
}

function cloneSnapshot(snapshot) {
  return {
    ...snapshot,
    matrix: snapshot.matrix.map(row => [...row]),
    cells: snapshot.cells.map(row => row.map(cell => ({ ...cell }))),
    rowMeta: snapshot.rowMeta.map(meta => ({
      ...meta,
      cellMeta: (meta.cellMeta || []).map(cell => ({ ...cell })),
    })),
    pageBreaks: (snapshot.pageBreaks || []).map(pageBreak => ({
      ...pageBreak,
      removedHeader: pageBreak.removedHeader ? {
        row: [...pageBreak.removedHeader.row],
        cells: pageBreak.removedHeader.cells.map(cell => ({ ...cell })),
        rowMeta: {
          ...pageBreak.removedHeader.rowMeta,
          cellMeta: (pageBreak.removedHeader.rowMeta?.cellMeta || []).map(cell => ({ ...cell })),
        },
        rowIndex: pageBreak.removedHeader.rowIndex ?? 0,
      } : null,
    })),
  };
}

function emptyCell(table) {
  return {
    value: '',
    normalizedValue: '',
    type: 'empty',
    numberFormat: null,
    preserveAsText: false,
    sourcePage: table.pageNumber,
    sourceItemIds: [],
    x: 0,
    y: 0,
    confidence: table.confidence || 0,
  };
}

function emptyRowMeta() {
  return {
    isBold: false,
    isItalic: false,
    isTitle: false,
    isProbablyHeader: false,
    maxFontSize: 10,
    cellMeta: [],
  };
}
