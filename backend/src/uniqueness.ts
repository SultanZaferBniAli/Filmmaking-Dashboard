import type { EntityDescriptor, Row } from './entities/types.js';

export interface UniqueConflict {
  keys: string[];
}

// Finds the first uniqueness violation `candidate` would create among `rows` (soft-deleted
// rows are exempt), optionally excluding one row (e.g. the row being patched). Shared by the
// CRUD routes (409 on conflict) and the import/upsert route (per-row error, row skipped).
export function findUniqueConflict(entity: EntityDescriptor, rows: Row[], candidate: Row, excludeRow?: Row): UniqueConflict | null {
  const keySets = [
    ...entity.uniqueKeys.map((keys) => ({ keys, whenPresent: false })),
    ...(entity.uniqueKeysWhenPresent ?? []).map((keys) => ({ keys, whenPresent: true })),
  ];
  for (const { keys, whenPresent } of keySets) {
    if (whenPresent && keys.some((k) => candidate[k] === null || candidate[k] === undefined || candidate[k] === '')) continue;
    const conflict = rows.find((r) => {
      if (excludeRow && r === excludeRow) return false;
      if (r.deleted_at) return false;
      return keys.every((k) => String(r[k] ?? '') === String(candidate[k] ?? ''));
    });
    if (conflict) return { keys };
  }
  return null;
}
