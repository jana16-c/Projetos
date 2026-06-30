import { $ } from '../utils/dom.js?v=2026-06-30-livepreview-3';

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
