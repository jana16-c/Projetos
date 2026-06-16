import { cellLooksDate, cellLooksNumeric, normalizeNumberLike } from '../extraction/geometry.js';
import { safeFileStem } from '../utils/download.js';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js';

export async function buildWorkbook(results, options) {
  await ensureExcelJsRuntime();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Conversor PDF Excel Estrutural';
  workbook.created = new Date();
  workbook.modified = new Date();

  if (options.sheetPerPage) {
    for (const result of results) addPageWorksheet(workbook, result, options);
  } else {
    addSingleWorksheet(workbook, results, options);
  }

  addDiagnosticsWorksheet(workbook, results);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addPageWorksheet(workbook, result, options) {
  const ws = workbook.addWorksheet(`Pag_${result.pageNumber}`);
  fillWorksheet(ws, result.matrix, result.rowMeta, options);
}

function addSingleWorksheet(workbook, results, options) {
  const ws = workbook.addWorksheet('PDF_convertido');
  let currentRow = 1;
  for (const result of results) {
    ws.getCell(currentRow, 1).value = `Página ${result.pageNumber}`;
    ws.getCell(currentRow, 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell(currentRow, 1).fill = solid('0B3D4A');
    ws.mergeCells(currentRow, 1, currentRow, Math.max(1, result.matrix[0]?.length || 1));
    currentRow++;
    writeMatrix(ws, result.matrix, result.rowMeta, options, currentRow);
    currentRow += result.matrix.length + 2;
  }
  autoFit(ws);
}

function fillWorksheet(ws, matrix, rowMeta, options) {
  writeMatrix(ws, matrix, rowMeta, options, 1);
  autoFit(ws);
  ws.views = [{ state: 'frozen', ySplit: findFreezeRow(rowMeta) }];
}

function writeMatrix(ws, matrix, rowMeta, options, startRow) {
  const maxCols = Math.max(1, ...matrix.map(r => r.length));

  for (let r = 0; r < matrix.length; r++) {
    const rowNumber = startRow + r;
    const row = ws.getRow(rowNumber);
    const meta = rowMeta?.[r] || {};

    for (let c = 0; c < maxCols; c++) {
      const cell = row.getCell(c + 1);
      const rawValue = matrix[r]?.[c] ?? '';
      cell.value = valueForExcel(rawValue);
      cell.alignment = { vertical: 'top', horizontal: alignmentFor(rawValue), wrapText: true };
      cell.border = thinBorder();

      if (meta.isProbablyHeader) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = solid('0B3D4A');
      } else if (meta.isTitle) {
        cell.font = { bold: true, color: { argb: 'FF08323D' }, size: Math.max(11, Math.min(15, meta.maxFontSize || 12)) };
        cell.fill = solid('EAF4F6');
      } else {
        const cm = meta.cellMeta?.[c] || {};
        cell.font = {
          bold: Boolean(meta.isBold || cm.bold),
          italic: Boolean(meta.isItalic || cm.italic),
          color: { argb: 'FF17282E' },
          size: Math.max(9, Math.min(13, cm.fontSize || meta.maxFontSize || 10)),
        };
      }

      if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
    }

    if (meta.isTitle && options.mergeTitles && maxCols > 1) {
      const filled = matrix[r].filter(v => String(v || '').trim()).length;
      if (filled === 1) {
        try { ws.mergeCells(rowNumber, 1, rowNumber, maxCols); } catch {}
      }
    }

    row.commit?.();
  }
}

function valueForExcel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (cellLooksNumeric(text)) return normalizeNumberLike(text);
  return text;
}

function alignmentFor(value) {
  const text = String(value ?? '').trim();
  if (cellLooksNumeric(text)) return 'right';
  if (cellLooksDate(text)) return 'center';
  return 'left';
}

function autoFit(ws) {
  ws.columns.forEach(column => {
    let max = 10;
    column.eachCell({ includeEmpty: true }, cell => {
      const length = String(cell.value ?? '').length;
      max = Math.max(max, Math.min(55, length + 2));
    });
    column.width = max;
  });
}

function findFreezeRow(rowMeta = []) {
  const headerIndex = rowMeta.findIndex(r => r.isProbablyHeader);
  return headerIndex >= 0 ? headerIndex + 1 : 0;
}

function addDiagnosticsWorksheet(workbook, results) {
  const ws = workbook.addWorksheet('_diagnostico');
  ws.columns = [
    { header: 'Página', key: 'pageNumber', width: 10 },
    { header: 'Itens de texto', key: 'textItems', width: 15 },
    { header: 'Linhas', key: 'rows', width: 10 },
    { header: 'Colunas', key: 'columns', width: 10 },
    { header: 'Confiança', key: 'confidence', width: 12 },
    { header: 'Avisos', key: 'warnings', width: 80 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = solid('0B3D4A');

  for (const result of results) {
    const d = result.diagnostics;
    ws.addRow({
      pageNumber: d.pageNumber,
      textItems: d.textItems,
      rows: d.rows,
      columns: d.columns,
      confidence: d.confidence,
      warnings: d.warnings.join(' | '),
    });
  }

  ws.eachRow(row => row.eachCell(cell => {
    cell.border = thinBorder();
    cell.alignment = { vertical: 'top', wrapText: true };
  }));
}

function thinBorder() {
  return {
    top: { style: 'thin', color: { argb: 'FFD6E1E5' } },
    left: { style: 'thin', color: { argb: 'FFD6E1E5' } },
    bottom: { style: 'thin', color: { argb: 'FFD6E1E5' } },
    right: { style: 'thin', color: { argb: 'FFD6E1E5' } },
  };
}

function solid(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

export function buildExcelFilename(pdfName) {
  return `${safeFileStem(pdfName)}_convertido.xlsx`;
}
