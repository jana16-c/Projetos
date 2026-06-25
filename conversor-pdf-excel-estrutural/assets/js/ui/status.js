import { $ } from '../utils/dom.js';

export class StatusView {
  constructor() {
    this.text = $('#statusText');
    this.bar = $('#progressBar');
  }

  set(message, progress = null) {
    this.text.textContent = message;
    if (progress !== null) this.progress(progress);
  }

  progress(value) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    this.bar.style.width = `${pct}%`;
  }

  showMetrics() {}
}
