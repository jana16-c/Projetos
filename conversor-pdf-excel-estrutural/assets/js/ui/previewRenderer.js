import { clear, el } from '../utils/dom.js?v=2026-06-30-livepreview-3';

export function renderPreview(container, documentResult, handlers = {}) {
  clear(container);
  container.classList.remove('empty');

  if (!documentResult?.tables?.length) {
    container.classList.add('empty');
    container.textContent = 'Nenhuma tabela processada ainda.';
    return;
  }

  for (const table of documentResult.tables) {
    container.appendChild(buildTableCard(table, handlers));
  }
}

function buildTableCard(table, handlers) {
  const card = el('section', { class: 'table-card' });
  const labelPages = table.sourcePages.length > 1
    ? `Paginas ${table.sourcePages.join(', ')}`
    : `Pagina ${table.pageNumber}`;

  card.append(
    el('div', { class: 'table-card-head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: labelPages }),
        el('h3', { text: `Tabela ${table.tableIndex}` }),
        el('p', { class: 'table-meta', text: `${Math.round((table.confidence || 0) * 100)}% de confianca · ${table.matrix.length} linhas · ${table.matrix[0]?.length || 0} colunas` }),
      ]),
      buildActions(table, handlers),
    ]),
  );

  if (table.warnings?.length) {
    card.appendChild(el('p', { class: 'warning', text: table.warnings.join(' · ') }));
  }

  const wrapper = el('div', { class: 'table-scroll' });
  const tableNode = el('table', { class: 'preview-table' });
  const hasHeader = table.headerRowIndex === 0;

  if (hasHeader) {
    const thead = el('thead');
    thead.appendChild(buildTableRow(table, 0, true, handlers));
    tableNode.appendChild(thead);
  }

  const tbody = el('tbody');
  const startIndex = hasHeader ? 1 : 0;
  for (let rowIndex = startIndex; rowIndex < table.matrix.length; rowIndex++) {
    tbody.appendChild(buildTableRow(table, rowIndex, false, handlers));
  }
  tableNode.appendChild(tbody);
  wrapper.appendChild(tableNode);
  card.appendChild(wrapper);

  return card;
}

function buildActions(table, handlers) {
  return el('div', { class: 'table-actions' }, [
    actionButton('Adicionar linha', () => handlers.onAddRow?.(table.id)),
    actionButton('Excluir linha', () => handlers.onDeleteRow?.(table.id)),
    actionButton('Adicionar coluna', () => handlers.onAddColumn?.(table.id)),
    actionButton('Excluir coluna', () => handlers.onDeleteColumn?.(table.id)),
    actionButton('Desfazer alteracoes da tabela', () => handlers.onResetTable?.(table.id)),
    actionButton('Marcar primeira linha como cabecalho', () => handlers.onMarkHeader?.(table.id)),
    actionButton('Unir a tabela anterior', () => handlers.onMergePrevious?.(table.id)),
    actionButton('Separar desta tabela', () => handlers.onSplitTable?.(table.id)),
    actionButton('Undo', () => handlers.onUndo?.(table.id)),
  ]);
}

function buildTableRow(table, rowIndex, headerRow, handlers) {
  const tr = el('tr');
  tr.appendChild(el(headerRow ? 'th' : 'td', { class: 'row-index', text: String(rowIndex + 1) }));

  for (let columnIndex = 0; columnIndex < table.matrix[rowIndex].length; columnIndex++) {
    const tag = headerRow ? 'th' : 'td';
    const cell = el(tag, {});
    const input = el('textarea', {
      class: 'cell-input',
      rows: '1',
      'data-table-id': table.id,
      'data-row-index': String(rowIndex),
      'data-column-index': String(columnIndex),
      onfocus: () => handlers.onFocusCell?.(table.id, rowIndex, columnIndex),
      onchange: event => handlers.onEditCell?.(table.id, rowIndex, columnIndex, event.target.value),
    });
    input.value = table.matrix[rowIndex][columnIndex];
    cell.appendChild(input);
    tr.appendChild(cell);
  }

  return tr;
}

function actionButton(label, onClick) {
  return el('button', {
    class: 'btn subtle small',
    type: 'button',
    onclick: onClick,
  }, [label]);
}
