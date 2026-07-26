import { useMemo, useState } from 'react';
import type { RegionCode } from '../data/workshops';
import { useFilters } from '../state/FiltersContext';
import { regionMetricLabels, type RegionMetric } from '../state/filters';
import type { RegionRow } from '../state/selectors';
import KsaMap from './KsaMap';

const metrics: RegionMetric[] = ['applications', 'accepted', 'attendance', 'actual_attendance'];

export default function RegionCard({ regionBreakdown }: { regionBreakdown: RegionRow[] }) {
  const { filters, setRegionMetric, toggleRegion } = useFilters();
  const metric = filters.regionMetric;
  const ITEMS_PER_PAGE = 4;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(regionBreakdown.length / ITEMS_PER_PAGE));
  const visible = regionBreakdown.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const max = regionBreakdown[0]?.value ?? 1;
  const total = useMemo(() => regionBreakdown.reduce((sum, r) => sum + r.value, 0), [regionBreakdown]);
  const selectedRegionRow = regionBreakdown.find((r) => r.code === filters.region) ?? null;

  const mapValues = useMemo(() => {
    const record: Partial<Record<RegionCode, number>> = {};
    for (const r of regionBreakdown) record[r.code] = r.value;
    return record;
  }, [regionBreakdown]);

  return (
    <div className="self-start max-h-[calc(100%-10px)] rounded-[20px] bg-surface p-4 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[16px] font-bold text-main-text">{regionMetricLabels[metric]} حسب المنطقة</h3>
        <div className="flex flex-wrap rounded-full border border-border bg-white/5 p-1 text-xs">
          {metrics.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRegionMetric(m)}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                metric === m ? 'bg-peach text-[#2a1608]' : 'text-white/60 hover:text-white'
              }`}
            >
              {regionMetricLabels[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-3">
          {visible.map((region) => {
            const pct = max === 0 ? 0 : (region.value / max) * 100;
            const color = region.color;
            const isSelected = region.code === filters.region;
            const isDimmed = filters.region !== null && !isSelected;
            return (
              <button
                key={region.code}
                type="button"
                onClick={() => toggleRegion(region.code)}
                className={`flex flex-col gap-1.5 rounded-lg border px-1 py-1 text-start transition-opacity ${
                  isSelected ? 'bg-white/5' : 'border-transparent'
                } ${isDimmed ? 'opacity-40' : ''}`}
                style={isSelected ? { borderColor: color } : undefined}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-main-text">
                  <span className="font-semibold">{region.name}</span>
                  <span>{region.value.toLocaleString('en-US')}</span>
                </div>
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px 0 ${color}88` }}
                  />
                </div>
              </button>
            );
          })}

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] text-muted">صفحة {page + 1} من {totalPages}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded px-2 py-1 text-xs text-white/60 disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded px-2 py-1 text-xs text-white/60 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-2 self-start text-center sm:self-auto">
            <p className="text-sm text-body-text">
              {selectedRegionRow ? `${regionMetricLabels[metric]} — ${selectedRegionRow.name}` : `إجمالي ${regionMetricLabels[metric]}`}
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <p className="text-[28px] font-bold text-main-text">
                {(selectedRegionRow ? selectedRegionRow.value : total).toLocaleString('en-US')}
              </p>
              {selectedRegionRow && (
                <span className="text-xs text-muted">({selectedRegionRow.workshopCount.toLocaleString('en-US')} ورشة)</span>
              )}
            </div>
          </div>

          <KsaMap values={mapValues} maxValue={max} selectedRegion={filters.region} onSelect={toggleRegion} />
        </div>
      </div>
    </div>
  );
}
