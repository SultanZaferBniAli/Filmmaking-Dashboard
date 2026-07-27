import type { FastifyInstance } from 'fastify';
import { serializeAllWorkshops, serializeWorkshop } from '../serialize/workshop.js';
import { serializeAllTrainers } from '../serialize/trainer.js';
import { serializeAllParticipants } from '../serialize/participant.js';
import { serializeAllFeedback } from '../serialize/feedback.js';
import { workshopEntity } from '../entities/index.js';
import { findRowById } from '../store.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../auth.js';

// The dashboard-consumable shape (matching the existing frontend TypeScript interfaces
// exactly), distinct from the raw CRUD routes (which operate on the underlying Excel column
// names for editing). `src/data/api.ts` on the frontend fetches from these.
export function registerViewRoutes(app: FastifyInstance) {
  app.get('/view/workshops', { preHandler: requireAuth }, async () => serializeAllWorkshops());
  app.get('/view/workshops/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const row = await findRowById(workshopEntity, id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', `workshops/${id} not found`);
    return serializeWorkshop(row);
  });
  app.get('/view/trainers', { preHandler: requireAuth }, async () => serializeAllTrainers());
  app.get('/view/participants', { preHandler: requireAuth }, async () => serializeAllParticipants());
  app.get('/view/feedback', { preHandler: requireAuth }, async () => serializeAllFeedback());
}
