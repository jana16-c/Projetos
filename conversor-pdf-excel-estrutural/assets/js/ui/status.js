import { $, clear, el } from '../utils/dom.js';

export class StatusView {
  constructor() {
    this.text = $('#statusText');
    this.bar = $('#progressBar');
    this.metrics = $('#metrics');
  }

  set(message, progress = null) {
    this.text.textContent = message;
    if (progress !== null) this.progress(progress);
  }

  progress(value) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    this.bar.style.width = `${pct}%`;
  }

  showMetrics(documentResult) {
    clear(this.metrics);
    if (!documentResult?.tables?.length) return;

    const pages = documentResult.selectedPages.length;
    const tables = documentResult.tables.length;
    const rows = documentResult.tables.reduce((acc, table) => acc + table.matrix.length, 0);
    const columns = Math.max(...documentResult.tables.map(table => table.matrix[0]?.length || 0), 0);
    const confidence = Math.round(documentResult.tables.reduce((acc, table) => acc + (table.confidence || 0), 0) / tables * 100);

    this.metrics.append(
      metric(pages, 'paginas lidas'),
      metric(tables, 'tabelas detectadas'),
      metric(rows, 'linhas editaveis'),
      metric(columns, 'maior numero de colunas'),
      metric(`${confidence}%`, 'confianca media'),
    );
  }
}

function metric(value, label) {
  return el('div', { class: 'metric' }, [
    el('strong', { text: String(value) }),
    el('span', { text: label }),
  ]);
}
