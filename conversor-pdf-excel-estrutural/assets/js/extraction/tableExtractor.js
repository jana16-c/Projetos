import { buildRows } from './rows.js';
import { buildColumnModel, rowsToMatrix } from './columns.js';
import { buildDiagnostics } from './diagnostics.js';

export function extractStructuredPage(pageData, settings) {
  const { rows, stats } = buildRows(pageData.items, settings);
  const columnModel = buildColumnModel(rows, pageData.width, settings);
  const { matrix, rowMeta } = rowsToMatrix(rows, columnModel, settings);
  const normalized = normalizeMatrix(matrix);
  const diagnostics = buildDiagnostics(pageData, rows, columnModel, normalized, settings);

  return {
    pageNumber: pageData.pageNumber,
    width: pageData.width,
    height: pageData.height,
    matrix: normalized,
    rowMeta,
    rows,
    columnModel,
    stats,
    diagnostics,
  };
}

function normalizeMatrix(matrix) {
  const maxCols = Math.max(1, ...matrix.map(r => r.length));
  return matrix.map(row => {
    const output = row.map(value => String(value ?? '').replace(/\s+/g, ' ').trim());
    while (output.length < maxCols) output.push('');
    return output;
  });
}
