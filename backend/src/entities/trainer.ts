import { z } from 'zod';
import { emptyToNull, cleanText } from '../normalize.js';
import type { EntityDescriptor, MapRowResult, Row } from './types.js';

export const trainerSchema = z.object({
  trainer_id: z.string().regex(/^TR-\d{3,}$/, 'trainer_id must match TR-### (3+ digits)'),
  name_ar: z.string().trim().min(1, 'name_ar is required'),
  name_en: z.string().nullable(),
  email: z.string().nullable(),
  position_title: z.string().nullable(),
  nationality: z.string().nullable(),
  nationality_code: z.string().regex(/^[A-Z]{2}$/, 'nationality_code must be 2 uppercase ISO-3166 letters'),
  field: z.string().nullable(),
  years_experience: z.string().nullable(),
  professional_membership: z.string().nullable(),
  accounts: z.string().nullable(),
  bio: z.string().nullable(),
  notable_works: z.string().nullable(),
  festival_recognition: z.string().nullable(),
  award: z.string().nullable(),
  contact: z.string().nullable(),
  profile_image: z.string().nullable(),
  passport_photo: z.string().nullable(),
  deleted_at: z.string().nullable().optional(),
});

export function mapTrainerRow(raw: Row): MapRowResult {
  const warnings: string[] = [];
  const nationalityCode = emptyToNull(raw.nationality_code);
  if (nationalityCode && !/^[A-Za-z]{2}$/.test(nationalityCode)) {
    warnings.push(`nationality_code "${nationalityCode}" does not look like a 2-letter ISO code.`);
  }

  const row: Row = {
    trainer_id: emptyToNull(raw.trainer_id),
    name_ar: cleanText(raw.name_ar),
    name_en: cleanText(raw.name_en),
    email: cleanText(raw.email),
    position_title: cleanText(raw.position_title),
    nationality: cleanText(raw.nationality),
    nationality_code: nationalityCode ? nationalityCode.toUpperCase() : null,
    field: cleanText(raw.field),
    years_experience: cleanText(raw.years_experience),
    professional_membership: cleanText(raw.professional_membership),
    accounts: cleanText(raw.accounts),
    bio: cleanText(raw.bio),
    notable_works: cleanText(raw.notable_works),
    festival_recognition: cleanText(raw.festival_recognition),
    award: cleanText(raw.award),
    contact: cleanText(raw.contact),
    profile_image: emptyToNull(raw.profile_image),
    passport_photo: emptyToNull(raw.passport_photo),
    deleted_at: emptyToNull(raw.deleted_at),
  };

  return { row, warnings };
}

export const trainerEntity: EntityDescriptor = {
  name: 'trainers',
  folder: 'trainers',
  idField: 'trainer_id',
  columns: [
    'trainer_id',
    'name_ar',
    'name_en',
    'email',
    'position_title',
    'nationality',
    'nationality_code',
    'field',
    'years_experience',
    'professional_membership',
    'accounts',
    'bio',
    'notable_works',
    'festival_recognition',
    'award',
    'contact',
    'profile_image',
    'passport_photo',
  ],
  schema: trainerSchema,
  mapRow: mapTrainerRow,
  uniqueKeys: [['trainer_id']],
  restrictDeleteIfReferencedBy: [{ entity: 'workshops', field: 'trainer_id' }],
  attachmentsDir: 'trainers/documents',
};
