import type { RegionCode, WorkshopType, WorkshopStatus } from '../data/workshops';
import { defaultDateRange } from '../data/workshops';

export type RegionMetric = 'applications' | 'accepted' | 'attendance' | 'actual_attendance';

export type GenderFilter = 'male' | 'female' | null;

export interface Filters {
  dateRange: { start: string | null; end: string | null };
  region: RegionCode | null;
  workshopType: WorkshopType | null;
  gender: GenderFilter;
  status: WorkshopStatus | null;
  regionMetric: RegionMetric;
}

export const defaultFilters: Filters = {
  dateRange: { ...defaultDateRange },
  region: null,
  workshopType: null,
  gender: null,
  status: null,
  regionMetric: 'applications',
};

export const regionMetricLabels: Record<RegionMetric, string> = {
  applications: 'التسجيلات',
  accepted: 'المقبولين',
  attendance: 'الحضور',
  actual_attendance: 'الحضور الفعلي',
};

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.dateRange.start !== defaultFilters.dateRange.start ||
    filters.dateRange.end !== defaultFilters.dateRange.end ||
    filters.region !== null ||
    filters.workshopType !== null ||
    filters.gender !== null ||
    filters.status !== null
  );
}
