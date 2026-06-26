import assert from 'node:assert/strict';
import { reconcileTextItems } from '../backend/src/ocr/reconcileItems.js';

const basePdfItem = {
  id: 'pdf:1',
  pageNumber: 1,
  index: 0,
  text: 'VALOR',
  rawText: 'VALOR',
  x: 10,
  y: 20,
  width: 40,
  height: 10,
  right: 50,
  bottom: 30,
};

const baseOcrItem = {
  id: 'ocr:1',
  pageNumber: 1,
  index: 0,
  text: 'VALOR',
  rawText: 'VALOR',
  x: 11,
  y: 20,
  width: 40,
  height: 10,
  right: 51,
  bottom: 30,
  ocrConfidence: 92,
};

const matched = reconcileTextItems({
  pdfItems: [basePdfItem],
  ocrItems: [baseOcrItem],
});
assert.equal(matched.items.length, 1);
assert.equal(matched.items[0].sourceType, 'pdf-text');
assert.deepEqual(matched.items[0].alternativeSourceIds, ['ocr:1']);

const filledByOcr = reconcileTextItems({
  pdfItems: [basePdfItem],
  ocrItems: [baseOcrItem, {
    ...baseOcrItem,
    id: 'ocr:2',
    text: '1.250,00',
    rawText: '1.250,00',
    x: 100,
    right: 160,
    ocrConfidence: 90,
  }],
});
assert.equal(filledByOcr.items.length, 2);
assert.equal(filledByOcr.items[1].sourceType, 'ocr');

const lowConfidence = reconcileTextItems({
  pdfItems: [],
  ocrItems: [{ ...baseOcrItem, id: 'ocr:3', ocrConfidence: 20 }],
});
assert.equal(lowConfidence.items.length, 0);

const brokenPdf = reconcileTextItems({
  pdfItems: [{ ...basePdfItem, id: 'pdf:2', text: 'INSCRI-' }],
  ocrItems: [{ ...baseOcrItem, id: 'ocr:4', text: 'INSCRICAO', rawText: 'INSCRICAO', ocrConfidence: 95 }],
});
assert.equal(brokenPdf.items.length, 1);
assert.equal(brokenPdf.items[0].sourceType, 'ocr');
assert.deepEqual(brokenPdf.items[0].alternativeSourceIds, ['pdf:2']);

console.log('reconcileItems.test.mjs OK');
