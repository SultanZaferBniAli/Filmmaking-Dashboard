import type { FastifyInstance } from 'fastify';
import * as path from 'node:path';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../config.js';
import { ApiError } from '../errors.js';
import { entities } from '../entities/index.js';
import { readRows, writeRows, findRowById } from '../store.js';
import { appendAuditEntry, diffFields } from '../audit.js';
import { createStagingSession, loadStagingSession, patchStagingRow, setBatchWorkshopId, applyStagingSession, discardStagingSession } from '../adminStaging.js';
import { trainerPhotosDir, workshopPhotosDir, findTrainerPhoto, listWorkshopPhotos, nextWorkshopPhotoIndex } from '../mediaPaths.js';
import { validateImageUpload, writeImageFile, removeImageFile } from '../imageStore.js';

const applyBodySchema = z.object({ batches: z.array(z.string()).optional() });

// The controlled admin pipeline: upload -> stage (parse+validate+diff, writes nothing) -> review
// (inline-edit re-validates live) -> apply (atomic write + audit, reusing store.ts/adminStaging.ts)
// or discard. Plus dedicated trainer/workshop photo upload — writes the file *and* updates the
// owning record's image column in one call (the generic attachments.ts route only writes a file).
export function registerAdminRoutes(app: FastifyInstance) {
  app.post('/admin/upload', async (req) => {
    const files: { filename: string; buffer: Buffer }[] = [];
    for await (const part of req.parts({ limits: { fileSize: MAX_UPLOAD_BYTES } })) {
      if (part.type !== 'file') continue;
      files.push({ filename: part.filename, buffer: await part.toBuffer() });
    }
    if (files.length === 0) throw new ApiError(400, 'BAD_REQUEST', 'No files uploaded (expected one or more multipart file fields)');
    return createStagingSession(files);
  });

  app.get('/admin/staging/:id', async (req) => {
    const { id } = req.params as { id: string };
    return loadStagingSession(id);
  });

  app.patch('/admin/staging/:id/batches/:entity/rows/:rowIndex', async (req) => {
    const { id, entity, rowIndex } = req.params as { id: string; entity: string; rowIndex: string };
    if (!entities[entity]) throw new ApiError(404, 'NOT_FOUND', `Unknown entity "${entity}"`);
    const idx = Number(rowIndex);
    if (!Number.isInteger(idx) || idx < 0) throw new ApiError(400, 'BAD_REQUEST', 'rowIndex must be a non-negative integer');
    return patchStagingRow(id, entity, idx, req.body as Record<string, unknown>);
  });

  app.patch('/admin/staging/:id/batches/:entity/workshop', async (req) => {
    const { id, entity } = req.params as { id: string; entity: string };
    const parsed = z.object({ workshop_id: z.string().trim().min(1) }).safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, 'BAD_REQUEST', 'Expected { workshop_id }');
    return setBatchWorkshopId(id, entity, parsed.data.workshop_id);
  });

  app.post('/admin/staging/:id/apply', async (req) => {
    const { id } = req.params as { id: string };
    const parsed = applyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ApiError(400, 'BAD_REQUEST', 'Invalid apply request body');
    return applyStagingSession(id, parsed.data.batches);
  });

  app.delete('/admin/staging/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await discardStagingSession(id);
    reply.code(204);
  });

  app.post('/admin/trainers/:id/photo', async (req) => {
    const { id } = req.params as { id: string };
    if (!(await findRowById(entities.trainers, id))) throw new ApiError(404, 'NOT_FOUND', `trainers/${id} not found`);

    const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!file) throw new ApiError(400, 'BAD_REQUEST', 'No file uploaded (expected multipart field "file")');
    const buffer = await file.toBuffer();
    const ext = validateImageUpload(file.filename, buffer.byteLength);

    // One photo per trainer — remove any existing file under a different extension first, so
    // replacing a .png with a .jpg doesn't leave the old file orphaned.
    const existing = findTrainerPhoto(id);
    if (existing && existing.filename !== `${id}${ext}`) {
      await removeImageFile(path.join(trainerPhotosDir(), existing.filename));
    }

    const filename = `${id}${ext}`;
    await writeImageFile(path.join(trainerPhotosDir(), filename), buffer);

    const rows = await readRows(entities.trainers);
    const idx = rows.findIndex((r) => String(r.trainer_id) === id);
    const before = rows[idx];
    const updated = { ...before, profile_image: filename };
    const updatedRows = [...rows];
    updatedRows[idx] = updated;
    await writeRows(entities.trainers, updatedRows);
    appendAuditEntry({
      entity: 'trainers',
      record_id: id,
      action: 'update',
      changed_fields: diffFields(before, updated),
      source: 'admin-upload',
      source_detail: file.filename,
      actor: null,
    });

    return { filename, url: `/files/trainers/photos/${encodeURIComponent(filename)}` };
  });

  app.delete('/admin/trainers/:id/photo', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await findRowById(entities.trainers, id))) throw new ApiError(404, 'NOT_FOUND', `trainers/${id} not found`);

    const existing = findTrainerPhoto(id);
    if (existing) await removeImageFile(path.join(trainerPhotosDir(), existing.filename));

    const rows = await readRows(entities.trainers);
    const idx = rows.findIndex((r) => String(r.trainer_id) === id);
    const before = rows[idx];
    if (before.profile_image) {
      const updated = { ...before, profile_image: null };
      const updatedRows = [...rows];
      updatedRows[idx] = updated;
      await writeRows(entities.trainers, updatedRows);
      appendAuditEntry({
        entity: 'trainers',
        record_id: id,
        action: 'update',
        changed_fields: diffFields(before, updated),
        source: 'admin-upload',
        source_detail: null,
        actor: null,
      });
    }

    reply.code(204);
  });

  app.post('/admin/workshops/:id/photos', async (req) => {
    const { id } = req.params as { id: string };
    if (!(await findRowById(entities.workshops, id))) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    const uploaded: { filename: string; url: string }[] = [];
    let makeCover = false;
    for await (const part of req.parts({ limits: { fileSize: MAX_UPLOAD_BYTES } })) {
      if (part.type === 'field') {
        if (part.fieldname === 'cover') makeCover = String(part.value) === 'true';
        continue;
      }
      const buffer = await part.toBuffer();
      const ext = validateImageUpload(part.filename, buffer.byteLength);
      const filename = `${id}_${nextWorkshopPhotoIndex(id)}${ext}`;
      await writeImageFile(path.join(workshopPhotosDir(), filename), buffer);
      uploaded.push({ filename, url: `/files/workshops/photos/${encodeURIComponent(filename)}` });
    }
    if (uploaded.length === 0) throw new ApiError(400, 'BAD_REQUEST', 'No files uploaded (expected one or more multipart file fields)');

    if (makeCover) {
      const rows = await readRows(entities.workshops);
      const idx = rows.findIndex((r) => String(r.workshop_id) === id);
      const before = rows[idx];
      const updated = { ...before, workshop_image: uploaded[0].filename };
      const updatedRows = [...rows];
      updatedRows[idx] = updated;
      await writeRows(entities.workshops, updatedRows);
      appendAuditEntry({
        entity: 'workshops',
        record_id: id,
        action: 'update',
        changed_fields: diffFields(before, updated),
        source: 'admin-upload',
        source_detail: null,
        actor: null,
      });
    }

    return { photos: uploaded };
  });

  app.delete('/admin/workshops/:id/photos/:filename', async (req, reply) => {
    const { id, filename } = req.params as { id: string; filename: string };
    if (!(await findRowById(entities.workshops, id))) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    // filename must belong to this workshop's own gallery — guards against path traversal and
    // against deleting another workshop's photo via a mismatched id.
    if (!filename.startsWith(`${id}_`) || filename.includes('/') || filename.includes('\\')) {
      throw new ApiError(400, 'BAD_REQUEST', 'filename does not belong to this workshop');
    }

    await removeImageFile(path.join(workshopPhotosDir(), filename));

    const rows = await readRows(entities.workshops);
    const idx = rows.findIndex((r) => String(r.workshop_id) === id);
    const before = rows[idx];
    if (before.workshop_image === filename) {
      const remaining = listWorkshopPhotos(id).filter((p) => p.filename !== filename);
      const updated = { ...before, workshop_image: remaining[0]?.filename ?? null };
      const updatedRows = [...rows];
      updatedRows[idx] = updated;
      await writeRows(entities.workshops, updatedRows);
      appendAuditEntry({
        entity: 'workshops',
        record_id: id,
        action: 'update',
        changed_fields: diffFields(before, updated),
        source: 'admin-upload',
        source_detail: null,
        actor: null,
      });
    }

    reply.code(204);
  });
}
