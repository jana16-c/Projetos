import assert from 'node:assert/strict';
import { mergeContinuationTables } from '../assets/js/extraction/tableContinuation.js';

const tables = [1, 2, 3].map(pageNumber => makeTable(pageNumber, [
  ['COMPETENCIA', 'EMPREGADO', 'VALOR'],
  [`0${pageNumber}/2024`, `NOME ${pageNumber}`, `${pageNumber}.000,00`],
]));

const merged = mergeContinuationTables(tables, { mergeContinuation: true });

assert.equal(merged.length, 1);
assert.deepEqual(merged[0].sourcePages, [1, 2, 3]);
assert.equal(merged[0].matrix.length, 4);
assert.deepEqual(merged[0].matrix[0], ['COMPETENCIA', 'EMPREGADO', 'VALOR']);
assert.deepEqual(merged[0].matrix[3], ['03/2024', 'NOME 3', '3.000,00']);

console.log('continuationThreePages.test.mjs OK');

function makeTable(pageNumber, matrix) {
  return {
    id: `P${pageNumber}_T1`,
    pageNumber,
    sourcePages: [pageNumber],
    width: 595,
    height: 842,
    bounds: { top: 40, bottom: 820, right: 560 },
    matrix,
    cells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
      value,
      normalizedValue: value,
      sourcePage: pageNumber,
      sourceItemIds: [`${pageNumber}:${rowIndex}:${columnIndex}`],
      x: 40 + (columnIndex * 120),
      y: 70 + (rowIndex * 20),
      width: 100,
      height: 10,
      confidence: 0.9,
    }))),
    rowMeta: matrix.map((row, rowIndex) => ({
      isProbablyHeader: rowIndex === 0,
      cellMeta: [],
    })),
    columnModel: { anchors: [{ x: 40 }, { x: 180 }, { x: 340 }] },
    headerSignature: ['competencia', 'empregado', 'valor'],
    headerRowIndex: 0,
    confidence: 0.88,
    warnings: [],
    continuedFromPreviousPage: pageNumber > 1,
    continuesOnNextPage: pageNumber < 3,
    pageBreaks: [{
      pageNumber,
      startRow: 0,
      rowCount: matrix.length,
      removedHeader: null,
      originalRowCount: matrix.length,
    }],
  };
}
