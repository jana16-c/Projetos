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
assert.equal(merged.matrix.length, 4);
assert.equal(merged.sourceMatrix.length, 6);
assert.deepEqual(merged.sourcePages, [1, 2]);
assert.equal(merged.pageBreaks[1].removedHeader?.rowIndex, 1);
assert.deepEqual(merged.matrix[3], ['02/2024', 'JOAO', '111.111.111-11', '1.500,00']);

const renderable = buildRenderableTable(merged);
assert.equal(renderable.matrix.length, 4);
assert.deepEqual(renderable.matrix[3], ['02/2024', 'JOAO', '111.111.111-11', '1.500,00']);

const incompatible = makeTable(3, ['codigo', 'valor'], [
  ['CODIGO', 'VALOR'],
  ['1001', '50,00'],
], 0);
assert.equal(canMergeTables(previous, incompatible), false);

const samePagePrevious = makeTable(4, ['periodo', 'base', 'devido'], [
  ['NOME: DIFERENCA DE ADI NOT'],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['01/2015', '302,55', '338,32'],
], 1);
samePagePrevious.bounds = { top: 120, bottom: 410, right: 560 };
samePagePrevious.height = 842;
const samePageCurrent = makeTable(4, ['periodo', 'base', 'devido'], [
  ['((((DIFERENCA DE ADI NOT + REFLE)) / 1,0000) X 1,0000)'],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['04/2015', '278,77', '310,81'],
], 1);
samePageCurrent.bounds = { top: 430, bottom: 700, right: 560 };
samePageCurrent.height = 842;
assert.equal(canMergeTables(samePagePrevious, samePageCurrent), true);
const mergedSamePage = combineTables(samePagePrevious, samePageCurrent);
assert.deepEqual(mergedSamePage.matrix, [
  ['NOME: DIFERENCA DE ADI NOT', '', ''],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['01/2015', '302,55', '338,32'],
  ['04/2015', '278,77', '310,81'],
]);

const previousWithFooter = makeTable(5, ['periodo', 'base', 'devido'], [
  ['NOME: DIFERENCA DE ADI NOT'],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['03/2015', '329,29', '366,29'],
  ['Calculo liquidado por offline. Pag. 7 de 25'],
], 1);
previousWithFooter.bounds = { top: 120, bottom: 760, right: 560 };
previousWithFooter.height = 842;
const currentAfterFooter = makeTable(6, ['periodo', 'base', 'devido'], [
  ['((((DIFERENCA DE ADI NOT + REFLE)) / 1,0000) X 1,0000)'],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['04/2015', '278,77', '310,81'],
], 1);
currentAfterFooter.bounds = { top: 40, bottom: 280, right: 560 };
currentAfterFooter.height = 842;

assert.equal(canMergeTables(previousWithFooter, currentAfterFooter), true);
const mergedAcrossPages = combineTables(previousWithFooter, currentAfterFooter);
assert.deepEqual(mergedAcrossPages.matrix, [
  ['NOME: DIFERENCA DE ADI NOT', '', ''],
  ['Periodo Mensal', 'Base', 'Devido'],
  ['03/2015', '329,29', '366,29'],
  ['04/2015', '278,77', '310,81'],
]);
assert.deepEqual(mergedAcrossPages.mergeDecisions.at(-1)?.droppedTrailingRows, [3]);

const shiftedPrevious = makeTable(7, ['periodo mensal', 'base', 'devido'], [
  ['Nome:', 'DIFERENCA DE ADI NOT', '', ''],
  ['', 'Periodo Mensal', 'Base', 'Devido'],
  ['', '03/2015', '329,29', '366,29'],
], 1);
shiftedPrevious.bounds = { top: 120, bottom: 760, right: 560 };
shiftedPrevious.height = 842;
shiftedPrevious.columnModel = { anchors: [{ x: 20 }, { x: 140 }, { x: 260 }, { x: 380 }] };
const shiftedCurrent = makeTable(8, ['periodo mensal', 'base', 'devido'], [
  ['Periodo Mensal', 'Base', 'Devido'],
  ['04/2015', '278,77', '310,81'],
], 0);
shiftedCurrent.bounds = { top: 40, bottom: 280, right: 560 };
shiftedCurrent.height = 842;
shiftedCurrent.columnModel = { anchors: [{ x: 140 }, { x: 260 }, { x: 380 }] };
assert.equal(canMergeTables(shiftedPrevious, shiftedCurrent), true);
const mergedShifted = combineTables(shiftedPrevious, shiftedCurrent);
assert.deepEqual(mergedShifted.matrix, [
  ['Nome:', 'DIFERENCA DE ADI NOT', '', ''],
  ['', 'Periodo Mensal', 'Base', 'Devido'],
  ['', '03/2015', '329,29', '366,29'],
  ['', '04/2015', '278,77', '310,81'],
]);
assert.equal(mergedShifted.mergeDecisions.at(-1)?.alignmentOffset, 1);

console.log('continuation.test.mjs OK');

function makeTable(pageNumber, headerSignature, matrix, headerRowIndex) {
  return {
    pageNumber,
    width: 595,
    bounds: { right: 560 },
    matrix,
    sourceMatrix: matrix,
    displayMatrix: matrix,
    cells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
      value,
      normalizedValue: value,
      sourcePage: pageNumber,
      sourceItemIds: [`${pageNumber}:${rowIndex}:${columnIndex}`],
    }))),
    sourceCells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
      value,
      normalizedValue: value,
      sourcePage: pageNumber,
      sourceItemIds: [`${pageNumber}:${rowIndex}:${columnIndex}`],
    }))),
    displayCells: matrix.map((row, rowIndex) => row.map((value, columnIndex) => ({
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
    sourceRowMeta: matrix.map((row, rowIndex) => ({
      cellMeta: [],
      isTitle: rowIndex === 0,
      isHeader: rowIndex === headerRowIndex,
    })),
    displayRowMeta: matrix.map((row, rowIndex) => ({
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
