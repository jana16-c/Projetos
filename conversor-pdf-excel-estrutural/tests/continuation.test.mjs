import assert from 'node:assert/strict';
import { canMergeTables, combineTables } from '../assets/js/extraction/tableContinuation.js';
import { buildRenderableTable } from '../assets/js/export/tableLayout.js';

const previous = makeTable(1, ['competencia', 'empregado', 'cpf', 'devido'], [
  ['QUADRO GERAL'],
  ['COMPETENCIA', 'EMPREGADO', 'CPF', 'DEVIDO'],
  ['01/2024', 'MARIA', '000.000.000-00', '1.200,00'],
], 1);
const current = makeTable(2, ['competencia', 'empregado', 'cpf', 'devido'], [
  ['QUADRO GERAL'],
  ['COMPETENCIA', 'EMPREGADO', 'CPF', 'DEVIDO'],
  ['02/2024', 'JOAO', '111.111.111-11', '1.500,00'],
], 1);

assert.equal(canMergeTables(previous, current), true);

const merged = combineTables(previous, current);
assert.equal(merged.matrix.length, 5);
assert.deepEqual(merged.sourcePages, [1, 2]);
assert.equal(merged.pageBreaks[1].removedHeader?.rowIndex, 1);
assert.deepEqual(merged.matrix[3], ['QUADRO GERAL']);

const renderable = buildRenderableTable(merged);
assert.equal(renderable.matrix.length, 5);
assert.deepEqual(renderable.matrix[4], ['02/2024', 'JOAO', '111.111.111-11', '1.500,00']);

const incompatible = makeTable(3, ['codigo', 'valor'], [
  ['CODIGO', 'VALOR'],
  ['1001', '50,00'],
], 0);
assert.equal(canMergeTables(previous, incompatible), false);

console.log('continuation.test.mjs OK');

function makeTable(pageNumber, headerSignature, matrix, headerRowIndex) {
  return {
    pageNumber,
    width: 595,
    bounds: { right: 560 },
    matrix,
    cells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
      value,
      normalizedValue: value,
      sourcePage: pageNumber,
      sourceItemIds: [`${pageNumber}:${rowIndex}:${columnIndex}`],
    }))),
    rowMeta: matrix.map((row, rowIndex) => ({
      cellMeta: [],
      isTitle: rowIndex === 0,
      isHeader: rowIndex === headerRowIndex,
    })),
    sourcePages: [pageNumber],
    headerSignature,
    headerRowIndex,
    columnModel: { anchors: [{ x: 40 }, { x: 160 }, { x: 320 }, { x: 460 }] },
    confidence: 0.82,
    warnings: [],
    pageBreaks: [{
      pageNumber,
      startRow: 0,
      rowCount: matrix.length,
      removedHeader: null,
      originalRowCount: matrix.length,
    }],
  };
}
