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

// Handles three notable-works formats seen in the workbooks, tried in order:
//   1. "Arabic Title (English Title) – 2010" — trainer's own display title plus an English
//      title for TMDB lookup (which indexes almost everything in English), and the release year.
//   2. "Title – 2010" — title and year, no separate English title.
//   3. "Moon Knight (2022)" — the original format, year directly in parens with no dash.
// e.g. "حرائق (Incendies) – 2010" -> { title: "حرائق", searchTitle: "Incendies", year: 2010 }
function parseNotableWorks(raw: unknown, role: string) {
  return splitList(raw, /[؛;]/).map((entry) => {
    const withEnglishTitle = entry.match(/^(.+?)\s*\(([^)]+)\)\s*[–—-]\s*(\d{4})$/);
    if (withEnglishTitle) {
      return { title: withEnglishTitle[1].trim(), searchTitle: withEnglishTitle[2].trim(), year: Number(withEnglishTitle[3]), role };
    }
    const withDash = entry.match(/^(.+?)\s*[–—-]\s*(\d{4})$/);
    if (withDash) {
      return { title: withDash[1].trim(), year: Number(withDash[2]), role };
    }
    const yearInParens = entry.match(/^(.*?)\s*\((\d{4})\)$/);
    if (yearInParens) {
      return { title: yearInParens[1].trim(), year: Number(yearInParens[2]), role };
    }
    return { title: entry, role };
  });
}

// Looks each notable work up on TMDB (in parallel) to attach a real poster image — best-effort:
// titles that don't match anything (or that fail the request) just keep no poster, since these
// are free-text names from the workbook, not guaranteed to be real/findable film titles. Prefers
// `searchTitle` (the English title, when the workbook provided one) over the Arabic display title
// since TMDB's catalog is indexed in English and rarely matches Arabic titles directly.
async function attachPosters<T extends { title: string; searchTitle?: string; year?: number }>(projects: T[]): Promise<(T & { poster: string | null })[]> {
  return Promise.all(
    projects.map(async (p) => ({ ...p, poster: await findMoviePosterUrl(p.searchTitle ?? p.title, p.year) })),
  );
}

// `passport_photo` is a plain filename in the workbook (matching how `profile_image` works) —
// resolved against the same `trainers/documents` folder the entity already declares as its
// attachments dir, unless it's already a full URL. Returns undefined (not null) so it can be
// spread directly into the serialized trainer without overriding a real value with null.
function resolvePassportUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  return `/files/trainers/documents/${value}`;
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
    position: row.position_title ?? row.field ?? '',
    nationality: row.nationality ?? '',
    nationalityCode,
    category: NATIONALITY_CATEGORY[nationalityCode] ?? 'regional',
    email: row.email ?? '',
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
    passportDocument: resolvePassportUrl(row.passport_photo),
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
