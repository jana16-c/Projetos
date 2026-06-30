import assert from 'node:assert/strict';
import { buildExtractionSheets, replaceExtractionSheets } from '../assets/js/export/xlsmTemplateBuilder.js';

const workbook = {
  SheetNames: ['Principal', 'EXTRACAO_OLD', 'Resumo'],
  Sheets: {
    Principal: { A1: { v: 'ok' } },
    EXTRACAO_OLD: { A1: { v: 'old' } },
    Resumo: { A1: { v: 'keep' } },
  },
};

replaceExtractionSheets(workbook, [
  { name: 'EXTRACAO_P1_T1', sheet: { A1: { v: 'novo' } } },
  { name: 'EXTRACAO_DIAGNOSTICO', sheet: { A1: { v: 'diag' } } },
]);

assert.deepEqual(workbook.SheetNames, ['Principal', 'Resumo', 'EXTRACAO_P1_T1', 'EXTRACAO_DIAGNOSTICO']);
assert.equal(Boolean(workbook.Sheets.Principal), true);
assert.equal(Boolean(workbook.Sheets.EXTRACAO_OLD), false);
assert.equal(Boolean(workbook.Sheets.EXTRACAO_P1_T1), true);

const fakeXlsx = {
  utils: {
    aoa_to_sheet(matrix) {
      return { matrix };
    },
  },
};

const lightSheets = buildExtractionSheets(fakeXlsx, {
  tables: [{
    pageNumber: 1,
    tableIndex: 1,
    matrix: [['A']],
    cells: [[{ value: 'A' }]],
    rowMeta: [{ cellMeta: [] }],
    pageDiagnostics: [],
  }],
  pageDiagnostics: [],
  pages: [],
  sourceItems: Array.from({ length: 6000 }, (_, index) => ({
    id: `id-${index}`,
    pageNumber: 1,
    text: `texto-${index}`,
    rawText: `texto-${index}`,
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  })),
}, {
  maxSourceAuditRows: 5000,
});

const sourceSheet = lightSheets.find(sheet => sheet.name === 'EXTRACAO_ORIGEM');
assert.equal(Boolean(sourceSheet), true);
assert.match(String(sourceSheet.sheet.matrix[1][2]), /omitida no XLSM/i);

const singleSheets = buildExtractionSheets(fakeXlsx, {
  settings: { sheetMode: 'single' },
  tables: [
    {
      pageNumber: 1,
      tableIndex: 1,
      sourcePages: [1],
      headerRowIndex: 0,
      matrix: [['A', 'B'], ['1', '2']],
      cells: [[{ value: 'A' }, { value: 'B' }], [{ value: '1' }, { value: '2' }]],
      rowMeta: [{ isHeader: true, cellMeta: [] }, { cellMeta: [] }],
    },
    {
      pageNumber: 2,
      tableIndex: 1,
      sourcePages: [2],
      headerRowIndex: 0,
      matrix: [['C', 'D'], ['3', '4']],
      cells: [[{ value: 'C' }, { value: 'D' }], [{ value: '3' }, { value: '4' }]],
      rowMeta: [{ isHeader: true, cellMeta: [] }, { cellMeta: [] }],
    },
  ],
  pageDiagnostics: [],
  pages: [],
  sourceItems: [],
});

assert.equal(singleSheets.some(sheet => sheet.name === 'EXTRACAO_DADOS'), true);
assert.equal(singleSheets.some(sheet => sheet.name === 'EXTRACAO_P1_T1'), false);
const extractionDataSheet = singleSheets.find(sheet => sheet.name === 'EXTRACAO_DADOS');
assert.deepEqual(extractionDataSheet.sheet.matrix.slice(0, 5), [
  ['A', 'B'],
  ['1', '2'],
  ['', ''],
  ['C', 'D'],
  ['3', '4'],
]);

console.log('xlsm.test.mjs OK');
