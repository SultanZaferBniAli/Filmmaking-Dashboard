import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const REAL_IMPORT_DATA = path.resolve(BACKEND_ROOT, '..', 'import-data');
const SAMPLE_WORKSHOP_DIR = path.join(__dirname, 'sample-workshop');

export const SAMPLE_WORKSHOP_ID = 'WS-101';

async function removeLockArtifacts(dir: string): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeLockArtifacts(full);
    } else if (entry.name.startsWith('~$')) {
      await fs.promises.unlink(full);
    }
  }
}

// Copies real import-data/trainers/ (single shared file, low-risk/unchanged by this test suite)
// plus the checked-in synthetic sample-workshop/ fixture (workshops/participants/feedback, in
// the flat master-workbook layout) into a fresh OS temp directory, so tests never touch real
// data and don't depend on the user having populated real workshop/participant/feedback data.
export async function createFixtureDataDir(): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fwd-backend-test-'));

  await fs.promises.cp(SAMPLE_WORKSHOP_DIR, dir, { recursive: true });
  await fs.promises.cp(path.join(REAL_IMPORT_DATA, 'trainers'), path.join(dir, 'trainers'), { recursive: true });
  await removeLockArtifacts(dir);

  return dir;
}

export async function removeFixtureDataDir(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}
