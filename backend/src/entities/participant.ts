import { z } from 'zod';
import {
  emptyToNull,
  cleanText,
  normalizePhone,
  mapGender,
  classifyNationality,
  normalizeCityToRegion,
  normalizeDateOfBirth,
  mapExperienceLevel,
  mapParticipantStatus,
  normalizeNationalId,
  computeAttendance,
  VALID_REGION_CODES,
  EXPERIENCE_LEVELS,
} from '../normalize.js';
import type { EntityDescriptor, MapRowResult, Row } from './types.js';

function toBoolOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === 'نعم' || s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'لا' || s === 'no' || s === 'false' || s === '0') return false;
  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export const participantSchema = z
  .object({
    participant_id: z.string().trim().min(1, 'participant_id is required'),
    workshop_id: z.string().trim().min(1, 'workshop_id is required'),
    full_name_arabic: z.string().trim().min(1, 'full_name_arabic is required'),
    full_name_en: z.string().nullable(),
    gender: z.enum(['male', 'female']).nullable(),
    nationality: z.string().nullable(),
    nationality_class: z.enum(['SA', 'non-SA']),
    national_id: z.string().nullable(),
    national_id_valid: z.boolean(),
    phone: z.string(),
    phone_verified: z.boolean(),
    email: z.email('email must be a valid address').toLowerCase(),
    city: z.string().nullable(),
    region_code: z.enum(VALID_REGION_CODES).nullable(),
    date_of_birth: z.string().nullable(),
    education_level: z.string().nullable(),
    skill_level: z.string().nullable(),
    experience_level: z.enum(EXPERIENCE_LEVELS),
    track: z.string().nullable(),
    current_role: z.string().nullable(),
    has_editing_exp: z.string().nullable(),
    editing_software: z.string().nullable(),
    how_heard: z.string().nullable(),
    application_date: z.string().nullable(),
    portfolio_url: z.string().nullable(),
    evaluation_score: z.number().min(0).max(100).nullable(),
    status: z.enum(['applicant', 'accepted', 'waitlist', 'rejected']),
    day_1: z.boolean().nullable(),
    day_2: z.boolean().nullable(),
    day_3: z.boolean().nullable(),
    day_4: z.boolean().nullable(),
    day_5: z.boolean().nullable(),
    sessions_attended: z.number().int().min(0).nullable(),
    total_sessions: z.number().int().min(0).nullable(),
    attendance_percentage: z.number().nullable(),
    attendance_status: z.string().nullable(),
    deleted_at: z.string().nullable().optional(),
  })
  .refine((v) => v.sessions_attended === null || v.total_sessions === null || v.sessions_attended <= v.total_sessions, {
    message: 'sessions_attended cannot exceed total_sessions',
    path: ['sessions_attended'],
  });

export function mapParticipantRow(raw: Row): MapRowResult {
  const warnings: string[] = [];

  const phoneResult = normalizePhone(raw.phone);
  if (phoneResult.warning) warnings.push(phoneResult.warning);

  const nationalIdResult = normalizeNationalId(raw.national_id);
  if (!nationalIdResult.nationalIdValid) {
    warnings.push(`national_id "${nationalIdResult.nationalId}" does not match the expected 10-digit Saudi format.`);
  }

  const cityRegion = normalizeCityToRegion(cleanText(raw.city), emptyToNull(raw.region_code));
  if (cityRegion.warning) warnings.push(cityRegion.warning);

  const dob = normalizeDateOfBirth(raw.date_of_birth);
  if (dob.warning) warnings.push(dob.warning);

  const sessionsAttended = toIntOrNull(raw.sessions_attended);
  const totalSessions = toIntOrNull(raw.total_sessions);
  const attendance = computeAttendance(sessionsAttended, totalSessions);

  const nationality = classifyNationality(raw.nationality);

  const row: Row = {
    participant_id: emptyToNull(raw.participant_id),
    workshop_id: emptyToNull(raw.workshop_id),
    full_name_arabic: cleanText(raw.full_name_arabic),
    full_name_en: cleanText(raw.full_name_en),
    gender: mapGender(raw.gender),
    nationality: nationality.raw,
    nationality_class: nationality.class,
    national_id: nationalIdResult.nationalId,
    national_id_valid: nationalIdResult.nationalIdValid,
    phone: phoneResult.phone,
    phone_verified: phoneResult.phoneVerified,
    email: emptyToNull(raw.email)?.toLowerCase() ?? '',
    city: cleanText(raw.city),
    region_code: cityRegion.region,
    date_of_birth: dob.dateOfBirth,
    education_level: cleanText(raw.education_level),
    skill_level: cleanText(raw.skill_level),
    experience_level: mapExperienceLevel(raw.experience_level),
    track: cleanText(raw.track),
    current_role: cleanText(raw.current_role),
    has_editing_exp: cleanText(raw.has_editing_exp),
    editing_software: cleanText(raw.editing_software),
    how_heard: cleanText(raw.how_heard),
    application_date: emptyToNull(raw.application_date),
    portfolio_url: cleanText(raw.portfolio_url),
    evaluation_score: raw.evaluation_score === null || raw.evaluation_score === undefined || raw.evaluation_score === '' ? null : Number(raw.evaluation_score),
    status: mapParticipantStatus(raw.status),
    day_1: toBoolOrNull(raw.day_1),
    day_2: toBoolOrNull(raw.day_2),
    day_3: toBoolOrNull(raw.day_3),
    day_4: toBoolOrNull(raw.day_4),
    day_5: toBoolOrNull(raw.day_5),
    sessions_attended: sessionsAttended,
    total_sessions: totalSessions,
    attendance_percentage: attendance.attendancePercentage,
    attendance_status: attendance.attendanceStatus,
    deleted_at: emptyToNull(raw.deleted_at),
  };

  return { row, warnings };
}

export const participantEntity: EntityDescriptor = {
  name: 'participants',
  folder: 'participants',
  idField: 'participant_id',
  columns: [
    'participant_id',
    'workshop_id',
    'full_name_arabic',
    'full_name_en',
    'gender',
    'nationality',
    'nationality_class',
    'national_id',
    'national_id_valid',
    'phone',
    'phone_verified',
    'email',
    'city',
    'region_code',
    'date_of_birth',
    'education_level',
    'skill_level',
    'experience_level',
    'track',
    'current_role',
    'has_editing_exp',
    'editing_software',
    'how_heard',
    'application_date',
    'portfolio_url',
    'evaluation_score',
    'status',
    'day_1',
    'day_2',
    'day_3',
    'day_4',
    'day_5',
    'sessions_attended',
    'total_sessions',
    'attendance_percentage',
    'attendance_status',
  ],
  schema: participantSchema,
  mapRow: mapParticipantRow,
  uniqueKeys: [['participant_id'], ['workshop_id', 'email']],
  uniqueKeysWhenPresent: [['workshop_id', 'national_id']],
  fk: [{ field: 'workshop_id', targetEntity: 'workshops' }],
  importFallbackMatch: [
    ['workshop_id', 'national_id'],
    ['workshop_id', 'email'],
  ],
  attachmentsDir: async (row: Row) => `participants/attachments/${String(row.participant_id)}`,
};
