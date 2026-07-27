import type { FastifyInstance } from 'fastify';
import { workshopEntity, participantEntity, feedbackEntity } from '../entities/index.js';
import { findRowById, findRowsByField } from '../store.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../auth.js';

export function registerRelationRoutes(app: FastifyInstance) {
  app.get('/workshops/:id/participants', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);
    return findRowsByField(participantEntity, 'workshop_id', id);
  });

  app.get('/workshops/:id/feedback', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const workshop = await findRowById(workshopEntity, id);
    if (!workshop) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);
    return findRowsByField(feedbackEntity, 'workshop_id', id);
  });
}
