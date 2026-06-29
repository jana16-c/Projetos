import { buildWorkbook, buildExcelFilename } from './workbookBuilder.js';
import { buildXlsmFromTemplate, buildXlsmFilename } from './xlsmTemplateBuilder.js';
import { buildZipPackage, buildZipFilename } from './zipBuilder.js';

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
