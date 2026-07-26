import type { Row } from '../entities/index.js';
import { feedbackEntity } from '../entities/index.js';
import { findActiveRows } from '../store.js';

export function serializeFeedback(row: Row) {
  return {
    feedbackId: row.feedback_id,
    workshopId: row.workshop_id,
    participantId: row.participant_id ?? undefined,
    responseStatus: row.response_status ?? undefined,

    respondentName: row.respondent_name ?? undefined,
    respondentEmail: row.respondent_email ?? undefined,
    respondentPhone: row.respondent_phone ?? undefined,
    respondentGender: row.respondent_gender ?? undefined,

    overallRating: row.overall_rating ?? undefined,
    trainerQuality: row.trainer_quality ?? undefined,
    contentQuality: row.content_quality ?? undefined,
    gainedKnowledge: row.gained_knowledge ?? undefined,
    intendsToApply: row.intends_to_apply ?? undefined,
    professionalConnections: row.professional_connections ?? undefined,
    currentSkillLevel: row.current_skill_level ?? undefined,
    confidenceLevel: row.confidence_level ?? undefined,

    comments: row.comments ?? undefined,
    suggestions: row.suggestions ?? undefined,

    submittedAt: row.submitted_at ?? undefined,
  };
}

export async function serializeAllFeedback() {
  const rows = await findActiveRows(feedbackEntity);
  return rows.map(serializeFeedback);
}
