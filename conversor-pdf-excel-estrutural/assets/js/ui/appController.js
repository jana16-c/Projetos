import { $, $all } from '../utils/dom.js?v=2026-06-30-livepreview-6';
import { parsePageSpec } from '../utils/pages.js?v=2026-06-30-livepreview-6';
import {
  buildDefaultPageSpec,
  formatPageList,
  normalizeSpecText,
  selectionSummary,
  shouldApplyDefaultPageSpec,
} from '../utils/pageSelection.js?v=2026-06-30-livepreview-6';
import { runPageSelectionSelfTest } from '../utils/pageSelection.test.js?v=2026-06-30-livepreview-6';
import { downloadBlob } from '../utils/download.js?v=2026-06-30-livepreview-6';
import { loadPdfDocument } from '../pdf/pdfLoader.js?v=2026-06-30-livepreview-6';
import { extractDocumentTables } from '../extraction/tableExtractor.js?v=2026-06-30-livepreview-6';
import { buildXlsxExport, buildXlsmExport, buildZipExport } from '../export/exportService.js?v=2026-06-30-livepreview-6';
import { StatusView } from './status.js?v=2026-06-30-livepreview-6';
import { DEFAULT_SETTINGS } from '../config/settings.js?v=2026-06-30-livepreview-6';
import { checkRuntimeLibraries } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-6';
import { processDocumentInBrowser } from '../processing/browserProcessor.js?v=2026-06-30-livepreview-6';
import {
  addTableColumn,
  addTableRow,
  applyTableCellEdit,
  markTableHeader,
  mergeTableBackward,
  removeTableColumn,
  removeTableRow,
  resetEditedTable,
  splitMergedTable,
  undoTableEdit,
} from './tableEditor.js?v=2026-06-30-livepreview-6';

export class AppController {
  constructor() {
    this.file = null;
    this.pdf = null;
    this.templateFile = null;
    this.documentResult = null;
    this.userEditedPageSpec = false;
    this.lastAutoPageSpec = '';
    this.activeTableId = null;
    this.activeCell = { rowIndex: -1, columnIndex: -1 };
    this.status = new StatusView();
    this.testOutput = document.querySelector('#testOutput');

    this.bindElements();
    this.bindEvents();
    this.bindTabs();
    this.bindTests();
    this.updatePageSelectionInfo();
  }

  bindElements() {
    this.dropZone = $('#dropZone');
    this.pdfInput = $('#pdfInput');
    this.selectPdfBtn = $('#selectPdfBtn');
    this.fileName = $('#fileName');
    this.fileDetails = $('#fileDetails');
    this.pageSpecInput = $('#pageSpec');
    this.pageSelectionInfo = $('#pageSelectionInfo');
    this.processBtn = $('#processBtn');
    this.exportXlsxBtn = $('#exportXlsxBtn');
    this.exportXlsmBtn = $('#exportXlsmBtn');
    this.exportZipBtn = $('#exportZipBtn');
    this.clearBtn = $('#clearBtn');
    this.templateInput = $('#templateInput');
    this.selectTemplateBtn = $('#selectTemplateBtn');
    this.templateName = $('#templateName');
  }

  bindEvents() {
    this.selectPdfBtn.addEventListener('click', () => this.pdfInput.click());
    this.selectTemplateBtn?.addEventListener('click', () => this.templateInput?.click());

    this.dropZone.addEventListener('click', event => {
      if (event.target === this.selectPdfBtn) return;
      this.pdfInput.click();
    });

    this.pdfInput.addEventListener('change', event => this.setFile(event.target.files?.[0]));
    this.templateInput?.addEventListener('change', event => this.setTemplate(event.target.files?.[0]));

    this.pageSpecInput.addEventListener('input', () => {
      this.userEditedPageSpec = true;
      this.updatePageSelectionInfo();
    });

    this.pageSpecInput.addEventListener('blur', () => {
      this.pageSpecInput.value = normalizeSpecText(this.pageSpecInput.value);
      this.updatePageSelectionInfo();
    });

    this.dropZone.addEventListener('dragover', event => {
      event.preventDefault();
      this.dropZone.classList.add('dragging');
    });
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragging'));
    this.dropZone.addEventListener('drop', event => {
      event.preventDefault();
      this.dropZone.classList.remove('dragging');
      this.setFile(event.dataTransfer.files?.[0]);
    });

    this.processBtn.addEventListener('click', () => this.process());
    this.exportXlsxBtn.addEventListener('click', () => this.exportXlsx());
    this.exportXlsmBtn?.addEventListener('click', () => this.exportXlsm());
    this.exportZipBtn.addEventListener('click', () => this.exportZip());
    this.clearBtn.addEventListener('click', () => this.clearState());

    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        this.process();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && this.activeTableId) {
        event.preventDefault();
        this.undoTable(this.activeTableId);
      }
    });
  }

  bindTabs() {
    const buttons = $all('[data-tab-target]');
    const panels = $all('[data-tab-panel]');
    if (!buttons.length || !panels.length) return;

    for (const button of buttons) {
      button.addEventListener('click', () => {
        const target = button.dataset.tabTarget;
        for (const item of buttons) item.classList.toggle('active', item === button);
        for (const panel of panels) panel.classList.toggle('active', panel.dataset.tabPanel === target);
      });
    }
  }

  bindTests() {
    document.querySelector('#testLibrariesBtn')?.addEventListener('click', () => this.testLibraries());
    document.querySelector('#testParserBtn')?.addEventListener('click', () => this.testParser());
    document.querySelector('#testExtractionBtn')?.addEventListener('click', () => this.testExtraction());
    document.querySelector('#clearTestsBtn')?.addEventListener('click', () => this.clearTests());
  }

  async setFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      this.status.set('Selecione um arquivo PDF valido.', 0);
      return;
    }

    this.file = file;
    this.pdf = null;
    this.documentResult = null;
    this.fileName.textContent = file.name;
    this.fileDetails.textContent = `${formatBytes(file.size)} - aguardando leitura`;
    this.exportXlsxBtn.disabled = true;
    this.exportZipBtn.disabled = true;
    if (this.exportXlsmBtn) this.exportXlsmBtn.disabled = !this.templateFile;

    try {
      this.status.set('Carregando PDF...', 8);
      this.pdf = await loadPdfDocument(file);
      this.pageSpecInput.placeholder = `Ex.: 1-${Math.min(3, this.pdf.numPages)}, 5`;
      this.applyDefaultPageSpecOnlyWhenSafe();
      this.updatePageSelectionInfo();
      this.fileDetails.textContent = `${formatBytes(file.size)} - ${this.pdf.numPages} pagina(s)`;
      this.status.set('Pronto.', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao carregar PDF: ${error.message}`, 0);
    }
  }

  setTemplate(file) {
    this.templateFile = file || null;
    if (this.templateName) this.templateName.textContent = file ? file.name : 'Nenhum modelo selecionado';
    if (this.exportXlsmBtn) this.exportXlsmBtn.disabled = !file || !this.documentResult;
  }

  applyDefaultPageSpecOnlyWhenSafe() {
    if (!this.pdf) return;

    const defaultSpec = buildDefaultPageSpec(this.pdf.numPages);
    const canApplyDefault = shouldApplyDefaultPageSpec({
      currentValue: this.pageSpecInput.value,
      lastAutoValue: this.lastAutoPageSpec,
      userEdited: this.userEditedPageSpec,
    });

    if (canApplyDefault) {
      this.pageSpecInput.value = defaultSpec;
      this.lastAutoPageSpec = defaultSpec;
      this.userEditedPageSpec = false;
    }
  }

  getSettings() {
    return {
      ...DEFAULT_SETTINGS,
      pageSpec: normalizeSpecText(this.pageSpecInput.value),
      mode: readValue('#mode', DEFAULT_SETTINGS.mode),
      sourceMode: readValue('#sourceMode', DEFAULT_SETTINGS.sourceMode),
      outputMode: readValue('#outputMode', DEFAULT_SETTINGS.outputMode),
      rowTolerance: readNumber('#rowTolerance', DEFAULT_SETTINGS.rowTolerance),
      columnTolerance: readNumber('#columnTolerance', DEFAULT_SETTINGS.columnTolerance),
      gapFactor: readNumber('#gapFactor', DEFAULT_SETTINGS.gapFactor),
      ocrDpi: readNumber('#ocrDpi', DEFAULT_SETTINGS.ocrDpi),
      ocrLanguages: readValue('#ocrLanguages', DEFAULT_SETTINGS.ocrLanguages),
      ocrMinConfidence: readNumber('#ocrMinConfidence', DEFAULT_SETTINGS.ocrMinConfidence),
      detectBorders: readChecked('#detectBorders', DEFAULT_SETTINGS.detectBorders),
      detectColors: readChecked('#detectColors', DEFAULT_SETTINGS.detectColors),
      mergeSplitRows: readChecked('#mergeSplitRows', DEFAULT_SETTINGS.mergeSplitRows),
      keepPageImagesInAudit: readChecked('#keepPageImagesInAudit', DEFAULT_SETTINGS.keepPageImagesInAudit),
      ignoreTopPct: readNumber('#ignoreTopPct', DEFAULT_SETTINGS.ignoreTopPct),
      ignoreBottomPct: readNumber('#ignoreBottomPct', DEFAULT_SETTINGS.ignoreBottomPct),
      ignoreLeftPct: readNumber('#ignoreLeftPct', DEFAULT_SETTINGS.ignoreLeftPct),
      ignoreRightPct: readNumber('#ignoreRightPct', DEFAULT_SETTINGS.ignoreRightPct),
      mergeContinuation: readChecked('#mergeContinuation', DEFAULT_SETTINGS.mergeContinuation),
      hideRepeatedLines: readChecked('#hideRepeatedLines', DEFAULT_SETTINGS.hideRepeatedLines),
      sheetMode: readValue('#sheetMode', DEFAULT_SETTINGS.sheetMode),
      includeXlsmInZip: readChecked('#includeXlsmInZip', DEFAULT_SETTINGS.includeXlsmInZip),
      mergeTitles: readChecked('#mergeTitles', DEFAULT_SETTINGS.mergeTitles),
    };
  }

  resolveSelectedPages(settings = this.getSettings()) {
    if (!this.pdf) throw new Error('Nenhum PDF foi carregado.');
    return parsePageSpec(settings.pageSpec, this.pdf.numPages);
  }

  currentSelectionSummary() {
    if (!this.pdf) return 'Selecione um PDF para validar o intervalo de paginas.';
    try {
      const pages = this.resolveSelectedPages();
      return selectionSummary(pages, this.pdf.numPages);
    } catch (error) {
      return error.message;
    }
  }

  updatePageSelectionInfo() {
    const summary = this.currentSelectionSummary();
    this.pageSelectionInfo.textContent = summary;
    this.pageSelectionInfo.dataset.state = /(fora do intervalo|invalido|invertido)/i.test(summary) ? 'error' : 'ok';
  }

  async process() {
    if (!this.file) {
      this.status.set('Selecione um PDF antes de processar.', 0);
      return;
    }

    try {
      if (!this.pdf) {
        this.pdf = await loadPdfDocument(this.file);
        this.applyDefaultPageSpecOnlyWhenSafe();
      }

      const settings = this.getSettings();
      let pages;
      try {
        pages = this.resolveSelectedPages(settings);
      } catch (error) {
        this.status.set(error.message, 0);
        this.updatePageSelectionInfo();
        return;
      }

      this.documentResult = null;
      this.exportXlsxBtn.disabled = true;
      this.exportZipBtn.disabled = true;
      if (this.exportXlsmBtn) this.exportXlsmBtn.disabled = true;

      const summary = selectionSummary(pages, this.pdf.numPages);
      this.updatePageSelectionInfo();
      this.status.set('Processando...', 1);
      this.writeTest(`SELECAO USADA NO PROCESSAMENTO\n${summary}\nLista interna: [${formatPageList(pages, 200)}]`, true);

      this.documentResult = await processDocumentInBrowser({
        pdf: this.pdf,
        file: this.file,
        settings,
        pages,
        onProgress: progress => {
          this.status.set(progress.message || mapStageLabel(progress.stage), progress.progress);
        },
      });

      this.status.showMetrics(this.documentResult);
      this.status.set('Convertido.', 100);
      this.exportXlsxBtn.disabled = false;
      this.exportZipBtn.disabled = false;
      if (this.exportXlsmBtn) this.exportXlsmBtn.disabled = !this.templateFile;

      const pageStates = this.documentResult.pages || [];
      const textLayerPages = pageStates.filter(page => page.textLayerDetected).length;
      const ocrPages = pageStates.filter(page => page.ocrApplied).length;
      this.fileDetails.textContent = `${formatBytes(this.file.size)} - ${this.pdf.numPages} pagina(s) - texto em ${textLayerPages}/${pages.length} - OCR em ${ocrPages}`;
    } catch (error) {
      console.error(error);
      this.status.set(`Erro durante a extracao: ${error.message}`, 0);
      this.writeTest(`ERRO NO PROCESSAMENTO\n${error.stack || error.message}`, true);
    }
  }

  async exportXlsx() {
    if (!this.documentResult) return;
    try {
      this.status.set('Exportando...', 40);
      const result = await buildXlsxExport(this.documentResult, this.getExportOptions());
      downloadBlob(result.blob, result.filename);
      this.status.set('Pronto!', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao exportar XLSX: ${error.message}`, 0);
    }
  }

  async exportXlsm() {
    if (!this.documentResult) return;
    try {
      this.status.set('Preparando XLSM...', 40);
      await waitForUi();
      const result = await buildXlsmExport(this.documentResult, this.templateFile);
      downloadBlob(result.blob, result.filename);
      this.status.set('Pronto!', 100);
    } catch (error) {
      console.error(error);
      this.status.set(error.message, 0);
    }
  }

  async exportZip() {
    if (!this.documentResult) return;
    try {
      this.status.set('Exportando...', 40);
      const result = await buildZipExport(this.documentResult, this.templateFile, {
        ...this.getExportOptions(),
        includeXlsmInZip: this.documentResult.settings.includeXlsmInZip,
      });
      downloadBlob(result.blob, result.filename);
      this.status.set('Pronto!', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao exportar ZIP: ${error.message}`, 0);
    }
  }

  previewHandlers() {
    return {
      onFocusCell: (tableId, rowIndex, columnIndex) => {
        this.activeTableId = tableId;
        this.activeCell = { rowIndex, columnIndex };
      },
      onEditCell: (tableId, rowIndex, columnIndex, value) => {
        if (!this.documentResult) return;
        applyTableCellEdit(this.documentResult, tableId, rowIndex, columnIndex, value);
      },
      onAddRow: tableId => this.mutateAndRerender(() => addTableRow(this.documentResult, tableId, this.resolveTargetRow())),
      onDeleteRow: tableId => this.mutateAndRerender(() => removeTableRow(this.documentResult, tableId, this.resolveTargetRow())),
      onAddColumn: tableId => this.mutateAndRerender(() => addTableColumn(this.documentResult, tableId, this.resolveTargetColumn())),
      onDeleteColumn: tableId => this.mutateAndRerender(() => removeTableColumn(this.documentResult, tableId, this.resolveTargetColumn())),
      onUndo: tableId => this.undoTable(tableId),
      onResetTable: tableId => this.mutateAndRerender(() => resetEditedTable(this.documentResult, tableId)),
      onMarkHeader: tableId => this.mutateAndRerender(() => markTableHeader(this.documentResult, tableId)),
      onMergePrevious: tableId => this.mutateAndRerender(() => mergeTableBackward(this.documentResult, tableId)),
      onSplitTable: tableId => this.mutateAndRerender(() => splitMergedTable(this.documentResult, tableId)),
    };
  }

  resolveTargetRow() {
    return this.activeCell.rowIndex >= 0 ? this.activeCell.rowIndex : 0;
  }

  resolveTargetColumn() {
    return this.activeCell.columnIndex >= 0 ? this.activeCell.columnIndex : 0;
  }

  mutateAndRerender(operation) {
    if (!this.documentResult) return;
    const changed = operation();
    if (changed === false) return;
    this.status.showMetrics(this.documentResult);
  }

  undoTable(tableId) {
    this.mutateAndRerender(() => undoTableEdit(this.documentResult, tableId));
  }

  clearState() {
    this.file = null;
    this.pdf = null;
    this.documentResult = null;
    this.activeTableId = null;
    this.activeCell = { rowIndex: -1, columnIndex: -1 };
    this.fileName.textContent = 'Nenhum arquivo selecionado';
    this.fileDetails.textContent = 'Arraste um PDF ou clique para escolher.';
    this.pageSpecInput.value = '';
    if (this.templateName) this.templateName.textContent = this.templateFile ? this.templateFile.name : 'Nenhum modelo selecionado';
    this.exportXlsxBtn.disabled = true;
    this.exportZipBtn.disabled = true;
    if (this.exportXlsmBtn) this.exportXlsmBtn.disabled = !this.templateFile;
    this.status.set('Pronto.', 0);
    this.updatePageSelectionInfo();
  }

  async testLibraries() {
    try {
      this.writeTest('Testando bibliotecas...', true);
      const results = await checkRuntimeLibraries();
      const lines = results.map(result => `OK: ${result.library} carregada por ${result.source}${result.workerSrc ? `; worker: ${result.workerSrc}` : ''}`);
      this.writeTest(lines.join('\n'));
      this.status.set('Bibliotecas testadas com sucesso.', 100);
    } catch (error) {
      console.error(error);
      this.writeTest(`ERRO: ${error.message}`, true);
      this.status.set(`Erro no teste de bibliotecas: ${error.message}`, 0);
    }
  }

  testParser() {
    try {
      const result = parsePageSpec('1-3, 5, 3', 6);
      if (result.join(',') !== '1,2,3,5') throw new Error(`Resultado inesperado: ${result.join(',')}`);
      const selectionTest = runPageSelectionSelfTest();
      this.writeTest([
        `OK: selecao "1-3, 5, 3" resultou em [${result.join(', ')}].`,
        `OK: selecao "2, 4-5" resultou em [${selectionTest.selected.join(', ')}].`,
        `OK: ${selectionTest.summary}`,
      ].join('\n'), true);
    } catch (error) {
      console.error(error);
      this.writeTest(`ERRO: ${error.message}`, true);
    }
  }

  testExtraction() {
    try {
      const pageData = buildMockPageData();
      const documentResult = extractDocumentTables({
        pagesData: [pageData],
        settings: this.getSettings(),
        sourceFileName: 'mock.pdf',
        totalPages: 1,
      });
      this.writeTest([
        'OK: extracao simulada concluida.',
        `Tabelas: ${documentResult.tables.length}`,
        `Linhas totais: ${documentResult.tables.reduce((acc, table) => acc + table.matrix.length, 0)}`,
      ].join('\n'), true);
    } catch (error) {
      console.error(error);
      this.writeTest(`ERRO: ${error.message}`, true);
    }
  }

  clearTests() {
    if (this.testOutput) this.testOutput.textContent = 'Nenhum teste executado.';
  }

  writeTest(message, reset = false) {
    if (!this.testOutput) return;
    if (reset || this.testOutput.textContent === 'Nenhum teste executado.') {
      this.testOutput.textContent = message;
    } else {
      this.testOutput.textContent += `\n\n${message}`;
    }
  }

  getExportOptions() {
    return {
      outputMode: readValue('#outputMode', this.documentResult?.settings?.outputMode || DEFAULT_SETTINGS.outputMode),
    };
  }
}

function readValue(selector, fallback = '') {
  const element = document.querySelector(selector);
  return element ? element.value : fallback;
}

function readNumber(selector, fallback = 0) {
  const value = Number(readValue(selector, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function readChecked(selector, fallback = false) {
  const element = document.querySelector(selector);
  return element ? element.checked : fallback;
}

function buildMockPageData() {
  const rows = [
    ['COMPETENCIA', 'EMPREGADO', 'CPF', 'DEVIDO'],
    ['01/2024', 'MARIA SILVA', '000.000.000-00', 'R$ 1.234,56'],
    ['02/2024', 'JOAO SOUZA', '111.111.111-11', '987,65'],
  ];
  const xPositions = [42, 150, 330, 470];
  const items = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((text, columnIndex) => {
      const fontSize = rowIndex === 0 ? 11 : 10;
      items.push({
        id: `mock:${rowIndex}:${columnIndex}`,
        pageNumber: 1,
        index: items.length,
        text,
        rawText: text,
        x: xPositions[columnIndex],
        y: 80 + rowIndex * 20,
        width: Math.max(38, text.length * fontSize * 0.48),
        height: fontSize,
        right: xPositions[columnIndex] + Math.max(38, text.length * fontSize * 0.48),
        bottom: 80 + rowIndex * 20 + fontSize,
        fontName: rowIndex === 0 ? 'Inter-Bold' : 'Inter-Regular',
        fontSize,
        dir: 'ltr',
        hasEOL: false,
      });
    });
  });

  return {
    pageNumber: 1,
    width: 595,
    height: 842,
    items,
    allItems: items,
    textLayerDetected: true,
  };
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mapStageLabel(stage) {
  const labels = {
    queued: 'Na fila...',
    validating: 'Validando PDF...',
    'loading-pdf': 'Abrindo PDF...',
    'extracting-text': 'Lendo texto...',
    'rendering-page': 'Renderizando pagina...',
    'running-ocr': 'Executando OCR...',
    'detecting-grid': 'Detectando grade...',
    reconciling: 'Consolidando texto...',
    'detecting-regions': 'Montando tabelas...',
    'validating-content': 'Validando resultado...',
    completed: 'Convertido.',
  };
  return labels[stage] || 'Processando...';
}

function waitForUi() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
