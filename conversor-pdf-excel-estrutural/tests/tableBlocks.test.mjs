import assert from 'node:assert/strict';
import { buildRows } from '../assets/js/extraction/rows.js';
import { detectTableBlocks } from '../assets/js/extraction/tableBlocks.js';

const items = [
  makeItem('CABECALHO LIVRE', 40, 40),
  makeItem('CODIGO', 40, 100),
  makeItem('DESCRICAO', 180, 100),
  makeItem('VALOR', 420, 100),
  makeItem('1001', 40, 120),
  makeItem('FGTS', 180, 120),
  makeItem('96,00', 420, 120),
  makeItem('1002', 40, 140),
  makeItem('INSS', 180, 140),
  makeItem('120,00', 420, 140),
  makeItem('RODAPE', 40, 220),
  makeItem('CODIGO', 40, 300),
  makeItem('DESCRICAO', 180, 300),
  makeItem('VALOR', 420, 300),
  makeItem('2001', 40, 320),
  makeItem('HONORARIOS', 180, 320),
  makeItem('300,00', 420, 320),
];

const { rows } = buildRows(items, { rowTolerance: 0.62, gapFactor: 2.3 });
const blocks = detectTableBlocks(rows, 595);

assert.equal(blocks.length, 2);
assert.ok(blocks[0].confidence >= 0.6);

console.log('tableBlocks.test.mjs OK');

function makeItem(text, x, y) {
  return {
    id: `${text}-${x}-${y}`,
    pageNumber: 1,
    index: 0,
    text,
    rawText: text,
    x,
    y,
    width: Math.max(30, text.length * 4.8),
    height: 10,
    right: x + Math.max(30, text.length * 4.8),
    bottom: y + 10,
    fontName: /^CODIGO|DESCRICAO|VALOR$/.test(text) ? 'Inter-Bold' : 'Inter-Regular',
    fontSize: /^CODIGO|DESCRICAO|VALOR$/.test(text) ? 11 : 10,
  };
}
