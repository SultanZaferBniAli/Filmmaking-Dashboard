import type { Row } from '../entities/index.js';
import { workshopEntity, trainerEntity, participantEntity, feedbackEntity } from '../entities/index.js';
import { findActiveRows, findRowById, findRowsByField } from '../store.js';
import { computeAgeBuckets, computeTrackBreakdown, computeOverallRating } from './reportAggregates.js';
import { findLatestWorkshopDocument, listWorkshopPhotos, workshopPhotoUrl, findTrainerPhoto } from '../mediaPaths.js';

// The real `themes` column ("محاور") is a single semicolon-separated string, e.g.
// "أساسيات المونتاج...؛ سير العمل...؛ إيقاع المشهد..." — split into the frontend's
// `objectives: string[]` shape (also accepts a plain ";" in case of non-Arabic punctuation).
function splitThemes(themes: string | null): string[] {
  if (!themes) return [];
  return themes
    .split(/[؛;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toWorkshopParticipant(row: Row) {
  const totalSessions = Number(row.total_sessions ?? 5) || 5;
  const sessionAttendance = Array.from({ length: totalSessions }, (_, i) => Boolean(row[`day_${i + 1}`]));
  return {
    participant_id: row.participant_id,
    name: row.full_name_arabic,
    phone: row.phone,
    email: row.email,
    department: row.track ?? '',
    sessionAttendance,
  };
}

function countByGender(rows: Row[]) {
  return {
    male: rows.filter((r) => r.gender === 'male').length,
    female: rows.filter((r) => r.gender === 'female').length,
  };
}

// Assembles the full frontend `Workshop` shape on read: joins trainer display fields, derives
// the nested participant roster, and computes every aggregate count live from the current
// participants/feedback sheets so they can never drift out of sync with the source data.
// Field-default decisions (level, capacity, description, created_at/updated_at) mirror the
// ones already established and verified in the prior session's real-data import.
export async function serializeWorkshop(row: Row) {
  const trainer = row.trainer_id ? await findRowById(trainerEntity, String(row.trainer_id)) : undefined;
  const participants = await findRowsByField(participantEntity, 'workshop_id', String(row.workshop_id));
  const feedback = await findRowsByField(feedbackEntity, 'workshop_id', String(row.workshop_id));

  const accepted = participants.filter((p) => p.status === 'accepted');
  const attendedAtLeastOne = accepted.filter((p) => Number(p.attendance_percentage ?? 0) > 0);
  const fullyAttended = accepted.filter((p) => p.attendance_status === 'حضور فعلي');

  const applicationsSplit = countByGender(participants);
  const acceptedSplit = countByGender(accepted);
  const attendanceSplit = countByGender(attendedAtLeastOne);
  const actualAttendanceSplit = countByGender(fullyAttended);

  const ratingCounts = [0, 0, 0, 0, 0];
  for (const f of feedback) {
    const rating = Number(f.overall_rating);
    if (rating >= 1 && rating <= 5) ratingCounts[rating - 1]++;
  }

  const ageBuckets = computeAgeBuckets(accepted);
  const attendanceByTrack = computeTrackBreakdown(accepted);
  const overallRating = computeOverallRating(feedback);
  const photos = listWorkshopPhotos(String(row.workshop_id));
  const reportFile = findLatestWorkshopDocument('reports', String(row.workshop_id));
  const guideFile = findLatestWorkshopDocument('guides', String(row.workshop_id));
  const coverImageFilename = row.workshop_image as string | null;
  const coverImage = coverImageFilename ? workshopPhotoUrl(coverImageFilename) : (photos[0]?.url ?? null);

  return {
    workshop_id: row.workshop_id,
    workshop_name: row.workshop_name,
    workshop_type: row.workshop_type,
    field: row.field,
    workshop_image: coverImage,
    region: row.region_code,
    city: row.city,
    start_date: row.start_date,
    end_date: row.end_date,
    trainer_id: trainer?.trainer_id ?? null,
    trainer_name: trainer?.name_ar ?? '',
    trainer_bio: trainer?.bio ?? '',
    trainer_nationality: trainer?.nationality_code ?? 'SA',
    trainer_image: trainer ? (findTrainerPhoto(String(trainer.trainer_id))?.url ?? null) : null,
    level: row.level ?? 'متوسط',
    language: row.language ?? 'العربية',
    objectives: splitThemes(row.themes as string | null),
    location_type: row.location_type,
    location_name: row.location_name ?? '',
    location_link: row.location_link ?? null,
    platform: null,
    meeting_link: null,
    capacity: row.capacity ?? 0,
    registered_participants: participants.length,
    description: (row.description as string | null) ?? '',
    created_at: row.start_date,
    updated_at: row.end_date,
    trainer_notes: '',
    general_notes: '',
    recommendations: '',
    participants: accepted.map(toWorkshopParticipant),
    photos: photos.map((p) => ({ id: p.filename, url: p.url, caption: undefined })),
    total_applications: participants.length,
    male_applications: applicationsSplit.male,
    female_applications: applicationsSplit.female,
    total_accepted: accepted.length,
    male_accepted: acceptedSplit.male,
    female_accepted: acceptedSplit.female,
    total_attendance: attendedAtLeastOne.length,
    male_attendance: attendanceSplit.male,
    female_attendance: attendanceSplit.female,
    actual_attendance: fullyAttended.length,
    male_actual_attendance: actualAttendanceSplit.male,
    female_actual_attendance: actualAttendanceSplit.female,
    rating_1_count: ratingCounts[0],
    rating_2_count: ratingCounts[1],
    rating_3_count: ratingCounts[2],
    rating_4_count: ratingCounts[3],
    rating_5_count: ratingCounts[4],
    status: row.status,
    age_18_24_count: ageBuckets.age_18_24_count,
    age_25_30_count: ageBuckets.age_25_30_count,
    age_30_plus_count: ageBuckets.age_30_plus_count,
    attendance_by_track: attendanceByTrack,
    overall_rating_percent: overallRating.overall_rating_percent,
    overall_rating_label: overallRating.overall_rating_label,
    targetAudienceTraits: [] as string[],
    honorPhotoId: undefined as string | undefined,
    executiveSummaryOverride: undefined as string | undefined,
    report_file: reportFile,
    guide_file: guideFile,
  };
}

export async function serializeAllWorkshops() {
  const rows = await findActiveRows(workshopEntity);
  return Promise.all(rows.map(serializeWorkshop));
}
