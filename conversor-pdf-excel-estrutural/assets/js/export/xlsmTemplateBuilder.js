import { safeFileStem } from '../utils/download.js?v=2026-06-30-livepreview-3';
import { ensureSheetJsRuntime } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-3';
import { buildRenderableTable, buildTableMerges, deriveColumnWidths, deriveRowHeights } from './tableLayout.js?v=2026-06-30-livepreview-3';
import { buildAuditRows, buildUnassignedRows } from './workbookBuilder.js?v=2026-06-30-livepreview-3';

const MAX_XLSM_SOURCE_AUDIT_ROWS = 5000;

export async function buildXlsmFromTemplate({
  templateFile,
  documentResult,
  options = {},
}) {
  if (!templateFile) {
    throw new Error('Selecione um modelo .xlsm.');
  }

  await ensureSheetJsRuntime();
  const XLSX = window.XLSX;
  const data = await templateFile.arrayBuffer();

  let workbook;
  try {
    workbook = XLSX.read(data, {
      type: 'array',
      bookVBA: true,
      cellStyles: true,
      cellDates: true,
    });
  } catch {
    throw new Error('O Excel macro-habilitado nao pode ser gerado.');
  }

  if (!workbook.vbaraw) {
    throw new Error('O modelo nao contem VBA.');
  }

  try {
    writeExtractionToMacroWorkbook(XLSX, workbook, documentResult, options);
  } catch {
    throw new Error('Nao foi possivel preservar o projeto VBA.');
  }

  const output = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsm',
    bookVBA: true,
    cellStyles: true,
  });

  return new Blob([output], {
    type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  });
}

export function writeExtractionToMacroWorkbook(XLSX, workbook, documentResult, options = {}) {
  const sheets = buildExtractionSheets(XLSX, documentResult, options);
  replaceExtractionSheets(workbook, sheets);
}

export function replaceExtractionSheets(workbook, sheets) {
  const keepNames = workbook.SheetNames.filter(name => !name.startsWith('EXTRACAO_'));
  workbook.SheetNames = [...keepNames];
  for (const name of Object.keys(workbook.Sheets)) {
    if (name.startsWith('EXTRACAO_')) delete workbook.Sheets[name];
  }

  for (const sheet of sheets) {
    workbook.SheetNames.push(sheet.name);
    workbook.Sheets[sheet.name] = sheet.sheet;
  }
}

export function buildExtractionSheets(XLSX, documentResult, options = {}) {
  const sheets = [];

  for (const table of documentResult.tables) {
    const name = safeSheetName(`EXTRACAO_P${table.pageNumber}_T${table.tableIndex}`);
    const renderable = buildRenderableTable(table);
    const matrix = renderable.matrix.map((row, rowIndex) => row.map((_, columnIndex) => xlsmValue(renderable.cells[rowIndex]?.[columnIndex])));
    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    sheet['!cols'] = buildCols(matrix, deriveColumnWidths(table, Math.max(1, ...renderable.matrix.map(row => row.length))));
    sheet['!rows'] = deriveRowHeights(table, matrix.length).map(height => ({ hpt: height }));
    sheet['!merges'] = buildTableMerges(table, renderable).map(merge => ({
      s: { r: merge.startRow, c: merge.startColumn },
      e: { r: merge.endRow, c: merge.endColumn },
    }));
    sheets.push({ name, sheet });
  }

  const diagnosticRows = [
    ['Pagina', 'Itens texto', 'Itens associados', 'Itens nao associados', 'Ultimo Y fonte', 'Ultimo Y exportado', 'Itens zona inferior', 'Zona inferior editavel', 'OCR aplicado', 'Imagem visual', 'Status', 'Avisos'],
    ...buildAuditRows(documentResult),
  ];
  const diagnosticSheet = XLSX.utils.aoa_to_sheet(diagnosticRows);
  diagnosticSheet['!cols'] = buildCols(diagnosticRows);
  sheets.push({ name: safeSheetName('EXTRACAO_DIAGNOSTICO'), sheet: diagnosticSheet });

  const unassignedRows = [
    ['ID', 'Pagina', 'Texto', 'X', 'Y', 'Largura', 'Altura', 'Dentro tabela', 'Tabelas', 'Zona inferior', 'Filtrado por margem'],
    ...buildUnassignedRows(documentResult),
  ];
  const unassignedSheet = XLSX.utils.aoa_to_sheet(unassignedRows);
  unassignedSheet['!cols'] = buildCols(unassignedRows);
  sheets.push({ name: safeSheetName('EXTRACAO_NAO_ASSOCIADOS'), sheet: unassignedSheet });

  const sourceRows = [
    ['ID', 'Pagina', 'Texto', 'Texto bruto', 'X', 'Y', 'Largura', 'Altura', 'Right', 'Bottom', 'Filtrado'],
  ];

  const maxSourceRows = Number(options.maxSourceAuditRows || MAX_XLSM_SOURCE_AUDIT_ROWS);
  const sourceItems = documentResult.sourceItems || [];
  if (sourceItems.length <= maxSourceRows) {
    sourceRows.push(...sourceItems.map(item => ([
      item.id,
      item.pageNumber,
      item.text || '',
      item.rawText || '',
      item.x,
      item.y,
      item.width,
      item.height,
      item.right,
      item.bottom,
      item.filteredOut ? 'sim' : 'nao',
    ])));
  } else {
    sourceRows.push(
      ['_resumo', '', 'Aba detalhada omitida no XLSM para evitar travamento.', '', '', '', '', '', '', '', ''],
      ['_itens_origem', sourceItems.length, '', '', '', '', '', '', '', '', ''],
      ['_limite_xlsm', maxSourceRows, '', '', '', '', '', '', '', '', ''],
    );
  }

  const sourceSheet = XLSX.utils.aoa_to_sheet(sourceRows);
  sourceSheet['!cols'] = buildCols(sourceRows);
  sheets.push({ name: safeSheetName('EXTRACAO_ORIGEM'), sheet: sourceSheet });

  return sheets;
}

function buildCols(matrix, preferredWidths = []) {
  let maxColumns = 1;
  for (const row of matrix) {
    maxColumns = Math.max(maxColumns, row.length);
  }

  return Array.from({ length: maxColumns }, (_, columnIndex) => {
    let contentWidth = 2;
    for (const row of matrix) {
      contentWidth = Math.max(contentWidth, String(row[columnIndex] ?? '').length + 2);
    }
    return {
      wch: Math.max(preferredWidths[columnIndex] || 10, Math.min(80, contentWidth)),
    };
  });
}

function xlsmValue(cell) {
  if (!cell) return '';
  if (cell.preserveAsText) return String(cell.value || '');
  return cell.normalizedValue ?? cell.value ?? '';
}

function safeSheetName(name) {
  return String(name || 'EXTRACAO')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);
}

export function buildXlsmFilename(pdfName) {
  return `${safeFileStem(pdfName)}.xlsm`;
}
