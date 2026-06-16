import assert from 'node:assert/strict';
import { parsePageSpec } from '../assets/js/utils/pages.js';

assert.deepEqual(parsePageSpec('', 3), [1, 2, 3]);
assert.deepEqual(parsePageSpec('1-3, 5, 3', 6), [1, 2, 3, 5]);
assert.deepEqual(parsePageSpec('4-2', 5), [2, 3, 4]);
assert.throws(() => parsePageSpec('0', 5), /fora do intervalo/);
assert.throws(() => parsePageSpec('abc', 5), /Trecho inválido/);

console.log('pages.test.mjs OK');
