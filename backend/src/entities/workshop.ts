import { z } from 'zod';
import { emptyToNull, cleanText, isValidRegionCode, VALID_REGION_CODES } from '../normalize.js';
import type { EntityDescriptor, MapRowResult, Row } from './types.js';

// The dashboard's actual WorkshopType (6 values) and LocationType (2 values) are distinct
// unions in the frontend contract — the build-backend brief's "workshop_type / location_type:
// enum in-person | virtual" line conflates them (true only for the one real workshop, which
// happens to be in-person on both fields). Validating workshop_type against the narrower
// 2-value set would reject legitimate values the existing "Add Workshop" form already offers
// (masterclass/specialized/residency/btl), so each field keeps its own correct enum here.
const WORKSHOP_TYPES = ['in-person', 'virtual', 'masterclass', 'specialized', 'residency', 'btl'] as const;
const LOCATION_TYPES = ['in-person', 'virtual'] as const;
const LANGUAGES = ['العربية', 'الإنجليزية'] as const;
const LEVELS = ['مبتدئ', 'متوسط', 'متقدم'] as const;
const STATUSES = ['upcoming', 'completed'] as const;

const timePattern = /^\d{2}:\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const workshopSchema = z
  .object({
    workshop_id: z.string().regex(/^WS-\d{3,}$/, 'workshop_id must match WS-### (3+ digits)'),
    workshop_name: z.string().trim().min(1, 'workshop_name is required'),
    workshop_type: z.enum(WORKSHOP_TYPES),
    field: z.string().trim().min(1, 'field is required'),
    year: z.number().int().nullable(),
    region_code: z.enum(VALID_REGION_CODES, { message: 'region must be one of the 13 known KSA region codes' }),
    region_name: z.string().nullable(),
    city: z.string().trim().min(1, 'city is required'),
    location_type: z.enum(LOCATION_TYPES),
    location_name: z.string().nullable(),
    location_link: z.string().nullable(),
    start_date: z.string().regex(datePattern, 'start_date must be ISO YYYY-MM-DD'),
    end_date: z.string().regex(datePattern, 'end_date must be ISO YYYY-MM-DD'),
    start_time: z.string().regex(timePattern).nullable(),
    end_time: z.string().regex(timePattern).nullable(),
    language: z.enum(LANGUAGES).nullable(),
    level: z.enum(LEVELS).nullable(),
    capacity: z.number().int().min(0).nullable(),
    trainer_id: z.string().trim().min(1, 'trainer_id is required'),
    status: z.enum(STATUSES),
    description: z.string().nullable(),
    themes: z.string().nullable(),
    workshop_image: z.string().nullable(),
    deleted_at: z.string().nullable().optional(),
  })
  .refine((v) => v.start_date <= v.end_date, { message: 'start_date must be on or before end_date', path: ['start_date'] });

export function mapWorkshopRow(raw: Row): MapRowResult {
  const warnings: string[] = [];
  const regionCodeRaw = emptyToNull(raw.region_code);
  if (regionCodeRaw && !isValidRegionCode(regionCodeRaw)) {
    warnings.push(`Unknown region_code "${regionCodeRaw}" — left as-is for validation to reject.`);
  }

  const row: Row = {
    workshop_id: emptyToNull(raw.workshop_id),
    workshop_name: cleanText(raw.workshop_name),
    workshop_type: emptyToNull(raw.workshop_type),
    field: cleanText(raw.field),
    year: raw.year === null || raw.year === undefined || raw.year === '' ? null : Number(raw.year),
    region_code: regionCodeRaw,
    region_name: cleanText(raw.region_name),
    city: cleanText(raw.city),
    location_type: emptyToNull(raw.location_type),
    location_name: cleanText(raw.location_name),
    location_link: cleanText(raw.location_link),
    start_date: emptyToNull(raw.start_date),
    end_date: emptyToNull(raw.end_date),
    start_time: emptyToNull(raw.start_time),
    end_time: emptyToNull(raw.end_time),
    language: emptyToNull(raw.language),
    level: emptyToNull(raw.level),
    capacity: raw.capacity === null || raw.capacity === undefined || raw.capacity === '' ? null : Number(raw.capacity),
    trainer_id: emptyToNull(raw.trainer_id),
    status: emptyToNull(raw.status) ?? 'upcoming',
    description: cleanText(raw.description),
    themes: cleanText(raw.themes),
    workshop_image: emptyToNull(raw.workshop_image),
    deleted_at: emptyToNull(raw.deleted_at),
  };

  return { row, warnings };
}

export const workshopEntity: EntityDescriptor = {
  name: 'workshops',
  folder: 'workshops',
  idField: 'workshop_id',
  columns: [
    'workshop_id',
    'workshop_name',
    'workshop_type',
    'field',
    'year',
    'region_code',
    'region_name',
    'city',
    'location_type',
    'location_name',
    'location_link',
    'start_date',
    'end_date',
    'start_time',
    'end_time',
    'language',
    'level',
    'capacity',
    'trainer_id',
    'status',
    'description',
    'themes',
    'workshop_image',
  ],
  schema: workshopSchema,
  mapRow: mapWorkshopRow,
  uniqueKeys: [['workshop_id']],
  fk: [{ field: 'trainer_id', targetEntity: 'trainers' }],
  restrictDeleteIfReferencedBy: [
    { entity: 'participants', field: 'workshop_id' },
    { entity: 'feedback', field: 'workshop_id' },
  ],
};
