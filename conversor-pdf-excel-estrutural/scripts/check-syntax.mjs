import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('..', import.meta.url));

const files = walk(rootPath)
  .filter(file => /\.(js|mjs)$/i.test(file))
  .filter(file => !/assets[\\/]+js[\\/]+vendor[\\/].+\.min\.js$/i.test(file));

const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push({ file, stderr: result.stderr.trim() || result.stdout.trim() });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`[syntax] ${relative(rootPath, failure.file)}\n${failure.stderr}\n`);
  }
  process.exit(1);
}

console.log(`check-syntax OK (${files.length} arquivos)`);

function walk(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === '.git' || entry === 'node_modules' || entry === 'temp') continue;
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
