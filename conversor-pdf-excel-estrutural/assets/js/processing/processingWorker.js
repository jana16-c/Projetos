import { extractDocumentTables } from '../extraction/tableExtractor.js';

self.addEventListener('message', event => {
  const { requestId, payload } = event.data || {};

  try {
    const documentResult = extractDocumentTables(payload);
    self.postMessage({ requestId, ok: true, documentResult });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: {
        message: error?.message || 'Falha no processamento local.',
        stack: error?.stack || '',
      },
    });
  }
});
