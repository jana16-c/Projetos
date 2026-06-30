export function scoreTextLayerQuality(pageData = {}) {
  const items = Array.isArray(pageData.allItems) && pageData.allItems.length
    ? pageData.allItems
    : Array.isArray(pageData.items) ? pageData.items : [];
  const pageWidth = Math.max(1, Number(pageData.width || pageData.widthPt || 0) || 1);
  const pageHeight = Math.max(1, Number(pageData.height || pageData.heightPt || 0) || 1);
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const texts = items.map(item => String(item?.text || item?.rawText || '').trim()).filter(Boolean);
  const joinedText = texts.join('');
  const printableChars = joinedText.replace(/[^\x20-\x7E\u00A0-\u024F]/g, '');
  const printableRatio = joinedText.length ? printableChars.length / joinedText.length : 0;
  const singleCharRatio = items.length ? items.filter(item => String(item?.text || '').trim().length <= 1).length / items.length : 1;
  const numericItemRatio = items.length ? items.filter(item => /\d/.test(String(item?.text || item?.rawText || ''))).length / items.length : 0;
  const coverageRatio = Math.min(1, items.reduce((sum, item) => sum + approximateItemArea(item), 0) / pageArea);
  const coordinateConsistency = items.length ? items.filter(item => hasConsistentBounds(item, pageWidth, pageHeight)).length / items.length : 0;
  const overlapRatio = estimateAbnormalOverlapRatio(items);
  const repetitionRatio = estimateRepetitionRatio(texts);

  let score = 100;
  const reasons = [];

  if (items.length < 3) {
    score -= 55;
    reasons.push('poucos_itens');
  } else if (items.length < 12) {
    score -= 18;
    reasons.push('itens_limitados');
  }

  if (printableRatio < 0.82) {
    score -= 30;
    reasons.push('baixo_texto_imprimivel');
  } else if (printableRatio < 0.93) {
    score -= 10;
    reasons.push('texto_imprimivel_irregular');
  }

  if (singleCharRatio > 0.72) {
    score -= 24;
    reasons.push('itens_muito_fragmentados');
  } else if (singleCharRatio > 0.5) {
    score -= 10;
    reasons.push('fragmentacao_moderada');
  }

  if (coverageRatio < 0.0025) {
    score -= 16;
    reasons.push('cobertura_muito_baixa');
  } else if (coverageRatio > 0.6) {
    score -= 8;
    reasons.push('cobertura_anormal');
  }

  if (coordinateConsistency < 0.9) {
    score -= 28;
    reasons.push('coordenadas_inconsistentes');
  } else if (coordinateConsistency < 0.98) {
    score -= 10;
    reasons.push('algumas_coordenadas_inconsistentes');
  }

  if (overlapRatio > 0.24) {
    score -= 24;
    reasons.push('sobreposicao_anormal');
  } else if (overlapRatio > 0.1) {
    score -= 10;
    reasons.push('sobreposicao_moderada');
  }

  if (repetitionRatio > 0.5) {
    score -= 18;
    reasons.push('repeticao_excessiva');
  } else if (repetitionRatio > 0.3) {
    score -= 8;
    reasons.push('repeticao_moderada');
  }

  if (numericItemRatio < 0.08 && items.length >= 8) {
    score -= 8;
    reasons.push('poucos_padroes_numericos');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const classification = score >= 72 ? 'good' : (score >= 45 ? 'suspect' : 'bad');

  return {
    score,
    classification,
    reasons,
    metrics: {
      itemCount: items.length,
      printableRatio: round(printableRatio),
      singleCharRatio: round(singleCharRatio),
      numericItemRatio: round(numericItemRatio),
      coverageRatio: round(coverageRatio),
      coordinateConsistency: round(coordinateConsistency),
      abnormalOverlapRatio: round(overlapRatio),
      repetitionRatio: round(repetitionRatio),
      pageWidth,
      pageHeight,
    },
  };
}

function approximateItemArea(item) {
  const width = Math.max(0, Number(item?.width || 0));
  const height = Math.max(0, Number(item?.height || 0));
  return width * height;
}

function hasConsistentBounds(item, pageWidth, pageHeight) {
  const x = Number(item?.x);
  const y = Number(item?.y);
  const right = Number(item?.right ?? (x + Number(item?.width || 0)));
  const bottom = Number(item?.bottom ?? (y + Number(item?.height || 0)));
  if (![x, y, right, bottom].every(Number.isFinite)) return false;
  if (right <= x || bottom <= y) return false;
  if (x < -4 || y < -4) return false;
  if (right > pageWidth + 4 || bottom > pageHeight + 4) return false;
  return true;
}

function estimateAbnormalOverlapRatio(items = []) {
  if (items.length < 2) return 0;
  const capped = items.slice(0, 160);
  let overlappingPairs = 0;
  let totalPairs = 0;

  for (let index = 0; index < capped.length; index++) {
    for (let nextIndex = index + 1; nextIndex < capped.length; nextIndex++) {
      const verticalGap = Math.abs(Number(capped[index]?.y || 0) - Number(capped[nextIndex]?.y || 0));
      if (verticalGap > Math.max(18, Number(capped[index]?.height || 0) * 2, Number(capped[nextIndex]?.height || 0) * 2)) continue;
      totalPairs += 1;
      if (boxOverlapRatio(capped[index], capped[nextIndex]) > 0.55) overlappingPairs += 1;
    }
  }

  return totalPairs ? overlappingPairs / totalPairs : 0;
}

function estimateRepetitionRatio(texts = []) {
  const normalized = texts
    .map(text => String(text || '').trim().toLowerCase())
    .filter(text => text.length >= 2);
  if (!normalized.length) return 0;

  const counts = new Map();
  for (const text of normalized) {
    counts.set(text, (counts.get(text) || 0) + 1);
  }

  const maxCount = Math.max(0, ...counts.values());
  return maxCount / normalized.length;
}

function boxOverlapRatio(left, right) {
  const leftX = Number(left?.x || 0);
  const leftY = Number(left?.y || 0);
  const leftRight = Number(left?.right ?? (leftX + Number(left?.width || 0)));
  const leftBottom = Number(left?.bottom ?? (leftY + Number(left?.height || 0)));
  const rightX = Number(right?.x || 0);
  const rightY = Number(right?.y || 0);
  const rightRight = Number(right?.right ?? (rightX + Number(right?.width || 0)));
  const rightBottom = Number(right?.bottom ?? (rightY + Number(right?.height || 0)));

  const width = Math.max(0, Math.min(leftRight, rightRight) - Math.max(leftX, rightX));
  const height = Math.max(0, Math.min(leftBottom, rightBottom) - Math.max(leftY, rightY));
  const overlap = width * height;
  if (!overlap) return 0;

  const leftArea = Math.max(1, (leftRight - leftX) * (leftBottom - leftY));
  const rightArea = Math.max(1, (rightRight - rightX) * (rightBottom - rightY));
  return overlap / Math.min(leftArea, rightArea);
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}
