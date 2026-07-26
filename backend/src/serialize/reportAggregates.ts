import type { Row } from '../entities/index.js';

// --- Age buckets (18-24 / 25-30 / 30+) -------------------------------------

export interface AgeBuckets {
  age_18_24_count: number;
  age_25_30_count: number;
  age_30_plus_count: number;
}

function ageFromDob(dob: string, asOf: Date): number | null {
  const birth = new Date(dob + 'T00:00:00Z');
  if (Number.isNaN(birth.getTime())) return null;
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    asOf.getUTCMonth() > birth.getUTCMonth() ||
    (asOf.getUTCMonth() === birth.getUTCMonth() && asOf.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

// Buckets are computed among the accepted population (see report plan: real
// attendance is 0 pre-event, so demographic breakdowns count who was
// accepted, not who has attended yet). Participants with no/invalid
// date_of_birth are simply excluded from the buckets rather than guessed.
export function computeAgeBuckets(acceptedRows: Row[], asOf: Date = new Date()): AgeBuckets {
  const buckets: AgeBuckets = { age_18_24_count: 0, age_25_30_count: 0, age_30_plus_count: 0 };
  for (const row of acceptedRows) {
    const dob = row.date_of_birth as string | null;
    if (!dob) continue;
    const age = ageFromDob(dob, asOf);
    if (age === null) continue;
    if (age >= 18 && age <= 24) buckets.age_18_24_count++;
    else if (age >= 25 && age <= 30) buckets.age_25_30_count++;
    else if (age > 30) buckets.age_30_plus_count++;
  }
  return buckets;
}

// --- Track / specialization breakdown --------------------------------------

export interface TrackCount {
  label: string;
  count: number;
}

// The template's "عدد الحضور بحسب الخبرة في المجال" chart's own sample data
// shows a track name ("كتابة السيناريو") as its bar label, not an
// experience-level bucket — so this breaks accepted participants down by
// their `track` (specialization) field, sorted by count descending.
export function computeTrackBreakdown(acceptedRows: Row[]): TrackCount[] {
  const counts = new Map<string, number>();
  for (const row of acceptedRows) {
    const track = (row.track as string | null)?.trim();
    if (!track) continue;
    counts.set(track, (counts.get(track) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// --- Overall satisfaction ---------------------------------------------------
//
// Rebuilt around the org's current fixed 8-question survey (see
// backend/src/entities/feedback.ts) — the old ممتاز/محايد/ضعيف q1-q8 categorical model, and the
// free-text `reason`/`suggestions` fields it drove (testimonials/report notes/suggestions), no
// longer exist: the new survey has no open-text question at all. computeOverallRating now
// averages the "ما مستوى رضاك العام عن الورشة؟" question (stored as `overall_rating`, still a
// direct 1-5 scale) across every response.

export interface OverallRating {
  overall_rating_percent: number;
  overall_rating_label: string;
}

export function computeOverallRating(feedbackRows: Row[]): OverallRating {
  const scores = feedbackRows
    .map((r) => r.overall_rating as number | null)
    .filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);

  if (scores.length === 0) return { overall_rating_percent: 0, overall_rating_label: 'لا يوجد' };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const percent = Math.round((avg / 5) * 100);
  const label = percent >= 80 ? 'ممتاز' : percent >= 60 ? 'جيد' : percent >= 40 ? 'مقبول' : 'يحتاج تحسين';
  return { overall_rating_percent: percent, overall_rating_label: label };
}
