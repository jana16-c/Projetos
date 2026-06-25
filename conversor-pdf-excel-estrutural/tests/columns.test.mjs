import assert from 'node:assert/strict';
import { buildRows } from '../assets/js/extraction/rows.js';
import { buildColumnModel, rowsToMatrix } from '../assets/js/extraction/columns.js';

const items = [
  makeItem('CODIGO', 40, 80),
  makeItem('DESCRICAO', 150, 80),
  makeItem('BASE', 340, 80),
  makeItem('VALOR', 470, 80),
  makeItem('1001', 40, 100),
  makeItem('FGTS', 150, 100),
  makeItem('1.200,00', 340, 100),
  makeItem('96,00', 470, 100),
  makeItem('1002', 40, 120),
  makeItem('INSS', 150, 120),
  makeItem('1.200,00', 340, 120),
  makeItem('120,00', 470, 120),
];

const { rows } = buildRows(items, { rowTolerance: 0.62, gapFactor: 2.3 });
const model = buildColumnModel(rows, 595, { mode: 'structural', columnTolerance: 9 });
const matrix = rowsToMatrix(rows, model);

assert.ok(model.columnCount >= 4);
assert.equal(matrix.matrix[1][3], '96,00');
assert.equal(matrix.rowMeta[0].isProbablyHeader, true);

console.log('columns.test.mjs OK');

function makeItem(text, x, y) {
  return {
    id: `${text}-${x}-${y}`,
    pageNumber: 1,
    index: 0,
    text,
    rawText: text,
    x,
    y,
    width: Math.max(30, text.length * 4.8),
    height: 10,
    right: x + Math.max(30, text.length * 4.8),
    bottom: y + 10,
    fontName: y === 80 ? 'Inter-Bold' : 'Inter-Regular',
    fontSize: y === 80 ? 11 : 10,
  };
}
