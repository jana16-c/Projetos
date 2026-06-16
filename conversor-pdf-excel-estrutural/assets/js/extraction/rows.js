import { median, weightedAverage, isBoldFont, isItalicFont } from './geometry.js';

export function buildRows(items, settings) {
  if (!items.length) return { rows: [], stats: defaultStats() };

  const fontMedian = median(items.map(i => i.fontSize), 10);
  const heightMedian = median(items.map(i => i.height), fontMedian);
  const rowTolerance = Math.max(2.2, fontMedian * Number(settings.rowTolerance || 0.62));

  const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const rawRows = [];

  for (const item of sorted) {
    const row = findCompatibleRow(rawRows, item, rowTolerance);
    if (row) {
      row.items.push(item);
      row.y = weightedAverage(row.items, 'y', 'width');
      row.minY = Math.min(row.minY, item.y);
      row.maxY = Math.max(row.maxY, item.y + item.height);
    } else {
      rawRows.push({ y: item.y, minY: item.y, maxY: item.y + item.height, items: [item] });
    }
  }

  rawRows.sort((a, b) => a.y - b.y);

  const rows = rawRows.map((row, index) => finalizeRow(row, index, settings, fontMedian));

  return {
    rows,
    stats: {
      fontMedian,
      heightMedian,
      rowTolerance,
      rowCount: rows.length,
      itemCount: items.length,
    },
  };
}

function defaultStats() {
  return { fontMedian: 0, heightMedian: 0, rowTolerance: 0, rowCount: 0, itemCount: 0 };
}

function findCompatibleRow(rows, item, tolerance) {
  let best = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    const distance = Math.abs(row.y - item.y);
    if (distance <= tolerance && distance < bestDistance) {
      best = row;
      bestDistance = distance;
    }
  }
  return best;
}

function finalizeRow(row, index, settings, fontMedian) {
  const ordered = [...row.items].sort((a, b) => a.x - b.x || a.index - b.index);
  const segments = mergeItemsIntoSegments(ordered, settings, fontMedian);
  const text = segments.map(s => s.text).join(' ').trim();
  const maxFontSize = Math.max(...ordered.map(i => i.fontSize || 0), 0);
  const boldRatio = ordered.filter(i => isBoldFont(i.fontName)).length / Math.max(1, ordered.length);

  return {
    index,
    y: row.y,
    minY: row.minY,
    maxY: row.maxY,
    height: Math.max(1, row.maxY - row.minY),
    items: ordered,
    segments,
    text,
    xStart: segments.length ? Math.min(...segments.map(s => s.x)) : 0,
    xEnd: segments.length ? Math.max(...segments.map(s => s.right)) : 0,
    maxFontSize,
    isBold: boldRatio >= 0.35,
    isItalic: ordered.some(i => isItalicFont(i.fontName)),
  };
}

export function mergeItemsIntoSegments(items, settings, fontMedian) {
  if (!items.length) return [];
  const gapFactor = Number(settings.gapFactor || 2.3);
  const charWidths = items.map(item => item.text.length ? item.width / item.text.length : item.fontSize * 0.45);
  const medianCharWidth = median(charWidths, fontMedian * 0.45);
  const hardGap = Math.max(7, medianCharWidth * gapFactor, fontMedian * 0.9);

  const segments = [];
  let current = makeSegment(items[0]);

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const gap = item.x - current.right;
    const verticalCompatible = Math.abs(item.y - current.y) <= Math.max(2.5, fontMedian * 0.55);
    const canJoin = verticalCompatible && gap <= hardGap;

    if (canJoin) {
      const joiner = shouldInsertSpace(gap, medianCharWidth, current.text, item.text) ? ' ' : '';
      current.text = `${current.text}${joiner}${item.text}`.replace(/\s+/g, ' ').trim();
      current.rawItems.push(item);
      current.right = Math.max(current.right, item.right);
      current.width = current.right - current.x;
      current.fontSize = Math.max(current.fontSize, item.fontSize || 0);
      current.isBold = current.isBold || isBoldFont(item.fontName);
      current.isItalic = current.isItalic || isItalicFont(item.fontName);
    } else {
      segments.push(current);
      current = makeSegment(item);
    }
  }

  segments.push(current);
  return segments.filter(s => s.text);
}

function makeSegment(item) {
  return {
    text: item.text,
    x: item.x,
    y: item.y,
    right: item.right,
    width: item.width,
    fontSize: item.fontSize || 0,
    isBold: isBoldFont(item.fontName),
    isItalic: isItalicFont(item.fontName),
    rawItems: [item],
  };
}

function shouldInsertSpace(gap, medianCharWidth, left, right) {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (gap > medianCharWidth * 0.18) return true;
  if (/[a-zA-ZÀ-ÿ0-9]$/.test(left) && /^[a-zA-ZÀ-ÿ0-9]/.test(right)) return true;
  return false;
}
