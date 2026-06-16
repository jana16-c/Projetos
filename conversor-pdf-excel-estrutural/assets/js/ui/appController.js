import { $, $all } from '../utils/dom.js';
import { parsePageSpec } from '../utils/pages.js';
import { downloadBlob } from '../utils/download.js';
import { loadPdfDocument, extractPageTextItems } from '../pdf/pdfLoader.js';
import { extractStructuredPage } from '../extraction/tableExtractor.js';
import { buildWorkbook, buildExcelFilename } from '../export/workbookBuilder.js';
import { buildZipPackage, buildZipFilename } from '../export/zipBuilder.js';
import { renderPreview } from './previewRenderer.js';
import { StatusView } from './status.js';
import { DEFAULT_SETTINGS } from '../config/settings.js';
import { checkRuntimeLibraries } from '../vendor/vendorLoader.js';

export class AppController {
  constructor() {
    this.file = null;
    this.pdf = null;
    this.results = [];
    this.status = new StatusView();
    this.preview = $('#preview');
    this.testOutput = document.querySelector('#testOutput');

    this.bindElements();
    this.bindEvents();
    this.bindTabs();
    this.bindTests();
  }

  bindElements() {
    this.dropZone = $('#dropZone');
    this.pdfInput = $('#pdfInput');
    this.selectPdfBtn = $('#selectPdfBtn');
    this.fileName = $('#fileName');
    this.processBtn = $('#processBtn');
    this.exportXlsxBtn = $('#exportXlsxBtn');
    this.exportZipBtn = $('#exportZipBtn');
  }

  bindEvents() {
    this.selectPdfBtn.addEventListener('click', () => this.pdfInput.click());
    this.dropZone.addEventListener('click', event => {
      if (event.target === this.selectPdfBtn) return;
      this.pdfInput.click();
    });
    this.pdfInput.addEventListener('change', event => this.setFile(event.target.files?.[0]));

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
    this.exportXlsxBtn.addEventListener('click', () => this.exportExcel());
    this.exportZipBtn.addEventListener('click', () => this.exportZip());
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
    document.querySelector('#testLibrariesBtn')?.addEventListener('click', () => this.testLibraries());
    document.querySelector('#testParserBtn')?.addEventListener('click', () => this.testParser());
    document.querySelector('#testExtractionBtn')?.addEventListener('click', () => this.testExtraction());
    document.querySelector('#clearTestsBtn')?.addEventListener('click', () => this.clearTests());
  }

  async setFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      this.status.set('Selecione um arquivo PDF válido.', 0);
      return;
    }

    this.file = file;
    this.pdf = null;
    this.results = [];
    this.fileName.textContent = file.name;
    this.exportXlsxBtn.disabled = true;
    this.exportZipBtn.disabled = true;
    renderPreview(this.preview, []);

    try {
      this.status.set('Carregando PDF...', 8);
      this.pdf = await loadPdfDocument(file);
      $('#pageSpec').placeholder = `Ex.: 1-${Math.min(3, this.pdf.numPages)}, 5`;
      $('#pageSpec').value = this.pdf.numPages === 1 ? '1' : `1-${this.pdf.numPages}`;
      this.status.set(`PDF carregado: ${this.pdf.numPages} página(s).`, 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao carregar PDF: ${error.message}`, 0);
    }
  }

  getSettings() {
    return {
      ...DEFAULT_SETTINGS,
      pageSpec: $('#pageSpec').value,
      mode: $('#mode').value,
      rowTolerance: Number($('#rowTolerance').value),
      columnTolerance: Number($('#columnTolerance').value),
      gapFactor: Number($('#gapFactor').value),
      sheetPerPage: $('#sheetPerPage').checked,
      mergeTitles: $('#mergeTitles').checked,
    };
  }

  async process() {
    if (!this.file) {
      this.status.set('Selecione um PDF antes de processar.', 0);
      return;
    }

    try {
      if (!this.pdf) {
        this.pdf = await loadPdfDocument(this.file);
      }

      const settings = this.getSettings();
      let pages;
      try {
        pages = parsePageSpec(settings.pageSpec, this.pdf.numPages);
      } catch (error) {
        this.status.set(error.message, 0);
        return;
      }

      this.results = [];
      this.exportXlsxBtn.disabled = true;
      this.exportZipBtn.disabled = true;
      renderPreview(this.preview, []);

      for (let i = 0; i < pages.length; i++) {
        const pageNumber = pages[i];
        const progressBase = Math.round((i / pages.length) * 90);
        this.status.set(`Extraindo estrutura da página ${pageNumber}...`, progressBase);
        const pageData = await extractPageTextItems(this.pdf, pageNumber);
        const result = extractStructuredPage(pageData, settings);
        this.results.push(result);
        this.status.set(`Página ${pageNumber} processada.`, Math.round(((i + 1) / pages.length) * 95));
      }

      renderPreview(this.preview, this.results, settings);
      this.status.showMetrics(this.results, this.pdf.numPages);
      this.status.set('Processamento concluído. Confira a prévia e exporte.', 100);
      this.exportXlsxBtn.disabled = false;
      this.exportZipBtn.disabled = false;
    } catch (error) {
      console.error(error);
      this.status.set(`Erro durante a extração: ${error.message}`, 0);
      this.writeTest(`ERRO NO PROCESSAMENTO\n${error.stack || error.message}`, true);
    }
  }

  async exportExcel() {
    if (!this.results.length) return;
    try {
      this.status.set('Gerando Excel...', 30);
      const blob = await buildWorkbook(this.results, this.getSettings());
      downloadBlob(blob, buildExcelFilename(this.file.name));
      this.status.set('Excel exportado.', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao exportar Excel: ${error.message}`, 0);
    }
  }

  async exportZip() {
    if (!this.results.length) return;
    try {
      this.status.set('Gerando pacote ZIP...', 30);
      const blob = await buildZipPackage(this.results, this.getSettings(), this.file.name);
      downloadBlob(blob, buildZipFilename(this.file.name));
      this.status.set('ZIP completo exportado.', 100);
    } catch (error) {
      console.error(error);
      this.status.set(`Erro ao exportar ZIP: ${error.message}`, 0);
    }
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
      this.writeTest(`OK: seleção "1-3, 5, 3" resultou em [${result.join(', ')}].`, true);
    } catch (error) {
      console.error(error);
      this.writeTest(`ERRO: ${error.message}`, true);
    }
  }

  testExtraction() {
    try {
      const pageData = buildMockPageData();
      const result = extractStructuredPage(pageData, this.getSettings());
      this.writeTest([
        'OK: extração simulada concluída.',
        `Linhas: ${result.diagnostics.rows}`,
        `Colunas: ${result.diagnostics.columns}`,
        `Confiança: ${result.diagnostics.confidence}`,
        '',
        'Matriz extraída:',
        JSON.stringify(result.matrix, null, 2),
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
}

function buildMockPageData() {
  const rows = [
    ['Competência', 'Empregado', 'CPF', 'Devido'],
    ['01/2024', 'MARIA SILVA', '000.000.000-00', '1.234,56'],
    ['02/2024', 'JOAO SOUZA', '111.111.111-11', '987,65'],
  ];

  const xPositions = [42, 150, 330, 470];
  const items = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((text, colIndex) => {
      const fontSize = rowIndex === 0 ? 11 : 10;
      items.push({
        id: `mock:${rowIndex}:${colIndex}`,
        pageNumber: 1,
        index: items.length,
        text,
        rawText: text,
        x: xPositions[colIndex],
        y: 80 + rowIndex * 18,
        width: Math.max(38, text.length * fontSize * 0.48),
        height: fontSize,
        right: xPositions[colIndex] + Math.max(38, text.length * fontSize * 0.48),
        bottom: 80 + rowIndex * 18 + fontSize,
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
  };
}
