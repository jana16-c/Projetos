import { safeFileStem } from '../utils/download.js';
import { ensureExcelJsRuntime } from '../vendor/vendorLoader.js';

export async function buildWorkbook(documentResult) {
  await ensureExcelJsRuntime();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Processador de Tabelas de Processos Trabalhistas';
  workbook.created = new Date();
  workbook.modified = new Date();

  if (documentResult.settings.sheetMode === 'page') {
    addPageSheets(workbook, documentResult);
  } else if (documentResult.settings.sheetMode === 'consolidated') {
    addConsolidatedSheets(workbook, documentResult);
  } else {
    addTableSheets(workbook, documentResult);
  }

  addDiagnosticsWorksheet(workbook, documentResult);
  addOriginWorksheet(workbook, documentResult);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addTableSheets(workbook, documentResult) {
  for (const table of documentResult.tables) {
    const sheetName = safeSheetName(`P${table.pageNumber}_T${table.tableIndex}`);
    const worksheet = workbook.addWorksheet(sheetName);
    writeTable(worksheet, table);
  }
}

function addPageSheets(workbook, documentResult) {
  const groups = groupBy(documentResult.tables, table => table.pageNumber);
  for (const [pageNumber, tables] of groups.entries()) {
    const worksheet = workbook.addWorksheet(safeSheetName(`Pag_${pageNumber}`));
    let currentRow = 1;

    for (const table of tables) {
      worksheet.getCell(currentRow, 1).value = `Pagina ${pageNumber} · Tabela ${table.tableIndex}`;
      decorateTitleCell(worksheet.getCell(currentRow, 1));
      worksheet.mergeCells(currentRow, 1, currentRow, Math.max(1, table.matrix[0]?.length || 1));
      currentRow += 1;
      currentRow = writeTableMatrix(worksheet, table, currentRow);
      currentRow += 2;
    }

    autoFit(worksheet);
  }
}

function addConsolidatedSheets(workbook, documentResult) {
  const groups = new Map();

  for (const table of documentResult.tables) {
    const key = table.headerSignature?.join('|') || `pagina:${table.pageNumber}`;
    const bucket = groups.get(key) || [];
    bucket.push(table);
    groups.set(key, bucket);
  }

  let sheetIndex = 1;
  for (const tables of groups.values()) {
    const worksheet = workbook.addWorksheet(safeSheetName(`Tabela_${sheetIndex}`));
    let currentRow = 1;
    tables.forEach((table, index) => {
      if (index > 0) currentRow += 2;
      currentRow = writeTableMatrix(worksheet, table, currentRow);
    });
    autoFit(worksheet);
    sheetIndex += 1;
  }
}

function writeTable(worksheet, table) {
  writeTableMatrix(worksheet, table, 1);
  autoFit(worksheet);
}

function writeTableMatrix(worksheet, table, startRow) {
  const maxCols = Math.max(1, ...table.matrix.map(row => row.length));
  for (let rowIndex = 0; rowIndex < table.matrix.length; rowIndex++) {
    const worksheetRow = worksheet.getRow(startRow + rowIndex);
    for (let columnIndex = 0; columnIndex < maxCols; columnIndex++) {
      const cellInfo = table.cells[rowIndex]?.[columnIndex];
      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.value = excelValue(cellInfo);
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'top',
        horizontal: alignmentFor(cellInfo),
        wrapText: true,
      };
      cell.font = baseFont();

      if (cellInfo?.numberFormat) {
        cell.numFmt = cellInfo.numberFormat;
      }

      if (rowIndex === table.headerRowIndex) {
        decorateHeaderCell(cell);
      } else if (table.rowMeta[rowIndex]?.isTitle) {
        decorateTitleCell(cell);
      }
    }
  }

  if (table.headerRowIndex === 0) {
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: startRow, column: 1 },
      to: { row: startRow, column: maxCols },
    };
  }

  return startRow + table.matrix.length;
}

function addDiagnosticsWorksheet(workbook, documentResult) {
  const worksheet = workbook.addWorksheet('_diagnostico');
  const headers = ['Pagina', 'Tabelas', 'Itens de texto', 'Linhas', 'Colunas', 'Confianca', 'Avisos', 'Codigos'];
  worksheet.addRow(headers);
  headers.forEach((_, index) => decorateHeaderCell(worksheet.getCell(1, index + 1)));

  for (const diagnostic of documentResult.pageDiagnostics) {
    worksheet.addRow([
      diagnostic.pageNumber,
      diagnostic.tables,
      diagnostic.allTextItems,
      diagnostic.rows,
      diagnostic.columns,
      diagnostic.confidence,
      diagnostic.warnings.join(' | '),
      (diagnostic.codes || []).map(code => code.code).join(' | '),
    ]);
  }

  worksheet.eachRow(row => row.eachCell(cell => {
    cell.border = thinBorder();
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.font = baseFont();
  }));
  autoFit(worksheet);
}

function addOriginWorksheet(workbook, documentResult) {
  const worksheet = workbook.addWorksheet('_origem');
  const rows = [
    ['PDF de origem', documentResult.sourceFileName],
    ['Total de paginas', documentResult.totalPages],
    ['Paginas selecionadas', documentResult.selectedPages.join(', ')],
    ['Data da extracao', documentResult.createdAt],
    ['Versao do processador', '2.0.0'],
    ['Modo usado', documentResult.settings.mode],
    ['Margens ignoradas', JSON.stringify({
      top: documentResult.settings.ignoreTopPct,
      bottom: documentResult.settings.ignoreBottomPct,
      left: documentResult.settings.ignoreLeftPct,
      right: documentResult.settings.ignoreRightPct,
    })],
    ['Alteracoes manuais', JSON.stringify(documentResult.manualChanges, null, 2)],
  ];

  rows.forEach((values, index) => {
    const row = worksheet.addRow(values);
    if (index === 0) {
      row.eachCell(cell => decorateHeaderCell(cell));
    }
  });

  worksheet.eachRow((row, index) => row.eachCell(cell => {
    if (index !== 1) cell.font = baseFont();
    cell.border = thinBorder();
    cell.alignment = { vertical: 'top', wrapText: true };
  }));
  autoFit(worksheet);
}

function excelValue(cellInfo) {
  if (!cellInfo) return '';
  if (cellInfo.preserveAsText) return String(cellInfo.value || '');
  return cellInfo.normalizedValue ?? cellInfo.value ?? '';
}

function alignmentFor(cellInfo) {
  if (!cellInfo) return 'left';
  if (cellInfo.type === 'number' || cellInfo.type === 'percentage') return 'right';
  if (cellInfo.type === 'date') return 'center';
  return 'left';
}

function decorateHeaderCell(cell) {
  cell.font = { ...baseFont(), bold: true, color: { argb: 'FFFFFFFF' }, name: 'Inter' };
  cell.fill = solid('0B1220');
  cell.border = thinBorder();
}

function decorateTitleCell(cell) {
  cell.font = { ...baseFont(), bold: true, color: { argb: 'FFE5EDF8' }, name: 'Inter' };
  cell.fill = solid('152238');
  cell.border = thinBorder();
}

function baseFont() {
  return { name: 'Inter', size: 10, color: { argb: 'FF0B1220' } };
}

function autoFit(worksheet) {
  worksheet.columns.forEach(column => {
    let max = 10;
    column.eachCell({ includeEmpty: true }, cell => {
      const length = String(cell.value ?? '').length;
      max = Math.max(max, Math.min(55, length + 2));
    });
    column.width = max;
  });
}

function thinBorder() {
  return {
    top: { style: 'thin', color: { argb: 'FF91A4BF' } },
    left: { style: 'thin', color: { argb: 'FF91A4BF' } },
    bottom: { style: 'thin', color: { argb: 'FF91A4BF' } },
    right: { style: 'thin', color: { argb: 'FF91A4BF' } },
  };
}

function solid(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

function safeSheetName(name) {
  return String(name || 'Planilha')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);
}

function groupBy(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export function buildExcelFilename(pdfName) {
  return `${safeFileStem(pdfName)}_tabelas_extraidas.xlsx`;
}
