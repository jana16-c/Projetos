export function parsePageSpec(spec, totalPages) {
  const normalized = String(spec || '').trim();
  if (!normalized) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set();
  const parts = normalized.split(',').map(part => part.trim()).filter(Boolean);

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^\d+$/);

    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);

      if (start > end) {
        throw new Error(`Intervalo invertido na selecao de paginas: "${part}"`);
      }

      for (let page = start; page <= end; page++) addPage(page, totalPages, pages);
      continue;
    }

    if (single) {
      addPage(Number(part), totalPages, pages);
      continue;
    }

    throw new Error(`Trecho invalido na selecao de paginas: "${part}"`);
  }

  const result = Array.from(pages).sort((left, right) => left - right);
  if (!result.length) throw new Error('Nenhuma pagina valida foi selecionada.');
  return result;
}

function addPage(page, totalPages, pages) {
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    throw new Error(`Pagina ${page} fora do intervalo do PDF, que possui ${totalPages} pagina(s).`);
  }
  pages.add(page);
}
