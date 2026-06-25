import assert from 'node:assert/strict';
import { parsePageSpec } from '../assets/js/utils/pages.js';
import {
  buildDefaultPageSpec,
  shouldApplyDefaultPageSpec,
  selectionSummary,
} from '../assets/js/utils/pageSelection.js';

assert.deepEqual(parsePageSpec('', 3), [1, 2, 3]);
assert.deepEqual(parsePageSpec('1-3, 5, 3', 6), [1, 2, 3, 5]);
assert.deepEqual(parsePageSpec('2, 4-5', 10), [2, 4, 5]);
assert.throws(() => parsePageSpec('0', 5), /fora do intervalo/i);
assert.throws(() => parsePageSpec('6', 5), /fora do intervalo/i);
assert.throws(() => parsePageSpec('5-3', 6), /invertido/i);
assert.throws(() => parsePageSpec('abc', 5), /invalido/i);

assert.equal(buildDefaultPageSpec(10), '1-10');
assert.equal(
  shouldApplyDefaultPageSpec({ currentValue: '2, 4-5', lastAutoValue: '1-10', userEdited: true }),
  false,
);
assert.equal(
  shouldApplyDefaultPageSpec({ currentValue: '', lastAutoValue: '1-10', userEdited: false }),
  true,
);
assert.equal(
  selectionSummary([2, 4, 5], 10),
  '3 de 10 página(s) serão processadas: 2, 4, 5.',
);

console.log('pages.test.mjs OK');
