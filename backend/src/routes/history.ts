import type { FastifyInstance } from 'fastify';
import { readAuditHistory } from '../audit.js';
import type { EntityDescriptor } from '../entities/index.js';
import { requireAuth } from '../auth.js';

export function registerHistoryRoute(app: FastifyInstance, entity: EntityDescriptor) {
  app.get(`/${entity.name}/:id/history`, { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    return readAuditHistory(entity.name, id);
  });
}
