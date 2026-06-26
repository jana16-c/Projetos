import assert from 'node:assert/strict';
import { filterItemsByMargins as browserFilter } from '../assets/js/pdf/pdfLoader.js';
import { filterItemsByMargins as backendFilter } from '../backend/src/pdf/loadPdf.js';

const viewport = { width: 1000, height: 1000 };
const items = [
  { id: 'inside', x: 100, y: 100, width: 40, height: 20, right: 140, bottom: 120 },
  { id: 'touch-bottom-keep', x: 100, y: 900, width: 120, height: 100, right: 220, bottom: 1000 },
  { id: 'center-out-bottom', x: 100, y: 951, width: 120, height: 100, right: 220, bottom: 1051 },
];

assert.deepEqual(
  browserFilter(items, viewport, { bottom: 0.05 }).map(item => item.id),
  ['inside', 'touch-bottom-keep'],
);

assert.deepEqual(
  backendFilter(items, viewport, { bottom: 0.05 }).map(item => item.id),
  ['inside', 'touch-bottom-keep'],
);

assert.deepEqual(
  browserFilter(items, viewport, { bottom: 0 }).map(item => item.id),
  ['inside', 'touch-bottom-keep'],
);

console.log('marginFiltering.test.mjs OK'); 
