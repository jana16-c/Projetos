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
  for (const diagnostic of documentResult.pageDiagnostics || []) warnings.push(...(diagnostic.warnings || []));
  for (const page of documentResult.pages || []) warnings.push(...(page.warnings || []));
  for (const table of documentResult.tables || []) warnings.push(...(table.warnings || []));
  warnings.push(...(documentResult.validation?.contentConservation?.warnings || []));
  return [...new Set(warnings.filter(Boolean))];
}

export function refreshDocumentResultDerivedState(documentResult) {
  documentResult.version = '3.0';
  documentResult.source = {
    fileName: documentResult.sourceFileName,
    pageCount: Number(documentResult.totalPages || 0),
    selectedPages: [...(documentResult.selectedPages || [])],
  };

  const sourceItems = readInternalValue(documentResult, '_sourceItems', []).map(item => ({ ...item }));
  const runtimePages = readInternalValue(documentResult, '_pages', []).map(page => ({ ...page }));
  const tableBoundsIndex = buildTableBoundsIndex(documentResult.tables);
  const unassignedTextItems = collectUnassignedTextItems(sourceItems, documentResult.tables, runtimePages, tableBoundsIndex);
  const validation = {
    contentConservation: validateContentConservation({
      sourceItems,
      tables: documentResult.tables,
      unassignedTextItems,
      pages: runtimePages,
      tableBoundsIndex,
    }),
  };
  const pages = buildPageStates({
    pages: runtimePages,
    sourceItems,
    tables: documentResult.tables,
    unassignedTextItems,
    validation: validation.contentConservation,
    tableBoundsIndex,
  });

  documentResult.sourceItems = sourceItems;
  documentResult.pages = pages;
  documentResult.ocr = buildOcrState(documentResult);
  documentResult.unassignedTextItems = unassignedTextItems;
  documentResult.validation = validation;
  documentResult.contentConservation = validation.contentConservation;
  documentResult.warnings = collectWarnings(documentResult);
  documentResult.tableIr = buildTableIr(documentResult);
  return documentResult;
}

export function hydrateDocumentResult(serialized = {}) {
  const documentResult = {
    sourceFileName: serialized.sourceFileName || serialized.source?.fileName || 'arquivo.pdf',
    totalPages: Number(serialized.totalPages || serialized.source?.pageCount || 0),
    selectedPages: [...(serialized.selectedPages || serialized.source?.selectedPages || [])],
    tables: reindexTables(serialized.tables || []),
    pageDiagnostics: Array.isArray(serialized.pageDiagnostics) ? serialized.pageDiagnostics.map(item => ({ ...item })) : [],
    settings: normalizeSettings(serialized.settings || {}),
    manualChanges: Array.isArray(serialized.manualChanges) ? [...serialized.manualChanges] : [],
    createdAt: serialized.createdAt || new Date().toISOString(),
  };

  defineInternalValue(
    documentResult,
    '_sourceItems',
    Array.isArray(serialized.sourceItems) ? serialized.sourceItems.map(item => ({ ...item })) : [],
  );
  defineInternalValue(
    documentResult,
    '_pages',
    Array.isArray(serialized.pages) ? serialized.pages.map(page => ({ ...page })) : [],
  );

  return refreshDocumentResultDerivedState(documentResult);
}

export function attachRuntimePageArtifacts(documentResult, pagesData = []) {
  const currentPages = readInternalValue(documentResult, '_pages', []);
  const byPage = new Map(currentPages.map(page => [page.pageNumber, { ...page }]));

  for (const page of pagesData) {
    const current = byPage.get(page.pageNumber) || {};
    byPage.set(page.pageNumber, {
      ...current,
      pageNumber: page.pageNumber,
      widthPt: round(page.width ?? current.widthPt),
      heightPt: round(page.height ?? current.heightPt),
      rotation: Number(page.rotation ?? current.rotation ?? 0),
      textLayerDetected: Boolean(page.textLayerDetected ?? current.textLayerDetected),
      ocrApplied: Boolean(page.ocrApplied ?? current.ocrApplied),
      visualRequired: Boolean(page.visualRequired ?? current.visualRequired),
      imageAvailable: Boolean(page.renderedPage?.dataUrl),
      visualGenerated: Boolean(page.renderedPage?.dataUrl),
      diagnostics: page.diagnostics || current.diagnostics || null,
      renderedPage: page.renderedPage ? { ...page.renderedPage } : current.renderedPage || null,
    });
  }

  defineInternalValue(documentResult, '_pages', [...byPage.values()].sort((left, right) => left.pageNumber - right.pageNumber));
  return refreshDocumentResultDerivedState(documentResult);
}

export function getRuntimePages(documentResult) {
  return readInternalValue(documentResult, '_pages', []).map(page => ({ ...page }));
}

export function validateContentConservation(sourceOrOptions = [], tables = [], unassignedTextItems = [], pages = [], tableBoundsIndex = null) {
  const options = Array.isArray(sourceOrOptions)
    ? { sourceItems: sourceOrOptions, tables, unassignedTextItems, pages, tableBoundsIndex }
    : sourceOrOptions;
  const sourceItems = options.sourceItems || [];
  const safeTables = options.tables || [];
  const safeUnassigned = options.unassignedTextItems || [];
  const safePages = options.pages || [];
  const boundsIndex = options.tableBoundsIndex || buildTableBoundsIndex(safeTables);
  const knownIds = new Set(sourceItems.map(item => item.id));
  const usages = collectItemUsages(safeTables);

  const unassignedCounts = new Map();
  for (const item of safeUnassigned) {
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
  const unassignedInsideDetectedTables = safeUnassigned
    .filter(item => (item.tableIds || []).length > 0)
    .map(item => item.id);
  const bottomZoneMissing = safeUnassigned
    .filter(item => item.inBottomZone && (item.tableIds || []).length > 0)
    .map(item => item.id);
  const visualPagesMissing = safePages
    .filter(page => page.visualRequired && !page.visualGenerated)
    .map(page => page.pageNumber);
  const warnings = [];

  if (duplicated.length) warnings.push(`Itens de origem duplicados: ${duplicated.length}.`);
  if (missing.length) warnings.push(`Itens de origem ausentes: ${missing.length}.`);
  if (unknownUnassigned.length) warnings.push(`Itens nao associados sem origem conhecida: ${unknownUnassigned.length}.`);
  if (unassignedInsideDetectedTables.length) warnings.push(`Itens nao associados dentro de area tabular: ${unassignedInsideDetectedTables.length}.`);
  if (bottomZoneMissing.length) warnings.push(`Itens nao associados na zona inferior tabular: ${bottomZoneMissing.length}.`);
  if (visualPagesMissing.length) warnings.push(`Paginas visuais nao geradas: ${visualPagesMissing.join(', ')}.`);

  return {
    valid: duplicated.length === 0
      && missing.length === 0
      && unknownUnassigned.length === 0
      && unassignedInsideDetectedTables.length === 0
      && bottomZoneMissing.length === 0
      && visualPagesMissing.length === 0,
    duplicated,
    missing,
    unknownUnassigned,
    unassignedInsideDetectedTables,
    bottomZoneMissing,
    visualPagesMissing,
    assignedCount: usages.size,
    unassignedCount: unassignedCounts.size,
    warnings,
    tableBoundsIndex: boundsIndex,
  };
}

function normalizeSettings(settings = {}) {
  return {
    ...settings,
    outputMode: settings.outputMode || (settings.mode === 'visual-grid' ? 'visual-replica' : 'clean-table'),
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
    ocrApplied: Boolean(page.ocrApplied),
    visualRequired: Boolean(page.visualRequired),
    imageAvailable: Boolean(page.renderedPage?.dataUrl),
    visualGenerated: Boolean(page.renderedPage?.dataUrl),
    diagnostics: page.diagnostics || null,
    renderedPage: page.renderedPage ? { ...page.renderedPage } : null,
  })));
}

function collectSourceItems(pagesData = []) {
  const seen = new Set();
  const items = [];

  for (const page of pagesData) {
    const filteredOutIds = new Set((page.filteredOutItems || []).map(item => item.id));

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
        right: round(item.right ?? (item.x + item.width)),
        bottom: round(item.bottom ?? (item.y + item.height)),
        filteredOut: filteredOutIds.has(item.id),
      });
    }
  }

  return items;
}

function collectUnassignedTextItems(sourceItems = [], tables = [], pages = [], tableBoundsIndex = buildTableBoundsIndex(tables)) {
  const assignedIds = new Set(collectItemUsages(tables).keys());
  const pageMap = new Map(pages.map(page => [page.pageNumber, page]));

  return sourceItems
    .filter(item => !assignedIds.has(item.id))
    .map(item => {
      const page = pageMap.get(item.pageNumber);
      const pageHeight = Number(page?.heightPt || 0);
      const bottomZoneStart = pageHeight ? pageHeight * 0.85 : 0;
      const tableIds = findContainingTables(item, tableBoundsIndex);
      return {
        ...item,
        tableIds,
        insideDetectedTable: tableIds.length > 0,
        inBottomZone: item.bottom >= bottomZoneStart,
      };
    });
}

function buildPageStates({
  pages = [],
  sourceItems = [],
  tables = [],
  unassignedTextItems = [],
  validation,
  tableBoundsIndex,
}) {
  const assignedIds = new Set(collectItemUsages(tables).keys());
  const unassignedMap = new Map();
  for (const item of unassignedTextItems) {
    const list = unassignedMap.get(item.pageNumber) || [];
    list.push(item);
    unassignedMap.set(item.pageNumber, list);
  }

  return pages.map(page => {
    const pageItems = sourceItems.filter(item => item.pageNumber === page.pageNumber);
    const assignedItems = pageItems.filter(item => assignedIds.has(item.id));
    const unassignedItems = unassignedMap.get(page.pageNumber) || [];
    const bottomZoneStart = Number(page.heightPt || 0) * 0.85;
    const bottomZoneSourceItems = pageItems.filter(item => item.bottom >= bottomZoneStart);
    const bottomZoneAssignedItems = bottomZoneSourceItems.filter(item => assignedIds.has(item.id));
    const bottomZoneUnassignedItems = bottomZoneSourceItems.filter(item => !assignedIds.has(item.id));
    const warnings = [
      ...(page.diagnostics?.ocrWarnings || []),
      ...(page.diagnostics?.warnings || []),
    ];
    if (page.visualRequired && !page.visualGenerated) warnings.push('Imagem visual integral nao foi gerada.');
    if (unassignedItems.some(item => item.insideDetectedTable)) warnings.push('Existem itens nao associados dentro da area de tabela.');
    if (bottomZoneUnassignedItems.some(item => item.tableIds?.length)) warnings.push('Existem itens finais da zona inferior sem associacao editavel.');

    let status = 'OK';
    const hasLostTableContent = validation.missing.some(id => {
      const item = sourceItems.find(sourceItem => sourceItem.id === id);
      return item && findContainingTables(item, tableBoundsIndex).length > 0;
    });

    if ((page.visualRequired && !page.visualGenerated) || hasLostTableContent) {
      status = 'FALHA';
    } else if (
      warnings.length
      || unassignedItems.some(item => item.insideDetectedTable)
      || bottomZoneUnassignedItems.some(item => item.tableIds?.length)
    ) {
      status = 'REVISAR';
    }

    return {
      pageNumber: page.pageNumber,
      widthPt: round(page.widthPt),
      heightPt: round(page.heightPt),
      rotation: Number(page.rotation || 0),
      textLayerDetected: Boolean(page.textLayerDetected),
      ocrApplied: Boolean(page.ocrApplied),
      visualRequired: Boolean(page.visualRequired),
      imageAvailable: Boolean(page.imageAvailable),
      visualGenerated: Boolean(page.visualGenerated),
      diagnostics: page.diagnostics || null,
      textItems: pageItems.length,
      assignedItems: assignedItems.length,
      unassignedItems: unassignedItems.length,
      lastSourceBottom: round(Math.max(0, ...pageItems.map(item => item.bottom))),
      lastAssignedBottom: round(Math.max(0, ...assignedItems.map(item => item.bottom))),
      bottomZoneSourceCount: bottomZoneSourceItems.length,
      bottomZoneAssignedCount: bottomZoneAssignedItems.length,
      bottomZoneUnassignedCount: bottomZoneUnassignedItems.length,
      warnings: [...new Set(warnings)],
      status,
    };
  });
}

function buildTableBoundsIndex(tables = []) {
  return tables.flatMap(table => {
    const pageBounds = new Map();
    const sourceRows = table.sourceCells || table.cells || [];

    for (const row of sourceRows) {
      for (const cell of row || []) {
        if (!cell || !cell.sourceItemIds?.length) continue;
        const pages = cell.sourcePages?.length ? cell.sourcePages : [cell.sourcePage || table.pageNumber];
        for (const pageNumber of pages) {
          const current = pageBounds.get(pageNumber) || createEmptyBounds(table.id, pageNumber);
          mergeIntoBounds(current, cell);
          pageBounds.set(pageNumber, current);
        }
      }
    }

    return [...pageBounds.values()]
      .filter(bounds => Number.isFinite(bounds.left) && Number.isFinite(bounds.right));
  });
}

function collectItemUsages(tables = []) {
  const usages = new Map();

  for (const table of tables) {
    for (const row of table.sourceCells || table.cells || []) {
      for (const cell of row || []) {
        for (const id of cell?.sourceItemIds || []) {
          usages.set(id, (usages.get(id) || 0) + 1);
        }
      }
    }
  }

  return usages;
}

function findContainingTables(item, tableBoundsIndex = []) {
  const centerX = item.x + (item.width / 2);
  const centerY = item.y + (item.height / 2);
  return tableBoundsIndex
    .filter(bounds => bounds.pageNumber === item.pageNumber)
    .filter(bounds => centerX >= (bounds.left - 4) && centerX <= (bounds.right + 4) && centerY >= (bounds.top - 4) && centerY <= (bounds.bottom + 4))
    .map(bounds => bounds.tableId);
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
        unassignedInsideDetectedTables: [...(documentResult.validation?.contentConservation?.unassignedInsideDetectedTables || [])],
        bottomZoneMissing: [...(documentResult.validation?.contentConservation?.bottomZoneMissing || [])],
        visualPagesMissing: [...(documentResult.validation?.contentConservation?.visualPagesMissing || [])],
        warnings: [...(documentResult.validation?.contentConservation?.warnings || [])],
      },
    },
    ocr: {
      ...(documentResult.ocr || {}),
      appliedPages: [...(documentResult.ocr?.appliedPages || [])],
      warnings: [...(documentResult.ocr?.warnings || [])],
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
    columnWidthsPt: [...(table.visualModel?.columnWidthsPt || [])],
    rowHeightsPt: [...(table.visualModel?.rowHeightsPt || [])],
    merges: [...(table.visualModel?.merges || [])],
    visualConfidence: Number(table.visualModel?.gridConfidence || table.confidence || 0),
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
          fontName: cell.style?.fontName || '',
          fontSizePt: meta.fontSize || table.rowMeta?.[rowIndex]?.maxFontSize || null,
          bold: Boolean(meta.bold || table.rowMeta?.[rowIndex]?.isBold),
          italic: Boolean(meta.italic || table.rowMeta?.[rowIndex]?.isItalic),
          fontColorArgb: cell.style?.fontColorArgb || null,
          fillArgb: cell.style?.fillArgb || meta.fillArgb || null,
          horizontalAlignment: cell.style?.horizontalAlignment || null,
          verticalAlignment: cell.style?.verticalAlignment || null,
          wrapText: cell.style?.wrapText ?? true,
          borders: cell.style?.borders || meta.borders || {},
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

function buildOcrState(documentResult) {
  const appliedPages = (documentResult.pages || [])
    .filter(page => page.ocrApplied)
    .map(page => page.pageNumber);

  const warnings = (documentResult.pages || [])
    .flatMap(page => page.diagnostics?.ocrWarnings || [])
    .filter(Boolean);

  return {
    appliedPages,
    languages: documentResult.settings?.ocrLanguages || 'por+eng',
    dpi: Number(documentResult.settings?.ocrDpi || 300),
    warnings: [...new Set(warnings)],
  };
}

function createEmptyBounds(tableId, pageNumber) {
  return {
    tableId,
    pageNumber,
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  };
}

function mergeIntoBounds(bounds, cell) {
  const left = Number(cell.x || 0);
  const top = Number(cell.y || 0);
  const right = Number.isFinite(cell.right) ? Number(cell.right) : left + Number(cell.width || 0);
  const bottom = Number.isFinite(cell.bottom) ? Number(cell.bottom) : top + Number(cell.height || 0);

  bounds.left = Math.min(bounds.left, left);
  bounds.top = Math.min(bounds.top, top);
  bounds.right = Math.max(bounds.right, right);
  bounds.bottom = Math.max(bounds.bottom, bottom);
}
