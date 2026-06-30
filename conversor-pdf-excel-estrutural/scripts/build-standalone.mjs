import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_VENDOR_FILES = Object.freeze({
  pdf: 'pdf.min.js',
  pdfWorker: 'pdf.worker.min.js',
  excel: 'exceljs.min.js',
  zip: 'zip-full.min.js',
  xlsx: 'xlsx.full.min.js',
});

const OPTIONAL_VENDOR_FILES = Object.freeze({
  tesseract: 'tesseract.min.js',
});

const SCRIPT_SRC_RE = /<script\s+type="module"\s+src="([^"]+)"\s*><\/script>/i;
const STYLESHEET_RE = /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/gi;
const VERSION_QUERY_RE = /\?v=[^'"`)\s]+/g;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildStandalone({
  rootDir = path.resolve(__dirname, '..'),
  outputFile = path.resolve(rootDir, 'dist', 'processador-tabelas.html'),
} = {}) {
  const projectRoot = path.resolve(rootDir);
  const indexPath = path.join(projectRoot, 'index.html');
  const indexHtml = await fs.readFile(indexPath, 'utf8');
  const vendorAssets = await readVendorAssets(projectRoot);
  const moduleSources = await readModuleSources(projectRoot, vendorAssets);
  const standaloneHtml = await buildStandaloneHtml(projectRoot, indexHtml, moduleSources);

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, standaloneHtml, 'utf8');
  return outputFile;
}

export async function buildStandaloneHtml(projectRoot, indexHtml, moduleSources) {
  const styleHrefs = [...indexHtml.matchAll(STYLESHEET_RE)].map(match => match[1]);
  const inlineStyles = await Promise.all(styleHrefs.map(async href => {
    const stylePath = path.join(projectRoot, stripQuery(href));
    const content = await fs.readFile(stylePath, 'utf8');
    return `<style data-source="${href}">\n${escapeInlineStyle(content)}\n</style>`;
  }));

  const scriptMatch = indexHtml.match(SCRIPT_SRC_RE);
  if (!scriptMatch) {
    throw new Error('Nao foi possivel localizar o entrypoint modular em index.html.');
  }

  const entryModuleId = normalizeSlashes(stripQuery(scriptMatch[1]));
  let html = indexHtml.replace(STYLESHEET_RE, '').replace(SCRIPT_SRC_RE, '');
  html = html.replace('</head>', `${inlineStyles.join('\n')}\n</head>`);
  html = html.replace('</body>', `${buildRuntimeScript(moduleSources, entryModuleId)}\n</body>`);
  return html;
}

async function readVendorAssets(projectRoot) {
  const vendorDir = path.join(projectRoot, 'assets', 'js', 'vendor');
  const assets = {};

  for (const [key, fileName] of Object.entries(REQUIRED_VENDOR_FILES)) {
    const filePath = path.join(vendorDir, fileName);
    try {
      const content = await fs.readFile(filePath);
      assets[key] = toDataUrl(content);
    } catch {
      throw new Error(`Build standalone requer assets/js/vendor/${fileName}. Execute BAIXAR_BIBLIOTECAS_WINDOWS.bat antes de npm run build.`);
    }
  }

  for (const [key, fileName] of Object.entries(OPTIONAL_VENDOR_FILES)) {
    const filePath = path.join(vendorDir, fileName);
    try {
      const content = await fs.readFile(filePath);
      assets[key] = toDataUrl(content);
    } catch {
      assets[key] = '';
    }
  }

  return assets;
}

async function readModuleSources(projectRoot, vendorAssets) {
  const jsRoot = path.join(projectRoot, 'assets', 'js');
  const moduleFiles = await collectFiles(jsRoot);
  const modules = {};

  for (const filePath of moduleFiles.sort()) {
    const moduleId = normalizeSlashes(path.relative(projectRoot, filePath));
    let source = await fs.readFile(filePath, 'utf8');
    if (source.charCodeAt(0) === 0xFEFF) source = source.slice(1);
    source = source.replace(/\r\n/g, '\n');
    source = transformModuleSource(moduleId, source, vendorAssets);
    modules[moduleId] = source;
  }

  return modules;
}

function transformModuleSource(moduleId, source, vendorAssets) {
  if (moduleId === 'assets/js/main.js') {
    source = source.replace(
      /const version =[\s\S]*?new AppController\(\);/,
      `const { AppController } = await import(window.__standaloneImport('assets/js/ui/appController.js'));\n    new AppController();`,
    );
  }

  if (moduleId === 'assets/js/processing/browserProcessor.js') {
    source = source.replace(
      "new Worker(new URL('./processingWorker.js', import.meta.url), { type: 'module' })",
      "new Worker(window.__standaloneImport('assets/js/processing/processingWorker.js'), { type: 'module' })",
    );
  }

  if (moduleId === 'assets/js/vendor/vendorLoader.js') {
    source = source.replace(
      /const LOCAL = Object\.freeze\(\{[\s\S]*?\}\);/,
      [
        'const LOCAL = Object.freeze({',
        `  pdf: ${JSON.stringify(vendorAssets.pdf)},`,
        `  pdfWorker: ${JSON.stringify(vendorAssets.pdfWorker)},`,
        `  excel: ${JSON.stringify(vendorAssets.excel)},`,
        `  zip: ${JSON.stringify(vendorAssets.zip)},`,
        `  xlsx: ${JSON.stringify(vendorAssets.xlsx)},`,
        `  tesseract: ${JSON.stringify(vendorAssets.tesseract || '')},`,
        '});',
      ].join('\n'),
    );
    source = source.replace(
      /async function urlExists\(url\) \{[\s\S]*?\n\}/,
      [
        'async function urlExists(url) {',
        "  if (!url) return false;",
        "  if (String(url).startsWith('data:')) return true;",
        '  try {',
        "    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });",
        '    return response.ok;',
        '  } catch {',
        '    return false;',
        '  }',
        '}',
      ].join('\n'),
    );
  }

  return source;
}

function buildRuntimeScript(moduleSources, entryModuleId) {
  const payload = JSON.stringify(moduleSources);
  return [
    '<script>',
    `(function () {`,
    `  const moduleSources = ${payload};`,
    '  const moduleUrls = Object.create(null);',
    '  window.__standaloneModuleUrls__ = moduleUrls;',
    '  window.__standaloneImport = function standaloneImport(id) {',
    '    return buildModuleUrl(normalizeModuleId(id));',
    '  };',
    '  function normalizeModuleId(id) {',
    "    return String(id || '').replace(/\\\\/g, '/').replace(/^\\.\\//, '').replace(/^\\/+/, '');",
    '  }',
    '  function resolveModuleId(fromId, specifier) {',
    "    const cleanSpecifier = String(specifier || '').replace(/\\?[^#]+$/, '');",
    "    if (!cleanSpecifier.startsWith('.')) return normalizeModuleId(cleanSpecifier);",
    "    const parts = normalizeModuleId(fromId).split('/');",
    '    parts.pop();',
    "    for (const part of cleanSpecifier.split('/')) {",
    "      if (!part || part === '.') continue;",
    "      if (part === '..') parts.pop(); else parts.push(part);",
    '    }',
    "    return parts.join('/');",
    '  }',
    '  function rewriteModuleSource(moduleId, source) {',
    "    return source.replace(/(['\"])(\\.{1,2}\\/[^'\"`]+?\\.js(?:\\?[^'\"`]+)?)\\1/g, function (_, quote, specifier) {",
    '      const dependencyId = resolveModuleId(moduleId, specifier);',
    '      return quote + buildModuleUrl(dependencyId) + quote;',
    '    });',
    '  }',
    '  function buildModuleUrl(moduleId) {',
    '    if (moduleUrls[moduleId]) return moduleUrls[moduleId];',
    '    const originalSource = moduleSources[moduleId];',
    "    if (!originalSource) throw new Error('Modulo nao encontrado no build standalone: ' + moduleId);",
    '    const rewrittenSource = rewriteModuleSource(moduleId, originalSource);',
    "    const url = URL.createObjectURL(new Blob([rewrittenSource], { type: 'text/javascript' }));",
    '    moduleUrls[moduleId] = url;',
    '    return url;',
    '  }',
    "  window.addEventListener('beforeunload', function () {",
    '    for (const url of Object.values(moduleUrls)) URL.revokeObjectURL(url);',
    '  });',
    `  import(buildModuleUrl(${JSON.stringify(entryModuleId)})).catch(function (error) {`,
    "    console.error(error);",
    "    const status = document.querySelector('#statusText');",
    "    if (status) status.textContent = 'Erro ao iniciar app standalone: ' + (error && error.message ? error.message : error);",
    '  });',
    '})();',
    '</script>',
  ].join('\n');
}

async function collectFiles(dirPath) {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
    const fullPath = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }
    if (dirent.isFile() && dirent.name.endsWith('.js')) files.push(fullPath);
  }

  return files;
}

function stripQuery(value) {
  return String(value || '').replace(/\?.*$/, '');
}

function normalizeSlashes(value) {
  return String(value || '').replace(/\\/g, '/');
}

function toDataUrl(buffer) {
  return `data:text/javascript;base64,${buffer.toString('base64')}`;
}

function escapeInlineStyle(content) {
  return String(content).replace(/<\/style/gi, '<\\/style');
}

if (process.argv[1] === __filename) {
  buildStandalone()
    .then(outputFile => {
      console.log(`build-standalone OK: ${outputFile}`);
    })
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
