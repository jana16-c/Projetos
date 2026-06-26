import assert from 'node:assert/strict';
import { buildTablesFromVisualGrid } from '../assets/js/extraction/visualTableExtractor.js';

const tables = buildTablesFromVisualGrid({
  pageNumber: 1,
  width: 595,
  height: 842,
  items: [
    makeItem('TITULO', 50, 42, 100, 20),
    makeItem('PERIODO', 50, 82, 70, 20),
    makeItem('VALOR', 170, 82, 60, 20),
    makeItem('OBS', 290, 82, 50, 20),
    makeItem('01/2024', 52, 122, 70, 18),
    makeItem('150,00', 172, 122, 60, 18),
  ],
  visualTables: [{
    bounds: { left: 40, top: 40, right: 360, bottom: 180 },
    rows: 3,
    columns: 3,
    confidence: 0.96,
    warnings: [],
    cells: [
      { row: 0, column: 0, x: 40, y: 40, width: 320, height: 30, rowSpan: 1, columnSpan: 3, style: { fillArgb: 'FFD9E8FF', borders: {}, horizontalAlignment: 'center' } },
      { row: 1, column: 0, x: 40, y: 80, width: 120, height: 30, style: { fillArgb: 'FF4F81BD', borders: {} } },
      { row: 1, column: 1, x: 160, y: 80, width: 120, height: 30, style: { fillArgb: 'FF4F81BD', borders: {} } },
      { row: 1, column: 2, x: 280, y: 80, width: 80, height: 30, style: { fillArgb: 'FF4F81BD', borders: {} } },
      { row: 2, column: 0, x: 40, y: 120, width: 120, height: 30, style: { fillArgb: 'FFFFFFFF', borders: {} } },
      { row: 2, column: 1, x: 160, y: 120, width: 120, height: 30, style: { fillArgb: 'FFFFFFFF', borders: {} } },
      { row: 2, column: 2, x: 280, y: 120, width: 80, height: 30, style: { fillArgb: 'FFFFFFFF', borders: {} } },
    ],
  }],
});

assert.equal(tables.length, 1);
assert.equal(tables[0].matrix[0][0], 'TITULO');
assert.equal(tables[0].matrix[1][0], 'PERIODO');
assert.equal(tables[0].matrix[2][2], '');
assert.equal(tables[0].visualModel.merges.length, 1);
assert.equal(tables[0].visualModel.columnWidthsPt[0], 120);
assert.equal(tables[0].visualModel.rowHeightsPt[0], 30);
assert.equal(tables[0].cells[2][1].style.fillArgb, 'FFFFFFFF');
assert.deepEqual(tables[0].cells[2][0].sourceItemIds, ['01/2024:52']);

console.log('visualTableExtractor.test.mjs OK');

function makeItem(text, x, y, width, height) {
  return {
    id: `${text}:${x}`,
    pageNumber: 1,
    index: x,
    text,
    rawText: text,
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    fontSize: 8,
    lineNumber: y,
  };
}
