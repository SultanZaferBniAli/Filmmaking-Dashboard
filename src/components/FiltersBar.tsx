import { X, RotateCcw } from 'lucide-react';
import { regionNameByCode, workshopTypeLabel } from '../data/workshops';
import { useFilters } from '../state/FiltersContext';
import { defaultFilters, hasActiveFilters } from '../state/filters';

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-main-text">
      {label}
      <button type="button" onClick={onClear} aria-label="إزالة الفلتر" className="text-white/50 hover:text-white">
        <X size={12} />
      </button>
    </span>
  );
}

export default function FiltersBar() {
  const { filters, setDateRange, setRegion, setWorkshopType, setGender, setStatus, resetFilters } = useFilters();

  if (!hasActiveFilters(filters)) return null;

  const chips: { key: string; label: string; onClear: () => void }[] = [];

  if (filters.dateRange.start !== defaultFilters.dateRange.start || filters.dateRange.end !== defaultFilters.dateRange.end) {
    chips.push({
      key: 'date',
      label: filters.dateRange.start && filters.dateRange.end ? 'فترة مخصصة' : 'كل الفترات',
      onClear: () => setDateRange(defaultFilters.dateRange.start, defaultFilters.dateRange.end),
    });
  }
  if (filters.region) {
    chips.push({ key: 'region', label: regionNameByCode[filters.region], onClear: () => setRegion(null) });
  }
  if (filters.workshopType) {
    chips.push({
      key: 'type',
      label: workshopTypeLabel[filters.workshopType],
      onClear: () => setWorkshopType(null),
    });
  }
  if (filters.gender) {
    chips.push({
      key: 'gender',
      label: filters.gender === 'male' ? 'ذكور فقط' : 'اناث فقط',
      onClear: () => setGender(null),
    });
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label: filters.status === 'upcoming' ? 'القادمة فقط' : 'المنفذة فقط',
      onClear: () => setStatus(null),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-4 md:px-10">
      <span className="text-xs text-subtle-blue">الفلاتر النشطة:</span>
      {chips.map((c) => (
        <Chip key={c.key} label={c.label} onClear={c.onClear} />
      ))}
      <button
        type="button"
        onClick={resetFilters}
        className="flex items-center gap-1.5 rounded-full border border-peach/30 px-3 py-1 text-xs font-medium text-peach hover:bg-peach/10"
      >
        <RotateCcw size={12} />
        إعادة تعيين الفلاتر
      </button>
    </div>
  );
}
