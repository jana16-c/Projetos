import { safeFileStem } from '../utils/download.js';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js';
import { buildRenderableTable, buildHorizontalMerges, deriveColumnWidths } from './tableLayout.js';

export async function buildWorkbook(documentResult) {
  await ensureExcelJsRuntime();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Processador de Tabelas de Processos Trabalhistas';
  workbook.created = new Date();
  workbook.modified = new Date();

  addTableSheets(workbook, documentResult);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addTableSheets(workbook, documentResult) {
  documentResult.tables.forEach((table, index) => {
    const sheetName = safeSheetName(`Table ${index + 1}`);
    const worksheet = workbook.addWorksheet(sheetName);
    writeTable(worksheet, table);
  });
}

function writeTable(worksheet, table) {
  worksheet.properties.defaultRowHeight = 15;
  const renderable = buildRenderableTable(table);
  const preferredWidths = deriveColumnWidths(table, Math.max(1, ...renderable.matrix.map(row => row.length)));
  writeTableMatrix(worksheet, renderable, 1);
  applyMerges(worksheet, buildHorizontalMerges(renderable.matrix), 1);
  autoFit(worksheet, preferredWidths);
}

function writeTableMatrix(worksheet, table, startRow) {
  const maxCols = Math.max(1, ...table.matrix.map(row => row.length));
  for (let rowIndex = 0; rowIndex < table.matrix.length; rowIndex++) {
    const worksheetRow = worksheet.getRow(startRow + rowIndex);
    for (let columnIndex = 0; columnIndex < maxCols; columnIndex++) {
      const cellInfo = table.cells[rowIndex]?.[columnIndex];
      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.value = excelValue(cellInfo);
      cell.border = borderForRow(table, rowIndex, columnIndex, maxCols);
      cell.alignment = {
        vertical: table.rowMeta[rowIndex]?.isTitle ? 'top' : 'center',
        horizontal: alignmentFor(cellInfo, table, rowIndex),
        wrapText: true,
        shrinkToFit: !table.rowMeta[rowIndex]?.isTitle,
      };
      cell.font = fontForRow(table, rowIndex, cellInfo);
      cell.fill = fillForRow(table, rowIndex);

      if (cellInfo?.numberFormat) {
        cell.numFmt = cellInfo.numberFormat;
      }

      if (table.rowMeta[rowIndex]?.isHeader) {
        decorateHeaderCell(cell);
      } else if (table.rowMeta[rowIndex]?.isTitle) {
        decorateTitleCell(cell);
      }
    }
  }

  return startRow + table.matrix.length;
}

function excelValue(cellInfo) {
  if (!cellInfo) return '';
  if (cellInfo.preserveAsText) return String(cellInfo.value || '');
  return cellInfo.normalizedValue ?? cellInfo.value ?? '';
}

function alignmentFor(cellInfo, table, rowIndex) {
  if (table.rowMeta[rowIndex]?.isHeader || table.rowMeta[rowIndex]?.isRepeatedHeader) return 'center';
  if (table.rowMeta[rowIndex]?.isTitle) return 'left';
  if (!cellInfo) return 'left';
  if (cellInfo.type === 'number' || cellInfo.type === 'percentage' || cellInfo.type === 'date') return 'center';
  return 'left';
}

function decorateHeaderCell(cell) {
  cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF000000' } };
  cell.fill = solid('CCCCCC');
  cell.border = thinBorder('FF000000');
}

function decorateTitleCell(cell) {
  cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF000000' } };
  cell.fill = noFill();
  cell.border = noBorder();
}

function baseFont() {
  return { name: 'Arial MT', size: 8, color: { argb: 'FF000000' } };
}

function autoFit(worksheet, preferredWidths = []) {
  worksheet.columns.forEach(column => {
    let max = preferredWidths[column.number - 1] || 4;
    column.eachCell({ includeEmpty: true }, cell => {
      const length = String(cell.value ?? '').length;
      max = Math.max(max, Math.min(40, Math.ceil((length + 2) * 0.9)));
    });
    column.width = max;
  });
}

function thinBorder(color = 'FF000000') {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function solid(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
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

function safeSheetName(name) {
  return String(name || 'Planilha')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);
}

export function buildExcelFilename(pdfName) {
  return `${safeFileStem(pdfName)}.xlsx`;
}

function fontForRow(table, rowIndex, cellInfo) {
  if (table.rowMeta[rowIndex]?.isTitle) {
    const text = String(cellInfo?.value ?? '').trim();
    return { name: 'Arial', size: text.length > 90 ? 10 : 12, bold: true, color: { argb: 'FF000000' } };
  }
  if (table.rowMeta[rowIndex]?.isHeader || table.rowMeta[rowIndex]?.isRepeatedHeader) {
    return { name: 'Arial', size: 8, bold: true, color: { argb: 'FF000000' } };
  }
  return baseFont();
}

function fillForRow(table, rowIndex) {
  if (table.rowMeta[rowIndex]?.isHeader || table.rowMeta[rowIndex]?.isRepeatedHeader) {
    return solid('CCCCCC');
  }
  return noFill();
}

function borderForRow(table, rowIndex, columnIndex, maxCols) {
  if (table.rowMeta[rowIndex]?.isTitle) return noBorder();
  const full = thinBorder('FF000000');
  if (columnIndex === 0) return { ...full, right: {} };
  if (columnIndex === maxCols - 1) return { ...full, left: {} };
  return { ...full, left: {}, right: {} };
}

function applyMerges(worksheet, merges, startRow) {
  for (const merge of merges) {
    if (merge.endColumn <= merge.startColumn) continue;
    worksheet.mergeCells(
      startRow + merge.rowIndex,
      merge.startColumn + 1,
      startRow + merge.rowIndex,
      merge.endColumn + 1,
    );
  }
}
