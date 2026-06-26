import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { buildServer } from '../backend/src/server.js';

const tempRoot = fileURLToPath(new URL('./tmp-backend-jobs', import.meta.url));
await rm(tempRoot, { recursive: true, force: true });

const app = await buildServer({
  serveFrontend: false,
  tempRoot,
});

await app.ready();

const pdfBuffer = buildPdfBuffer([
  { text: 'COMPETENCIA', x: 40, y: 160 },
  { text: 'VALOR', x: 180, y: 160 },
  { text: '01/2024', x: 40, y: 140 },
  { text: '150,00', x: 180, y: 140 },
]);

const createResponse = await app.inject({
  method: 'POST',
  url: '/api/jobs',
  payload: {
    pdfBase64: pdfBuffer.toString('base64'),
    fileName: 'amostra.pdf',
    pageSpec: '1',
    settings: {
      mode: 'automatic',
      mergeContinuation: true,
      hideRepeatedLines: true,
    },
  },
});

assert.equal(createResponse.statusCode, 202);
const createdJob = createResponse.json();
assert.equal(createdJob.status === 'queued' || createdJob.status === 'validating', true);

const completedJob = await waitForCompletion(app, createdJob.jobId);
assert.equal(completedJob.status, 'completed');
assert.equal(completedJob.totalPages, 1);
assert.ok(completedJob.tables >= 1);

const tableIrResponse = await app.inject({
  method: 'GET',
  url: `/api/jobs/${createdJob.jobId}/table-ir`,
});
assert.equal(tableIrResponse.statusCode, 200);
const tableIr = tableIrResponse.json();
assert.equal(tableIr.version, '3.0');
assert.equal(tableIr.tables.length >= 1, true);

const documentResultResponse = await app.inject({
  method: 'GET',
  url: `/api/jobs/${createdJob.jobId}/document-result`,
});
assert.equal(documentResultResponse.statusCode, 200);
const documentResult = documentResultResponse.json();
assert.equal(documentResult.version, '3.0');
assert.equal(Array.isArray(documentResult.sourceItems), true);
assert.equal(Array.isArray(documentResult.pages), true);

const exportResponse = await app.inject({
  method: 'POST',
  url: `/api/jobs/${createdJob.jobId}/export`,
  payload: { format: 'table-ir' },
});
assert.equal(exportResponse.statusCode, 200);
assert.equal(exportResponse.json().fileName, 'amostra.table-ir.json');

const resultResponse = await app.inject({
  method: 'GET',
  url: `/api/jobs/${createdJob.jobId}/result`,
});
assert.equal(resultResponse.statusCode, 200);
assert.match(resultResponse.headers['content-disposition'], /amostra\.table-ir\.json/i);

const deleteResponse = await app.inject({
  method: 'DELETE',
  url: `/api/jobs/${createdJob.jobId}`,
});
assert.equal(deleteResponse.statusCode, 200);
assert.equal(deleteResponse.json().status, 'deleted');

await app.close();
await rm(tempRoot, { recursive: true, force: true });

console.log('backendJobs.test.mjs OK');

async function waitForCompletion(app, jobId) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/jobs/${jobId}`,
    });
    assert.equal(response.statusCode, 200);
    const job = response.json();

    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(`Job falhou: ${job.error || job.message}`);
    }

    await delay(100);
  }

  throw new Error('Tempo esgotado aguardando conclusao do job.');
}

function buildPdfBuffer(items) {
  const content = [
    'BT',
    '/F1 12 Tf',
    ...items.map(item => `1 0 0 1 ${item.x} ${item.y} Tm (${escapePdfText(item.text)}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index++) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, 'utf8');
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
