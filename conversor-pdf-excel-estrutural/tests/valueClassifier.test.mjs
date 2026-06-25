import assert from 'node:assert/strict';
import { classifyCellValue } from '../assets/js/extraction/valueClassifier.js';

assert.equal(classifyCellValue('000123').type, 'text');
assert.equal(classifyCellValue('123.456.789-00').type, 'text');
assert.equal(classifyCellValue('12.345.678/0001-90').type, 'text');
assert.equal(classifyCellValue('0001234-56.2024.5.03.0001').type, 'text');
assert.equal(classifyCellValue('05/2024').type, 'text');
assert.equal(classifyCellValue('31/05/2024').type, 'date');
assert.equal(classifyCellValue('R$ 1.234,56').normalizedValue, 1234.56);
assert.equal(classifyCellValue('(123,45)').normalizedValue, -123.45);
assert.equal(classifyCellValue('8,00%').normalizedValue, 0.08);

console.log('valueClassifier.test.mjs OK');
