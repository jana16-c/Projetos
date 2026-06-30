import { ensureTesseractRuntime } from '../vendor/vendorLoader.js?v=2026-06-30-livepreview-6';

export async function createOcrWorkerPool(options = {}) {
  const languages = String(options.languages || 'por+eng');
  const runtime = await ensureTesseractRuntime();
  if (!window.Tesseract || runtime.source === 'unavailable') {
    return createDirectRecognizer({ languages, available: false });
  }

  if (typeof window.Tesseract.createWorker !== 'function') {
    return createDirectRecognizer({ languages, available: true });
  }

  let workerPromise = null;
  let queue = Promise.resolve();
  let initFailed = false;

  return {
    async recognize(image) {
      if (!image) {
        return { ok: false, data: null, mode: 'worker', warnings: ['Imagem OCR ausente.'] };
      }

      if (initFailed) {
        return directRecognize(image, languages, true);
      }

      queue = queue.then(async () => {
        try {
          const worker = await getWorker();
          const data = await worker.recognize(image);
          return { ok: true, data, mode: 'worker', warnings: [] };
        } catch (error) {
          initFailed = true;
          return directRecognize(image, languages, true, error);
        }
      });

      return queue;
    },
    async close() {
      if (!workerPromise) return;
      try {
        const worker = await workerPromise;
        await worker.terminate();
      } catch {
        // Fallback silencioso: o pool nao deve quebrar o fechamento do documento.
      } finally {
        workerPromise = null;
      }
    },
  };

  async function getWorker() {
    if (!workerPromise) {
      workerPromise = window.Tesseract.createWorker(languages);
    }
    return workerPromise;
  }
}

function createDirectRecognizer({ languages, available }) {
  return {
    async recognize(image) {
      if (!available) {
        return { ok: false, data: null, mode: 'unavailable', warnings: ['OCR opcional indisponivel neste ambiente.'] };
      }
      return directRecognize(image, languages, false);
    },
    async close() {},
  };
}

async function directRecognize(image, languages, workerFallback, error = null) {
  try {
    const data = await window.Tesseract.recognize(image, languages);
    return {
      ok: true,
      data,
      mode: workerFallback ? 'direct-fallback' : 'direct',
      warnings: workerFallback && error ? [`Pool OCR indisponivel: ${error.message}`] : [],
    };
  } catch (recognizeError) {
    return {
      ok: false,
      data: null,
      mode: workerFallback ? 'direct-fallback' : 'direct',
      warnings: [workerFallback && error ? `Pool OCR indisponivel: ${error.message}` : `OCR falhou: ${recognizeError.message}`],
    };
  }
}
