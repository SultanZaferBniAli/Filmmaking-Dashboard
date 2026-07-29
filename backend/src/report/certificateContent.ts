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

// Fixed org policy (confirmed rather than derived from workshop start_time/end_time): every
// workshop day counts as 4 training hours, regardless of the actual daily schedule. Certificate
// hours are prorated by the individual participant's own attendance — a 5-day workshop attended
// in full is 20 hours; attended 4 of 5 days (still ≥80%, so still certificate-eligible) is 16.
const HOURS_PER_DAY = 4;

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

  const sessionsAttended = participantRow.sessions_attended as number | null;
  if (sessionsAttended === null) {
    throw new ApiError(422, 'MISSING_ATTENDANCE', `participant ${participantId} has no sessions_attended on file — cannot compute certificate training hours`);
  }

  const trainerRow = workshopRow.trainer_id ? await findRowById(trainerEntity, String(workshopRow.trainer_id)) : undefined;

  const start = parseIsoDate(workshopRow.start_date as string);
  const end = parseIsoDate(workshopRow.end_date as string);
  const totalHours = HOURS_PER_DAY * sessionsAttended;

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
// route. Participants with no gender or no sessions_attended would fail generateCertificateContent's
// own checks; callers should skip those individually rather than letting one bad row 500 the whole
// batch.
export async function listEligibleParticipantIds(workshopId: string): Promise<string[]> {
  const participants = await findRowsByField(participantEntity, 'workshop_id', workshopId);
  return participants
    .filter((p) => p.status === 'accepted' && typeof p.attendance_percentage === 'number' && (p.attendance_percentage as number) >= CERTIFICATE_ATTENDANCE_THRESHOLD)
    .map((p) => p.participant_id as string);
}
