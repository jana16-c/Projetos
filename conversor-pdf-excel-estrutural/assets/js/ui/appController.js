import { $, $all } from '../utils/dom.js';
import { parsePageSpec } from '../utils/pages.js';
import {
  buildDefaultPageSpec,
  formatPageList,
  normalizeSpecText,
  selectionSummary,
  shouldApplyDefaultPageSpec,
} from '../utils/pageSelection.js';
import { runPageSelectionSelfTest } from '../utils/pageSelection.test.js';
import { downloadBlob } from '../utils/download.js';
import { loadPdfDocument, extractPageTextItemsWithOptions } from '../pdf/pdfLoader.js';
import { extractDocumentTables } from '../extraction/tableExtractor.js';
import { buildXlsxExport, buildXlsmExport, buildZipExport } from '../export/exportService.js';
import { renderPreview } from './previewRenderer.js';
import { StatusView } from './status.js';
import { DEFAULT_SETTINGS } from '../config/settings.js';
import { checkRuntimeLibraries } from '../vendor/vendorLoader.js';
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
} from './tableEditor.js';

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
    this.preview = $('#preview');
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
    this.selectTemplateBtn.addEventListener('click', () => this.templateInput.click());

    this.dropZone.addEventListener('click', event => {
      if (event.target === this.selectPdfBtn) return;
      this.pdfInput.click();
    });

    this.pdfInput.addEventListener('change', event => this.setFile(event.target.files?.[0]));
    this.templateInput.addEventListener('change', event => this.setTemplate(event.target.files?.[0]));

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
    this.exportXlsmBtn.addEventListener('click', () => this.exportXlsm());
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

    for (const button of buttons) {
      button.addEventListener('click', () => {
        const target = button.dataset.tabTarget;
        for (const item of buttons) item.classList.toggle('active', item === button);
        for (const panel of panels) panel.classList.toggle('active', panel.dataset.tabPanel === target);
      });
    }
  }

  bindTests() {
    $('#testLibrariesBtn').addEventListener('click', () => this.testLibraries());
    $('#testParserBtn').addEventListener('click', () => this.testParser());
    $('#testExtractionBtn').addEventListener('click', () => this.testExtraction());
    $('#clearTestsBtn').addEventListener('click', () => this.clearTests());
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
    this.fileDetails.textContent = `${formatBytes(file.size)} · aguardando leitura`;
    this.exportXlsxBtn.disabled = true;
    this.exportZipBtn.disabled = true;
    this.exportXlsmBtn.disabled = !this.templateFile;
    renderPreview(this.preview, null);

    try {
      this.status.set('Carregando PDF...', 8);
      this.pdf = await loadPdfDocument(file);
      this.pageSpecInput.placeholder = `Ex.: 1-${Math.min(3, this.pdf.numPages)}, 5`;
      this.applyDefaultPageSpecOnlyWhenSafe();
      this.updatePageSelectionInfo();
      this.fileDetails.textContent = `${formatBytes(file.size)} · ${this.pdf.numPages} pagina(s) · camada textual sera verificada no processamento`;
      this.status.set(`PDF carregado: ${this.pdf.numPages} pagina(s). ${this.currentSelectionSummary()}`, 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao carregar PDF: ${error.message}`, 0);
    }
  }

  setTemplate(file) {
    this.templateFile = file || null;
    this.templateName.textContent = file ? file.name : 'Nenhum modelo selecionado';
    this.exportXlsmBtn.disabled = !file || !this.documentResult;
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
      mode: $('#mode').value,
      rowTolerance: Number($('#rowTolerance').value),
      columnTolerance: Number($('#columnTolerance').value),
      gapFactor: Number($('#gapFactor').value),
      ignoreTopPct: Number($('#ignoreTopPct').value),
      ignoreBottomPct: Number($('#ignoreBottomPct').value),
      ignoreLeftPct: Number($('#ignoreLeftPct').value),
      ignoreRightPct: Number($('#ignoreRightPct').value),
      mergeContinuation: $('#mergeContinuation').checked,
      hideRepeatedLines: $('#hideRepeatedLines').checked,
      sheetMode: $('#sheetMode').value,
      includeXlsmInZip: $('#includeXlsmInZip').checked,
      mergeTitles: $('#mergeTitles').checked,
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
      this.exportXlsmBtn.disabled = true;
      renderPreview(this.preview, null);

      const summary = selectionSummary(pages, this.pdf.numPages);
      this.updatePageSelectionInfo();
      this.status.set(`Processando selecao: ${summary}`, 1);
      this.writeTest(`SELECAO USADA NO PROCESSAMENTO\n${summary}\nLista interna: [${formatPageList(pages, 200)}]`, true);

      const pagesData = [];
      for (let index = 0; index < pages.length; index++) {
        const pageNumber = pages[index];
        const progressBase = Math.round((index / pages.length) * 90);
        this.status.set(`Extraindo pagina ${pageNumber} (${index + 1}/${pages.length})...`, progressBase);
        pagesData.push(await extractPageTextItemsWithOptions(this.pdf, pageNumber, {
          ignoreMargins: {
            top: settings.ignoreTopPct / 100,
            bottom: settings.ignoreBottomPct / 100,
            left: settings.ignoreLeftPct / 100,
            right: settings.ignoreRightPct / 100,
          },
        }));
      }

      this.documentResult = extractDocumentTables({
        pagesData,
        settings,
        sourceFileName: this.file.name,
        totalPages: this.pdf.numPages,
      });

      renderPreview(this.preview, this.documentResult, this.previewHandlers());
      this.status.showMetrics(this.documentResult);
      this.status.set(`Processamento concluido. ${summary}`, 100);
      this.exportXlsxBtn.disabled = false;
      this.exportZipBtn.disabled = false;
      this.exportXlsmBtn.disabled = !this.templateFile;

      const textLayerPages = pagesData.filter(page => page.textLayerDetected).length;
      this.fileDetails.textContent = `${formatBytes(this.file.size)} · ${this.pdf.numPages} pagina(s) · camada textual em ${textLayerPages}/${pagesData.length} pagina(s) processadas`;
    } catch (error) {
      console.error(error);
      this.status.set(`Erro durante a extracao: ${error.message}`, 0);
      this.writeTest(`ERRO NO PROCESSAMENTO\n${error.stack || error.message}`, true);
    }
  }

  async exportXlsx() {
    if (!this.documentResult) return;
    try {
      this.status.set('Gerando XLSX...', 40);
      const result = await buildXlsxExport(this.documentResult);
      downloadBlob(result.blob, result.filename);
      this.status.set('XLSX exportado.', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao exportar XLSX: ${error.message}`, 0);
    }
  }

  async exportXlsm() {
    if (!this.documentResult) return;
    try {
      this.status.set('Gerando XLSM...', 40);
      const result = await buildXlsmExport(this.documentResult, this.templateFile);
      downloadBlob(result.blob, result.filename);
      this.status.set('XLSM exportado.', 100);
    } catch (error) {
      console.error(error);
      this.status.set(error.message, 0);
    }
  }

  async exportZip() {
    if (!this.documentResult) return;
    try {
      this.status.set('Gerando ZIP de auditoria...', 40);
      const result = await buildZipExport(this.documentResult, this.templateFile, {
        includeXlsmInZip: this.documentResult.settings.includeXlsmInZip,
      });
      downloadBlob(result.blob, result.filename);
      this.status.set('ZIP exportado.', 100);
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
    renderPreview(this.preview, this.documentResult, this.previewHandlers());
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
    this.fileDetails.textContent = 'Arraste um PDF textual ou clique para escolher.';
    this.pageSpecInput.value = '';
    this.templateName.textContent = this.templateFile ? this.templateFile.name : 'Nenhum modelo selecionado';
    renderPreview(this.preview, null);
    this.exportXlsxBtn.disabled = true;
    this.exportZipBtn.disabled = true;
    this.exportXlsmBtn.disabled = !this.templateFile;
    this.status.set('Aguardando PDF.', 0);
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
      const expected = '1,2,3,5';
      if (result.join(',') !== expected) {
        throw new Error(`Resultado inesperado: ${result.join(',')}`);
      }

      const selectionTest = runPageSelectionSelfTest();
      this.writeTest([
        `OK: selecao "1-3, 5, 3" resultou em [${result.join(', ')}].`,
        `OK: selecao "2, 4-5" resultou em [${selectionTest.selected.join(', ')}].`,
        `OK: ${selectionTest.summary}`,
        'OK: selecao manual nao e sobrescrita pelo padrao 1-total.',
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
        `Avisos: ${documentResult.pageDiagnostics[0]?.warnings.join(' | ') || 'nenhum'}`,
      ].join('\n'), true);
    } catch (error) {
      console.error(error);
      this.writeTest(`ERRO: ${error.message}`, true);
    }
  }

  clearTests() {
    this.testOutput.textContent = 'Nenhum teste executado.';
  }

  writeTest(message, reset = false) {
    if (reset || this.testOutput.textContent === 'Nenhum teste executado.') {
      this.testOutput.textContent = message;
    } else {
      this.testOutput.textContent += `\n\n${message}`;
    }
  }
}

function buildMockPageData() {
  const rows = [
    ['COMPETENCIA', 'EMPREGADO', 'CPF', 'DEVIDO'],
    ['01/2024', 'MARIA SILVA', '000.000.000-00', 'R$ 1.234,56'],
    ['02/2024', 'JOAO SOUZA', '111.111.111-11', '987,65'],
    ['DETALHAMENTO EXTRA', '', '', ''],
    ['CODIGO', 'DESCRICAO', 'BASE', 'VALOR'],
    ['1001', 'FGTS', '1.200,00', '96,00'],
    ['1002', 'INSS', '1.200,00', '120,00'],
  ];

  const xPositions = [42, 150, 330, 470];
  const items = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((text, columnIndex) => {
      if (!text) return;
      const fontSize = rowIndex === 0 || rowIndex === 4 ? 11 : 10;
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
        fontName: rowIndex === 0 || rowIndex === 4 ? 'Inter-Bold' : 'Inter-Regular',
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
