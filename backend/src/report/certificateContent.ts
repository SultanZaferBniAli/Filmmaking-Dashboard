import { workshopEntity, trainerEntity, participantEntity } from '../entities/index.js';
import { findRowById, findRowsByField } from '../store.js';
import { ApiError } from '../errors.js';

// Same threshold as the frontend's (now-superseded) client-side certificate logic
// (src/state/selectors.ts CERTIFICATE_ATTENDANCE_THRESHOLD) — kept in sync manually since the
// backend and frontend build separately and can't share a module.
export const CERTIFICATE_ATTENDANCE_THRESHOLD = 80;

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function parseIsoDate(iso: string): { day: number; month: number; year: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { day, month, year };
}

// Workshop days run the same start_time-end_time window every day (see workshop entity) — total
// training hours is that daily window's length times how many calendar days the workshop spans,
// matching the certificate template's own wording ("بإجمالي X ساعة تدريبية", the WORKSHOP's total
// hours, not a per-participant prorated count — every certificate for a given workshop shows the
// same total).
function dailyHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh + em / 60 - (sh + sm / 60);
}

function dayCount(startIso: string, endIso: string): number {
  const start = new Date(startIso + 'T00:00:00Z').getTime();
  const end = new Date(endIso + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export interface CertificateContent {
  gender: 'male' | 'female';
  participantName: string;
  workshopName: string;
  trainerName: string;
  startDay: string;
  startMonth: string;
  endDay: string;
  endMonth: string;
  year: string;
  totalHours: string;
}

export async function generateCertificateContent(workshopId: string, participantId: string): Promise<CertificateContent> {
  const workshopRow = await findRowById(workshopEntity, workshopId);
  if (!workshopRow) throw new ApiError(404, 'NOT_FOUND', `workshops/${workshopId} not found`);

  const participantRow = await findRowById(participantEntity, participantId);
  if (!participantRow || participantRow.workshop_id !== workshopId) {
    throw new ApiError(404, 'NOT_FOUND', `participant ${participantId} not found in workshop ${workshopId}`);
  }

  const attendancePercentage = participantRow.attendance_percentage as number | null;
  if (attendancePercentage === null || attendancePercentage < CERTIFICATE_ATTENDANCE_THRESHOLD) {
    throw new ApiError(403, 'NOT_ELIGIBLE', `participant ${participantId} has not met the ${CERTIFICATE_ATTENDANCE_THRESHOLD}% attendance threshold for a certificate`);
  }

  // The two templates encode the participant's grammatical gender directly into their prose
  // (المشارك/قد أتم vs. المشاركة/قد أتمت) — there is no gender-neutral fallback, so a missing
  // gender can't be silently guessed on an official document.
  const gender = participantRow.gender as 'male' | 'female' | null;
  if (gender !== 'male' && gender !== 'female') {
    throw new ApiError(422, 'MISSING_GENDER', `participant ${participantId} has no gender on file — required to pick the male/female certificate template`);
  }

  const startTime = workshopRow.start_time as string | null;
  const endTime = workshopRow.end_time as string | null;
  if (!startTime || !endTime) {
    throw new ApiError(422, 'MISSING_WORKSHOP_TIMES', `workshop ${workshopId} is missing start_time/end_time — cannot compute certificate training hours`);
  }

  const trainerRow = workshopRow.trainer_id ? await findRowById(trainerEntity, String(workshopRow.trainer_id)) : undefined;

  const start = parseIsoDate(workshopRow.start_date as string);
  const end = parseIsoDate(workshopRow.end_date as string);
  const totalHours = dailyHours(startTime, endTime) * dayCount(workshopRow.start_date as string, workshopRow.end_date as string);

  return {
    gender,
    participantName: participantRow.full_name_arabic as string,
    workshopName: workshopRow.workshop_name as string,
    trainerName: (trainerRow?.name_ar as string | null) ?? 'N/A',
    startDay: String(start.day),
    startMonth: MONTHS_AR[start.month - 1],
    endDay: String(end.day),
    endMonth: MONTHS_AR[end.month - 1],
    year: String(end.year),
    totalHours: formatHours(totalHours),
  };
}

// Every accepted participant meeting the attendance threshold — used by the bulk certificates.zip
// route. Participants with no gender or the workshop's missing start_time/end_time would fail
// generateCertificateContent's own checks; callers should skip those individually rather than
// letting one bad row 500 the whole batch.
export async function listEligibleParticipantIds(workshopId: string): Promise<string[]> {
  const participants = await findRowsByField(participantEntity, 'workshop_id', workshopId);
  return participants
    .filter((p) => p.status === 'accepted' && typeof p.attendance_percentage === 'number' && (p.attendance_percentage as number) >= CERTIFICATE_ATTENDANCE_THRESHOLD)
    .map((p) => p.participant_id as string);
}
