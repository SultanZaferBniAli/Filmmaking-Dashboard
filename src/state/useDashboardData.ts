import { useMemo } from 'react';
import { useFilters } from './FiltersContext';
import { useData } from './DataContext';
import {
  computeKpis,
  computeRatings,
  computeRegionBreakdown,
  computeTypeBreakdown,
  filterWorkshops,
  splitUpcomingCompleted,
} from './selectors';

export function useDashboardData() {
  const { filters } = useFilters();
  const { workshops } = useData();

  return useMemo(() => {
    const filtered = filterWorkshops(workshops, filters);
    const kpis = computeKpis(filtered);
    const ratings = computeRatings(filtered);
    const { upcoming, completed } = splitUpcomingCompleted(filtered);
    const regionBreakdown = computeRegionBreakdown(workshops, filters, filters.regionMetric);
    const typeBreakdown = computeTypeBreakdown(workshops, filters);

    return {
      filtered,
      kpis,
      ratings,
      upcoming,
      completed,
      regionBreakdown,
      typeBreakdown,
      totalCount: filtered.length,
    };
  }, [filters, workshops]);
}
