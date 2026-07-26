import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createFixtureDataDir, removeFixtureDataDir, SAMPLE_WORKSHOP_ID } from './fixtures/setup.js';

let dataDir: string;
let store: typeof import('../src/store.js');
let entities: typeof import('../src/entities/index.js');

beforeAll(async () => {
  dataDir = await createFixtureDataDir();
  process.env.DATA_DIR = dataDir;
  store = await import('../src/store.js');
  entities = await import('../src/entities/index.js');
});

afterAll(async () => {
  await removeFixtureDataDir(dataDir);
});

describe('store', () => {
  it('reads the sample workshop row', async () => {
    const rows = await store.readRows(entities.workshopEntity);
    expect(rows.length).toBe(1);
    expect(rows[0].workshop_id).toBe(SAMPLE_WORKSHOP_ID);
  });

  it('writes atomically, leaves no stray .tmp file, and creates a timestamped backup', async () => {
    const rows = await store.readRows(entities.trainerEntity);
    const before = await store.listBackups(entities.trainerEntity);

    await store.writeRows(entities.trainerEntity, rows.map((r) => ({ ...r })));

    const after = await store.listBackups(entities.trainerEntity);
    expect(after.length).toBe(before.length + 1);

    const filePath = await store.fullPath(entities.trainerEntity);
    const dir = path.dirname(filePath);
    const files = await fs.promises.readdir(dir);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('detects a fake Excel lock file and rejects the write with FileLockedError', async () => {
    const filePath = await store.fullPath(entities.workshopEntity);
    const lockPath = path.join(path.dirname(filePath), `~$${path.basename(filePath)}`);
    await fs.promises.writeFile(lockPath, '');

    try {
      const rows = await store.readRows(entities.workshopEntity);
      // Force a dirty write (a same-reference array would be a no-op and never reach the lock
      // check) by cloning the one row.
      await expect(store.writeRows(entities.workshopEntity, rows.map((r) => ({ ...r })))).rejects.toThrow(store.FileLockedError);
    } finally {
      await fs.promises.unlink(lockPath);
    }
  });

  it('soft-deletes and restores a row round-trip', async () => {
    const rows = await store.readRows(entities.feedbackEntity);
    const target = rows[0];

    const deleted = rows.map((r) => (r === target ? { ...r, deleted_at: new Date().toISOString() } : r));
    await store.writeRows(entities.feedbackEntity, deleted);

    const active = await store.findActiveRows(entities.feedbackEntity);
    expect(active.find((r) => r.feedback_id === target.feedback_id)).toBeUndefined();

    const withDeleted = await store.findActiveRows(entities.feedbackEntity, true);
    const found = withDeleted.find((r) => r.feedback_id === target.feedback_id);
    expect(found?.deleted_at).toBeTruthy();

    const restored = withDeleted.map((r) => (r.feedback_id === target.feedback_id ? { ...r, deleted_at: null } : r));
    await store.writeRows(entities.feedbackEntity, restored);

    const activeAgain = await store.findActiveRows(entities.feedbackEntity);
    expect(activeAgain.find((r) => r.feedback_id === target.feedback_id)).toBeTruthy();
  });

  it('throws a clear error instead of silently picking one, when an entity folder has two ambiguous candidate workbooks', async () => {
    const filePath = await store.fullPath(entities.workshopEntity);
    const dir = path.dirname(filePath);
    const original = await fs.promises.readFile(filePath);
    const decoyPath = path.join(dir, 'decoy.xlsx');
    await fs.promises.writeFile(decoyPath, original);

    try {
      await expect(store.readRows(entities.workshopEntity)).rejects.toThrow(/Multiple candidate workbooks/);
    } finally {
      await fs.promises.unlink(decoyPath);
    }
  });

  it('a no-op write (identical rows) is skipped even if the target file is locked', async () => {
    const filePath = await store.fullPath(entities.trainerEntity);
    const lockPath = path.join(path.dirname(filePath), `~$${path.basename(filePath)}`);
    await fs.promises.writeFile(lockPath, '');

    try {
      const rows = await store.readRows(entities.trainerEntity);
      // Same array reference (not cloned) — isDirty() must report false and skip the lock check.
      await expect(store.writeRows(entities.trainerEntity, rows)).resolves.toBeUndefined();
    } finally {
      await fs.promises.unlink(lockPath);
    }
  });
});
