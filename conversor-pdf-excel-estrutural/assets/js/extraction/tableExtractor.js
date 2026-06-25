import { buildRows } from './rows.js';
import { buildColumnModel, rowsToMatrix } from './columns.js';
import { buildDiagnostics } from './diagnostics.js';
import { detectTableBlocks } from './tableBlocks.js';
import { detectHeaderSignature } from './headerSignature.js';
import { attachCellClassification } from './valueClassifier.js';
import { mergeContinuationTables } from './tableContinuation.js';
import { buildDocumentResult } from '../model/resultModel.js';

export function extractStructuredPage(pageData, settings) {
  const documentResult = extractDocumentTables({
    pagesData: [pageData],
    settings,
    sourceFileName: 'pagina.pdf',
    totalPages: 1,
  });

  const [table] = documentResult.tables;
  const [diagnostics] = documentResult.pageDiagnostics;

  if (!table) {
    return {
      pageNumber: pageData.pageNumber,
      width: pageData.width,
      height: pageData.height,
      matrix: [],
      cells: [],
      rowMeta: [],
      rows: [],
      columnModel: { anchors: [], columnCount: 0, confidence: 0, warnings: [] },
      stats: {},
      diagnostics,
    };
  }

  return {
    pageNumber: pageData.pageNumber,
    width: pageData.width,
    height: pageData.height,
    matrix: table.matrix,
    cells: table.cells,
    rowMeta: table.rowMeta,
    rows: [],
    columnModel: table.columnModel,
    stats: {},
    diagnostics,
  };
}

export function extractDocumentTables({
  pagesData,
  settings,
  sourceFileName,
  totalPages,
}) {
  const pageAnalyses = pagesData.map(pageData => buildPageAnalysis(pageData, settings));
  const repeatedRows = detectRepeatedRows(pageAnalyses);

  for (const analysis of pageAnalyses) {
    finalizePageAnalysis(analysis, repeatedRows.get(analysis.pageNumber) || new Set(), settings);
  }

  const mergedTables = mergeContinuationTables(pageAnalyses.flatMap(analysis => analysis.tables), settings);

  for (const table of mergedTables) {
    table.initialState = {
      matrix: table.matrix.map(row => [...row]),
      cells: table.cells.map(row => row.map(cell => ({ ...cell }))),
      rowMeta: table.rowMeta.map(meta => ({
        ...meta,
        cellMeta: (meta.cellMeta || []).map(cell => ({ ...cell })),
      })),
      headerSignature: [...(table.headerSignature || [])],
      headerRowIndex: table.headerRowIndex,
      pageBreaks: (table.pageBreaks || []).map(pageBreak => ({
        ...pageBreak,
        removedHeader: pageBreak.removedHeader ? {
          row: [...pageBreak.removedHeader.row],
          cells: pageBreak.removedHeader.cells.map(cell => ({ ...cell })),
          rowMeta: {
            ...pageBreak.removedHeader.rowMeta,
            cellMeta: (pageBreak.removedHeader.rowMeta?.cellMeta || []).map(cell => ({ ...cell })),
          },
        } : null,
      })),
    };
    table.history = [];
  }

  return buildDocumentResult({
    sourceFileName,
    totalPages,
    selectedPages: pagesData.map(page => page.pageNumber),
    tables: mergedTables,
    pageDiagnostics: pageAnalyses.map(analysis => analysis.diagnostics),
    settings,
  });
}

function buildPageAnalysis(pageData, settings) {
  const { rows, stats } = buildRows(pageData.items, settings);

  return {
    pageNumber: pageData.pageNumber,
    width: pageData.width,
    height: pageData.height,
    items: pageData.items,
    allItems: pageData.allItems || pageData.items,
    textLayerDetected: pageData.textLayerDetected,
    rows,
    stats,
    tables: [],
    hiddenRows: [],
    warnings: [],
  };
}

function finalizePageAnalysis(pageAnalysis, repeatedRows, settings) {
  const visibleRows = pageAnalysis.rows.filter(row => {
    const key = buildRowKey(row);
    const hidden = settings.hideRepeatedLines && repeatedRows.has(key);
    if (hidden) {
      pageAnalysis.hiddenRows.push({
        key,
        text: row.text,
      });
    }
    return !hidden;
  });

  const tables = buildTablesForRows(pageAnalysis, visibleRows, settings);
  pageAnalysis.tables = tables;

  if (!pageAnalysis.textLayerDetected) {
    pageAnalysis.warnings.push('Esta pagina parece ser uma imagem ou PDF escaneado. A versao atual requer uma camada de texto.');
  }

  if (!tables.length) {
    pageAnalysis.warnings.push('Nenhuma tabela clara foi detectada nesta pagina.');
  }

  pageAnalysis.diagnostics = buildDiagnostics(pageAnalysis, settings);
}

function buildTablesForRows(pageAnalysis, rows, settings) {
  if (!rows.length) return [];

  const extractionMode = settings.mode === 'automatic' ? 'structural' : settings.mode;
  const blocks = settings.mode === 'full-page'
    ? [{ rows, confidence: 0.65, warnings: [], bounds: inferBounds(rows), tableIndex: 1 }]
    : detectTableBlocks(rows, pageAnalysis.width);

  const effectiveBlocks = blocks.length
    ? blocks
    : [{ rows, confidence: 0.58, warnings: ['Nenhum bloco tabular forte encontrado. A pagina foi exportada inteira.'], bounds: inferBounds(rows), tableIndex: 1 }];

  return effectiveBlocks.map((block, index) => buildTableFromBlock(pageAnalysis, block, index, {
    ...settings,
    mode: extractionMode,
  }));
}

function buildTableFromBlock(pageAnalysis, block, index, settings) {
  const columnModel = buildColumnModel(block.rows, pageAnalysis.width, settings);
  const { matrix, rowMeta, cells } = rowsToMatrix(block.rows, columnModel, settings);
  const normalizedMatrix = normalizeMatrix(matrix);
  const headerInfo = detectHeaderSignature(normalizedMatrix, rowMeta);
  const typedCells = attachCellClassification(normalizedMatrix, cells, headerInfo.headerRowIndex);
  const confidence = Math.round((((block.confidence || 0) * 0.55) + ((columnModel.confidence || 0) * 0.45)) * 100) / 100;

  return {
    id: `P${pageAnalysis.pageNumber}_T${index + 1}`,
    pageNumber: pageAnalysis.pageNumber,
    tableIndex: index + 1,
    sourcePages: [pageAnalysis.pageNumber],
    matrix: normalizedMatrix,
    cells: typedCells,
    rowMeta,
    bounds: block.bounds,
    columnModel,
    headerSignature: headerInfo.signature,
    headerRowIndex: headerInfo.headerRowIndex,
    confidence,
    warnings: [...new Set([...(columnModel.warnings || []), ...(block.warnings || [])])],
    continuedFromPreviousPage: false,
    continuesOnNextPage: false,
    width: pageAnalysis.width,
    pageBreaks: [{
      pageNumber: pageAnalysis.pageNumber,
      startRow: 0,
      rowCount: normalizedMatrix.length,
      removedHeader: null,
      originalRowCount: normalizedMatrix.length,
    }],
  };
}

function normalizeMatrix(matrix) {
  const maxCols = Math.max(1, ...matrix.map(row => row.length));
  return matrix.map(row => {
    const output = row.map(value => String(value ?? '').replace(/\s+/g, ' ').trim());
    while (output.length < maxCols) output.push('');
    return output;
  });
}

function detectRepeatedRows(pageAnalyses) {
  const occurrences = new Map();
  const threshold = Math.max(2, Math.ceil(pageAnalyses.length * 0.6));

  for (const analysis of pageAnalyses) {
    const candidates = [
      ...analysis.rows.slice(0, 3).map(row => ({ zone: 'top', key: buildRowKey(row) })),
      ...analysis.rows.slice(-3).map(row => ({ zone: 'bottom', key: buildRowKey(row) })),
    ];

    for (const candidate of candidates) {
      const mapKey = `${candidate.zone}:${candidate.key}`;
      const seen = occurrences.get(mapKey) || new Set();
      seen.add(analysis.pageNumber);
      occurrences.set(mapKey, seen);
    }
  }

  const result = new Map();
  for (const analysis of pageAnalyses) {
    const keys = new Set();
    for (const row of analysis.rows) {
      const key = buildRowKey(row);
      const topKey = `top:${key}`;
      const bottomKey = `bottom:${key}`;
      if ((occurrences.get(topKey)?.size || 0) >= threshold || (occurrences.get(bottomKey)?.size || 0) >= threshold) {
        keys.add(key);
      }
    }
    result.set(analysis.pageNumber, keys);
  }

  return result;
}

function buildRowKey(row) {
  return String(row.text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function inferBounds(rows) {
  return {
    left: Math.min(...rows.map(row => row.xStart), 0),
    right: Math.max(...rows.map(row => row.xEnd), 0),
    top: Math.min(...rows.map(row => row.minY), 0),
    bottom: Math.max(...rows.map(row => row.maxY), 0),
  };
}
