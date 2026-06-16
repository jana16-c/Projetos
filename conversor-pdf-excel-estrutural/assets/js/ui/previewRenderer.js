import { clear, el } from '../utils/dom.js';
import { DEFAULT_SETTINGS } from '../config/settings.js';

export function renderPreview(container, results, settings = DEFAULT_SETTINGS) {
  clear(container);
  container.classList.remove('empty');

  if (!results?.length) {
    container.classList.add('empty');
    container.textContent = 'Nenhum resultado processado ainda.';
    return;
  }

  for (const result of results.slice(0, settings.maxPreviewPages)) {
    const section = el('div', { class: 'page-preview' });
    section.appendChild(el('h3', { text: `Página ${result.pageNumber}` }));
    section.appendChild(buildTable(result.matrix.slice(0, settings.maxPreviewRows)));

    if (result.diagnostics.warnings.length) {
      section.appendChild(el('p', { class: 'warning', text: result.diagnostics.warnings.join(' · ') }));
    }
    container.appendChild(section);
  }
}

function buildTable(matrix) {
  const table = el('table');
  const tbody = el('tbody');
  for (const row of matrix) {
    const tr = el('tr');
    for (const cell of row) {
      tr.appendChild(el('td', { text: String(cell ?? '') }));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}
