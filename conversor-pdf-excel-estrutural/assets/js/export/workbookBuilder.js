import { safeFileStem } from '../utils/download.js';
import { getRuntimePages } from '../model/resultModel.js';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js';
import { buildRenderableTable, buildTableMerges, deriveColumnWidths, deriveRowHeights } from './tableLayout.js';

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
  const dataSheets = (documentResult.tables || []).map((table, index) => ({
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

  documentResult.tables.forEach((table, index) => {
    const renderable = buildRenderableTable(table);
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
