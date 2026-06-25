import { average, cellLooksNumeric, clamp, median } from './geometry.js';

export function detectTableBlocks(rows, pageWidth) {
  if (!rows.length) return [];

  const heights = rows.map(row => row.height).filter(Boolean);
  const medianHeight = median(heights, 12);
  const blocks = [];
  let current = null;
  let separatorBudget = 1;
  let nonTabularStreak = 0;

  for (const row of rows) {
    const analysis = analyzeRow(row, pageWidth);
    if (!current) {
      if (analysis.candidate) {
        current = startBlock(row, analysis);
      }
      continue;
    }

    const verticalGap = Math.max(0, row.minY - current.lastMaxY);
    const gapBreak = verticalGap > medianHeight * 2.2;

    if (gapBreak || nonTabularStreak >= 2) {
      blocks.push(finalizeBlock(current));
      current = analysis.candidate ? startBlock(row, analysis) : null;
      separatorBudget = 1;
      nonTabularStreak = 0;
      continue;
    }

    if (analysis.candidate) {
      addRowToBlock(current, row, analysis);
      separatorBudget = 1;
      nonTabularStreak = 0;
      continue;
    }

    if (separatorBudget > 0 && looksLikeSoftSeparator(row)) {
      addRowToBlock(current, row, analysis);
      separatorBudget -= 1;
      continue;
    }

    nonTabularStreak += 1;
  }

  if (current) {
    blocks.push(finalizeBlock(current));
  }

  return blocks
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

  const candidate = nonEmpty.length >= 2 || numericCount >= 2 || hasHeaderProfile;
  const score = (
    (repeatedSpread * 0.3)
    + (clamp(nonEmpty.length / 6, 0, 1) * 0.25)
    + (clamp(numericCount / Math.max(1, nonEmpty.length), 0, 1) * 0.2)
    + (hasHeaderProfile ? 0.15 : 0)
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
    lastMaxY: row.maxY,
    minX: row.xStart,
    maxX: row.xEnd,
  };
}

function addRowToBlock(block, row, analysis) {
  block.rows.push(row);
  block.scores.push(analysis.score);
  block.candidates.push(analysis);
  block.lastMaxY = row.maxY;
  block.minX = Math.min(block.minX, row.xStart);
  block.maxX = Math.max(block.maxX, row.xEnd);
}

function finalizeBlock(block) {
  const rowCounts = block.candidates.map(item => item.segmentCount);
  const numericDistribution = average(block.candidates.map(item => item.numericCount / Math.max(1, item.segmentCount)), 0);
  const rowConsistency = 1 - clamp(
    average(rowCounts.map(count => Math.abs(count - median(rowCounts, 0))), 0) / Math.max(1, median(rowCounts, 1)),
    0,
    1,
  );
  const columnRepetition = clamp(median(rowCounts, 0) / Math.max(2, Math.max(...rowCounts, 0)), 0, 1);
  const headerLikelihood = block.rows.slice(0, 3).some(row => row.isBold && row.segments.length >= 2) ? 0.85 : 0.45;
  const rowCountScore = clamp(block.rows.length / 6, 0, 1);
  const confidence = (
    (0.3 * columnRepetition)
    + (0.25 * rowConsistency)
    + (0.2 * numericDistribution)
    + (0.15 * headerLikelihood)
    + (0.1 * rowCountScore)
  );

  if (confidence < 0.6) {
    block.warnings.push('Tabela com confianca baixa. Revise a previa antes de exportar.');
  }

  return {
    rows: block.rows,
    confidence: Math.round(confidence * 100) / 100,
    warnings: block.warnings,
    bounds: {
      left: block.minX,
      right: block.maxX,
      top: block.rows[0]?.minY || 0,
      bottom: block.rows[block.rows.length - 1]?.maxY || 0,
    },
  };
}

function looksLikeSoftSeparator(row) {
  return row.segments.length <= 1 && row.text.length <= 60;
}
