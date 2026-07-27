import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { DATA_DIR, BACKUPS_DIR, MAX_BACKUPS_PER_ENTITY } from './config.js';
import type { EntityDescriptor, Row } from './entities/types.js';
import { broadcastChange } from './sse.js';

const SHEET_NAME = 'البيانات';
const GUIDE_SHEET_NAME = 'دليل الأعمدة';

export class FileLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileLockedError';
  }
}

export class AmbiguousPrimaryFileError extends Error {
  constructor(dir: string, candidates: string[]) {
    super(`Multiple candidate workbooks found in "${dir}" (${candidates.join(', ')}) — remove or rename the extras so exactly one remains.`);
    this.name = 'AmbiguousPrimaryFileError';
  }
}

// Finds the one real workbook in `dir` (excluding Excel's "~$" lock-file marker and the
// "*_with_N_dummy_records.xlsx" import-test fixtures). Returns undefined if none exist yet
// (soft — the caller decides whether that means "empty" or "not set up yet"). Throws loudly if
// more than one candidate exists, rather than silently picking one alphabetically.
export function resolvePrimaryFile(dir: string): string | undefined {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return undefined;
  }
  const candidates = entries
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$') && !/_with_\d+_dummy_records/i.test(f))
    .sort();
  if (candidates.length === 0) return undefined;
  if (candidates.length > 1) throw new AmbiguousPrimaryFileError(dir, candidates);
  return path.join(dir, candidates[0]);
}

type CacheEntry = { rows: Row[]; mtimeMs: number };
// Keyed by absolute file path — one entry per entity's master workbook.
const cache = new Map<string, CacheEntry>();

type PendingWrite = { entity: EntityDescriptor; rows: Row[]; queuedAt: string };
const pendingWrites = new Map<string, PendingWrite>();

// Every read AND write for a given file is chained through the same per-file queue, so a read
// never interleaves with an in-flight write and concurrent writes never race.
const fileQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = fileQueues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  fileQueues.set(
    file,
    next.then(
      () => {},
      () => {},
    ),
  );
  return next;
}

function buildWorkbook(entity: EntityDescriptor, rows: Row[], originalWorkbook: XLSX.WorkBook): XLSX.WorkBook {
  const columns = [...entity.columns, 'deleted_at'];
  const aoa: unknown[][] = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? null))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  if (originalWorkbook.Sheets[GUIDE_SHEET_NAME]) {
    XLSX.utils.book_append_sheet(workbook, originalWorkbook.Sheets[GUIDE_SHEET_NAME], GUIDE_SHEET_NAME);
  }
  return workbook;
}

// Resolves an entity's one master workbook. If none exists yet (fresh install, or a brand-new
// master file), bootstraps one with just the header row so every read/write path always has
// exactly one file to resolve — no separate manual setup step required.
export async function fullPath(entity: EntityDescriptor): Promise<string> {
  const folderPath = path.join(DATA_DIR, entity.folder);
  const existing = resolvePrimaryFile(folderPath);
  if (existing) return existing;

  await fs.promises.mkdir(folderPath, { recursive: true });
  const file = path.join(folderPath, `${entity.folder}.xlsx`);
  const workbook = buildWorkbook(entity, [], XLSX.utils.book_new());
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  await fs.promises.writeFile(file, buffer);
  return file;
}

function lockFilePath(filePath: string): string {
  return path.join(path.dirname(filePath), `~$${path.basename(filePath)}`);
}

function isLocked(filePath: string): boolean {
  return fs.existsSync(lockFilePath(filePath));
}

async function readRowsUncachedFromFile(entity: EntityDescriptor, file: string): Promise<{ rows: Row[]; mtimeMs: number }> {
  const stat = await fs.promises.stat(file);
  const buffer = await fs.promises.readFile(file);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${file}`);
  const rawRows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  // Normalize on read, not just on write — otherwise any row never touched by a PATCH/import
  // since the backend started still serves raw, un-normalized Excel values (Arabic enum
  // labels, blank level/capacity as "" instead of the documented defaults, etc). mapRow() is
  // already idempotent (safe to re-run on already-normalized data), so this is safe to do
  // unconditionally on every read.
  const rows = rawRows.map((raw) => entity.mapRow(raw).row);
  return { rows, mtimeMs: stat.mtimeMs };
}

async function readOneFile(entity: EntityDescriptor, file: string): Promise<Row[]> {
  return enqueue(file, async () => {
    const stat = await fs.promises.stat(file);
    const cached = cache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.rows;
    const { rows, mtimeMs } = await readRowsUncachedFromFile(entity, file);
    cache.set(file, { rows, mtimeMs });
    return rows;
  });
}

export async function readRows(entity: EntityDescriptor): Promise<Row[]> {
  const file = await fullPath(entity);
  return readOneFile(entity, file);
}

// Keeps at most MAX_BACKUPS_PER_ENTITY snapshots per entity — backup filenames are
// timestamp-suffixed so a plain lexicographic sort is also chronological order; deletes the
// oldest beyond the cap. Without this, every write (e.g. every attendance save) leaves behind
// another snapshot forever.
async function pruneBackups(dir: string): Promise<void> {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const entries = dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
  const excess = entries.length - MAX_BACKUPS_PER_ENTITY;
  if (excess <= 0) return;
  await Promise.all(entries.slice(0, excess).map((f) => fs.promises.unlink(path.join(dir, f))));
}

function backupDir(entity: EntityDescriptor): string {
  return path.join(BACKUPS_DIR, entity.name);
}

async function backupFile(entity: EntityDescriptor, filePath: string): Promise<void> {
  const dir = backupDir(entity);
  await fs.promises.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `${path.basename(filePath)}.${stamp}.xlsx`);
  await fs.promises.copyFile(filePath, dest);
  await pruneBackups(dir);
}

async function performWrite(entity: EntityDescriptor, file: string, rows: Row[]): Promise<void> {
  if (isLocked(file)) {
    throw new FileLockedError(`"${file}" is currently open in Excel — close it and retry.`);
  }

  let originalWorkbook: XLSX.WorkBook;
  if (fs.existsSync(file)) {
    const originalBuffer = await fs.promises.readFile(file);
    originalWorkbook = XLSX.read(originalBuffer, { type: 'buffer' });
    await backupFile(entity, file);
  } else {
    // Bootstrap: first row ever written for this entity's file — nothing to back up or carry a
    // "دليل الأعمدة" guide sheet forward from.
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    originalWorkbook = XLSX.utils.book_new();
  }

  const workbook = buildWorkbook(entity, rows, originalWorkbook);
  const tmpPath = `${file}.tmp`;
  const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  try {
    await fs.promises.writeFile(tmpPath, outBuffer);
    await fs.promises.rename(tmpPath, file);
  } catch (err) {
    await fs.promises.unlink(tmpPath).catch(() => {});
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EBUSY') {
      throw new FileLockedError(`"${file}" could not be written (file busy) — close it and retry.`);
    }
    throw err;
  }

  const stat = await fs.promises.stat(file);
  cache.set(file, { rows, mtimeMs: stat.mtimeMs });
}

// A file is dirty if it wasn't cached before (never read, or a brand-new bootstrap file) or any
// row is a different object than what's currently cached — every real write call site (crud.ts,
// attendance.ts, adminStaging.ts) builds its "updated" array via [...rows] plus selective index
// replacement, so unchanged rows keep their exact reference from readRows(). This costs zero
// extra I/O (no on-disk re-read needed to decide) and fails safe: if some future caller ever
// rebuilds every row unconditionally, the file is just always dirty — never silently skipped.
function isDirty(file: string, rows: Row[]): boolean {
  const cached = cache.get(file);
  if (!cached) return true;
  if (cached.rows.length !== rows.length) return true;
  for (let i = 0; i < rows.length; i++) {
    if (cached.rows[i] !== rows[i]) return true;
  }
  return false;
}

export async function writeRows(entity: EntityDescriptor, rows: Row[]): Promise<void> {
  const file = await fullPath(entity);

  if (!isDirty(file, rows)) {
    pendingWrites.delete(entity.name);
    return;
  }

  if (isLocked(file)) {
    pendingWrites.set(entity.name, { entity, rows, queuedAt: new Date().toISOString() });
    throw new FileLockedError(`"${file}" is currently open in Excel — close it and retry.`);
  }

  try {
    await enqueue(file, () => performWrite(entity, file, rows));
    pendingWrites.delete(entity.name);
    broadcastChange(entity.name);
  } catch (err) {
    if (err instanceof FileLockedError) {
      pendingWrites.set(entity.name, { entity, rows, queuedAt: new Date().toISOString() });
    }
    throw err;
  }
}

// Background sweeper: retries any write that failed because a workbook was locked, so a change
// is never silently dropped — it completes automatically once the file is closed, without the
// client needing to resubmit. unref()'d so it never keeps the process (or a test runner) alive
// on its own.
let sweeperStarted = false;
export function startPendingWriteSweeper(intervalMs = 5000): void {
  if (sweeperStarted) return;
  sweeperStarted = true;
  const timer = setInterval(() => {
    for (const pending of pendingWrites.values()) {
      writeRows(pending.entity, pending.rows).catch(() => {
        // Still locked (or another transient error) — leave it queued for the next sweep.
      });
    }
  }, intervalMs);
  timer.unref();
}

export function hasPendingWrite(entity: EntityDescriptor): boolean {
  return pendingWrites.has(entity.name);
}

export async function restoreFromBackup(entity: EntityDescriptor, backupFileName: string): Promise<void> {
  const dir = backupDir(entity);
  const backupPath = path.join(dir, backupFileName);
  const buffer = await fs.promises.readFile(backupPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in backup ${backupFileName}`);
  const rawRows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  const rows = rawRows.map((raw) => entity.mapRow(raw).row);
  // writeRows backs up the pre-restore state first, same as any other write.
  await writeRows(entity, rows);
}

export async function listBackups(entity: EntityDescriptor): Promise<string[]> {
  const dir = backupDir(entity);
  try {
    return (await fs.promises.readdir(dir)).sort();
  } catch {
    return [];
  }
}

// --- Row-level query helpers built on top of readRows(), shared by the route layer ---

export async function findActiveRows(entity: EntityDescriptor, includeDeleted = false): Promise<Row[]> {
  const rows = await readRows(entity);
  return includeDeleted ? rows : rows.filter((r) => !r.deleted_at);
}

export async function findRowById(entity: EntityDescriptor, id: string, includeDeleted = false): Promise<Row | undefined> {
  const rows = await findActiveRows(entity, includeDeleted);
  return rows.find((r) => String(r[entity.idField]) === id);
}

export async function findRowsByField(entity: EntityDescriptor, field: string, value: string, includeDeleted = false): Promise<Row[]> {
  const rows = await findActiveRows(entity, includeDeleted);
  return rows.filter((r) => String(r[field] ?? '') === value);
}
