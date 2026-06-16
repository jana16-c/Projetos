import { median, percentile, cellLooksNumeric } from './geometry.js';

export function buildColumnModel(rows, pageWidth, settings) {
  const segments = rows.flatMap(row => row.segments.map(segment => ({ ...segment, rowIndex: row.index })));
  if (!segments.length) return emptyModel();

  if (settings.mode === 'visual-grid') {
    return buildVisualGridModel(segments, rows, pageWidth, settings);
  }

  return buildStructuralModel(segments, rows, pageWidth, settings);
}

function emptyModel() {
  return { anchors: [], columnCount: 0, confidence: 0, warnings: ['Nenhum texto detectado na página.'] };
}

function buildStructuralModel(segments, rows, pageWidth, settings) {
  const tolerance = Number(settings.columnTolerance || 9);
  const clusters = clusterPositions(segments.map(s => s.x), tolerance);
  const minSupport = Math.max(2, Math.ceil(rows.length * 0.06));

  let anchors = clusters
    .filter(c => c.count >= minSupport || c.hasNumeric || c.widthScore > 90)
    .map(c => ({ x: c.center, support: c.count, score: c.score }))
    .sort((a, b) => a.x - b.x);

  anchors = removeNearDuplicateAnchors(anchors, Math.max(3, tolerance * 0.75));

  if (anchors.length < 2) {
    anchors = fallbackAnchorsFromRows(rows, tolerance);
  }

  const densityScore = Math.min(1, segments.length / Math.max(1, rows.length * Math.max(1, anchors.length)));
  const supportScore = anchors.length ? Math.min(1, median(anchors.map(a => a.support), 0) / Math.max(2, rows.length * 0.18)) : 0;
  const confidence = Math.round((0.45 + densityScore * 0.25 + supportScore * 0.30) * 100) / 100;

  const warnings = [];
  if (anchors.length <= 1) warnings.push('Poucas colunas detectadas. Talvez a página não contenha tabela ou precise do modo grade visual.');
  if (confidence < 0.62) warnings.push('Confiança estrutural moderada. Confira a prévia e ajuste tolerâncias se necessário.');

  return { anchors, columnCount: anchors.length, confidence: Math.min(1, confidence), warnings };
}

function buildVisualGridModel(segments, rows, pageWidth, settings) {
  const tolerance = Number(settings.columnTolerance || 9);
  const left = Math.max(0, percentile(segments.map(s => s.x), 0.02, 0));
  const right = Math.min(pageWidth, percentile(segments.map(s => s.right), 0.98, pageWidth));
  const typicalWidth = median(segments.map(s => s.width), 60);
  const step = Math.max(28, Math.min(90, typicalWidth * 0.9, tolerance * 5));
  const anchors = [];
  for (let x = left; x <= right; x += step) anchors.push({ x, support: 1, score: 1 });

  return {
    anchors,
    columnCount: anchors.length,
    confidence: 0.70,
    warnings: ['Modo grade visual usado: preserva posição, mas pode criar mais colunas vazias.'],
  };
}

function clusterPositions(positions, tolerance) {
  const sorted = positions.filter(Number.isFinite).sort((a, b) => a - b);
  const clusters = [];

  for (const x of sorted) {
    let cluster = clusters.find(c => Math.abs(c.center - x) <= tolerance);
    if (!cluster) {
      cluster = { values: [], center: x, count: 0, hasNumeric: false, widthScore: 0, score: 0 };
      clusters.push(cluster);
    }
    cluster.values.push(x);
    cluster.count += 1;
    cluster.center = median(cluster.values, x);
  }

  for (const c of clusters) {
    c.score = c.count / Math.max(1, clusters.length);
    c.widthScore = c.values.length ? Math.max(...c.values) - Math.min(...c.values) : 0;
  }

  return clusters;
}

function removeNearDuplicateAnchors(anchors, minDistance) {
  const result = [];
  for (const anchor of anchors) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.x - anchor.x) < minDistance) {
      if (anchor.support > previous.support) result[result.length - 1] = anchor;
    } else {
      result.push(anchor);
    }
  }
  return result;
}

function fallbackAnchorsFromRows(rows, tolerance) {
  const candidateRows = rows
    .filter(row => row.segments.length >= 2)
    .sort((a, b) => b.segments.length - a.segments.length);

  const positions = [];
  for (const row of candidateRows.slice(0, 8)) {
    positions.push(...row.segments.map(s => s.x));
  }

  return removeNearDuplicateAnchors(
    clusterPositions(positions, tolerance).map(c => ({ x: c.center, support: c.count, score: c.score })).sort((a, b) => a.x - b.x),
    tolerance * 0.8,
  );
}

export function rowsToMatrix(rows, columnModel, settings) {
  const anchors = columnModel.anchors;
  if (!anchors.length) return rows.map(row => [row.text]);

  const matrix = [];
  const rowMeta = [];

  for (const row of rows) {
    const cells = Array.from({ length: anchors.length }, () => '');
    const cellMeta = Array.from({ length: anchors.length }, () => ({ bold: false, italic: false, fontSize: 0, x: 0 }));

    for (const segment of row.segments) {
      const col = findNearestAnchorIndex(segment.x, anchors);
      if (col < 0) continue;
      const existing = cells[col];
      cells[col] = existing ? `${existing} ${segment.text}`.replace(/\s+/g, ' ').trim() : segment.text;
      cellMeta[col].bold = cellMeta[col].bold || segment.isBold;
      cellMeta[col].italic = cellMeta[col].italic || segment.isItalic;
      cellMeta[col].fontSize = Math.max(cellMeta[col].fontSize, segment.fontSize || 0);
      cellMeta[col].x = segment.x;
    }

    trimTrailingEmpty(cells, cellMeta);
    matrix.push(cells);
    rowMeta.push({
      y: row.y,
      isBold: row.isBold,
      isItalic: row.isItalic,
      maxFontSize: row.maxFontSize,
      sourceText: row.text,
      cellMeta,
      isTitle: isTitleRow(row, cells),
      isProbablyHeader: isProbablyHeader(cells),
    });
  }

  return { matrix, rowMeta };
}

function findNearestAnchorIndex(x, anchors) {
  let best = -1;
  let dist = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const d = Math.abs(anchors[i].x - x);
    if (d < dist) {
      best = i;
      dist = d;
    }
  }
  return best;
}

function trimTrailingEmpty(cells, meta) {
  while (cells.length > 1 && !String(cells[cells.length - 1] || '').trim()) {
    cells.pop();
    meta.pop();
  }
}

function isTitleRow(row, cells) {
  const nonEmpty = cells.filter(c => String(c || '').trim()).length;
  return nonEmpty === 1 && (row.isBold || row.maxFontSize >= 11.5 || row.text.length > 25);
}

function isProbablyHeader(cells) {
  const filled = cells.filter(c => String(c || '').trim());
  if (filled.length < 2) return false;
  const numeric = filled.filter(cellLooksNumeric).length;
  const uppercaseish = filled.filter(v => {
    const s = String(v).trim();
    return s.length >= 2 && s === s.toUpperCase();
  }).length;
  return numeric === 0 && uppercaseish >= Math.ceil(filled.length * 0.45);
}
