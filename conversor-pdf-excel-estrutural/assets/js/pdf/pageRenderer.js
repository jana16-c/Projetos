export async function renderPdfPageToPng(page, options = {}) {
  const dpi = clampDpi(options.dpi);
  const rotation = Number(options.rotation ?? page.rotate ?? 0);
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const renderViewport = page.getViewport({ scale: dpi / 72, rotation });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });

  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);

  await page.render({
    canvasContext: context,
    viewport: renderViewport,
  }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  const displayWidthPx = Math.round(baseViewport.width * 96 / 72);
  const displayHeightPx = Math.round(baseViewport.height * 96 / 72);

  page.cleanup?.();
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    dpi,
    rotation,
    widthPt: baseViewport.width,
    heightPt: baseViewport.height,
    widthPx: renderViewport.width,
    heightPx: renderViewport.height,
    displayWidthPx,
    displayHeightPx,
  };
}

function clampDpi(value) {
  const dpi = Number(value);
  if (!Number.isFinite(dpi)) return 300;
  return Math.max(150, Math.min(450, dpi));
}
