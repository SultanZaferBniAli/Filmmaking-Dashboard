import { workshopEntity } from './workshop.js';
import { trainerEntity } from './trainer.js';
import { participantEntity } from './participant.js';
import { feedbackEntity } from './feedback.js';
import type { EntityDescriptor } from './types.js';

export const entities: Record<string, EntityDescriptor> = {
  workshops: workshopEntity,
  trainers: trainerEntity,
  participants: participantEntity,
  feedback: feedbackEntity,
};

export function getEntity(name: string): EntityDescriptor | undefined {
  return entities[name];
}

export type { EntityDescriptor, Row, MapRowResult } from './types.js';
export { workshopEntity, trainerEntity, participantEntity, feedbackEntity };
