import assert from 'node:assert/strict';
import { scoreTextLayerQuality } from '../assets/js/pdf/textLayerQuality.js';

const goodPage = {
  width: 595,
  height: 842,
  allItems: [
    makeItem('COMPETENCIA', 40, 80, 90, 12),
    makeItem('EMPREGADO', 160, 80, 80, 12),
    makeItem('CPF', 320, 80, 30, 12),
    makeItem('VALOR', 460, 80, 50, 12),
    makeItem('01/2024', 40, 100, 60, 10),
    makeItem('MARIA', 160, 100, 45, 10),
    makeItem('000.000.000-00', 320, 100, 90, 10),
    makeItem('1.200,00', 460, 100, 65, 10),
  ],
};

const badPage = {
  width: 595,
  height: 842,
  allItems: Array.from({ length: 18 }, (_, index) => makeItem(index % 2 === 0 ? 'A' : 'A', 40, 80 + (index % 3), 8, 8)),
};

const goodScore = scoreTextLayerQuality(goodPage);
const badScore = scoreTextLayerQuality(badPage);

assert.equal(goodScore.classification, 'good');
assert.equal(goodScore.score > badScore.score, true);
assert.equal(badScore.classification === 'bad' || badScore.classification === 'suspect', true);
assert.equal(goodScore.metrics.itemCount, 8);
assert.equal(badScore.reasons.includes('itens_muito_fragmentados') || badScore.reasons.includes('fragmentacao_moderada'), true);

console.log('textLayerQuality.test.mjs OK');

function makeItem(text, x, y, width, height) {
  return {
    text,
    rawText: text,
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  };
}
