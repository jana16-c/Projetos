import { matrixToCsv } from './csvBuilder.js?v=2026-06-30-livepreview-3';
import { buildWorkbook, buildExcelFilename } from './workbookBuilder.js?v=2026-06-30-livepreview-3';
import { buildXlsmFilename, buildXlsmFromTemplate } from './xlsmTemplateBuilder.js?v=2026-06-30-livepreview-3';
import { safeFileStem } from '../utils/download.js?v=2026-06-30-livepreview-3';
import { ensureZipJsRuntime } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-3';
import { collectWarnings } from '../model/resultModel.js?v=2026-06-30-livepreview-3';
import { buildRenderableTable } from './tableLayout.js?v=2026-06-30-livepreview-3';

export async function buildZipPackage(documentResult, templateFile = null, options = {}) {
  await ensureZipJsRuntime();

  const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
  const stem = safeFileStem(documentResult.sourceFileName);
  const xlsx = await buildWorkbook(documentResult, options);

  await writer.add(`${buildExcelFilename(documentResult.sourceFileName)}`, new zip.BlobReader(xlsx));

  for (const table of documentResult.tables) {
    const csv = matrixToCsv(buildRenderableTable(table).matrix);
    await writer.add(`tabelas/pagina_${String(table.pageNumber).padStart(3, '0')}_tabela_${table.tableIndex}.csv`, new zip.TextReader(csv));
  }

  await writer.add('diagnostico/resultado.json', new zip.TextReader(JSON.stringify(documentResult, null, 2)));
  await writer.add('diagnostico/configuracoes.json', new zip.TextReader(JSON.stringify(documentResult.settings, null, 2)));
  await writer.add('diagnostico/alteracoes_manuais.json', new zip.TextReader(JSON.stringify(documentResult.manualChanges, null, 2)));
  await writer.add('diagnostico/avisos.txt', new zip.TextReader(collectWarnings(documentResult).join('\n')));

  if (options.includeXlsmInZip && templateFile) {
    const xlsm = await buildXlsmFromTemplate({
      templateFile,
      documentResult,
      options,
    });
    await writer.add(`${buildXlsmFilename(documentResult.sourceFileName)}`, new zip.BlobReader(xlsm));
  }

  return writer.close();
}

export function buildZipFilename(pdfName) {
  return `${safeFileStem(pdfName)}.zip`;
}
