import type { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { workshopEntity } from '../entities/index.js';
import { findRowById } from '../store.js';
import { MAX_UPLOAD_BYTES } from '../config.js';
import { ApiError } from '../errors.js';
import { workshopDocsDir, removeExistingWorkshopDocuments, type WorkshopDocKind } from '../mediaPaths.js';
import { requireAdmin } from '../auth.js';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const ROUTE_KINDS: { route: 'report' | 'guide'; dirKind: WorkshopDocKind }[] = [
  { route: 'report', dirKind: 'reports' },
  { route: 'guide', dirKind: 'guides' },
];

export function registerWorkshopDocumentRoutes(app: FastifyInstance) {
  for (const { route: kind, dirKind } of ROUTE_KINDS) {
    app.post(`/workshops/:id/${kind}-file`, { preHandler: requireAdmin }, async (req) => {
      const { id } = req.params as { id: string };
      const workshop = await findRowById(workshopEntity, id);
      if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

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

      const dir = workshopDocsDir(dirKind);
      await fs.promises.mkdir(dir, { recursive: true });
      removeExistingWorkshopDocuments(dirKind, id);

      const storedName = `${id}_${Date.now()}${ext}`;
      await fs.promises.writeFile(path.join(dir, storedName), buffer);

      return { url: `/files/workshops/${dirKind}/${encodeURIComponent(storedName)}`, filename: storedName };
    });

    app.delete(`/workshops/:id/${kind}-file`, { preHandler: requireAdmin }, async (req) => {
      const { id } = req.params as { id: string };
      const workshop = await findRowById(workshopEntity, id);
      if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);

      removeExistingWorkshopDocuments(dirKind, id);
      return { removed: true };
    });
  }
}
