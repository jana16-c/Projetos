import { matrixToCsv } from './csvBuilder.js';
import { buildWorkbook, buildExcelFilename } from './workbookBuilder.js';
import { safeFileStem } from '../utils/download.js';
import { ensureZipJsRuntime } from '../vendor/vendorLoader.js';

export async function buildZipPackage(results, options, pdfFileName) {
  await ensureZipJsRuntime();

  const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
  const stem = safeFileStem(pdfFileName);
  const xlsx = await buildWorkbook(results, options);

  await writer.add(`${stem}/${buildExcelFilename(pdfFileName)}`, new zip.BlobReader(xlsx));

  for (const result of results) {
    const csv = matrixToCsv(result.matrix);
    await writer.add(`${stem}/csv/pagina_${String(result.pageNumber).padStart(3, '0')}.csv`, new zip.TextReader(csv));
  }

  await writer.add(`${stem}/diagnostico/extracao.json`, new zip.TextReader(JSON.stringify({
    source: pdfFileName,
    generatedAt: new Date().toISOString(),
    pages: results.map(r => r.diagnostics),
    technical: results.map(r => ({
      pageNumber: r.pageNumber,
      columnAnchors: r.columnModel.anchors,
      stats: r.stats,
    })),
  }, null, 2)));

  await writer.add(`${stem}/LEIA-ME.txt`, new zip.TextReader([
    'Conversor PDF Excel Estrutural',
    '',
    'Conteudo do pacote:',
    '- Excel convertido em .xlsx',
    '- CSV separado por pagina',
    '- JSON tecnico com diagnostico da extracao',
    '',
    'Observacao: PDFs escaneados/imagem precisam de OCR.',
  ].join('\n')));

  return writer.close();
}

export function buildZipFilename(pdfName) {
  return `${safeFileStem(pdfName)}_pacote_convertido.zip`;
}
