const HTTPS = 'https:' + '//';

const LOCAL = Object.freeze({
  pdf: new URL('./pdf.min.js', import.meta.url).href,
  pdfWorker: new URL('./pdf.worker.min.js', import.meta.url).href,
  excel: new URL('./exceljs.min.js', import.meta.url).href,
  zip: new URL('./zip-full.min.js', import.meta.url).href,
  xlsx: new URL('./xlsx.full.min.js', import.meta.url).href,
});

const CDN = Object.freeze({
  pdf: HTTPS + 'cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: HTTPS + 'cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  excel: HTTPS + 'cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  zip: HTTPS + 'cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/dist/zip-full.min.js',
  xlsx: HTTPS + 'cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js',
});

const loadedScripts = new Map();

export async function ensurePdfJsRuntime() {
  const result = await loadWithFallback({
    name: 'pdf.js',
    localSrc: LOCAL.pdf,
    remoteSrc: CDN.pdf,
    isReady: () => Boolean(window.pdfjsLib),
  });

  const workerSrc = await chooseWorkerSrc(result.source);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  return {
    library: 'pdf.js',
    source: result.source,
    workerSrc,
  };
}

export async function ensureExcelJsRuntime() {
  return loadWithFallback({
    name: 'ExcelJS',
    localSrc: LOCAL.excel,
    remoteSrc: CDN.excel,
    isReady: () => Boolean(window.ExcelJS),
  });
}

export async function ensureZipJsRuntime() {
  return loadWithFallback({
    name: 'zip.js',
    localSrc: LOCAL.zip,
    remoteSrc: CDN.zip,
    isReady: () => Boolean(window.zip),
  });
}

export async function ensureSheetJsRuntime() {
  return loadWithFallback({
    name: 'SheetJS',
    localSrc: LOCAL.xlsx,
    remoteSrc: CDN.xlsx,
    isReady: () => Boolean(window.XLSX),
  });
}

export async function checkRuntimeLibraries() {
  const results = [];
  results.push(await ensurePdfJsRuntime());
  results.push(await ensureExcelJsRuntime());
  results.push(await ensureZipJsRuntime());
  results.push(await ensureSheetJsRuntime());
  return results;
}

async function loadWithFallback({ name, localSrc, remoteSrc, isReady }) {
  if (isReady()) return { library: name, source: 'already-loaded' };

  const hasLocalCopy = shouldTryLocalAssets() && await urlExists(localSrc);
  if (hasLocalCopy) {
    try {
      await loadScript(localSrc, `${name}:local`);
      if (isReady()) return { library: name, source: 'local' };
    } catch (localError) {
      console.warn(`${name} local nao carregou. Tentando CDN.`, localError);
    }
  }

  try {
    await loadScript(remoteSrc, `${name}:cdn`);
    if (isReady()) return { library: name, source: 'cdn' };
  } catch (remoteError) {
    console.error(`${name} nao carregou pela CDN.`, remoteError);
  }

  throw new Error(`Nao foi possivel carregar ${name}. Execute BAIXAR_BIBLIOTECAS_WINDOWS.bat ou verifique sua conexao.`);
}

function loadScript(src, key) {
  if (loadedScripts.has(key)) return loadedScripts.get(key);

  const existing = document.querySelector(`script[data-vendor-key="${cssEscape(key)}"]`);
  if (existing?.dataset.loaded === 'true') return Promise.resolve();

  const promise = new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.src = src;
    script.async = false;
    script.defer = false;
    script.dataset.vendorKey = key;

    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });

    script.addEventListener('error', () => {
      reject(new Error(`Falha ao carregar script: ${src}`));
    }, { once: true });

    if (!existing) document.head.appendChild(script);
  });

  loadedScripts.set(key, promise);
  return promise;
}

async function chooseWorkerSrc(source) {
  if (source === 'local' || source === 'already-loaded') {
    const localWorkerAvailable = await urlExists(LOCAL.pdfWorker);
    if (localWorkerAvailable) return LOCAL.pdfWorker;
  }
  return CDN.pdfWorker;
}

async function urlExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function shouldTryLocalAssets() {
  return window.location.protocol === 'file:';
}
