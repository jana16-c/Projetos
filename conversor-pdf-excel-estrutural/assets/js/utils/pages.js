export function parsePageSpec(spec, totalPages) {
  const normalized = String(spec || '').trim();
  if (!normalized) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set();
  const parts = normalized.split(',').map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^\d+$/);

    if (range) {
      let start = Number(range[1]);
      let end = Number(range[2]);
      if (start > end) [start, end] = [end, start];
      for (let p = start; p <= end; p++) addPage(p, totalPages, pages);
      continue;
    }

    if (single) {
      addPage(Number(part), totalPages, pages);
      continue;
    }

    throw new Error(`Trecho inválido na seleção de páginas: "${part}"`);
  }

  const result = Array.from(pages).sort((a, b) => a - b);
  if (!result.length) throw new Error('Nenhuma página válida foi selecionada.');
  return result;
}

function addPage(page, totalPages, pages) {
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    throw new Error(`Página ${page} fora do intervalo do PDF, que possui ${totalPages} página(s).`);
  }
  pages.add(page);
}
