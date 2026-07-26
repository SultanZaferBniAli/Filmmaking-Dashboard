import * as fs from 'node:fs';
import * as path from 'node:path';
import { BACKUPS_DIR, MAX_UPLOAD_BYTES, MAX_BACKUPS_PER_ENTITY } from './config.js';
import { ApiError } from './errors.js';

// Mirrors store.ts's backup-first, atomic-write conventions (BACKUPS_DIR, MAX_BACKUPS_PER_ENTITY
// pruning, temp-file + rename) for plain image files, which don't need the xlsx row/sheet
// machinery store.ts carries.

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function validateImageUpload(filename: string, byteLength: number): string {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new ApiError(422, 'UNSUPPORTED_FILE_TYPE', `Unsupported image type "${ext}" — must be one of: ${[...ALLOWED_IMAGE_EXTENSIONS].join(', ')}`);
  }
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(422, 'FILE_TOO_LARGE', `Image exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`);
  }
  return ext;
}

const IMAGE_BACKUPS_DIR = path.join(BACKUPS_DIR, 'images');

async function pruneImageBackups(prefix: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(IMAGE_BACKUPS_DIR);
  } catch {
    return;
  }
  const matching = entries.filter((f) => f.startsWith(`${prefix}.`)).sort();
  const excess = matching.length - MAX_BACKUPS_PER_ENTITY;
  if (excess <= 0) return;
  await Promise.all(matching.slice(0, excess).map((f) => fs.promises.unlink(path.join(IMAGE_BACKUPS_DIR, f))));
}

async function backupImageFileIfExists(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return;
  await fs.promises.mkdir(IMAGE_BACKUPS_DIR, { recursive: true });
  const basename = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.promises.copyFile(filePath, path.join(IMAGE_BACKUPS_DIR, `${basename}.${stamp}`));
  await pruneImageBackups(basename);
}

// Atomically writes an image file, backing up whatever was previously at that exact path first.
export async function writeImageFile(filePath: string, buffer: Buffer): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await backupImageFileIfExists(filePath);
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, buffer);
  await fs.promises.rename(tmpPath, filePath);
}

export async function removeImageFile(filePath: string): Promise<void> {
  await backupImageFileIfExists(filePath);
  await fs.promises.unlink(filePath).catch(() => {});
}
