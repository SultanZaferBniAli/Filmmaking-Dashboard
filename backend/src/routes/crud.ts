import type { FastifyInstance } from 'fastify';
import { entities, type EntityDescriptor, type Row } from '../entities/index.js';
import { readRows, writeRows, findActiveRows, findRowById, findRowsByField } from '../store.js';
import { appendAuditEntry, diffFields } from '../audit.js';
import { ApiError, zodToApiError } from '../errors.js';
import { findUniqueConflict } from '../uniqueness.js';

function checkUniqueness(entity: EntityDescriptor, rows: Row[], candidate: Row, excludeRow?: Row) {
  const conflict = findUniqueConflict(entity, rows, candidate, excludeRow);
  if (conflict) {
    throw new ApiError(
      409,
      'CONFLICT',
      `A record with the same ${conflict.keys.join(' + ')} already exists`,
      conflict.keys.map((k) => ({ path: k, message: `${k} must be unique` })),
    );
  }
}

async function checkForeignKeys(entity: EntityDescriptor, candidate: Row) {
  for (const rule of entity.fk ?? []) {
    const targetEntity = entities[rule.targetEntity];
    const value = candidate[rule.field];
    if (value === null || value === undefined || value === '') continue;
    const found = await findRowById(targetEntity, String(value));
    if (!found) {
      throw new ApiError(400, 'BAD_REFERENCE', `${rule.field} "${String(value)}" does not reference an existing ${rule.targetEntity} record`, [
        { path: rule.field, message: 'does not reference an existing record' },
      ]);
    }
  }
}

async function checkRestrictDelete(entity: EntityDescriptor, id: string) {
  for (const rule of entity.restrictDeleteIfReferencedBy ?? []) {
    const targetEntity = entities[rule.entity];
    const referencing = await findRowsByField(targetEntity, rule.field, id);
    if (referencing.length > 0) {
      throw new ApiError(
        409,
        'CONFLICT',
        `Cannot delete ${entity.name}/${id}: still referenced by ${referencing.length} ${rule.entity} record(s)`,
      );
    }
  }
}

function withWarnings(row: Row, warnings: string[]) {
  return warnings.length > 0 ? { ...row, _warnings: warnings } : row;
}

export function registerCrudRoutes(app: FastifyInstance, entity: EntityDescriptor) {
  const base = `/${entity.name}`;

  app.get(base, async (req) => {
    const includeDeleted = (req.query as { includeDeleted?: string }).includeDeleted === 'true';
    return findActiveRows(entity, includeDeleted);
  });

  app.get(`${base}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const includeDeleted = (req.query as { includeDeleted?: string }).includeDeleted === 'true';
    const row = await findRowById(entity, id, includeDeleted);
    if (!row) throw new ApiError(404, 'NOT_FOUND', `${entity.name}/${id} not found`);
    return row;
  });

  app.post(base, async (req, reply) => {
    const raw = req.body as Row;
    const { row: mapped, warnings } = entity.mapRow(raw);
    const parsed = entity.schema.safeParse(mapped);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const candidate: Row = { ...(parsed.data as Row), deleted_at: null };
    await checkForeignKeys(entity, candidate);

    const rows = await readRows(entity);
    checkUniqueness(entity, rows, candidate);
    await writeRows(entity, [...rows, candidate]);

    appendAuditEntry({
      entity: entity.name,
      record_id: String(candidate[entity.idField]),
      action: 'create',
      changed_fields: diffFields(null, candidate),
      source: 'dashboard-edit',
      source_detail: null,
      actor: null,
    });

    reply.code(201);
    return withWarnings(candidate, warnings);
  });

  app.patch(`${base}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const rows = await readRows(entity);
    const idx = rows.findIndex((r) => String(r[entity.idField]) === id && !r.deleted_at);
    if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${entity.name}/${id} not found`);

    const existing = rows[idx];
    const merged = { ...existing, ...(req.body as Row) };
    const { row: mapped, warnings } = entity.mapRow(merged);
    const parsed = entity.schema.safeParse(mapped);
    if (!parsed.success) throw zodToApiError(parsed.error);

    const candidate: Row = { ...(parsed.data as Row), deleted_at: existing.deleted_at ?? null };
    checkUniqueness(entity, rows, candidate, existing);
    await checkForeignKeys(entity, candidate);

    const changed = diffFields(existing, candidate);
    if (Object.keys(changed).length === 0) return withWarnings(candidate, warnings);

    const updatedRows = [...rows];
    updatedRows[idx] = candidate;
    await writeRows(entity, updatedRows);
    appendAuditEntry({
      entity: entity.name,
      record_id: id,
      action: 'update',
      changed_fields: changed,
      source: 'dashboard-edit',
      source_detail: null,
      actor: null,
    });

    return withWarnings(candidate, warnings);
  });

  app.delete(`${base}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await readRows(entity);
    const idx = rows.findIndex((r) => String(r[entity.idField]) === id && !r.deleted_at);
    if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${entity.name}/${id} not found`);

    await checkRestrictDelete(entity, id);

    const timestamp = new Date().toISOString();
    const updatedRows = [...rows];
    updatedRows[idx] = { ...rows[idx], deleted_at: timestamp };
    await writeRows(entity, updatedRows);
    appendAuditEntry({
      entity: entity.name,
      record_id: id,
      action: 'delete',
      changed_fields: { deleted_at: { before: null, after: timestamp } },
      source: 'dashboard-edit',
      source_detail: null,
      actor: null,
    });

    reply.code(204);
  });

  app.post(`${base}/:id/restore`, async (req) => {
    const { id } = req.params as { id: string };
    const rows = await readRows(entity);
    const idx = rows.findIndex((r) => String(r[entity.idField]) === id);
    if (idx === -1) throw new ApiError(404, 'NOT_FOUND', `${entity.name}/${id} not found`);
    if (!rows[idx].deleted_at) throw new ApiError(400, 'NOT_DELETED', `${entity.name}/${id} is not deleted`);

    const before = rows[idx].deleted_at;
    const updatedRows = [...rows];
    updatedRows[idx] = { ...rows[idx], deleted_at: null };
    await writeRows(entity, updatedRows);
    appendAuditEntry({
      entity: entity.name,
      record_id: id,
      action: 'restore',
      changed_fields: { deleted_at: { before: before ?? null, after: null } },
      source: 'dashboard-edit',
      source_detail: null,
      actor: null,
    });

    return updatedRows[idx];
  });
}
