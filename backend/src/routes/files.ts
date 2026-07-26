import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DATA_DIR } from '../config.js';
import { ApiError } from '../errors.js';
import { workshopEntity } from '../entities/index.js';
import { findRowById } from '../store.js';
import { listWorkshopPhotos, workshopPhotosDir } from '../mediaPaths.js';
import { createZipBuffer } from '../zip.js';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Serves a file from anywhere under DATA_DIR by its relative path (e.g.
// /files/<workshop folder>/photos/123.jpg) — the only way the frontend can render an uploaded
// attachment. Guards against path traversal by refusing to serve anything that resolves outside
// DATA_DIR.
export function registerFileRoutes(app: FastifyInstance) {
  app.get('/files/*', async (req, reply) => {
    const relPath = (req.params as { '*': string })['*'];
    const fullPath = path.resolve(DATA_DIR, relPath);
    if (!fullPath.startsWith(path.resolve(DATA_DIR) + path.sep)) {
      throw new ApiError(400, 'BAD_REQUEST', 'Invalid file path');
    }
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new ApiError(404, 'NOT_FOUND', 'File not found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    reply.type(MIME_BY_EXT[ext] ?? 'application/octet-stream');
    return fs.createReadStream(fullPath);
  });

  app.get('/workshops/:id/photos.zip', async (req, reply) => {
    const { id } = req.params as { id: string };
    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

    const photos = listWorkshopPhotos(id);
    if (photos.length === 0) throw new ApiError(404, 'NOT_FOUND', `No photos found for workshops/${id}`);

    const photosDir = workshopPhotosDir();
    const entries = photos.map(({ filename }) => ({
      name: filename,
      content: fs.readFileSync(path.join(photosDir, filename)),
    }));
    const zipBuffer = createZipBuffer(entries);

    reply.header('Content-Disposition', `attachment; filename="${id}-photos.zip"`);
    reply.type('application/zip');
    return zipBuffer;
  });
}
