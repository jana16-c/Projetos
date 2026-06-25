export function buildDocumentResult({
  sourceFileName,
  totalPages,
  selectedPages,
  tables,
  pageDiagnostics,
  settings,
}) {
  return {
    sourceFileName,
    totalPages,
    selectedPages,
    tables: reindexTables(tables),
    pageDiagnostics,
    settings,
    manualChanges: [],
    createdAt: new Date().toISOString(),
  };
}

export function reindexTables(tables = []) {
  const counters = new Map();
  return tables.map(table => {
    const pageCount = (counters.get(table.pageNumber) || 0) + 1;
    counters.set(table.pageNumber, pageCount);
    return {
      ...table,
      tableIndex: pageCount,
      id: table.id || `P${table.pageNumber}_T${pageCount}`,
    };
  });
}

export function collectWarnings(documentResult) {
  const warnings = [];
  for (const diagnostic of documentResult.pageDiagnostics || []) {
    warnings.push(...(diagnostic.warnings || []));
  }
  for (const table of documentResult.tables || []) {
    warnings.push(...(table.warnings || []));
  }
  return [...new Set(warnings.filter(Boolean))];
}
