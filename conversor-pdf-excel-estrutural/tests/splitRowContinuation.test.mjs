import assert from 'node:assert/strict';
import { mergeSplitBoundaryRow } from '../assets/js/extraction/splitRowContinuation.js';

const merged = mergeSplitBoundaryRow(
  makeTable(1, [['MARIA', '123.456.789-00', '02/2024', '', '']]),
  makeTable(2, [['', '', '', '1.250,00', '250,00']]),
);

assert.equal(merged.merged, true);
assert.equal(merged.continuedRowIndex, 0);
assert.deepEqual(merged.previousMatrix[0], ['MARIA', '123.456.789-00', '02/2024', '1.250,00', '250,00']);
assert.equal(merged.previousRowMeta[0].continuedAcrossPage, true);
assert.deepEqual(merged.previousRowMeta[0].sourcePages, [1, 2]);
assert.equal(merged.currentMatrix.length, 0);

const conflict = mergeSplitBoundaryRow(
  makeTable(1, [['MARIA', '123.456.789-00', '02/2024', '900,00', '']]),
  makeTable(2, [['', '', '', '1.250,00', '250,00']]),
);

assert.equal(conflict.merged, false);
assert.match(conflict.warning || '', /Conflito|Confianca/i);

console.log('splitRowContinuation.test.mjs OK');

function makeTable(pageNumber, matrix) {
  return {
    pageNumber,
    sourcePages: [pageNumber],
    height: 842,
    bounds: {
      top: pageNumber === 1 ? 760 : 20,
      bottom: pageNumber === 1 ? 828 : 110,
    },
    matrix,
    cells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
      value,
      normalizedValue: value,
      sourcePage: pageNumber,
      sourceItemIds: [`${pageNumber}:${rowIndex}:${columnIndex}`],
      x: 40 + (columnIndex * 120),
      y: (pageNumber === 1 ? 780 : 40) + (rowIndex * 14),
      width: 90,
      height: 10,
      right: 130 + (columnIndex * 120),
      bottom: (pageNumber === 1 ? 790 : 50) + (rowIndex * 14),
      confidence: 0.9,
    }))),
    rowMeta: matrix.map(() => ({ cellMeta: [], isProbablyHeader: false })),
    headerRowIndex: -1,
  };
}
