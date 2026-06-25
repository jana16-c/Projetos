import { safeFileStem } from '../utils/download.js';
import { ensureSheetJsRuntime } from '../vendor/vendorLoader.js';

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

export function writeExtractionToMacroWorkbook(XLSX, workbook, documentResult) {
  const sheets = buildExtractionSheets(XLSX, documentResult);
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

function buildExtractionSheets(XLSX, documentResult) {
  const sheets = [];

  for (const table of documentResult.tables) {
    const name = safeSheetName(`EXTRACAO_P${table.pageNumber}_T${table.tableIndex}`);
    const matrix = table.matrix.map((row, rowIndex) => row.map((_, columnIndex) => xlsmValue(table.cells[rowIndex]?.[columnIndex])));
    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    sheet['!cols'] = buildCols(matrix);
    sheets.push({ name, sheet });
  }

  const diagnosticRows = [
    ['Pagina', 'Tabelas', 'Linhas', 'Colunas', 'Confianca', 'Avisos'],
    ...documentResult.pageDiagnostics.map(diagnostic => [
      diagnostic.pageNumber,
      diagnostic.tables,
      diagnostic.rows,
      diagnostic.columns,
      diagnostic.confidence,
      diagnostic.warnings.join(' | '),
    ]),
  ];
  const diagnosticSheet = XLSX.utils.aoa_to_sheet(diagnosticRows);
  diagnosticSheet['!cols'] = buildCols(diagnosticRows);
  sheets.push({ name: safeSheetName('EXTRACAO_DIAGNOSTICO'), sheet: diagnosticSheet });

  return sheets;
}

function buildCols(matrix) {
  const maxColumns = Math.max(...matrix.map(row => row.length), 1);
  return Array.from({ length: maxColumns }, (_, columnIndex) => ({
    wch: Math.max(10, Math.min(55, ...matrix.map(row => String(row[columnIndex] ?? '').length + 2))),
  }));
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
  return `${safeFileStem(pdfName)}_tabelas_extraidas.xlsm`;
}
