import { mkdir, rm } from 'node:fs/promises';

export async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

export async function removeDirectory(directoryPath) {
  if (!directoryPath) return;
  await rm(directoryPath, { recursive: true, force: true });
}
