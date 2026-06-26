import {
  addColumn,
  addRow,
  deleteColumn,
  deleteRow,
  markFirstRowAsHeader,
  mergeTableIntoPrevious,
  resetTable,
  splitTableFromPrevious,
  undoTableChange,
  updateCell,
} from '../model/tableModel.js';
import { refreshDocumentResultDerivedState } from '../model/resultModel.js';

export function applyTableCellEdit(documentResult, tableId, rowIndex, columnIndex, value) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  updateCell(table, rowIndex, columnIndex, value);
  trackChange(documentResult, 'edit-cell', tableId, { rowIndex, columnIndex, value });
  return true;
}

export function addTableRow(documentResult, tableId, rowIndex) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  addRow(table, rowIndex);
  trackChange(documentResult, 'add-row', tableId, { rowIndex });
  return true;
}

export function removeTableRow(documentResult, tableId, rowIndex) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  deleteRow(table, rowIndex);
  trackChange(documentResult, 'delete-row', tableId, { rowIndex });
  return true;
}

export function addTableColumn(documentResult, tableId, columnIndex) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  addColumn(table, columnIndex);
  trackChange(documentResult, 'add-column', tableId, { columnIndex });
  return true;
}

export function removeTableColumn(documentResult, tableId, columnIndex) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  deleteColumn(table, columnIndex);
  trackChange(documentResult, 'delete-column', tableId, { columnIndex });
  return true;
}

export function undoTableEdit(documentResult, tableId) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  const changed = undoTableChange(table);
  if (changed) trackChange(documentResult, 'undo', tableId, {});
  return changed;
}

export function resetEditedTable(documentResult, tableId) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  const changed = resetTable(table);
  if (changed) trackChange(documentResult, 'reset-table', tableId, {});
  return changed;
}

export function markTableHeader(documentResult, tableId) {
  const table = findTable(documentResult, tableId);
  if (!table) return false;
  markFirstRowAsHeader(table);
  trackChange(documentResult, 'mark-header', tableId, {});
  return true;
}

export function mergeTableBackward(documentResult, tableId) {
  const changed = mergeTableIntoPrevious(documentResult, tableId);
  if (changed) trackChange(documentResult, 'merge-previous', tableId, {});
  return changed;
}

export function splitMergedTable(documentResult, tableId) {
  const changed = splitTableFromPrevious(documentResult, tableId);
  if (changed) trackChange(documentResult, 'split-table', tableId, {});
  return changed;
}

function findTable(documentResult, tableId) {
  return documentResult.tables.find(table => table.id === tableId);
}

function trackChange(documentResult, action, tableId, payload) {
  documentResult.manualChanges.push({
    action,
    tableId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
  refreshDocumentResultDerivedState(documentResult);
}
