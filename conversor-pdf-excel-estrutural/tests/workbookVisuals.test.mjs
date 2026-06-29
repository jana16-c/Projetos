import assert from 'node:assert/strict';
import {
  buildAuditRows,
  buildUnassignedRows,
  buildWorkbookSheetPlan,
} from '../assets/js/export/workbookBuilder.js';

const documentResult = {
  selectedPages: [2, 1],
  pages: [
    {
      pageNumber: 1,
      textItems: 10,
      assignedItems: 9,
      unassignedItems: 1,
      lastSourceBottom: 820,
      lastAssignedBottom: 810,
      bottomZoneSourceCount: 2,
      bottomZoneAssignedCount: 1,
      ocrApplied: false,
      visualGenerated: true,
      status: 'REVISAR',
      warnings: ['rodape final sem associacao'],
    },
    {
      pageNumber: 2,
      textItems: 4,
      assignedItems: 4,
      unassignedItems: 0,
      lastSourceBottom: 760,
      lastAssignedBottom: 760,
      bottomZoneSourceCount: 0,
      bottomZoneAssignedCount: 0,
      ocrApplied: true,
      visualGenerated: true,
      status: 'OK',
      warnings: [],
    },
  ],
  unassignedTextItems: [
    {
      id: '1:0',
      pageNumber: 1,
      text: 'FINAL',
      x: 10,
      y: 790,
      width: 40,
      height: 10,
      insideDetectedTable: true,
      tableIds: ['P1_T1'],
      inBottomZone: true,
      filteredOut: false,
    },
  ],
};

Object.defineProperty(documentResult, '_pages', {
  value: [
    {
      pageNumber: 1,
      renderedPage: { dataUrl: 'data:image/png;base64,AAA=', displayWidthPx: 794, displayHeightPx: 1123 },
      rotation: 0,
    },
    {
      pageNumber: 2,
      renderedPage: { dataUrl: 'data:image/png;base64,BBB=', displayWidthPx: 794, displayHeightPx: 1123 },
      rotation: 90,
    },
  ],
  enumerable: false,
});

const sheetPlanDocument = { ...documentResult, tables: [{ pageNumber: 1 }, { pageNumber: 2 }] };
Object.defineProperty(sheetPlanDocument, '_pages', {
  value: documentResult._pages,
  enumerable: false,
});
const sheetPlan = buildWorkbookSheetPlan(sheetPlanDocument);
assert.deepEqual(sheetPlan.map(item => item.sheetName), ['Dados_T001', 'Dados_T002']);

const cleanSheetPlan = buildWorkbookSheetPlan({
  tables: [{ pageNumber: 1 }],
  settings: { outputMode: 'clean-table' },
  pages: [],
  selectedPages: [1],
});
assert.deepEqual(cleanSheetPlan.map(item => item.sheetName), ['Dados_T001']);

const auditRows = buildAuditRows(documentResult);
assert.equal(auditRows[0][0], 1);
assert.equal(auditRows[0][10], 'REVISAR');

const unassignedRows = buildUnassignedRows(documentResult);
assert.equal(unassignedRows[0][7], 'sim');
assert.equal(unassignedRows[0][8], 'P1_T1');

console.log('workbookVisuals.test.mjs OK');
