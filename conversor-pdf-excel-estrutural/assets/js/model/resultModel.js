export function buildDocumentResult({
  sourceFileName,
  totalPages,
  selectedPages,
  tables,
  pageDiagnostics,
  settings,
  pagesData = [],
}) {
  const documentResult = {
    sourceFileName,
    totalPages,
    selectedPages,
    tables: reindexTables(tables),
    pageDiagnostics,
    settings: normalizeSettings(settings),
    manualChanges: [],
    createdAt: new Date().toISOString(),
  };

  cacheInternalSourceState(documentResult, pagesData);
  return refreshDocumentResultDerivedState(documentResult);
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
  warnings.push(...(documentResult.validation?.contentConservation?.warnings || []));
  return [...new Set(warnings.filter(Boolean))];
}

export function refreshDocumentResultDerivedState(documentResult) {
  documentResult.version = '2.0';
  documentResult.source = {
    fileName: documentResult.sourceFileName,
    pageCount: Number(documentResult.totalPages || 0),
    selectedPages: [...(documentResult.selectedPages || [])],
  };

  documentResult.pages = readInternalValue(documentResult, '_pages', []).map(page => ({ ...page }));
  documentResult.unassignedTextItems = collectUnassignedTextItems(
    readInternalValue(documentResult, '_sourceItems', []),
    documentResult.tables,
  );
  documentResult.validation = {
    contentConservation: validateContentConservation(
      readInternalValue(documentResult, '_sourceItems', []),
      documentResult.tables,
      documentResult.unassignedTextItems,
    ),
  };
  documentResult.contentConservation = documentResult.validation.contentConservation;
  documentResult.warnings = collectWarnings(documentResult);
  documentResult.tableIr = buildTableIr(documentResult);
  return documentResult;
}

export function validateContentConservation(sourceItems = [], tables = [], unassignedTextItems = []) {
  const knownIds = new Set(sourceItems.map(item => item.id));
  const usages = new Map();

  for (const table of tables) {
    for (const row of table.cells || []) {
      for (const cell of row || []) {
        for (const id of cell?.sourceItemIds || []) {
          usages.set(id, (usages.get(id) || 0) + 1);
        }
      }
    }
  }

  const unassignedCounts = new Map();
  for (const item of unassignedTextItems) {
    if (!item?.id) continue;
    unassignedCounts.set(item.id, (unassignedCounts.get(item.id) || 0) + 1);
  }

  const duplicated = [...new Set([
    ...[...usages.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    ...[...unassignedCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    ...[...unassignedCounts.keys()].filter(id => usages.has(id)),
  ])];
  const missing = sourceItems
    .filter(item => !usages.has(item.id) && !unassignedCounts.has(item.id))
    .map(item => item.id);
  const unknownUnassigned = [...unassignedCounts.keys()].filter(id => !knownIds.has(id));
  const warnings = [];

  if (duplicated.length) warnings.push(`Itens de origem duplicados: ${duplicated.length}.`);
  if (missing.length) warnings.push(`Itens de origem ausentes: ${missing.length}.`);
  if (unknownUnassigned.length) warnings.push(`Itens nao associados sem origem conhecida: ${unknownUnassigned.length}.`);

  return {
    valid: duplicated.length === 0 && missing.length === 0 && unknownUnassigned.length === 0,
    duplicated,
    missing,
    unknownUnassigned,
    assignedCount: usages.size,
    unassignedCount: unassignedCounts.size,
    warnings,
  };
}

function normalizeSettings(settings = {}) {
  return {
    ...settings,
    outputMode: settings.mode === 'visual-grid' ? 'geometric-replica' : 'clean-table',
    sheetMode: settings.sheetMode || 'table',
  };
}

function cacheInternalSourceState(documentResult, pagesData = []) {
  defineInternalValue(documentResult, '_sourceItems', collectSourceItems(pagesData));
  defineInternalValue(documentResult, '_pages', pagesData.map(page => ({
    pageNumber: page.pageNumber,
    widthPt: round(page.width),
    heightPt: round(page.height),
    rotation: Number(page.rotation || 0),
    textLayerDetected: Boolean(page.textLayerDetected),
  })));
}

function collectSourceItems(pagesData = []) {
  const seen = new Set();
  const items = [];

  for (const page of pagesData) {
    for (const item of page.allItems || page.items || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push({
        id: item.id,
        pageNumber: item.pageNumber,
        text: item.text || '',
        rawText: item.rawText || item.text || '',
        x: round(item.x),
        y: round(item.y),
        width: round(item.width),
        height: round(item.height),
      });
    }
  }

  return items;
}

function collectUnassignedTextItems(sourceItems = [], tables = []) {
  const assignedIds = new Set();

  for (const table of tables) {
    for (const row of table.cells || []) {
      for (const cell of row || []) {
        for (const id of cell?.sourceItemIds || []) {
          assignedIds.add(id);
        }
      }
    }
  }

  return sourceItems
    .filter(item => !assignedIds.has(item.id))
    .map(item => ({ ...item }));
}

function buildTableIr(documentResult) {
  return {
    version: documentResult.version,
    source: { ...documentResult.source },
    settings: { ...documentResult.settings },
    pages: (documentResult.pages || []).map(page => ({ ...page })),
    tables: (documentResult.tables || []).map(table => buildTableIrTable(table)),
    unassignedTextItems: (documentResult.unassignedTextItems || []).map(item => ({ ...item })),
    warnings: [...(documentResult.warnings || [])],
    validation: {
      contentConservation: {
        ...(documentResult.validation?.contentConservation || {}),
        duplicated: [...(documentResult.validation?.contentConservation?.duplicated || [])],
        missing: [...(documentResult.validation?.contentConservation?.missing || [])],
        unknownUnassigned: [...(documentResult.validation?.contentConservation?.unknownUnassigned || [])],
        warnings: [...(documentResult.validation?.contentConservation?.warnings || [])],
      },
    },
  };
}

function buildTableIrTable(table) {
  const rowCount = table.matrix?.length || 0;
  const columnCount = Math.max(0, ...((table.matrix || []).map(row => row.length)));

  return {
    id: table.id,
    sourcePages: [...(table.sourcePages || [])],
    layoutMode: table.columnModel?.anchors?.length ? 'column-anchors' : 'text-flow',
    rows: rowCount,
    columns: columnCount,
    xBoundaries: (table.columnModel?.anchors || []).map(anchor => round(anchor.x)),
    yBoundaries: (table.rowMeta || []).map(meta => round(meta.y)),
    headerRows: Number.isInteger(table.headerRowIndex) && table.headerRowIndex >= 0 ? [table.headerRowIndex] : [],
    cells: flattenTableCells(table, columnCount),
    pageBreaks: (table.pageBreaks || []).map(pageBreak => clonePageBreak(pageBreak)),
    warnings: [...(table.warnings || [])],
  };
}

function flattenTableCells(table, columnCount) {
  const cells = [];

  for (let rowIndex = 0; rowIndex < (table.matrix?.length || 0); rowIndex++) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const value = table.matrix[rowIndex]?.[columnIndex] ?? '';
      const cell = table.cells?.[rowIndex]?.[columnIndex] || {};
      const meta = table.rowMeta?.[rowIndex]?.cellMeta?.[columnIndex] || {};
      cells.push({
        id: `${table.id}_R${rowIndex + 1}C${columnIndex + 1}`,
        row: rowIndex,
        column: columnIndex,
        rowSpan: 1,
        columnSpan: 1,
        rawText: String(value || ''),
        displayText: String(value || ''),
        value: cell.normalizedValue ?? cell.value ?? value ?? '',
        valueType: cell.type || inferValueType(cell.value ?? value),
        sourceItemIds: [...(cell.sourceItemIds || [])],
        bounds: {
          pageNumber: cell.sourcePage || table.pageNumber,
          x: round(cell.x),
          y: round(cell.y),
          width: round(cell.width),
          height: round(cell.height),
        },
        style: {
          fontSizePt: meta.fontSize || table.rowMeta?.[rowIndex]?.maxFontSize || null,
          bold: Boolean(meta.bold || table.rowMeta?.[rowIndex]?.isBold),
          italic: Boolean(meta.italic || table.rowMeta?.[rowIndex]?.isItalic),
        },
        confidence: {
          overall: round(cell.confidence ?? table.confidence ?? 0),
        },
        warnings: [],
      });
    }
  }

  return cells;
}

function clonePageBreak(pageBreak) {
  return {
    ...pageBreak,
    removedHeader: pageBreak.removedHeader ? {
      row: [...(pageBreak.removedHeader.row || [])],
      cells: (pageBreak.removedHeader.cells || []).map(cell => ({ ...cell })),
      rowMeta: pageBreak.removedHeader.rowMeta
        ? {
          ...pageBreak.removedHeader.rowMeta,
          cellMeta: (pageBreak.removedHeader.rowMeta.cellMeta || []).map(cell => ({ ...cell })),
        }
        : null,
      rowIndex: pageBreak.removedHeader.rowIndex ?? 0,
    } : null,
  };
}

function inferValueType(value) {
  if (value === null || value === undefined || value === '') return 'empty';
  return typeof value === 'number' ? 'number' : 'text';
}

function defineInternalValue(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

function readInternalValue(target, key, fallback) {
  return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : fallback;
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}
