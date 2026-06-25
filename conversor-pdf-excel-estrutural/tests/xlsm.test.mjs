import assert from 'node:assert/strict';
import { replaceExtractionSheets } from '../assets/js/export/xlsmTemplateBuilder.js';

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

console.log('xlsm.test.mjs OK');
