import { average, cellLooksNumeric, clamp, median } from './geometry.js';

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
    uncertainRows: block.uncertainRows,
    leftOutRows: block.leftOutRows,
    bounds: {
      left: block.minX,
      right: block.maxX,
      top: block.rows[0]?.minY || 0,
      bottom: block.rows[block.rows.length - 1]?.maxY || 0,
    },
  };
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
