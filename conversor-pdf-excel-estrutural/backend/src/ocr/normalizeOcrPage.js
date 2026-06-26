export function normalizeOcrPage(rawPage, options = {}) {
  return {
    pageNumber: Number(rawPage?.pageNumber || options.pageNumber || 0),
    dpi: Number(rawPage?.dpi || options.dpi || 300),
    languages: rawPage?.languages || options.languages || 'por+eng',
    ocrWords: Array.isArray(rawPage?.ocrWords) ? rawPage.ocrWords.map(word => ({ ...word })) : [],
    horizontalLines: Array.isArray(rawPage?.horizontalLines) ? rawPage.horizontalLines.map(line => ({ ...line })) : [],
    verticalLines: Array.isArray(rawPage?.verticalLines) ? rawPage.verticalLines.map(line => ({ ...line })) : [],
    visualTables: Array.isArray(rawPage?.visualTables) ? rawPage.visualTables.map(table => ({ ...table })) : [],
    warnings: Array.isArray(rawPage?.warnings) ? [...rawPage.warnings] : [],
  };
}
