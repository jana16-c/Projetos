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

const sparseLeadingColumnTable = {
  matrix: [
    ['Nome:', 'DIFERENCA DE ADI NOT + REFLE', '', ''],
    ['', 'Periodo Mensal', 'Base', 'Devido'],
    ['', '03/2015', '329,29', '366,29'],
    ['', '04/2015', '278,77', '310,81'],
  ],
  rowMeta: [
    { isTitle: false, cellMeta: [] },
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
    { cellMeta: [] },
  ],
  displayMatrix: [
    ['Nome:', 'DIFERENCA DE ADI NOT + REFLE', '', ''],
    ['', 'Periodo Mensal', 'Base', 'Devido'],
    ['', '03/2015', '329,29', '366,29'],
    ['', '04/2015', '278,77', '310,81'],
  ],
  displayRowMeta: [
    { isTitle: false, cellMeta: [] },
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
    { cellMeta: [] },
  ],
  columnModel: { anchors: [{ x: 20 }, { x: 220 }, { x: 320 }, { x: 420 }] },
};
const moderatedWidths = deriveColumnWidths(sparseLeadingColumnTable, 4);
assert.ok(moderatedWidths[0] <= 11);
assert.ok(moderatedWidths[1] <= 32);

const titleHeightTable = {
  matrix: [['((((DIFERENCA DE ADI NOT + REFLE (CALCULO HOMOLOGADO)) / 1,0000) X 1,00000000) X 1,0000)', '', '', '']],
  displayMatrix: [['((((DIFERENCA DE ADI NOT + REFLE (CALCULO HOMOLOGADO)) / 1,0000) X 1,00000000) X 1,0000)', '', '', '']],
  rowMeta: [{ isTitle: true, cellMeta: [] }],
  displayRowMeta: [{ isTitle: true, cellMeta: [] }],
  columnModel: { anchors: [{ x: 20 }, { x: 120 }, { x: 220 }, { x: 320 }] },
};
const titleHeights = deriveRowHeights(titleHeightTable, 1);
assert.ok(titleHeights[0] <= 42);

const shiftedContinuationTable = {
  headerRowIndex: 1,
  matrix: [
    ['Nome:', 'JUROS SOBRE VERBAS', '', ''],
    ['', 'Ocorrencia', 'Data Inicial', 'Juros'],
    ['', '07/2012', '06/07/2017', '0,00'],
    ['Demonstrativo de Juros', '', '', ''],
    ['Ocorrencia', 'Data Inicial', 'Juros', ''],
    ['08/2012', '06/07/2017', '0,00', ''],
  ],
  cells: [
    [{ value: 'Nome:' }, { value: 'JUROS SOBRE VERBAS' }, { value: '' }, { value: '' }],
    [{ value: '' }, { value: 'Ocorrencia' }, { value: 'Data Inicial' }, { value: 'Juros' }],
    [{ value: '' }, { value: '07/2012' }, { value: '06/07/2017' }, { value: '0,00' }],
    [{ value: 'Demonstrativo de Juros' }, { value: '' }, { value: '' }, { value: '' }],
    [{ value: 'Ocorrencia' }, { value: 'Data Inicial' }, { value: 'Juros' }, { value: '' }],
    [{ value: '08/2012' }, { value: '06/07/2017' }, { value: '0,00' }, { value: '' }],
  ],
  rowMeta: [
    { isTitle: true, cellMeta: [] },
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
    { isTitle: true, cellMeta: [] },
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
  ],
  pageBreaks: [{
    pageNumber: 1,
    startRow: 0,
    rowCount: 3,
    removedHeader: null,
  }, {
    pageNumber: 2,
    startRow: 3,
    rowCount: 3,
    removedHeader: null,
  }],
};
const normalizedContinuation = buildRenderableTable(shiftedContinuationTable);
assert.deepEqual(normalizedContinuation.matrix, [
  ['Demonstrativo de Juros sobre Verbas', '', ''],
  ['Ocorrencia', 'Data Inicial', 'Juros'],
  ['07/2012', '06/07/2017', '0,00'],
  ['08/2012', '06/07/2017', '0,00'],
]);

const duplicatedPreludeTable = {
  headerRowIndex: 2,
  matrix: [
    ['Demonstrativo de Juros sobre Verbas', '', '', ''],
    ['Demonstrativo de Juros sobre Verbas', '', '', ''],
    ['', 'Ocorrencia', 'Data Inicial', 'Juros'],
    ['', '07/2012', '06/07/2017', '0,00'],
  ],
  cells: [
    [{ value: 'Demonstrativo de Juros sobre Verbas' }, { value: '' }, { value: '' }, { value: '' }],
    [{ value: 'Demonstrativo de Juros sobre Verbas' }, { value: '' }, { value: '' }, { value: '' }],
    [{ value: '' }, { value: 'Ocorrencia' }, { value: 'Data Inicial' }, { value: 'Juros' }],
    [{ value: '' }, { value: '07/2012' }, { value: '06/07/2017' }, { value: '0,00' }],
  ],
  rowMeta: [
    { isTitle: true, cellMeta: [] },
    { isTitle: true, cellMeta: [] },
    { isHeader: true, cellMeta: [] },
    { cellMeta: [] },
  ],
};
const dedupedPrelude = buildRenderableTable(duplicatedPreludeTable);
assert.deepEqual(dedupedPrelude.matrix, [
  ['Demonstrativo de Juros sobre Verbas', '', ''],
  ['Ocorrencia', 'Data Inicial', 'Juros'],
  ['07/2012', '06/07/2017', '0,00'],
]);

console.log('tableLayout.test.mjs OK');
