import { safeFileStem } from '../utils/download.js?v=2026-06-30-livepreview-3';
import { getRuntimePages } from '../model/resultModel.js?v=2026-06-30-livepreview-3';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-3';
import { buildRenderableTable, buildTableMerges, deriveColumnWidths, deriveRowHeights } from './tableLayout.js?v=2026-06-30-livepreview-3';

export async function buildWorkbook(documentResult, options = {}) {
  await ensureExcelJsRuntime();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Processador de Tabelas de Processos Trabalhistas';
  workbook.created = new Date();
  workbook.modified = new Date();

  addTableSheets(workbook, documentResult);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function buildVisualSheetSpecs(documentResult) {
  return getRuntimePages(documentResult)
    .filter(page => documentResult.selectedPages.includes(page.pageNumber))
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map(page => ({
      pageNumber: page.pageNumber,
      sheetName: `Visual_P${String(page.pageNumber).padStart(3, '0')}`,
      imageAvailable: Boolean(page.renderedPage?.dataUrl),
      displayWidthPx: Number(page.renderedPage?.displayWidthPx || 0),
      displayHeightPx: Number(page.renderedPage?.displayHeightPx || 0),
      rotation: Number(page.rotation || 0),
    }));
}

export function buildWorkbookSheetPlan(documentResult, options = {}) {
  const sourceTables = (documentResult.tables || []).every(table => Array.isArray(table?.matrix))
    ? normalizeWorkbookTablesForExport(documentResult.tables || []).map(entry => entry.table)
    : (documentResult.tables || []);
  const dataSheets = sourceTables.map((table, index) => ({
    type: 'data',
    sheetName: buildTableSheetName(table, index),
  }));
  return [...dataSheets];
}

export function buildAuditRows(documentResult) {
  return (documentResult.pages || []).map(page => ([
    page.pageNumber,
    page.textItems,
    page.assignedItems,
    page.unassignedItems,
    page.lastSourceBottom,
    page.lastAssignedBottom,
    page.bottomZoneSourceCount,
    page.bottomZoneAssignedCount,
    page.ocrApplied ? 'sim' : 'nao',
    page.visualGenerated ? 'sim' : 'nao',
    page.status,
    (page.warnings || []).join(' | '),
  ]));
}

export function buildUnassignedRows(documentResult) {
  return (documentResult.unassignedTextItems || []).map(item => ([
    item.id,
    item.pageNumber,
    item.text || '',
    item.x,
    item.y,
    item.width,
    item.height,
    item.insideDetectedTable ? 'sim' : 'nao',
    (item.tableIds || []).join(', '),
    item.inBottomZone ? 'sim' : 'nao',
    item.filteredOut ? 'sim' : 'nao',
  ]));
}

function addVisualSheets(workbook, documentResult) {
  const usedNames = new Set();

  for (const spec of buildVisualSheetSpecs(documentResult)) {
    const sheetName = uniqueSheetName(spec.sheetName, usedNames);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: false, zoomScale: 100 }],
    });
    worksheet.properties.defaultRowHeight = 15;
    worksheet.getColumn(1).width = 2;
    worksheet.getRow(1).height = Math.max(15, Math.round(spec.displayHeightPx * 0.75));

    const page = getRuntimePages(documentResult).find(item => item.pageNumber === spec.pageNumber);
    if (!page?.renderedPage?.dataUrl) {
      worksheet.getCell('A1').value = `Pagina ${spec.pageNumber} sem imagem visual.`;
      continue;
    }

    const imageId = workbook.addImage({
      base64: page.renderedPage.dataUrl,
      extension: 'png',
    });

    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: {
        width: page.renderedPage.displayWidthPx,
        height: page.renderedPage.displayHeightPx,
      },
      editAs: 'oneCell',
    });
  }
}

function addTableSheets(workbook, documentResult) {
  const usedNames = new Set();

  normalizeWorkbookTablesForExport(documentResult.tables || []).forEach((entry, index) => {
    const table = entry.table;
    const renderable = entry.renderable;
    const sheetName = uniqueSheetName(buildTableSheetName(table, index), usedNames);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{
        state: 'frozen',
        showGridLines: true,
        ySplit: Number.isInteger(renderable.headerRowIndex) && renderable.headerRowIndex >= 0 ? renderable.headerRowIndex + 1 : 0,
      }],
    });
    writeTable(worksheet, table, renderable);
  });
}

function writeTable(worksheet, table, renderable = buildRenderableTable(table)) {
  const columnCount = Math.max(1, ...renderable.matrix.map(row => row.length));
  const layoutTable = {
    ...table,
    displayMatrix: renderable.matrix,
    displayCells: renderable.cells,
    displayRowMeta: renderable.rowMeta,
    matrix: renderable.matrix,
    cells: renderable.cells,
    rowMeta: renderable.rowMeta,
    headerRowIndex: renderable.headerRowIndex,
  };
  const rowHeights = deriveRowHeights(layoutTable, renderable.matrix.length);
  const columnWidths = deriveColumnWidths(layoutTable, columnCount);

  worksheet.properties.defaultRowHeight = 15;
  worksheet.properties.defaultColWidth = 12;
  applyColumnWidths(worksheet, columnWidths, columnCount);
  writeTableMatrix(worksheet, layoutTable, renderable, rowHeights, 1);
  applyMerges(worksheet, buildTableMerges(layoutTable, renderable), 1);
  if (renderable.headerRowIndex >= 0 && renderable.matrix[renderable.headerRowIndex]?.length) {
    worksheet.autoFilter = {
      from: { row: renderable.headerRowIndex + 1, column: 1 },
      to: { row: renderable.headerRowIndex + 1, column: renderable.matrix[renderable.headerRowIndex].length },
    };
  }
}

function writeTableMatrix(worksheet, sourceTable, renderable, rowHeights, startRow) {
  const maxCols = Math.max(1, ...renderable.matrix.map(row => row.length));

  for (let rowIndex = 0; rowIndex < renderable.matrix.length; rowIndex++) {
    const worksheetRow = worksheet.getRow(startRow + rowIndex);
    worksheetRow.height = rowHeights[rowIndex] || 15;

    for (let columnIndex = 0; columnIndex < maxCols; columnIndex++) {
      const cellInfo = renderable.cells[rowIndex]?.[columnIndex];
      const rowMeta = renderable.rowMeta[rowIndex] || {};
      const cellMeta = rowMeta.cellMeta?.[columnIndex] || {};
      const cell = worksheetRow.getCell(columnIndex + 1);

      cell.value = excelValue(cellInfo);
      cell.alignment = alignmentFor(cellInfo, rowMeta, cellMeta);
      cell.font = fontForCell(cellInfo, rowMeta, cellMeta);
      cell.fill = fillForCell(cellInfo, rowMeta, cellMeta);
      cell.border = borderForCell(cellInfo, rowMeta, cellMeta, sourceTable, rowIndex, columnIndex, maxCols);

      if (cellInfo?.numberFormat) {
        cell.numFmt = cellInfo.numberFormat;
      }
    }
  }

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      if (rowNumber === startRow + renderable.headerRowIndex) {
        cell.fill = cell.fill?.pattern === 'none' ? solid('FFF3F4F6') : cell.fill;
      }
    });
  });
}

function applyColumnWidths(worksheet, widths, columnCount) {
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const width = Number(widths[columnIndex] || 0);
    worksheet.getColumn(columnIndex + 1).width = clamp(width || 10, 2, 80);
  }
}

function excelValue(cellInfo) {
  if (!cellInfo) return '';
  if (cellInfo.preserveAsText) return String(cellInfo.value || '');
  return cellInfo.normalizedValue ?? cellInfo.value ?? '';
}

function alignmentFor(cellInfo, rowMeta, cellMeta) {
  return {
    vertical: normalizeVertical(cellInfo?.style?.verticalAlignment || cellMeta.verticalAlignment || (rowMeta.isTitle ? 'top' : 'center')),
    horizontal: normalizeHorizontal(
      cellInfo?.style?.horizontalAlignment
      || cellMeta.horizontalAlignment
      || inferHorizontal(cellInfo, rowMeta),
    ),
    wrapText: cellInfo?.style?.wrapText ?? true,
    shrinkToFit: !rowMeta.isTitle,
  };
}

function fontForCell(cellInfo, rowMeta, cellMeta) {
  const title = rowMeta.isTitle;
  const header = rowMeta.isHeader || rowMeta.isRepeatedHeader || rowMeta.isProbablyHeader;
  const size = clamp(
    Number(cellMeta.fontSize || rowMeta.maxFontSize || (title ? 12 : 9)),
    title ? 10 : 8,
    title ? 14 : 11,
  );

  return {
    name: cellInfo?.style?.fontName || 'Calibri',
    size,
    bold: Boolean(rowMeta.isBold || header || title),
    italic: Boolean(rowMeta.isItalic),
    color: { argb: normalizeArgb(cellInfo?.style?.fontColorArgb || 'FF000000') },
  };
}

function fillForCell(cellInfo, rowMeta, cellMeta) {
  const fillArgb = normalizeArgb(
    cellInfo?.style?.fillArgb
    || cellMeta.fillArgb
    || (rowMeta.isHeader || rowMeta.isRepeatedHeader ? 'FFCCCCCC' : null),
  );

  if (!fillArgb || fillArgb === 'FFFFFFFF') return noFill();
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
}

function borderForCell(cellInfo, rowMeta, cellMeta, table, rowIndex, columnIndex, maxCols) {
  const styleBorder = normalizeBorderMap(cellInfo?.style?.borders || cellMeta.borders || {});
  if (hasBorder(styleBorder)) return styleBorder;

  if (rowMeta.isTitle) return noBorder();
  return fallbackBorder(table, rowMeta, rowIndex, columnIndex, maxCols);
}

function fallbackBorder(table, rowMeta, rowIndex, columnIndex, maxCols) {
  const full = thinBorder(rowMeta.isHeader || rowMeta.isRepeatedHeader ? 'FF6B7280' : 'FFB6C0CC');
  if (rowMeta.isHeader || rowMeta.isRepeatedHeader || table.visualModel) return full;
  if (columnIndex === 0) return { ...full, right: {} };
  if (columnIndex === maxCols - 1) return { ...full, left: {} };
  return { ...full, left: {}, right: {} };
}

function buildTableSheetName(table, index) {
  return safeSheetName(`Dados_T${String(index + 1).padStart(3, '0')}`);
}

function applyMerges(worksheet, merges, startRow) {
  for (const merge of merges) {
    if (merge.endColumn < merge.startColumn || merge.endRow < merge.startRow) continue;
    worksheet.mergeCells(
      startRow + merge.startRow,
      merge.startColumn + 1,
      startRow + merge.endRow,
      merge.endColumn + 1,
    );
  }
}

function normalizeBorderMap(border = {}) {
  return {
    top: normalizeSideBorder(border.top),
    left: normalizeSideBorder(border.left),
    bottom: normalizeSideBorder(border.bottom),
    right: normalizeSideBorder(border.right),
  };
}

function normalizeSideBorder(side = {}) {
  const color = normalizeArgb(side?.color || side?.argb || side?.fgColor?.argb);
  const style = normalizeBorderStyle(side?.style);
  if (!color && !style) return {};
  return {
    style: style || 'thin',
    color: color ? { argb: color } : undefined,
  };
}

function normalizeBorderStyle(style) {
  const value = String(style || '').trim().toLowerCase();
  if (!value) return '';
  if (['thin', 'medium', 'thick', 'double', 'dotted', 'dashed'].includes(value)) return value;
  return 'thin';
}

function hasBorder(border = {}) {
  return ['top', 'left', 'bottom', 'right'].some(side => Boolean(border?.[side]?.style || border?.[side]?.color));
}

function inferHorizontal(cellInfo, rowMeta) {
  if (rowMeta.isHeader || rowMeta.isRepeatedHeader || rowMeta.isProbablyHeader) return 'center';
  if (rowMeta.isTitle) return 'left';
  if (!cellInfo) return 'left';
  if (cellInfo.type === 'number' || cellInfo.type === 'percentage' || cellInfo.type === 'date') return 'center';
  return 'left';
}

function normalizeHorizontal(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['left', 'center', 'right', 'fill', 'justify'].includes(normalized)) return normalized;
  return 'left';
}

function normalizeVertical(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'middle') return 'middle';
  if (['top', 'middle', 'bottom', 'justify'].includes(normalized)) return normalized;
  return 'middle';
}

function thinBorder(color = 'FF000000') {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: normalizeArgb(argb) } };
}

function noFill() {
  return { type: 'pattern', pattern: 'none' };
}

function noBorder() {
  return {
    top: {},
    left: {},
    bottom: {},
    right: {},
  };
}

function uniqueSheetName(baseName, usedNames) {
  let name = safeSheetName(baseName);
  let suffix = 2;
  while (usedNames.has(name)) {
    name = safeSheetName(`${baseName}_${suffix}`);
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

function normalizeArgb(value) {
  if (!value) return '';
  const normalized = String(value).trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(normalized)) return normalized;
  if (/^[0-9A-F]{6}$/.test(normalized)) return `FF${normalized}`;
  return '';
}

function safeSheetName(name) {
  return String(name || 'Planilha')
    .replace(/[\\/?*[\]:]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Planilha';
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function buildExcelFilename(pdfName) {
  return `${safeFileStem(pdfName)}.xlsx`;
}

export function normalizeWorkbookTablesForExport(tables = []) {
  const entries = tables.flatMap(table => splitRenderableEntryIntoSections({
    table: {
      ...table,
      sourcePages: [...(table.sourcePages || [table.pageNumber])],
    },
    renderable: cloneRenderable(buildRenderableTable(table)),
  }));

  let changed = true;
  while (changed) {
    changed = false;

    for (let index = 0; index < entries.length - 1; index++) {
      const current = entries[index];
      const next = entries[index + 1];

      if (moveTrailingPreludeToNext(current.renderable, next.renderable)) {
        changed = true;
      }

      if (canMergeRenderableContinuation(current, next)) {
        entries[index] = mergeRenderableEntries(current, next);
        entries.splice(index + 1, 1);
        changed = true;
        index = Math.max(-1, index - 1);
        continue;
      }

      if (isPostludeOnlyRenderable(next.renderable) && current.renderable.matrix.length) {
        entries[index] = appendRenderableEntry(current, next);
        entries.splice(index + 1, 1);
        changed = true;
        index = Math.max(-1, index - 1);
        continue;
      }

      if (isPreludeOnlyRenderable(current.renderable) && canAttachPreludeToNext(next.renderable)) {
        entries[index + 1] = prependRenderableEntry(current, next);
        entries.splice(index, 1);
        changed = true;
        index = Math.max(-1, index - 2);
        continue;
      }
    }
  }

  return entries
    .map(entry => ({
      ...entry,
      renderable: finalizeRenderableForWorkbook(collapseRepeatedHeaders(entry.renderable)),
    }))
    .filter(entry => entry.renderable.matrix.length > 0);
}

function canMergeRenderableContinuation(current, next) {
  if (!areTablesConsecutive(current.table, next.table)) return false;
  if (isPreludeOnlyRenderable(current.renderable) || isPreludeOnlyRenderable(next.renderable)) return false;
  const currentProbe = prepareRenderableForMerge(current.renderable);
  const nextProbe = prepareRenderableForMerge(next.renderable);
  const currentHeader = readRenderableHeaderBlockSignature(currentProbe);
  const nextHeader = readRenderableHeaderBlockSignature(nextProbe);
  if (!currentHeader.length || !nextHeader.length) return false;
  if (!sameRenderableHeaderBlock(currentHeader, nextHeader)) return false;

  const currentPrelude = readRenderablePreludeSignature(currentProbe);
  const nextPrelude = readRenderablePreludeSignature(nextProbe);
  if (currentPrelude && nextPrelude && currentPrelude !== nextPrelude) return false;

  return !endsWithTotalRow(currentProbe);
}

function mergeRenderableEntries(current, next) {
  const nextSkip = next.renderable.headerRowIndex >= 0 ? next.renderable.headerRowIndex + 1 : 0;
  const mergedRenderable = {
    matrix: [
      ...current.renderable.matrix.map(row => [...row]),
      ...next.renderable.matrix.slice(nextSkip).map(row => [...row]),
    ],
    cells: [
      ...current.renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) }))),
      ...next.renderable.cells.slice(nextSkip).map(row => row.map(cell => ({ ...(cell || {}) }))),
    ],
    rowMeta: [
      ...current.renderable.rowMeta.map(meta => cloneMeta(meta)),
      ...next.renderable.rowMeta.slice(nextSkip).map(meta => cloneMeta(meta)),
    ],
    headerRowIndex: current.renderable.headerRowIndex,
  };

  return {
    table: {
      ...current.table,
      sourcePages: [...new Set([...(current.table.sourcePages || []), ...(next.table.sourcePages || [])])],
    },
    renderable: mergedRenderable,
  };
}

function prependRenderableEntry(prelude, next) {
  const mergedRenderable = {
    matrix: [
      ...prelude.renderable.matrix.map(row => [...row]),
      ...next.renderable.matrix.map(row => [...row]),
    ],
    cells: [
      ...prelude.renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) }))),
      ...next.renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) }))),
    ],
    rowMeta: [
      ...prelude.renderable.rowMeta.map(meta => cloneMeta(meta)),
      ...next.renderable.rowMeta.map(meta => cloneMeta(meta)),
    ],
    headerRowIndex: next.renderable.headerRowIndex >= 0 ? prelude.renderable.matrix.length + next.renderable.headerRowIndex : -1,
  };

  return {
    table: {
      ...prelude.table,
      sourcePages: [...new Set([...(prelude.table.sourcePages || []), ...(next.table.sourcePages || [])])],
    },
    renderable: mergedRenderable,
  };
}

function appendRenderableEntry(current, next) {
  const mergedRenderable = {
    matrix: [
      ...current.renderable.matrix.map(row => [...row]),
      ...next.renderable.matrix.map(row => [...row]),
    ],
    cells: [
      ...current.renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) }))),
      ...next.renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) }))),
    ],
    rowMeta: [
      ...current.renderable.rowMeta.map(meta => cloneMeta(meta)),
      ...next.renderable.rowMeta.map(meta => cloneMeta(meta)),
    ],
    headerRowIndex: current.renderable.headerRowIndex,
  };

  return {
    table: {
      ...current.table,
      sourcePages: [...new Set([...(current.table.sourcePages || []), ...(next.table.sourcePages || [])])],
    },
    renderable: mergedRenderable,
  };
}

function moveTrailingPreludeToNext(current, next) {
  const trailingIndexes = collectTrailingPreludeIndexes(current);
  if (!trailingIndexes.length || !canAttachPreludeToNext(next)) return false;

  const movedMatrix = trailingIndexes.map(index => [...current.matrix[index]]);
  const movedCells = trailingIndexes.map(index => current.cells[index].map(cell => ({ ...(cell || {}) })));
  const movedMeta = trailingIndexes.map(index => cloneMeta(current.rowMeta[index]));

  current.matrix = current.matrix.filter((_, index) => !trailingIndexes.includes(index));
  current.cells = current.cells.filter((_, index) => !trailingIndexes.includes(index));
  current.rowMeta = current.rowMeta.filter((_, index) => !trailingIndexes.includes(index));

  next.matrix = [...movedMatrix, ...next.matrix];
  next.cells = [...movedCells, ...next.cells];
  next.rowMeta = [...movedMeta, ...next.rowMeta];
  if (next.headerRowIndex >= 0) next.headerRowIndex += movedMatrix.length;
  return true;
}

function collectTrailingPreludeIndexes(renderable) {
  const indexes = [];
  for (let index = renderable.matrix.length - 1; index >= 0; index--) {
    const row = renderable.matrix[index] || [];
    const text = normalizeLooseText(row.map(value => String(value ?? '').trim()).filter(Boolean).join(' '));
    if (!text) continue;
    if (!isPreludeText(text)) break;
    indexes.unshift(index);
  }
  return indexes;
}

function isPreludeOnlyRenderable(renderable) {
  const rows = renderable.matrix || [];
  const preludeRows = rows.filter(row => isPreludeText(normalizeLooseText(row.map(value => String(value ?? '').trim()).filter(Boolean).join(' '))));
  if (renderable.headerRowIndex >= 0) return false;
  return rows.length <= 8 && preludeRows.length >= Math.max(2, rows.length - 1);
}

function canAttachPreludeToNext(renderable) {
  return Array.isArray(renderable?.matrix) && renderable.matrix.length > 0;
}

function isPostludeOnlyRenderable(renderable) {
  if (renderable.headerRowIndex >= 0) return false;
  const rows = (renderable.matrix || []).filter(row => row.some(value => String(value ?? '').trim()));
  if (!rows.length || rows.length > 4) return false;
  return rows.every(row => isPostludeText(rowLooseText(row)));
}

function isPostludeText(text) {
  if (!text) return false;
  return /^observa/.test(text)
    || /^a partir de /.test(text)
    || /aliquota efetiva/.test(text)
    || /contribuicao social sobre salarios devidos periodo/.test(text)
    || /rendimentos recebidos acumuladamente/.test(text);
}

function readRenderableHeaderSignature(renderable) {
  if (!Number.isInteger(renderable.headerRowIndex) || renderable.headerRowIndex < 0) return [];
  return (renderable.matrix[renderable.headerRowIndex] || [])
    .map(value => normalizeLooseText(value))
    .filter(Boolean);
}

function areTablesConsecutive(current, next) {
  const currentLastPage = Math.max(Number(current.pageNumber || 0), ...((current.sourcePages || []).map(Number)));
  const nextFirstPage = Math.min(Number(next.pageNumber || 0), ...((next.sourcePages || []).map(Number)));
  return nextFirstPage - currentLastPage <= 1;
}

function endsWithTotalRow(renderable) {
  for (let index = renderable.matrix.length - 1; index >= 0; index--) {
    const text = normalizeLooseText((renderable.matrix[index] || []).map(value => String(value ?? '').trim()).filter(Boolean).join(' '));
    if (!text) continue;
    return /\btotal\b/.test(text);
  }
  return false;
}

function isPreludeText(text) {
  if (!text) return false;
  return /^demonstrativo\b/.test(text)
    || /^nome\b(?! abrangencia\b)/.test(text)
    || /^periodo\b(?! mensal\b)(?! de referencia\b)/.test(text)
    || /^comentario\b/.test(text)
    || /^incidencia(?:s)?\b/.test(text)
    || /recolher em conta vinculada/.test(text)
    || /calculo homologado/.test(text)
    || /^fgts\b/.test(text)
    || /^historico salarial\b/.test(text)
    || /^ocorrencias do historico salarial\b/.test(text)
    || /^base s para/.test(text);
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function prepareRenderableForMerge(renderable) {
  let next = cloneRenderable(renderable);
  next = trimBlankRows(next);
  next = compactStructuredRows(next);
  next = compactRenderableByHeader(next);
  next = removeGloballyEmptyColumns(next);
  next = trimBlankRows(next);
  return next;
}

function readRenderableHeaderBlockSignature(renderable) {
  const headerBlock = findPrimaryHeaderBlock(renderable.matrix || []);
  if (headerBlock) {
    return renderable.matrix
      .slice(headerBlock.start, headerBlock.end + 1)
      .map(rowSignature)
      .filter(Boolean);
  }

  const header = readRenderableHeaderSignature(renderable);
  return header.length ? [header.join('|')] : [];
}

function readRenderablePreludeSignature(renderable) {
  const headerBlock = findPrimaryHeaderBlock(renderable.matrix || []);
  const end = headerBlock ? headerBlock.start : Math.min(renderable.matrix.length, 4);
  return renderable.matrix
    .slice(0, end)
    .map(rowLooseText)
    .filter(text => isPreludeText(text))
    .join('||');
}

function sameRenderableHeaderBlock(left = [], right = []) {
  if (!left.length || !right.length) return false;
  if (left.join('||') === right.join('||')) return true;
  return matchesCanonicalHeaderSuffix(left, right) || matchesCanonicalHeaderSuffix(right, left);
}

function cloneRenderable(renderable) {
  return {
    matrix: (renderable.matrix || []).map(row => [...row]),
    cells: (renderable.cells || []).map(row => row.map(cell => ({ ...(cell || {}) }))),
    rowMeta: (renderable.rowMeta || []).map(meta => cloneMeta(meta)),
    headerRowIndex: Number.isInteger(renderable.headerRowIndex) ? renderable.headerRowIndex : -1,
  };
}

function cloneMeta(meta = {}) {
  return {
    ...meta,
    cellMeta: (meta.cellMeta || []).map(cell => ({ ...(cell || {}) })),
  };
}

function collapseRepeatedHeaders(renderable) {
  const headerSignature = readRenderableHeaderSignature(renderable);
  if (!headerSignature.length) return renderable;

  const seenFirstHeader = renderable.headerRowIndex;
  const nextMatrix = [];
  const nextCells = [];
  const nextRowMeta = [];
  let nextHeaderIndex = renderable.headerRowIndex;

  for (let index = 0; index < renderable.matrix.length; index++) {
    const rowSignature = (renderable.matrix[index] || []).map(value => normalizeLooseText(value)).filter(Boolean);
    const isRepeatedHeader = index !== seenFirstHeader && rowSignature.length && rowSignature.join('|') === headerSignature.join('|');
    if (isRepeatedHeader) {
      if (index < nextHeaderIndex) nextHeaderIndex -= 1;
      continue;
    }
    nextMatrix.push([...(renderable.matrix[index] || [])]);
    nextCells.push((renderable.cells[index] || []).map(cell => ({ ...(cell || {}) })));
    nextRowMeta.push(cloneMeta(renderable.rowMeta[index]));
  }

  return {
    matrix: nextMatrix,
    cells: nextCells,
    rowMeta: nextRowMeta,
    headerRowIndex: nextHeaderIndex,
  };
}

function finalizeRenderableForWorkbook(renderable) {
  let next = cloneRenderable(renderable);
  next = trimBlankRows(next);
  next = compactStructuredRows(next);
  next = dropRepeatedHeaderBlocks(next);
  next = compactRenderableByHeader(next);
  next = removeGloballyEmptyColumns(next);
  next = trimBlankRows(next);
  next = trimTrailingEmptyColumns(next);
  return next;
}

function splitRenderableEntryIntoSections(entry) {
  const sections = [];
  let current = {
    table: { ...entry.table, sourcePages: [...(entry.table.sourcePages || [])] },
    renderable: cloneRenderable(entry.renderable),
  };

  while (true) {
    const splitIndex = findSecondarySectionStart(current.renderable);
    if (splitIndex <= 0) {
      sections.push(current);
      break;
    }

    const head = sliceRenderable(current.renderable, 0, splitIndex);
    const tail = sliceRenderable(current.renderable, splitIndex);
    sections.push({
      table: { ...current.table, sourcePages: [...(current.table.sourcePages || [])] },
      renderable: head,
    });
    current = {
      table: { ...current.table, sourcePages: [...(current.table.sourcePages || [])] },
      renderable: tail,
    };
  }

  return sections;
}

function findSecondarySectionStart(renderable) {
  const rows = renderable.matrix || [];
  const currentHeaderSignature = readRenderableHeaderSignature(renderable).join('|');
  for (let index = Math.max(2, renderable.headerRowIndex + 2); index < rows.length - 2; index++) {
    const text = normalizeLooseText(rows[index].map(value => String(value ?? '').trim()).filter(Boolean).join(' '));
    if (!isPreludeText(text)) continue;
    const previousMeaningful = rows.slice(0, index).some(row => row.some(value => String(value ?? '').trim()));
    if (!previousMeaningful) continue;
    const nextHeaderIndex = findUpcomingHeaderIndex(rows, index + 1);
    if (nextHeaderIndex < 0) continue;
    const nextHeaderSignature = rowSignature(rows[nextHeaderIndex]);
    if (nextHeaderSignature && nextHeaderSignature === currentHeaderSignature) continue;
    const hasDataAfterHeader = rows
      .slice(nextHeaderIndex + 1, Math.min(rows.length, nextHeaderIndex + 5))
      .some(row => looksLikeTabularDataRow(row));
    if (!hasDataAfterHeader) continue;
    return index;
  }
  return -1;
}

function sliceRenderable(renderable, start, end = undefined) {
  const matrix = (renderable.matrix || []).slice(start, end).map(row => [...row]);
  const cells = (renderable.cells || []).slice(start, end).map(row => row.map(cell => ({ ...(cell || {}) })));
  const rowMeta = (renderable.rowMeta || []).slice(start, end).map(meta => cloneMeta(meta));
  const oldHeaderIndex = Number.isInteger(renderable.headerRowIndex) ? renderable.headerRowIndex : -1;
  let headerRowIndex = -1;
  if (oldHeaderIndex >= start && (end === undefined || oldHeaderIndex < end)) {
    headerRowIndex = oldHeaderIndex - start;
  } else {
    headerRowIndex = detectHeaderRowIndex(matrix);
  }
  return { matrix, cells, rowMeta, headerRowIndex };
}

function trimBlankRows(renderable) {
  const matrix = [];
  const cells = [];
  const rowMeta = [];
  let headerRowIndex = renderable.headerRowIndex;

  for (let index = 0; index < renderable.matrix.length; index++) {
    const row = renderable.matrix[index] || [];
    if (!row.some(value => String(value ?? '').trim())) {
      if (index < headerRowIndex) headerRowIndex -= 1;
      continue;
    }
    matrix.push([...row]);
    cells.push((renderable.cells[index] || []).map(cell => ({ ...(cell || {}) })));
    rowMeta.push(cloneMeta(renderable.rowMeta[index]));
  }

  return { matrix, cells, rowMeta, headerRowIndex };
}

function compactStructuredRows(renderable) {
  const headerBlock = findPrimaryHeaderBlock(renderable.matrix);
  if (!headerBlock) return renderable;

  const matrix = renderable.matrix.map((row, rowIndex) => {
    if (rowIndex < headerBlock.start) return [...row];
    const keepIndexes = getFilledIndexes(row);
    return keepIndexes.map(index => row?.[index] ?? '');
  });
  const cells = renderable.cells.map((row, rowIndex) => {
    if (rowIndex < headerBlock.start) return row.map(cell => ({ ...(cell || {}) }));
    const keepIndexes = getFilledIndexes(renderable.matrix[rowIndex]);
    return keepIndexes.map(index => ({ ...(row?.[index] || {}) }));
  });
  const rowMeta = renderable.rowMeta.map((meta, rowIndex) => ({
    ...cloneMeta(meta),
    cellMeta: rowIndex >= headerBlock.start
      ? getFilledIndexes(renderable.matrix[rowIndex]).map(index => ({ ...(meta.cellMeta?.[index] || {}) }))
      : (meta.cellMeta || []).map(cell => ({ ...(cell || {}) })),
  }));

  return {
    matrix,
    cells,
    rowMeta,
    headerRowIndex: headerBlock.start,
  };
}

function dropRepeatedHeaderBlocks(renderable) {
  const headerBlock = findPrimaryHeaderBlock(renderable.matrix);
  if (!headerBlock) return renderable;

  const canonicalSignatures = renderable.matrix
    .slice(headerBlock.start, headerBlock.end + 1)
    .map(rowSignature)
    .filter(Boolean);
  if (!canonicalSignatures.length) return renderable;

  const matrix = renderable.matrix.map(row => [...row]);
  const cells = renderable.cells.map(row => row.map(cell => ({ ...(cell || {}) })));
  const rowMeta = renderable.rowMeta.map(meta => cloneMeta(meta));
  let index = headerBlock.end + 1;

  while (index < matrix.length) {
    if (!looksLikeHeaderRow(matrix[index])) {
      index += 1;
      continue;
    }

    let candidateEnd = index;
    while (candidateEnd + 1 < matrix.length && looksLikeHeaderRow(matrix[candidateEnd + 1])) {
      candidateEnd += 1;
    }

    if (candidateEnd + 1 >= matrix.length || !looksLikeTabularDataRow(matrix[candidateEnd + 1])) {
      index = candidateEnd + 1;
      continue;
    }

    const candidateSignatures = matrix
      .slice(index, candidateEnd + 1)
      .map(rowSignature)
      .filter(Boolean);

    if (!matchesCanonicalHeaderSuffix(canonicalSignatures, candidateSignatures)) {
      index = candidateEnd + 1;
      continue;
    }

    matrix.splice(index, candidateEnd - index + 1);
    cells.splice(index, candidateEnd - index + 1);
    rowMeta.splice(index, candidateEnd - index + 1);
  }

  return {
    matrix,
    cells,
    rowMeta,
    headerRowIndex: headerBlock.start,
  };
}

function compactRenderableByHeader(renderable) {
  if (!Number.isInteger(renderable.headerRowIndex) || renderable.headerRowIndex < 0) return renderable;
  const headerRow = renderable.matrix[renderable.headerRowIndex] || [];
  let removable = 0;
  while (removable < headerRow.length && !String(headerRow[removable] ?? '').trim()) {
    const usedLater = renderable.matrix.slice(renderable.headerRowIndex).some(row => String(row?.[removable] ?? '').trim());
    if (usedLater) break;
    removable += 1;
  }
  if (!removable) return renderable;

  const matrix = renderable.matrix.map((row, index) => (
    index >= renderable.headerRowIndex ? row.slice(removable) : [...row]
  ));
  const cells = renderable.cells.map((row, index) => (
    index >= renderable.headerRowIndex ? row.slice(removable).map(cell => ({ ...(cell || {}) })) : row.map(cell => ({ ...(cell || {}) }))
  ));
  const rowMeta = renderable.rowMeta.map((meta, index) => ({
    ...cloneMeta(meta),
    cellMeta: index >= renderable.headerRowIndex
      ? (meta.cellMeta || []).slice(removable).map(cell => ({ ...(cell || {}) }))
      : (meta.cellMeta || []).map(cell => ({ ...(cell || {}) })),
  }));
  return { matrix, cells, rowMeta, headerRowIndex: renderable.headerRowIndex };
}

function removeGloballyEmptyColumns(renderable) {
  const maxCols = Math.max(0, ...renderable.matrix.map(row => row.length));
  const keepIndexes = [];

  for (let columnIndex = 0; columnIndex < maxCols; columnIndex++) {
    const hasContent = renderable.matrix.some(row => String(row?.[columnIndex] ?? '').trim());
    if (hasContent) keepIndexes.push(columnIndex);
  }

  if (!keepIndexes.length || keepIndexes.length === maxCols) return renderable;

  return {
    matrix: renderable.matrix.map(row => keepIndexes.map(index => row?.[index] ?? '')),
    cells: renderable.cells.map(row => keepIndexes.map(index => ({ ...(row?.[index] || {}) }))),
    rowMeta: renderable.rowMeta.map(meta => ({
      ...cloneMeta(meta),
      cellMeta: keepIndexes.map(index => ({ ...(meta.cellMeta?.[index] || {}) })),
    })),
    headerRowIndex: renderable.headerRowIndex,
  };
}

function trimTrailingEmptyColumns(renderable) {
  const maxCols = Math.max(0, ...renderable.matrix.map(row => row.length));
  let keepCols = maxCols;
  while (keepCols > 1) {
    const col = keepCols - 1;
    const hasContent = renderable.matrix.some(row => String(row?.[col] ?? '').trim());
    if (hasContent) break;
    keepCols -= 1;
  }
  return {
    matrix: renderable.matrix.map(row => row.slice(0, keepCols)),
    cells: renderable.cells.map(row => row.slice(0, keepCols).map(cell => ({ ...(cell || {}) }))),
    rowMeta: renderable.rowMeta.map(meta => ({
      ...cloneMeta(meta),
      cellMeta: (meta.cellMeta || []).slice(0, keepCols).map(cell => ({ ...(cell || {}) })),
    })),
    headerRowIndex: renderable.headerRowIndex,
  };
}

function detectHeaderRowIndex(matrix = []) {
  for (let index = 0; index < Math.min(matrix.length, 6); index++) {
    if (looksLikeHeaderRow(matrix[index])) return index;
  }
  return -1;
}

function findUpcomingHeaderIndex(rows = [], startIndex = 0) {
  for (let index = startIndex; index < Math.min(rows.length, startIndex + 6); index++) {
    if (looksLikeHeaderRow(rows[index])) return index;
    if (looksLikeTabularDataRow(rows[index])) return -1;
  }
  return -1;
}

function findPrimaryHeaderBlock(matrix = []) {
  const dataStart = matrix.findIndex(row => looksLikeTabularDataRow(row));
  if (dataStart <= 0) return null;

  let start = dataStart - 1;
  while (start >= 0 && looksLikeHeaderRow(matrix[start]) && !isPreludeText(rowLooseText(matrix[start]))) {
    start -= 1;
  }

  start += 1;
  if (start >= dataStart) return null;
  return { start, end: dataStart - 1, dataStart };
}

function compactRowValues(row = []) {
  return row.filter(value => String(value ?? '').trim());
}

function getFilledIndexes(row = []) {
  return row.flatMap((value, index) => (String(value ?? '').trim() ? [index] : []));
}

function rowSignature(row = []) {
  return compactRowValues(row).map(value => normalizeLooseText(value)).filter(Boolean).join('|');
}

function rowLooseText(row = []) {
  return normalizeLooseText(row.map(value => String(value ?? '').trim()).filter(Boolean).join(' '));
}

function matchesCanonicalHeaderSuffix(canonical = [], candidate = []) {
  if (!candidate.length || candidate.length > canonical.length) return false;
  const suffix = canonical.slice(canonical.length - candidate.length);
  return suffix.length === candidate.length && suffix.every((value, index) => value === candidate[index]);
}

function looksLikeHeaderRow(row = []) {
  const filled = row.map(value => String(value ?? '').trim()).filter(Boolean);
  if (filled.length < 2) return false;
  const numeric = filled.filter(value => /\d/.test(value)).length;
  return numeric <= Math.floor(filled.length / 3);
}

function looksLikeDataRow(row = []) {
  const filled = row.map(value => String(value ?? '').trim()).filter(Boolean);
  if (!filled.length) return false;
  return filled.some(value => /\d/.test(value));
}

function looksLikeTabularDataRow(row = []) {
  const filled = row.map(value => String(value ?? '').trim()).filter(Boolean);
  if (filled.length < 3) return false;
  const numeric = filled.filter(value => /\d/.test(value)).length;
  return numeric >= 2;
}
