import { buildWorkbook, buildExcelFilename } from './workbookBuilder.js?v=2026-06-30-livepreview-4';
import { buildXlsmFromTemplate, buildXlsmFilename } from './xlsmTemplateBuilder.js?v=2026-06-30-livepreview-4';
import { buildZipPackage, buildZipFilename } from './zipBuilder.js?v=2026-06-30-livepreview-4';

export async function buildXlsxExport(documentResult, options = {}) {
  return {
    filename: buildExcelFilename(documentResult.sourceFileName),
    blob: await buildWorkbook(documentResult, options),
  };
}

export async function buildXlsmExport(documentResult, templateFile, options = {}) {
  return {
    filename: buildXlsmFilename(documentResult.sourceFileName),
    blob: await buildXlsmFromTemplate({
      templateFile,
      documentResult,
      options,
    }),
  };
}

export async function buildZipExport(documentResult, templateFile = null, options = {}) {
  return {
    filename: buildZipFilename(documentResult.sourceFileName),
    blob: await buildZipPackage(documentResult, templateFile, options),
  };
}
