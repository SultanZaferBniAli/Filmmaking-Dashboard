import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { entities } from '../entities/index.js';
import { findRowById } from '../store.js';
import { DATA_DIR, MAX_UPLOAD_BYTES } from '../config.js';
import { ApiError } from '../errors.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

export function registerAttachmentRoutes(app: FastifyInstance) {
  app.post('/:entityName/:id/attachments', async (req) => {
    const { entityName, id } = req.params as { entityName: string; id: string };
    const entity = entities[entityName];
    if (!entity) throw new ApiError(404, 'NOT_FOUND', `Unknown entity "${entityName}"`);
    if (!entity.attachmentsDir) throw new ApiError(400, 'NOT_SUPPORTED', `${entityName} does not accept attachments`);

    const row = await findRowById(entity, id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', `${entityName}/${id} not found`);

    const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!file) throw new ApiError(400, 'BAD_REQUEST', 'No file uploaded (expected multipart field "file")');

    const ext = path.extname(file.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new ApiError(422, 'VALIDATION_ERROR', `Unsupported file type "${ext}"`, [
        { path: 'file', message: `must be one of: ${[...ALLOWED_EXTENSIONS].join(', ')}` },
      ]);
    }

    const buffer = await file.toBuffer();
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new ApiError(422, 'VALIDATION_ERROR', `File exceeds the ${MAX_UPLOAD_BYTES}-byte limit`, [{ path: 'file', message: 'too large' }]);
    }

    const attachmentsDir = typeof entity.attachmentsDir === 'function' ? await entity.attachmentsDir(row) : entity.attachmentsDir;
    const targetDir = path.join(DATA_DIR, attachmentsDir);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const storedName = `${id}_${Date.now()}${ext}`;
    const targetPath = path.join(targetDir, storedName);
    await fs.promises.writeFile(targetPath, buffer);

    return { path: path.join(attachmentsDir, storedName).replace(/\\/g, '/') };
  });
}
