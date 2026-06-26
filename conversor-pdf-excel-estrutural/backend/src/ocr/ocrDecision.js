export function shouldUseOcr(pageData, settings = {}) {
  const sourceMode = String(settings.sourceMode || 'auto').toLowerCase();
  const itemCount = pageData?.items?.length || 0;
  const allCount = pageData?.allItems?.length || itemCount;
  const textLayerDetected = Boolean(pageData?.textLayerDetected);

  if (sourceMode === 'text') {
    return { shouldRun: false, mode: 'text', reason: 'Modo textual forçado.' };
  }

  if (sourceMode === 'ocr') {
    return { shouldRun: true, mode: 'ocr', reason: 'Modo OCR forçado.' };
  }

  if (sourceMode === 'hybrid') {
    return { shouldRun: true, mode: 'hybrid', reason: 'Modo híbrido forçado.' };
  }

  if (!textLayerDetected || itemCount < 3 || allCount < 3) {
    return { shouldRun: true, mode: 'auto', reason: 'Pouco texto detectado na página.' };
  }

  return { shouldRun: false, mode: 'auto', reason: 'Camada textual suficiente.' };
}
