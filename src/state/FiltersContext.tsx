import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RegionCode, WorkshopType, WorkshopStatus } from '../data/workshops';
import { defaultFilters, type Filters, type GenderFilter, type RegionMetric } from './filters';

interface FiltersContextValue {
  filters: Filters;
  setDateRange: (start: string | null, end: string | null) => void;
  setRegion: (region: RegionCode | null) => void;
  toggleRegion: (region: RegionCode) => void;
  setWorkshopType: (type: WorkshopType | null) => void;
  toggleWorkshopType: (type: WorkshopType) => void;
  setGender: (gender: GenderFilter) => void;
  setStatus: (status: WorkshopStatus | null) => void;
  setRegionMetric: (metric: RegionMetric) => void;
  resetFilters: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const value = useMemo<FiltersContextValue>(
    () => ({
      filters,
      setDateRange: (start, end) => setFilters((f) => ({ ...f, dateRange: { start, end } })),
      setRegion: (region) => setFilters((f) => ({ ...f, region })),
      toggleRegion: (region) => setFilters((f) => ({ ...f, region: f.region === region ? null : region })),
      setWorkshopType: (workshopType) => setFilters((f) => ({ ...f, workshopType })),
      toggleWorkshopType: (type) =>
        setFilters((f) => ({ ...f, workshopType: f.workshopType === type ? null : type })),
      setGender: (gender) => setFilters((f) => ({ ...f, gender })),
      setStatus: (status) => setFilters((f) => ({ ...f, status })),
      setRegionMetric: (regionMetric) => setFilters((f) => ({ ...f, regionMetric })),
      resetFilters: () => setFilters(defaultFilters),
    }),
    [filters],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
