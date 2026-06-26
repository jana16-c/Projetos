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

console.log('xlsm.test.mjs OK');
