export const DEFAULT_SETTINGS = Object.freeze({
  pageSpec: '',
  mode: 'automatic',
  sourceMode: 'auto',
  outputMode: 'clean-table',
  rowTolerance: 0.62,
  columnTolerance: 9,
  gapFactor: 2.3,
  ocrDpi: 300,
  ocrLanguages: 'por+eng',
  ocrMinConfidence: 45,
  detectBorders: true,
  detectColors: true,
  mergeSplitRows: true,
  keepPageImagesInAudit: false,
  ignoreTopPct: 0,
  ignoreBottomPct: 0,
  ignoreLeftPct: 0,
  ignoreRightPct: 0,
  mergeContinuation: true,
  hideRepeatedLines: true,
  sheetMode: 'table',
  includeXlsmInZip: false,
  mergeTitles: true,
  maxPreviewTables: 18,
});

export const PDFJS_WORKER = 'assets/js/vendor/pdf.worker.min.js';

export const APP_NAME = 'Processador de Tabelas de Processos Trabalhistas';
