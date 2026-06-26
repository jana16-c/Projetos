import assert from 'node:assert/strict';
import { buildHorizontalMerges, buildRenderableTable, buildTableMerges, deriveColumnWidths, deriveRowHeights } from '../assets/js/export/tableLayout.js';

const table = {
  pageNumber: 5,
  bounds: { right: 590 },
  headerRowIndex: 0,
  matrix: [
    ['PERIODO', 'BASE', 'PAGO'],
    ['01/2024', '100,00', '50,00'],
    ['02/2024', '200,00', '75,00'],
  ],
  cells: [
    [{ value: 'PERIODO' }, { value: 'BASE' }, { value: 'PAGO' }],
    [{ value: '01/2024' }, { value: '100,00' }, { value: '50,00' }],
    [{ value: '02/2024' }, { value: '200,00' }, { value: '75,00' }],
  ],
  rowMeta: [
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
    { cellMeta: [] },
  ],
  pageBreaks: [{
    pageNumber: 5,
    startRow: 0,
    rowCount: 1,
    removedHeader: null,
  }, {
    pageNumber: 6,
    startRow: 1,
    rowCount: 2,
    removedHeader: {
      row: ['PERIODO', 'BASE', 'PAGO'],
      cells: [{ value: 'PERIODO' }, { value: 'BASE' }, { value: 'PAGO' }],
      rowMeta: { isHeader: true, cellMeta: [] },
      rowIndex: 0,
    },
  }],
  columnModel: { anchors: [{ x: 40 }, { x: 210 }, { x: 360 }] },
  visualModel: {
    columnWidthsPt: [120, 110, 100],
    rowHeightsPt: [28, 20, 22],
    merges: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 }],
  },
};

const renderable = buildRenderableTable(table);
assert.deepEqual(renderable.matrix, [
  ['PERIODO', 'BASE', 'PAGO'],
  ['01/2024', '100,00', '50,00'],
  ['02/2024', '200,00', '75,00'],
]);
assert.equal(renderable.rowMeta[1].isRepeatedHeader, undefined);

const widths = deriveColumnWidths(table, 3);
assert.equal(widths.length, 3);
assert.ok(widths[0] >= 2);
assert.ok(widths[1] >= 2);

const heights = deriveRowHeights(table, 3);
assert.deepEqual(heights, [28, 20, 22]);

const visualMerges = buildTableMerges(table, renderable);
assert.deepEqual(visualMerges, [
  { startRow: 0, endRow: 0, startColumn: 0, endColumn: 2 },
]);

const merges = buildHorizontalMerges([
  ['A', '', '', 'B', '', 'C'],
  ['Titulo', '', '', '', '', ''],
]);
assert.deepEqual(merges, [
  { rowIndex: 0, startColumn: 0, endColumn: 2 },
  { rowIndex: 0, startColumn: 3, endColumn: 4 },
  { rowIndex: 1, startColumn: 0, endColumn: 5 },
]);

console.log('tableLayout.test.mjs OK');
