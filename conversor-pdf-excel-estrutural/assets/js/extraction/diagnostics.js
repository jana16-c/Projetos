export function buildDiagnostics(pageAnalysis, settings) {
  const warnings = [...(pageAnalysis.warnings || [])];
  const codes = [];

  if (!pageAnalysis.textLayerDetected) {
    warnings.push('Esta pagina parece ser uma imagem ou PDF escaneado. A versao atual requer uma camada de texto.');
    codes.push({
      code: 'PAGE_WITHOUT_TEXT_LAYER',
      severity: 'warning',
    });
  }

  return {
    pageNumber: pageAnalysis.pageNumber,
    pageWidth: round(pageAnalysis.width),
    pageHeight: round(pageAnalysis.height),
    textItems: pageAnalysis.items.length,
    allTextItems: pageAnalysis.allItems?.length || pageAnalysis.items.length,
    rows: pageAnalysis.rows.length,
    hiddenRepeatedRows: pageAnalysis.hiddenRows.length,
    tables: pageAnalysis.tables.length,
    columns: Math.max(...pageAnalysis.tables.map(table => table.columnModel.columnCount || 0), 0),
    confidence: roundConfidence(pageAnalysis.tables),
    warnings,
    codes,
    settings: {
      mode: settings.mode,
      rowTolerance: Number(settings.rowTolerance),
      columnTolerance: Number(settings.columnTolerance),
      gapFactor: Number(settings.gapFactor),
      ignoreTopPct: Number(settings.ignoreTopPct),
      ignoreBottomPct: Number(settings.ignoreBottomPct),
      ignoreLeftPct: Number(settings.ignoreLeftPct),
      ignoreRightPct: Number(settings.ignoreRightPct),
    },
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundConfidence(tables) {
  if (!tables.length) return 0;
  return round(tables.reduce((acc, table) => acc + (table.confidence || 0), 0) / tables.length);
}
