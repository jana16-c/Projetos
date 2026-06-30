import assert from 'node:assert/strict';
import { buildDocumentResult } from '../assets/js/model/resultModel.js';

const documentResult = buildDocumentResult({
  sourceFileName: 'mock.pdf',
  totalPages: 1,
  selectedPages: [1],
  tables: [],
  pageDiagnostics: [],
  settings: { outputMode: 'clean-table' },
  pagesData: [{
    pageNumber: 1,
    width: 595,
    height: 842,
    rotation: 0,
    items: [],
    allItems: [],
    filteredOutItems: [],
    textLayerDetected: true,
    ocrApplied: false,
    visualRequired: false,
    renderedPage: null,
    diagnostics: {},
  }],
});

assert.equal(documentResult.validation.contentConservation.visualPagesMissing.length, 0);
assert.equal(documentResult.pages[0].status, 'OK');
assert.equal(documentResult.pages[0].warnings.includes('Imagem visual integral nao foi gerada.'), false);

console.log('resultModel.test.mjs OK');
