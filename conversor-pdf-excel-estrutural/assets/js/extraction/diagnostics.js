export function buildDiagnostics(pageData, rows, columnModel, matrix, settings) {
  const warnings = [...(columnModel.warnings || [])];

  if (!pageData.items.length) warnings.push('A página não retornou texto. Pode ser página escaneada ou imagem.');
  if (rows.length && matrix.every(row => row.length <= 1)) warnings.push('A extração encontrou apenas uma coluna. Verifique se o PDF é tabela ou texto corrido.');

  return {
    pageNumber: pageData.pageNumber,
    pageWidth: round(pageData.width),
    pageHeight: round(pageData.height),
    textItems: pageData.items.length,
    rows: rows.length,
    columns: columnModel.columnCount,
    confidence: columnModel.confidence,
    warnings,
    settings: {
      mode: settings.mode,
      rowTolerance: Number(settings.rowTolerance),
      columnTolerance: Number(settings.columnTolerance),
      gapFactor: Number(settings.gapFactor),
    },
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
