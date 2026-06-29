import assert from 'node:assert/strict';
import { validateContentConservation } from '../assets/js/model/resultModel.js';

const validation = validateContentConservation(
  [
    { id: '1:0', pageNumber: 1, text: 'A' },
    { id: '1:1', pageNumber: 1, text: 'B' },
  ],
  [{
    cells: [[
      { sourceItemIds: ['1:0', '1:1'] },
      { sourceItemIds: ['1:1'] },
    ]],
  }],
  [],
);

assert.equal(validation.valid, false);
assert.deepEqual(validation.duplicated, ['1:1']);
assert.deepEqual(validation.missing, []);
assert.deepEqual(validation.unknownUnassigned, []);

const insideTable = validateContentConservation({
  sourceItems: [
    { id: '1:0', pageNumber: 1, text: 'FINAL', x: 10, y: 790, width: 40, height: 10, right: 50, bottom: 800 },
  ],
  tables: [{
    id: 'P1_T1',
    pageNumber: 1,
    sourcePages: [1],
    sourceCells: [[{ sourcePage: 1, sourceItemIds: ['other'], x: 0, y: 760, width: 200, height: 60, right: 200, bottom: 820 }]],
    cells: [[{ sourcePage: 1, sourceItemIds: ['other'], x: 0, y: 760, width: 200, height: 60, right: 200, bottom: 820 }]],
  }],
  unassignedTextItems: [{
    id: '1:0',
    pageNumber: 1,
    text: 'FINAL',
    x: 10,
    y: 790,
    width: 40,
    height: 10,
    right: 50,
    bottom: 800,
    tableIds: ['P1_T1'],
    inBottomZone: true,
  }],
  pages: [{ pageNumber: 1, visualGenerated: true }],
});

assert.equal(insideTable.valid, false);
assert.deepEqual(insideTable.unassignedInsideDetectedTables, ['1:0']);
assert.deepEqual(insideTable.bottomZoneMissing, ['1:0']);

console.log('contentConservation.test.mjs OK');
