import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildStandaloneHtml } from '../scripts/build-standalone.mjs';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'conversor-standalone-'));

try {
  await fs.mkdir(path.join(tempRoot, 'assets', 'css'), { recursive: true });
  await fs.writeFile(path.join(tempRoot, 'assets', 'css', 'app.css'), '.app { color: red; }\n', 'utf8');

  const html = await buildStandaloneHtml(
    tempRoot,
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '  <meta charset="utf-8" />',
      '  <link rel="stylesheet" href="assets/css/app.css?v=test" />',
      '</head>',
      '<body>',
      '  <div id="statusText"></div>',
      '  <script type="module" src="assets/js/main.js?v=test"></script>',
      '</body>',
      '</html>',
    ].join('\n'),
    {
      'assets/js/main.js': "console.log('main');",
    },
  );

  assert.match(html, /<style data-source="assets\/css\/app\.css\?v=test">/);
  assert.match(html, /\.app \{ color: red; \}/);
  assert.doesNotMatch(html, /<link\s+rel="stylesheet"/);
  assert.doesNotMatch(html, /<script\s+type="module"\s+src=/);
  assert.match(html, /window\.__standaloneImport/);
  assert.match(html, /assets\/js\/main\.js/);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}

console.log('buildStandalone.test.mjs OK');
