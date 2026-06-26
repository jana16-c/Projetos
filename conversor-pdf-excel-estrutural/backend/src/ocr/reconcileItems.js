export function reconcileTextItems({ pdfItems = [], ocrItems = [], minOcrConfidence = 45 } = {}) {
  const matchedOcrIds = new Set();
  const mergedItems = [];

  for (const pdfItem of pdfItems) {
    const best = findBestOcrMatch(pdfItem, ocrItems, matchedOcrIds, minOcrConfidence);
    if (!best) {
      mergedItems.push(tagPdfItem(pdfItem));
      continue;
    }

    matchedOcrIds.add(best.id);

    if (isBrokenPdfText(pdfItem, best)) {
      mergedItems.push({
        ...best,
        sourceType: 'ocr',
        alternativeSourceIds: [pdfItem.id],
        reconciliationConfidence: best.matchConfidence,
      });
      continue;
    }

    mergedItems.push({
      ...pdfItem,
      sourceType: 'pdf-text',
      alternativeSourceIds: [best.id],
      reconciliationConfidence: best.matchConfidence,
    });
  }

  for (const ocrItem of ocrItems) {
    if (matchedOcrIds.has(ocrItem.id)) continue;
    if (Number(ocrItem.ocrConfidence || 0) < minOcrConfidence) continue;
    if (overlapsExisting(ocrItem, mergedItems)) continue;

    mergedItems.push({
      ...ocrItem,
      sourceType: 'ocr',
      alternativeSourceIds: [],
      reconciliationConfidence: Math.max(0.5, Number(ocrItem.ocrConfidence || 0) / 100),
    });
  }

  mergedItems.sort((left, right) => (left.y - right.y) || (left.x - right.x) || (left.index - right.index));

  return {
    items: mergedItems,
    diagnostics: {
      pdfItems: pdfItems.length,
      ocrItems: ocrItems.length,
      mergedItems: mergedItems.length,
      matchedOcrItems: matchedOcrIds.size,
    },
  };
}

export function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function intersectionOverUnion(left, right) {
  const intersectionLeft = Math.max(left.x, right.x);
  const intersectionTop = Math.max(left.y, right.y);
  const intersectionRight = Math.min(left.right, right.right);
  const intersectionBottom = Math.min(left.bottom, right.bottom);

  const intersectionWidth = Math.max(0, intersectionRight - intersectionLeft);
  const intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea <= 0) return 0;

  const leftArea = Math.max(1, left.width * left.height);
  const rightArea = Math.max(1, right.width * right.height);
  return intersectionArea / Math.max(1, leftArea + rightArea - intersectionArea);
}

export function centerDistance(left, right) {
  const leftCenterX = left.x + (left.width / 2);
  const leftCenterY = left.y + (left.height / 2);
  const rightCenterX = right.x + (right.width / 2);
  const rightCenterY = right.y + (right.height / 2);
  return Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY);
}

export function isBrokenPdfText(pdfItem, ocrItem) {
  const pdfText = String(pdfItem?.text || '').trim();
  const ocrText = String(ocrItem?.text || '').trim();
  if (!pdfText || !ocrText) return false;

  const normalizedPdf = normalizeComparableText(pdfText);
  const normalizedOcr = normalizeComparableText(ocrText);
  if (normalizedPdf === normalizedOcr) return false;
  if (normalizedPdf.length >= normalizedOcr.length) return false;

  return normalizedOcr.includes(normalizedPdf) || /[\-_/]$/.test(pdfText) || pdfText.length <= 3;
}

function findBestOcrMatch(pdfItem, ocrItems, matchedOcrIds, minOcrConfidence) {
  let best = null;

  for (const ocrItem of ocrItems) {
    if (matchedOcrIds.has(ocrItem.id)) continue;
    if (Number(ocrItem.ocrConfidence || 0) < minOcrConfidence) continue;

    const iou = intersectionOverUnion(pdfItem, ocrItem);
    const distance = centerDistance(pdfItem, ocrItem);
    const averageHeight = Math.max(1, ((pdfItem.height || 0) + (ocrItem.height || 0)) / 2);
    const sameText = normalizeComparableText(pdfItem.text) === normalizeComparableText(ocrItem.text);
    const compatible = iou >= 0.35 || distance <= averageHeight * 0.6;

    if (!compatible) continue;

    const score = (sameText ? 0.6 : 0.2) + Math.min(0.3, iou) + Math.max(0, 0.1 - (distance / (averageHeight * 10)));
    if (!best || score > best.matchConfidence) {
      best = {
        ...ocrItem,
        matchConfidence: Math.max(0, Math.min(1, score)),
      };
    }
  }

  return best;
}

function overlapsExisting(ocrItem, items) {
  return items.some(item => {
    const iou = intersectionOverUnion(item, ocrItem);
    const distance = centerDistance(item, ocrItem);
    const averageHeight = Math.max(1, ((item.height || 0) + (ocrItem.height || 0)) / 2);
    return iou >= 0.35 || distance <= averageHeight * 0.5;
  });
}

function tagPdfItem(pdfItem) {
  return {
    ...pdfItem,
    sourceType: 'pdf-text',
    alternativeSourceIds: [],
    reconciliationConfidence: 1,
  };
}
