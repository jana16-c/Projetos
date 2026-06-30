import { average, cellLooksNumeric, clamp, median } from './geometry.js?v=2026-06-30-livepreview-3';

export function detectTableBlocks(rows, pageWidth) {
  if (!rows.length) return [];

  const heights = rows.map(row => row.height).filter(Boolean);
  const medianHeight = median(heights, 12);
  const blocks = [];
  let current = null;
  let separatorBudget = 2;
  let nonTabularStreak = 0;
  let pendingOutsideRows = [];

  for (const row of rows) {
    const analysis = analyzeRow(row, pageWidth);
    if (!current) {
      if (analysis.candidate) {
        current = startBlock(row, analysis);
      } else {
        pendingOutsideRows.push({ row, analysis });
      }
      continue;
    }

    const verticalGap = Math.max(0, row.minY - current.lastMaxY);
    const gapBreak = verticalGap > medianHeight * 2.2;

    if (gapBreak || nonTabularStreak >= 3) {
      absorbNearbyRows(current, pendingOutsideRows, medianHeight);
      blocks.push(finalizeBlock(current));
      current = analysis.candidate ? startBlock(row, analysis) : null;
      separatorBudget = 1;
      nonTabularStreak = 0;
      pendingOutsideRows = current ? [] : [{ row, analysis }];
      continue;
    }

    if (analysis.candidate) {
      addRowToBlock(current, row, analysis);
      separatorBudget = 1;
      nonTabularStreak = 0;
      continue;
    }

    if (shouldKeepAsUncertainRow(current, row, analysis, medianHeight)) {
      addRowToBlock(current, row, {
        ...analysis,
        score: Math.max(analysis.score, 0.42),
        uncertain: true,
      });
      separatorBudget -= 1;
      continue;
    }

    pendingOutsideRows.push({ row, analysis });
    nonTabularStreak += 1;
  }

  if (current) {
    absorbNearbyRows(current, pendingOutsideRows, medianHeight);
    blocks.push(finalizeBlock(current));
  }

  return blocks
    .flatMap(block => splitCompositeBlock(block, pageWidth))
    .filter(block => block.rows.length >= 2)
    .map((block, index) => ({
      ...block,
      tableIndex: index + 1,
    }));
}

function analyzeRow(row, pageWidth) {
  const segments = row.segments || [];
  const nonEmpty = segments.filter(segment => String(segment.text || '').trim());
  const numericCount = nonEmpty.filter(segment => cellLooksNumeric(segment.text)).length;
  const repeatedSpread = nonEmpty.length >= 2
    ? clamp((row.xEnd - row.xStart) / Math.max(80, pageWidth * 0.55), 0, 1)
    : 0;
  const hasHeaderProfile = row.isBold && nonEmpty.length >= 2 && numericCount === 0;
  const singleCellContinuation = nonEmpty.length === 1 && (
    row.isBold
    || numericCount === 1
    || String(row.text || '').trim().length >= 18
  );

  const candidate = nonEmpty.length >= 2 || numericCount >= 2 || hasHeaderProfile || singleCellContinuation;
  const score = (
    (repeatedSpread * 0.3)
    + (clamp(nonEmpty.length / 6, 0, 1) * 0.25)
    + (clamp(numericCount / Math.max(1, nonEmpty.length), 0, 1) * 0.2)
    + (hasHeaderProfile ? 0.15 : 0)
    + (singleCellContinuation ? 0.08 : 0)
    + (nonEmpty.length >= 3 ? 0.1 : 0)
  );

  return {
    candidate,
    score,
    numericCount,
    segmentCount: nonEmpty.length,
  };
}

function startBlock(row, analysis) {
  return {
    rows: [row],
    scores: [analysis.score],
    candidates: [analysis],
    warnings: [],
    uncertainRows: [],
    leftOutRows: [],
    lastMaxY: row.maxY,
    minX: row.xStart,
    maxX: row.xEnd,
  };
}

function addRowToBlock(block, row, analysis) {
  const nextRow = {
    ...row,
    confidence: round(Math.max(analysis.score || 0, 0.35)),
    isUncertain: Boolean(analysis.uncertain),
  };

  block.rows.push(nextRow);
  block.scores.push(analysis.score);
  block.candidates.push(analysis);
  block.lastMaxY = nextRow.maxY;
  block.minX = Math.min(block.minX, nextRow.xStart);
  block.maxX = Math.max(block.maxX, nextRow.xEnd);
  if (analysis.uncertain) {
    block.uncertainRows.push(nextRow);
  }
}

function finalizeBlock(block) {
  return summarizeBlock(block.rows, block.warnings, block.uncertainRows, block.leftOutRows);
}

function summarizeBlock(rows, warnings = [], uncertainRows = [], leftOutRows = []) {
  const analyses = rows.map(row => analyzeRow(row, Math.max(1, row.xEnd || row.xStart || 1)));
  const rowCounts = analyses.map(item => item.segmentCount);
  const numericDistribution = average(analyses.map(item => item.numericCount / Math.max(1, item.segmentCount)), 0);
  const rowConsistency = 1 - clamp(
    average(rowCounts.map(count => Math.abs(count - median(rowCounts, 0))), 0) / Math.max(1, median(rowCounts, 1)),
    0,
    1,
  );
  const columnRepetition = clamp(median(rowCounts, 0) / Math.max(2, Math.max(...rowCounts, 0)), 0, 1);
  const headerLikelihood = rows.slice(0, 3).some(row => row.isBold && row.segments.length >= 2) ? 0.85 : 0.45;
  const rowCountScore = clamp(rows.length / 6, 0, 1);
  const confidence = (
    (0.3 * columnRepetition)
    + (0.25 * rowConsistency)
    + (0.2 * numericDistribution)
    + (0.15 * headerLikelihood)
    + (0.1 * rowCountScore)
  );

  const nextWarnings = [...warnings];
  if (confidence < 0.6) {
    nextWarnings.push('Tabela com confianca baixa. Revise a previa antes de exportar.');
  }

  return {
    rows,
    confidence: Math.round(confidence * 100) / 100,
    warnings: [...new Set(nextWarnings)],
    uncertainRows,
    leftOutRows,
    bounds: {
      left: Math.min(...rows.map(row => row.xStart), 0),
      right: Math.max(...rows.map(row => row.xEnd), 0),
      top: rows[0]?.minY || 0,
      bottom: rows[rows.length - 1]?.maxY || 0,
    },
  };
}

function splitCompositeBlock(block, pageWidth) {
  const parts = [];
  let remaining = [...(block.rows || [])];

  while (remaining.length >= 2) {
    const splitIndex = findPreludeSplitIndex(remaining);
    if (splitIndex <= 0) {
      parts.push(summarizeBlock(remaining, block.warnings, block.uncertainRows, block.leftOutRows));
      break;
    }

    const head = remaining.slice(0, splitIndex);
    const tail = remaining.slice(splitIndex);
    if (head.length >= 2) {
      parts.push(summarizeBlock(head, block.warnings, block.uncertainRows.filter(row => head.includes(row)), block.leftOutRows));
    }
    remaining = tail;
  }

  return parts.length ? parts : [block];
}

function findPreludeSplitIndex(rows = []) {
  for (let index = 0; index < rows.length - 2; index++) {
    if (!isTotalBoundaryRow(rows[index])) continue;
    const probe = rows.slice(index + 1, index + 7);
    const preludeCount = probe.filter(isNextTablePreludeRow).length;
    if (preludeCount >= 2) return index + 1;
  }
  return -1;
}

function looksLikeSoftSeparator(row) {
  return row.segments.length <= 1 && row.text.length <= 120;
}

function shouldKeepAsUncertainRow(block, row, analysis, medianHeight) {
  if (!block) return false;
  if (looksLikeSoftSeparator(row) && isNearCurrentBlock(block, row, medianHeight)) return true;
  if (analysis.segmentCount <= 1 && isInsideExpandedBounds(block, row, 18)) return true;
  return false;
}

function absorbNearbyRows(block, pendingRows, medianHeight) {
  if (!block) return;

  const stillOutside = [];
  for (const entry of pendingRows) {
    if (isInsideExpandedBounds(block, entry.row, 22) && isNearCurrentBlock(block, entry.row, medianHeight * 1.4)) {
      addRowToBlock(block, entry.row, {
        ...entry.analysis,
        score: Math.max(entry.analysis.score || 0.35, 0.38),
        uncertain: true,
      });
      continue;
    }

    stillOutside.push(entry.row);
  }

  block.leftOutRows.push(...stillOutside);
}

function isInsideExpandedBounds(block, row, padding) {
  return row.xStart <= (block.maxX + padding) && row.xEnd >= (block.minX - padding);
}

function isNearCurrentBlock(block, row, maxGap) {
  const gap = Math.max(0, row.minY - block.lastMaxY);
  return gap <= maxGap;
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isTotalBoundaryRow(row) {
  const text = normalizeLooseText(row?.text || '');
  return /\btotal\b/.test(text);
}

function isNextTablePreludeRow(row) {
  const text = normalizeLooseText(row?.text || '');
  if (!text) return false;
  if (/^demonstrativo\b/.test(text)) return true;
  if (/^(nome|periodo|comentario|incidencia)\b/.test(text)) return true;
  if (/recolher em conta vinculada/.test(text)) return true;
  if (/calculo homologado/.test(text)) return true;
  if (/^fgts\b/.test(text) || /^juros\b/.test(text)) return true;
  return row?.segments?.length <= 1 && text.length >= 18 && !cellLooksNumeric(text);
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s:%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
