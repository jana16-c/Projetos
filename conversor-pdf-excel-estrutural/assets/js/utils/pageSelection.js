export function buildDefaultPageSpec(totalPages) {
  const total = Number(totalPages);
  if (!Number.isInteger(total) || total < 1) return '';
  return total === 1 ? '1' : `1-${total}`;
}

export function shouldApplyDefaultPageSpec({ currentValue, lastAutoValue, userEdited }) {
  const current = normalizeSpecText(currentValue);
  const lastAuto = normalizeSpecText(lastAutoValue);

  if (!current) return true;
  if (!userEdited) return true;
  if (lastAuto && current === lastAuto) return true;

  return false;
}

export function normalizeSpecText(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPageList(pages, maxVisible = 18) {
  if (!Array.isArray(pages) || !pages.length) return 'nenhuma página';
  if (pages.length <= maxVisible) return pages.join(', ');
  const head = pages.slice(0, maxVisible).join(', ');
  return `${head} ... (+${pages.length - maxVisible})`;
}

export function selectionSummary(pages, totalPages) {
  if (!Array.isArray(pages) || !pages.length) return 'Nenhuma página selecionada.';
  if (pages.length === totalPages) return `Todas as ${totalPages} páginas serão processadas.`;
  return `${pages.length} de ${totalPages} página(s) serão processadas: ${formatPageList(pages)}.`;
}
