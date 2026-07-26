import type { Row } from '../entities/index.js';
import { trainerEntity, workshopEntity } from '../entities/index.js';
import { findActiveRows, findRowsByField } from '../store.js';
import { findTrainerPhoto } from '../mediaPaths.js';
import { findMoviePosterUrl } from '../tmdb.js';

// Mirrors the categorization already used by the frontend's own `nationalities` list
// (src/data/trainers.ts) so a trainer's KPI bucket (local/regional/international) matches.
const NATIONALITY_CATEGORY: Record<string, 'local' | 'regional' | 'international'> = {
  SA: 'local',
  EG: 'regional',
  JO: 'regional',
  AE: 'regional',
  KW: 'regional',
  QA: 'regional',
  BH: 'regional',
  OM: 'regional',
  MA: 'regional',
  LB: 'regional',
  TN: 'regional',
  IQ: 'regional',
};

function parseExperienceYears(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

// Raw workbook columns store these as free-text lists (Arabic separators — "؛" for notable_works,
// "،" for accounts) rather than structured data, so they're parsed here rather than at import time
// to keep the raw row a faithful copy of the source workbook.
function splitList(raw: unknown, separator: RegExp): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

// e.g. "Moon Knight (2022)؛ الفيل الأزرق" -> [{ title: "Moon Knight", year: 2022 }, { title: "الفيل الأزرق" }]
function parseNotableWorks(raw: unknown, role: string) {
  return splitList(raw, /[؛;]/).map((entry) => {
    const match = entry.match(/^(.*?)\s*\((\d{4})\)$/);
    return match ? { title: match[1].trim(), year: Number(match[2]), role } : { title: entry, role };
  });
}

// Looks each notable work up on TMDB (in parallel) to attach a real poster image — best-effort:
// titles that don't match anything (or that fail the request) just keep no poster, since these
// are free-text names from the workbook, not guaranteed to be real/findable film titles.
async function attachPosters<T extends { title: string; year?: number }>(projects: T[]): Promise<(T & { poster: string | null })[]> {
  return Promise.all(
    projects.map(async (p) => ({ ...p, poster: await findMoviePosterUrl(p.title, p.year) })),
  );
}

// The workbook records one free-text award phrase per trainer (sometimes with a year embedded,
// e.g. "جائزة الأوسكار المصرية 2024 عن..."); surfaced as a single-item list rather than force-split
// into title/organization since the source text doesn't cleanly separate those.
function parseAward(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const yearMatch = raw.match(/(19|20)\d{2}/);
  return [{ title: raw.trim(), year: yearMatch ? Number(yearMatch[0]) : undefined }];
}

// Folds the membership/experience/festival columns into the biography paragraph (نبذة مهنية)
// instead of the expertise list, since they read as prose rather than discrete skills.
function buildBiography(row: Row): string | undefined {
  const sentences: string[] = [];
  const bio = row.bio;
  if (typeof bio === 'string' && bio.trim()) sentences.push(bio.trim());
  const membership = row.professional_membership;
  if (typeof membership === 'string' && membership.trim()) sentences.push(membership.trim());
  const years = row.years_experience;
  const field = row.field;
  if (typeof years === 'string' && years.trim() && typeof field === 'string' && field.trim()) {
    sentences.push(`${years.trim()} في مجال ${field.trim()}`);
  } else if (typeof field === 'string' && field.trim()) {
    sentences.push(field.trim());
  }
  const festivals = row.festival_recognition;
  if (typeof festivals === 'string' && festivals.trim()) sentences.push(`حضور في المهرجانات: ${festivals.trim()}`);
  if (sentences.length === 0) return undefined;
  return sentences.map((s) => (/[.!؟?]$/.test(s) ? s : `${s}.`)).join(' ');
}

export async function serializeTrainer(row: Row) {
  const workshops = await findRowsByField(workshopEntity, 'trainer_id', String(row.trainer_id));
  const nationalityCode = String(row.nationality_code ?? '');

  const photo = findTrainerPhoto(String(row.trainer_id));
  const projects = await attachPosters(parseNotableWorks(row.notable_works, row.field ? String(row.field) : ''));

  return {
    id: row.trainer_id,
    fullName: row.name_ar,
    profileImage: photo?.url ?? null,
    position: row.field ?? '',
    nationality: row.nationality ?? '',
    nationalityCode,
    category: NATIONALITY_CATEGORY[nationalityCode] ?? 'regional',
    email: '',
    phone: row.contact ?? undefined,
    company: undefined,
    biography: buildBiography(row),
    experienceYears: parseExperienceYears(row.years_experience as string | null),
    education: undefined,
    certifications: undefined,
    expertise: [],
    projects,
    awards: parseAward(row.award),
    accounts: splitList(row.accounts, /[،,]/),
    portfolioLinks: undefined,
    cvDocument: undefined,
    passportDocument: undefined,
    workshops: workshops.map((w) => ({
      id: w.workshop_id,
      name: w.workshop_name,
      workshopType: w.workshop_type,
      field: w.field,
      year: Number(String(w.start_date ?? '').slice(0, 4)) || null,
      city: w.city,
      region: w.region_code,
    })),
  };
}

export async function serializeAllTrainers() {
  const rows = await findActiveRows(trainerEntity);
  return Promise.all(rows.map(serializeTrainer));
}
