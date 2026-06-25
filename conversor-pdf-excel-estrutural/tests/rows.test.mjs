import assert from 'node:assert/strict';
import { buildRows } from '../assets/js/extraction/rows.js';

const items = [
  makeItem('Competencia', 40, 80, 11),
  makeItem('Empregado', 180, 80.8, 11),
  makeItem('CPF', 340, 80.3, 11),
  makeItem('01/2024', 40, 100, 10),
  makeItem('Maria', 180, 100.4, 10),
  makeItem('Silva', 214, 100.5, 10),
  makeItem('000.000.000-00', 340, 100.2, 10),
];

const result = buildRows(items, { rowTolerance: 0.62, gapFactor: 2.3 });

assert.equal(result.rows.length, 2);
assert.equal(result.rows[1].segments.length, 3);
assert.equal(result.rows[1].segments[1].text, 'Maria Silva');

console.log('rows.test.mjs OK');

function makeItem(text, x, y, fontSize) {
  return {
    id: `${text}-${x}-${y}`,
    pageNumber: 1,
    index: 0,
    text,
    rawText: text,
    x,
    y,
    width: Math.max(30, text.length * fontSize * 0.48),
    height: fontSize,
    right: x + Math.max(30, text.length * fontSize * 0.48),
    bottom: y + fontSize,
    fontName: fontSize >= 11 ? 'Inter-Bold' : 'Inter-Regular',
    fontSize,
  };
}
