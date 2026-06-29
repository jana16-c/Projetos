import assert from 'node:assert/strict';
import { extractDocumentTables } from '../assets/js/extraction/tableExtractor.js';

const documentResult = extractDocumentTables({
  pagesData: [makePage(1), makePage(2)],
  settings: {
    mode: 'automatic',
    rowTolerance: 0.62,
    columnTolerance: 9,
    gapFactor: 2.3,
    mergeContinuation: true,
    hideRepeatedLines: true,
  },
  sourceFileName: 'mock.pdf',
  totalPages: 2,
});

assert.equal(documentResult.tables.length, 1);
assert.deepEqual(documentResult.tables[0].sourcePages, [1, 2]);
assert.equal(documentResult.pageDiagnostics.length, 2);
assert.ok(documentResult.tables[0].matrix.length >= 2);
assert.equal(documentResult.version, '3.0');
assert.equal(documentResult.tableIr.version, '3.0');
assert.equal(documentResult.tableIr.source.fileName, 'mock.pdf');
assert.equal(documentResult.tableIr.pages.length, 2);
assert.equal(documentResult.tableIr.tables.length, 1);
assert.ok(Array.isArray(documentResult.sourceItems));
assert.ok(Array.isArray(documentResult.ocr.appliedPages));
assert.equal(documentResult.validation.contentConservation.valid, true);
assert.deepEqual(documentResult.validation.contentConservation.duplicated, []);
assert.deepEqual(documentResult.validation.contentConservation.missing, []);
assert.equal(documentResult.unassignedTextItems.length, 0);
assert.deepEqual(documentResult.validation.contentConservation.unassignedInsideDetectedTables, []);
assert.deepEqual(documentResult.validation.contentConservation.visualPagesMissing, []);
assert.equal(documentResult.tableIr.tables[0].cells[0].id, 'P1_T1_R1C1');

console.log('extraction.test.mjs OK');

function makePage(pageNumber) {
  const rows = [
    ['COMPETENCIA', 'EMPREGADO', 'CPF', 'DEVIDO'],
    [pageNumber === 1 ? '01/2024' : '02/2024', pageNumber === 1 ? 'MARIA' : 'JOAO', pageNumber === 1 ? '000.000.000-00' : '111.111.111-11', '1.200,00'],
    ['RODAPE REPETIDO'],
  ];
  const positions = [40, 180, 340, 470];
  const items = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((text, columnIndex) => {
      items.push({
        id: `${pageNumber}:${rowIndex}:${columnIndex}`,
        pageNumber,
        index: items.length,
        text,
        rawText: text,
        x: positions[columnIndex],
        y: 80 + rowIndex * 20,
        width: Math.max(30, text.length * 4.8),
        height: rowIndex === 0 ? 11 : 10,
        right: positions[columnIndex] + Math.max(30, text.length * 4.8),
        bottom: 80 + rowIndex * 20 + (rowIndex === 0 ? 11 : 10),
        fontName: rowIndex === 0 ? 'Inter-Bold' : 'Inter-Regular',
        fontSize: rowIndex === 0 ? 11 : 10,
      });
    });
  });

  return {
    pageNumber,
    width: 595,
    height: 842,
    items,
    allItems: items,
    textLayerDetected: true,
    renderedPage: {
      dataUrl: 'data:image/png;base64,AAA=',
      displayWidthPx: 794,
      displayHeightPx: 1123,
    },
  };
}
