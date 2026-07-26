import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { fileURLToPath } from 'node:url';
import { PORT } from './config.js';
import { entities } from './entities/index.js';
import { registerCrudRoutes } from './routes/crud.js';
import { registerRelationRoutes } from './routes/relations.js';
import { registerHistoryRoute } from './routes/history.js';
import { registerViewRoutes } from './routes/view.js';
import { registerAttendanceRoute } from './routes/attendance.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerFileRoutes } from './routes/files.js';
import { registerWorkshopDocumentRoutes } from './routes/workshopDocuments.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerReportRoutes } from './routes/report.js';
import { registerParticipantsExportRoutes } from './routes/participantsExport.js';
import { registerWorkshopExportRoutes } from './routes/workshopExport.js';
import { registerTrainerExportRoutes } from './routes/trainerExport.js';
import { ApiError, errorBody, zodToApiError } from './errors.js';
import { FileLockedError, startPendingWriteSweeper } from './store.js';

export function buildServer() {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  app.register(multipart);

  for (const entity of Object.values(entities)) {
    registerCrudRoutes(app, entity);
    registerHistoryRoute(app, entity);
  }
  registerRelationRoutes(app);
  registerViewRoutes(app);
  registerAttendanceRoute(app);
  registerAttachmentRoutes(app);
  registerFileRoutes(app);
  registerWorkshopDocumentRoutes(app);
  registerAdminRoutes(app);
  registerReportRoutes(app);
  registerParticipantsExportRoutes(app);
  registerWorkshopExportRoutes(app);
  registerTrainerExportRoutes(app);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send(errorBody(err));
      return;
    }
    if (err instanceof ZodError) {
      const apiErr = zodToApiError(err);
      reply.code(apiErr.statusCode).send(errorBody(apiErr));
      return;
    }
    if (err instanceof FileLockedError) {
      reply.code(423).send(errorBody(new ApiError(423, 'FILE_LOCKED', err.message)));
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    reply.code(500).send(errorBody(new ApiError(500, 'INTERNAL_ERROR', 'Unexpected server error')));
  });

  startPendingWriteSweeper();

  return app;
}

async function main() {
  const app = buildServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
