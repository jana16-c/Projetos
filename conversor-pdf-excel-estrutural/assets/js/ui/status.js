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

  showMetrics(results, totalPages) {
    clear(this.metrics);
    if (!results?.length) return;
    const pages = results.length;
    const rows = results.reduce((acc, r) => acc + r.matrix.length, 0);
    const cols = Math.max(...results.map(r => r.diagnostics.columns || 0), 0);
    const confidence = Math.round(results.reduce((acc, r) => acc + (r.diagnostics.confidence || 0), 0) / pages * 100);

    this.metrics.append(
      metric(pages, 'páginas processadas'),
      metric(rows, 'linhas reconstruídas'),
      metric(cols, 'maior nº de colunas'),
      metric(`${confidence}%`, 'confiança média'),
    );
  }
}

function metric(value, label) {
  return el('div', { class: 'metric' }, [
    el('strong', { text: String(value) }),
    el('span', { text: label }),
  ]);
}
