import { z } from 'zod';
import { emptyToNull, cleanText, normalizePhone, mapGender, normalizeDateOfBirth } from '../normalize.js';
import type { EntityDescriptor, MapRowResult, Row } from './types.js';

// The org's fixed 8-question post-workshop survey (replaces the old q1-q8 "ممتاز/محايد/ضعيف"
// set). Raw imports come from an external survey tool (see PROMPT context: "responses
// dummy.xlsx") whose export headers are the literal Arabic question text plus a handful of
// English metadata columns (Response Type, Start/Submit Date (UTC), Network ID, Tags, Ending) —
// mapRow reads those verbatim. Every field also falls back to its own canonical column name (via
// `pick` below) so re-reading our *own* already-normalized master workbook (which is always
// written back out with canonical headers, never the original import headers) still works —
// mapRow must stay idempotent since store.ts re-runs it on every read, not just on import.

const YES_NO_PARTIAL = ['نعم', 'نعم جزئياً', 'لا'] as const;
const YES_NO_MAYBE = ['نعم', 'ربما', 'لا'] as const;

function pick(raw: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function mapEnumOrNull<T extends readonly string[]>(value: unknown, options: T): T[number] | null {
  const s = emptyToNull(value);
  return s && (options as readonly string[]).includes(s) ? (s as T[number]) : null;
}

export const feedbackSchema = z.object({
  feedback_id: z.string().trim().min(1, 'feedback_id is required'),
  workshop_id: z.string().trim().min(1, 'workshop_id is required'),
  participant_id: z.string().nullable(),

  // Respondent identity as sent by the survey tool — informational / for the admin's manual
  // participant_id linking, not itself matched against the participants table (mapRow has no DB
  // access; matching happens, if at all, through the same admin staging review flow used for
  // participant/workshop imports with no id column of their own).
  respondent_name: z.string().nullable(),
  respondent_email: z.string().nullable(),
  respondent_phone: z.string().nullable(),
  respondent_gender: z.enum(['male', 'female']).nullable(),
  respondent_dob: z.string().nullable(),
  workshop_name_raw: z.string().nullable(),

  overall_rating: z.number().int().min(1).max(5).nullable(),
  trainer_quality: z.number().int().min(1).max(5).nullable(),
  content_quality: z.number().int().min(1).max(5).nullable(),
  gained_knowledge: z.enum(YES_NO_PARTIAL).nullable(),
  intends_to_apply: z.enum(YES_NO_MAYBE).nullable(),
  professional_connections: z.number().int().min(0).nullable(),
  current_skill_level: z.number().int().min(1).max(5).nullable(),
  confidence_level: z.number().int().min(1).max(5).nullable(),

  // Open-ended, added when the survey grew two free-text questions (comments/suggestions) beyond
  // the original fixed 8-question set — nullable since every response collected before that
  // change has neither.
  comments: z.string().nullable(),
  suggestions: z.string().nullable(),

  response_status: z.string().nullable(),
  started_at: z.string().nullable(),
  submitted_at: z.string().nullable(),
  external_response_id: z.string().nullable(),
  tags: z.string().nullable(),
  deleted_at: z.string().nullable().optional(),
});

export function mapFeedbackRow(raw: Row): MapRowResult {
  const warnings: string[] = [];

  const phoneRaw = pick(raw, 'respondent_phone', 'رقم الجوال');
  const phoneResult = normalizePhone(phoneRaw);
  if (phoneRaw && phoneResult.warning) warnings.push(phoneResult.warning);

  const dobRaw = pick(raw, 'respondent_dob', 'تاريخ الميلاد');
  const dob = normalizeDateOfBirth(dobRaw);
  if (dobRaw && dob.warning) warnings.push(dob.warning);

  const row: Row = {
    feedback_id: emptyToNull(raw.feedback_id),
    workshop_id: emptyToNull(pick(raw, 'workshop_id')),
    participant_id: emptyToNull(pick(raw, 'participant_id')),

    respondent_name: cleanText(pick(raw, 'respondent_name', 'الاسم الثلاثي')),
    respondent_email: (emptyToNull(pick(raw, 'respondent_email', 'البريد الالكتروني')) ?? '').toLowerCase() || null,
    respondent_phone: phoneRaw ? phoneResult.phone : null,
    respondent_gender: mapGender(pick(raw, 'respondent_gender', 'الجنس')),
    respondent_dob: dob.dateOfBirth,
    workshop_name_raw: cleanText(pick(raw, 'workshop_name_raw', 'اسم الورشة التدريبية؟')),

    overall_rating: toIntOrNull(pick(raw, 'overall_rating', 'ما مستوى رضاك العام عن الورشة؟')),
    trainer_quality: toIntOrNull(pick(raw, 'trainer_quality', 'ما تقييمك لجودة المدرب؟')),
    content_quality: toIntOrNull(pick(raw, 'content_quality', 'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟')),
    gained_knowledge: mapEnumOrNull(pick(raw, 'gained_knowledge', 'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟'), YES_NO_PARTIAL),
    intends_to_apply: mapEnumOrNull(pick(raw, 'intends_to_apply', 'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟'), YES_NO_MAYBE),
    professional_connections: toIntOrNull(pick(raw, 'professional_connections', 'كم عدد العلاقات المهنية المكتسبة من الورشة؟')),
    current_skill_level: toIntOrNull(pick(raw, 'current_skill_level', 'قيّم مهاراتك الحالية في موضوع الورشة')),
    confidence_level: toIntOrNull(pick(raw, 'confidence_level', 'قيّم ثقتك في تطبيق المهارات الآن')),

    comments: cleanText(pick(raw, 'comments', 'هل لديك أي آراء أو ملاحظات إضافية تود مشاركتها حول البرنامج أو الورشة؟')),
    suggestions: cleanText(pick(raw, 'suggestions', 'هل لديك أي اقتراحات تسهم في تطوير وتحسين البرنامج أو الورش المستقبلية؟')),

    response_status: cleanText(pick(raw, 'response_status', 'Response Type')),
    started_at: emptyToNull(pick(raw, 'started_at', 'Start Date (UTC)')),
    submitted_at: emptyToNull(pick(raw, 'submitted_at', 'Submit Date (UTC)')),
    external_response_id: emptyToNull(pick(raw, 'external_response_id', 'Network ID')),
    tags: cleanText(pick(raw, 'tags', 'Tags')),
    deleted_at: emptyToNull(raw.deleted_at),
  };

  return { row, warnings };
}

export const feedbackEntity: EntityDescriptor = {
  name: 'feedback',
  folder: 'feedback',
  idField: 'feedback_id',
  columns: [
    'feedback_id',
    'workshop_id',
    'participant_id',
    'respondent_name',
    'respondent_email',
    'respondent_phone',
    'respondent_gender',
    'respondent_dob',
    'workshop_name_raw',
    'overall_rating',
    'trainer_quality',
    'content_quality',
    'gained_knowledge',
    'intends_to_apply',
    'professional_connections',
    'current_skill_level',
    'confidence_level',
    'comments',
    'suggestions',
    'response_status',
    'started_at',
    'submitted_at',
    'external_response_id',
    'tags',
  ],
  schema: feedbackSchema,
  mapRow: mapFeedbackRow,
  uniqueKeys: [['feedback_id']],
  uniqueKeysWhenPresent: [['external_response_id']],
  fk: [{ field: 'workshop_id', targetEntity: 'workshops' }],
  importFallbackMatch: [['external_response_id'], ['workshop_id', 'respondent_email']],
  // Lets adminStaging.ts's detectEntityByHeaders recognize a raw survey-tool export as a
  // "feedback" upload even though its sheet name won't match ENTITY_SHEET_ALIASES and its
  // headers are literal question text, not this entity's canonical column names.
  importHeaderAliases: [
    'الاسم الثلاثي',
    'البريد الالكتروني',
    'رقم الجوال',
    'الجنس',
    'تاريخ الميلاد',
    'اسم الورشة التدريبية؟',
    'ما مستوى رضاك العام عن الورشة؟',
    'ما تقييمك لجودة المدرب؟',
    'ما تقييمك لجودة المحتوى وقابليته للتطبيق؟',
    'هل اكتسبت معرفة أو مهارة جديدة من الورشة؟',
    'هل تنوي تطبيق ما تعلمته في عمل أو مشروع قريب؟',
    'كم عدد العلاقات المهنية المكتسبة من الورشة؟',
    'قيّم مهاراتك الحالية في موضوع الورشة',
    'قيّم ثقتك في تطبيق المهارات الآن',
    'هل لديك أي آراء أو ملاحظات إضافية تود مشاركتها حول البرنامج أو الورشة؟',
    'هل لديك أي اقتراحات تسهم في تطوير وتحسين البرنامج أو الورش المستقبلية؟',
    'Response Type',
    'Start Date (UTC)',
    'Submit Date (UTC)',
    'Network ID',
    'Tags',
  ],
};
