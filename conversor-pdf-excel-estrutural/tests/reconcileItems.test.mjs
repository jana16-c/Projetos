import assert from 'node:assert/strict';
import { mergeOcrAndPdfItems } from '../assets/js/processing/browserProcessor.js';

const merged = mergeOcrAndPdfItems({
  pdfItems: [
    makeItem('pdf:1', 'VALOR', 10, 20, 50, 30),
    makeItem('pdf:2', 'DESCRICAO', 10, 40, 120, 52),
  ],
  ocrItems: [
    makeItem('ocr:1', 'VALOR', 11, 20, 51, 30),
    makeItem('ocr:2', '1.250,00', 180, 40, 240, 52),
  ],
});

assert.equal(merged.length, 3);
assert.equal(merged[0].sourceType, 'pdf-text');
assert.equal(merged[2].sourceType, 'ocr');
assert.equal(merged[2].text, '1.250,00');

console.log('reconcileItems.test.mjs OK');

function makeItem(id, text, x, y, right, bottom) {
  return {
    id,
    pageNumber: 1,
    text,
    rawText: text,
    x,
    y,
    width: right - x,
    height: bottom - y,
    right,
    bottom,
  };
}
