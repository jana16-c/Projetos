import { cellLooksNumeric, median, percentile } from './geometry.js';

export function buildColumnModel(rows, pageWidth, settings) {
  const segments = rows.flatMap(row => row.segments.map(segment => ({ ...segment, rowIndex: row.index })));
  if (!segments.length) return emptyModel();

  if (settings.mode === 'visual-grid') {
    return buildVisualGridModel(segments, rows, pageWidth, settings);
  }

  return buildStructuralModel(segments, rows, pageWidth, settings);
}

function emptyModel() {
  return { anchors: [], columnCount: 0, confidence: 0, warnings: ['Nenhum texto detectado na pagina.'] };
}

function buildStructuralModel(segments, rows, pageWidth, settings) {
  const tolerance = Number(settings.columnTolerance || 9);
  const clusters = clusterPositions(segments.map(segment => segment.x), tolerance);
  const minSupport = Math.max(2, Math.ceil(rows.length * 0.12));

  let anchors = clusters
    .filter(cluster => cluster.count >= minSupport || cluster.widthScore > 90)
    .map(cluster => ({ x: cluster.center, support: cluster.count, score: cluster.score }))
    .sort((left, right) => left.x - right.x);

  anchors = removeNearDuplicateAnchors(anchors, Math.max(3, tolerance * 0.75));

  if (anchors.length < 2) {
    anchors = fallbackAnchorsFromRows(rows, tolerance);
  }

  if (anchors.length > 24) anchors = anchors.slice(0, 24);

  const densityScore = Math.min(1, segments.length / Math.max(1, rows.length * Math.max(1, anchors.length)));
  const supportScore = anchors.length
    ? Math.min(1, median(anchors.map(anchor => anchor.support), 0) / Math.max(2, rows.length * 0.18))
    : 0;
  const confidence = Math.round((0.42 + (densityScore * 0.25) + (supportScore * 0.33)) * 100) / 100;

  const warnings = [];
  if (anchors.length <= 1) warnings.push('Poucas colunas detectadas. Talvez a pagina nao contenha tabela ou precise do modo grade visual.');
  if (confidence < 0.62) warnings.push('Confianca estrutural moderada. Confira a previa e ajuste tolerancias se necessario.');

  return { anchors, columnCount: anchors.length, confidence: Math.min(1, confidence), warnings };
}

function buildVisualGridModel(segments, rows, pageWidth, settings) {
  const tolerance = Number(settings.columnTolerance || 9);
  const left = Math.max(0, percentile(segments.map(segment => segment.x), 0.02, 0));
  const right = Math.min(pageWidth, percentile(segments.map(segment => segment.right), 0.98, pageWidth));
  const typicalWidth = median(segments.map(segment => segment.width), 60);
  const step = Math.max(28, Math.min(90, typicalWidth * 0.9, tolerance * 5));
  const anchors = [];

  for (let x = left; x <= right; x += step) {
    anchors.push({ x, support: 1, score: 1 });
  }

  return {
    anchors,
    columnCount: anchors.length,
    confidence: 0.7,
    warnings: ['Modo grade visual usado: preserva posicao, mas pode criar mais colunas vazias.'],
  };
}

function clusterPositions(positions, tolerance) {
  const sorted = positions.filter(Number.isFinite).sort((left, right) => left - right);
  const clusters = [];

  for (const x of sorted) {
    let cluster = clusters.find(item => Math.abs(item.center - x) <= tolerance);
    if (!cluster) {
      cluster = { values: [], center: x, count: 0, widthScore: 0, score: 0 };
      clusters.push(cluster);
    }

    cluster.values.push(x);
    cluster.count += 1;
    cluster.center = median(cluster.values, x);
  }

  for (const cluster of clusters) {
    cluster.score = cluster.count / Math.max(1, clusters.length);
    cluster.widthScore = cluster.values.length ? Math.max(...cluster.values) - Math.min(...cluster.values) : 0;
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
    .sort((left, right) => right.segments.length - left.segments.length);

  const positions = [];
  for (const row of candidateRows.slice(0, 8)) {
    positions.push(...row.segments.map(segment => segment.x));
  }

  return removeNearDuplicateAnchors(
    clusterPositions(positions, tolerance)
      .map(cluster => ({ x: cluster.center, support: cluster.count, score: cluster.score }))
      .sort((left, right) => left.x - right.x),
    tolerance * 0.8,
  );
}

export function rowsToMatrix(rows, columnModel) {
  const anchors = columnModel.anchors;
  if (!anchors.length) {
    const matrix = rows.map(row => [row.text]);
    const rowMeta = rows.map(row => ({
      y: row.y,
      isBold: row.isBold,
      isItalic: row.isItalic,
      maxFontSize: row.maxFontSize,
      sourceText: row.text,
      cellMeta: [{
        bold: row.isBold,
        italic: row.isItalic,
        fontSize: row.maxFontSize,
        x: row.xStart,
        sourcePage: row.items[0]?.pageNumber || 0,
        sourceItemIds: row.items.map(item => item.id),
      }],
      isTitle: isTitleRow(row, [row.text]),
      isProbablyHeader: isProbablyHeader([row.text]),
    }));
    const cells = rows.map(row => [{
      value: row.text,
      sourcePage: row.items[0]?.pageNumber || 0,
      sourceItemIds: row.items.map(item => item.id),
      x: row.xStart,
      y: row.y,
      confidence: columnModel.confidence,
    }]);

    return { matrix, rowMeta, cells };
  }

  const matrix = [];
  const rowMeta = [];
  const cellModels = [];

  for (const row of rows) {
    const rowCells = Array.from({ length: anchors.length }, () => '');
    const meta = Array.from({ length: anchors.length }, () => ({ bold: false, italic: false, fontSize: 0, x: 0 }));
    const model = Array.from({ length: anchors.length }, () => ({
      value: '',
      sourcePage: row.items[0]?.pageNumber || 0,
      sourceItemIds: [],
      x: 0,
      y: row.y,
      confidence: columnModel.confidence,
    }));

    for (const segment of row.segments) {
      const columnIndex = findNearestAnchorIndex(segment.x, anchors);
      if (columnIndex < 0) continue;

      const existing = rowCells[columnIndex];
      rowCells[columnIndex] = existing
        ? `${existing} ${segment.text}`.replace(/\s+/g, ' ').trim()
        : segment.text;

      meta[columnIndex].bold = meta[columnIndex].bold || segment.isBold;
      meta[columnIndex].italic = meta[columnIndex].italic || segment.isItalic;
      meta[columnIndex].fontSize = Math.max(meta[columnIndex].fontSize, segment.fontSize || 0);
      meta[columnIndex].x = segment.x;
      meta[columnIndex].sourcePage = row.items[0]?.pageNumber || 0;
      meta[columnIndex].sourceItemIds = segment.rawItems.map(item => item.id);

      model[columnIndex].value = rowCells[columnIndex];
      model[columnIndex].sourceItemIds = [...new Set([...model[columnIndex].sourceItemIds, ...segment.rawItems.map(item => item.id)])];
      model[columnIndex].x = segment.x;
    }

    trimTrailingEmpty(rowCells, meta, model);
    matrix.push(rowCells);
    rowMeta.push({
      y: row.y,
      isBold: row.isBold,
      isItalic: row.isItalic,
      maxFontSize: row.maxFontSize,
      sourceText: row.text,
      cellMeta: meta,
      isTitle: isTitleRow(row, rowCells),
      isProbablyHeader: isProbablyHeader(rowCells),
    });
    cellModels.push(model);
  }

  return { matrix, rowMeta, cells: cellModels };
}

function findNearestAnchorIndex(x, anchors) {
  let best = -1;
  let distance = Infinity;
  for (let index = 0; index < anchors.length; index++) {
    const currentDistance = Math.abs(anchors[index].x - x);
    if (currentDistance < distance) {
      best = index;
      distance = currentDistance;
    }
  }
  return best;
}

function trimTrailingEmpty(cells, meta, models) {
  while (cells.length > 1 && !String(cells[cells.length - 1] || '').trim()) {
    cells.pop();
    meta.pop();
    models.pop();
  }
}

function isTitleRow(row, cells) {
  const nonEmpty = cells.filter(cell => String(cell || '').trim()).length;
  return nonEmpty === 1 && (row.isBold || row.maxFontSize >= 11.5 || row.text.length > 25);
}

function isProbablyHeader(cells) {
  const filled = cells.filter(cell => String(cell || '').trim());
  if (filled.length < 2) return false;
  const numeric = filled.filter(cellLooksNumeric).length;
  const uppercaseish = filled.filter(value => {
    const text = String(value).trim();
    return text.length >= 2 && text === text.toUpperCase();
  }).length;
  return numeric === 0 && uppercaseish >= Math.ceil(filled.length * 0.45);
}
