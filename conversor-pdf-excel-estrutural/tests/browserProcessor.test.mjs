import assert from 'node:assert/strict';
import { planPageProcessing } from '../assets/js/processing/browserProcessor.js';

const extracted = { allItems: Array.from({ length: 12 }, () => ({ text: 'ABC' })) };

const autoGood = planPageProcessing({
  settings: { sourceMode: 'auto', outputMode: 'clean-table', keepPageImagesInAudit: false },
  extracted,
  textQuality: { classification: 'good', score: 90 },
});

const autoSuspect = planPageProcessing({
  settings: { sourceMode: 'auto', outputMode: 'clean-table', keepPageImagesInAudit: false },
  extracted,
  textQuality: { classification: 'suspect', score: 55 },
});

const autoBad = planPageProcessing({
  settings: { sourceMode: 'auto', outputMode: 'clean-table', keepPageImagesInAudit: false },
  extracted,
  textQuality: { classification: 'bad', score: 22 },
});

const visualMode = planPageProcessing({
  settings: { sourceMode: 'text', outputMode: 'visual-replica', keepPageImagesInAudit: false },
  extracted,
  textQuality: { classification: 'good', score: 90 },
});

assert.equal(autoGood.effectiveSourceMode, 'text');
assert.equal(autoGood.shouldRenderPage, false);
assert.equal(autoSuspect.effectiveSourceMode, 'hybrid');
assert.equal(autoSuspect.shouldRenderPage, true);
assert.equal(autoBad.effectiveSourceMode, 'ocr');
assert.equal(autoBad.shouldRunOcr, true);
assert.equal(visualMode.keepRenderedPage, true);

console.log('browserProcessor.test.mjs OK');
