import { safeFileStem } from '../utils/download.js';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js';
import { buildRenderableTable, buildTableMerges, deriveColumnWidths, deriveRowHeights } from './tableLayout.js';

export async function buildWorkbook(documentResult) {
  await ensureExcelJsRuntime();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Processador de Tabelas de Processos Trabalhistas';
  workbook.created = new Date();
  workbook.modified = new Date();

  addTableSheets(workbook, documentResult);
  addAuditSheets(workbook, documentResult);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addTableSheets(workbook, documentResult) {
  const usedNames = new Set();

  documentResult.tables.forEach((table, index) => {
    const sheetName = uniqueSheetName(buildTableSheetName(table, index), usedNames);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{
        state: 'frozen',
        ySplit: Number.isInteger(table.headerRowIndex) && table.headerRowIndex >= 0 ? table.headerRowIndex + 1 : 0,
      }],
    });
    writeTable(worksheet, table);
  });
}

function addAuditSheets(workbook, documentResult) {
  writeOcrAuditSheet(workbook.addWorksheet('_ocr_auditoria'), documentResult);
  writeSourceSheet(workbook.addWorksheet('_origem'), documentResult);
}

function writeTable(worksheet, table) {
  const renderable = buildRenderableTable(table);
  const columnCount = Math.max(1, ...renderable.matrix.map(row => row.length));
  const rowHeights = deriveRowHeights(table, renderable.matrix.length);
  const columnWidths = deriveColumnWidths(table, columnCount);

  worksheet.properties.defaultRowHeight = 15;
  applyColumnWidths(worksheet, columnWidths, columnCount);
  writeTableMatrix(worksheet, table, renderable, rowHeights, 1);
  applyMerges(worksheet, buildTableMerges(table, renderable), 1);
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
}

function writeOcrAuditSheet(worksheet, documentResult) {
  const headers = ['Pagina', 'Texto PDF', 'OCR aplicado', 'Imagem', 'Modo', 'Motivo', 'Avisos'];
  const rows = (documentResult.pages || []).map(page => ([
    page.pageNumber,
    page.textLayerDetected ? 'sim' : 'nao',
    page.ocrApplied ? 'sim' : 'nao',
    page.imageAvailable ? 'sim' : 'nao',
    page.diagnostics?.sourceMode || '',
    page.diagnostics?.reason || '',
    (page.diagnostics?.ocrWarnings || []).join(' | '),
  ]));

  writeAuditMatrix(worksheet, headers, rows, [10, 12, 14, 10, 12, 32, 48]);
}

function writeSourceSheet(worksheet, documentResult) {
  const headers = ['ID', 'Pagina', 'Texto', 'Texto bruto', 'X', 'Y', 'Largura', 'Altura'];
  const rows = (documentResult.sourceItems || []).map(item => ([
    item.id,
    item.pageNumber,
    item.text || '',
    item.rawText || '',
    item.x,
    item.y,
    item.width,
    item.height,
  ]));

  writeAuditMatrix(worksheet, headers, rows, [22, 10, 36, 36, 10, 10, 12, 12]);
}

function writeAuditMatrix(worksheet, headers, rows, widths = []) {
  worksheet.addRow(headers);
  rows.forEach(row => worksheet.addRow(row));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  applyColumnWidths(worksheet, widths, headers.length);

  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 18 : 15;
    row.eachCell(cell => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: rowNumber === 1 ? 'center' : 'left',
        wrapText: true,
      };
      cell.font = rowNumber === 1
        ? { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF102033' } }
        : { name: 'Calibri', size: 9, color: { argb: 'FF111827' } };
      cell.fill = rowNumber === 1 ? solid('FFE9F1FB') : noFill();
      cell.border = thinBorder('FFD0D7E2');
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
  const preferred = firstMeaningfulLabel(table)
    || `Pagina_${table.pageNumber}_Tabela_${table.tableIndex || index + 1}`;
  return safeSheetName(preferred);
}

function firstMeaningfulLabel(table) {
  const titleRow = table.matrix?.find((row, rowIndex) => table.rowMeta?.[rowIndex]?.isTitle);
  const headerRow = Number.isInteger(table.headerRowIndex) && table.headerRowIndex >= 0
    ? table.matrix?.[table.headerRowIndex]
    : null;
  const titleText = (titleRow || []).join(' ').trim();
  if (titleText) return titleText;
  const headerText = (headerRow || []).join(' ').trim();
  return headerText || '';
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
