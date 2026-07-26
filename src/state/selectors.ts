import {
  focusRegionMeta,
  regionColors,
  workshopTypeMeta,
  workshopTypeTarget,
  type RegionCode,
  type Workshop,
  type WorkshopType,
  type WorkshopPhase,
  type WorkshopParticipant,
} from '../data/workshops';
import type { Filters, GenderFilter, RegionMetric } from './filters';

function overlaps(wStart: string, wEnd: string, fStart: string | null, fEnd: string | null): boolean {
  if (fStart && wEnd < fStart) return false;
  if (fEnd && wStart > fEnd) return false;
  return true;
}

// The real current date is authoritative: a workshop whose end_date has already passed is
// "completed" regardless of what the source data's `status` column says (an Excel column can go
// stale; the calendar can't). `status === 'completed'` is still honored on its own so a workshop
// explicitly closed out early (e.g. cancelled) doesn't wait for its dates to pass. Receiving even
// one post-workshop rating is treated the same way — a satisfaction survey response is only ever
// collected after the workshop actually ran, so it's stronger evidence than the calendar itself
// (e.g. a workshop whose organizer already imported its ratings sheet ahead of its recorded
// end_date, or whose dates in the source data are simply wrong). No ratings yet leaves a
// currently-active workshop active — only the date/status rules below apply in that case.
function hasAnyRatings(workshop: Workshop): boolean {
  return (
    workshop.rating_1_count + workshop.rating_2_count + workshop.rating_3_count + workshop.rating_4_count + workshop.rating_5_count > 0
  );
}

export function getWorkshopPhase(workshop: Workshop): WorkshopPhase {
  const now = new Date().toISOString().slice(0, 10);
  if (workshop.status === 'completed' || workshop.end_date < now || hasAnyRatings(workshop)) return 'completed';
  if (workshop.start_date <= now && now <= workshop.end_date) return 'ongoing';
  return 'scheduled';
}

export const CERTIFICATE_ATTENDANCE_THRESHOLD = 80;

export function getParticipantAttendance(participant: WorkshopParticipant) {
  const total = participant.sessionAttendance.length;
  const attended = participant.sessionAttendance.filter(Boolean).length;
  const missed = total - attended;
  const percentage = total === 0 ? 0 : (attended / total) * 100;
  return { attended, missed, total, percentage };
}

export function isCertificateEligible(participant: WorkshopParticipant): boolean {
  return getParticipantAttendance(participant).percentage >= CERTIFICATE_ATTENDANCE_THRESHOLD;
}

type FilterOptions = { excludeRegion?: boolean; excludeType?: boolean };

export function filterWorkshops(workshops: Workshop[], filters: Filters, options: FilterOptions = {}): Workshop[] {
  return workshops.filter((w) => {
    if (!overlaps(w.start_date, w.end_date, filters.dateRange.start, filters.dateRange.end)) return false;
    if (!options.excludeRegion && filters.region && w.region !== filters.region) return false;
    if (!options.excludeType && filters.workshopType && w.workshop_type !== filters.workshopType) return false;
    if (filters.status && w.status !== filters.status) return false;
    return true;
  });
}

export type GenderCount = { total: number; male: number; female: number };

function sumField(workshops: Workshop[], totalKey: keyof Workshop, maleKey: keyof Workshop, femaleKey: keyof Workshop): GenderCount {
  let total = 0;
  let male = 0;
  let female = 0;
  for (const w of workshops) {
    total += w[totalKey] as number;
    male += w[maleKey] as number;
    female += w[femaleKey] as number;
  }
  return { total, male, female };
}

export interface Kpis {
  registrations: GenderCount;
  accepted: GenderCount;
  attendance: GenderCount;
  actualAttendance: GenderCount;
}

export function computeKpis(filtered: Workshop[]): Kpis {
  return {
    registrations: sumField(filtered, 'total_applications', 'male_applications', 'female_applications'),
    accepted: sumField(filtered, 'total_accepted', 'male_accepted', 'female_accepted'),
    attendance: sumField(filtered, 'total_attendance', 'male_attendance', 'female_attendance'),
    actualAttendance: sumField(filtered, 'actual_attendance', 'male_actual_attendance', 'female_actual_attendance'),
  };
}

export function pickGenderValue(count: GenderCount, gender: GenderFilter): number {
  if (gender === 'male') return count.male;
  if (gender === 'female') return count.female;
  return count.total;
}

const metricFields: Record<RegionMetric, keyof Workshop> = {
  applications: 'total_applications',
  accepted: 'total_accepted',
  attendance: 'total_attendance',
  actual_attendance: 'actual_attendance',
};

export interface RegionRow {
  code: RegionCode;
  name: string;
  value: number;
  color: string;
  workshopCount: number;
}

export function computeRegionBreakdown(
  workshops: Workshop[],
  filters: Filters,
  metric: RegionMetric,
): RegionRow[] {
  const scoped = filterWorkshops(workshops, filters, { excludeRegion: true });
  const field = metricFields[metric];
  const totals = new Map<RegionCode, number>();
  const counts = new Map<RegionCode, number>();
  for (const r of focusRegionMeta) {
    totals.set(r.code, 0);
    counts.set(r.code, 0);
  }
  for (const w of scoped) {
    if (!totals.has(w.region)) continue; // outside the 4 focus regions — not tracked here
    totals.set(w.region, (totals.get(w.region) ?? 0) + (w[field] as number));
    counts.set(w.region, (counts.get(w.region) ?? 0) + 1);
  }
  const rows = focusRegionMeta.map((r) => ({
    code: r.code,
    name: r.name,
    value: totals.get(r.code) ?? 0,
    workshopCount: counts.get(r.code) ?? 0,
  }));
  return rows.map((r) => ({ ...r, color: regionColors[r.code] })).sort((a, b) => b.value - a.value);
}

export interface TypeRow {
  key: WorkshopType;
  label: string;
  color: string;
  done: number;
  total: number;
  target: number;
}

export function computeTypeBreakdown(workshops: Workshop[], filters: Filters): TypeRow[] {
  const scoped = filterWorkshops(workshops, filters, { excludeType: true });
  return workshopTypeMeta.map((t) => {
    const ofType = scoped.filter((w) => w.workshop_type === t.key);
    const done = ofType.filter((w) => getWorkshopPhase(w) === 'completed').length;
    return { key: t.key, label: t.label, color: t.color, done, total: ofType.length, target: workshopTypeTarget[t.key] };
  });
}

export interface RatingBreakdownRow {
  stars: 5 | 4 | 3 | 2 | 1;
  count: number;
  percent: number;
}

export interface Ratings {
  average: number;
  total: number;
  breakdown: RatingBreakdownRow[];
}

export function computeRatings(filtered: Workshop[]): Ratings {
  const counts = [0, 0, 0, 0, 0, 0]; // index 1..5
  for (const w of filtered) {
    counts[1] += w.rating_1_count;
    counts[2] += w.rating_2_count;
    counts[3] += w.rating_3_count;
    counts[4] += w.rating_4_count;
    counts[5] += w.rating_5_count;
  }
  const total = counts[1] + counts[2] + counts[3] + counts[4] + counts[5];
  const weightedSum = counts[1] * 1 + counts[2] * 2 + counts[3] * 3 + counts[4] * 4 + counts[5] * 5;
  const average = total === 0 ? 0 : weightedSum / total;
  const breakdown: RatingBreakdownRow[] = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: counts[stars],
    percent: total === 0 ? 0 : Math.round((counts[stars] / total) * 100),
  }));
  return { average, total, breakdown };
}

export function splitUpcomingCompleted(filtered: Workshop[]): { upcoming: Workshop[]; completed: Workshop[] } {
  const upcoming = filtered
    .filter((w) => getWorkshopPhase(w) !== 'completed')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const completed = filtered
    .filter((w) => getWorkshopPhase(w) === 'completed')
    .sort((a, b) => b.end_date.localeCompare(a.end_date));
  return { upcoming, completed };
}
