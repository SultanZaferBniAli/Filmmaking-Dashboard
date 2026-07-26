import { Download, RotateCcw } from 'lucide-react';
import {
  focusRegionMeta,
  workshopTypeMeta,
  workshopPhaseLabel,
  workshopFields,
  type RegionCode,
  type WorkshopType,
  type WorkshopPhase,
  type WorkshopField,
} from '../../data/workshops';
import MultiSelectFilter from '../MultiSelectFilter';
import SearchAutocomplete from '../SearchAutocomplete';

export type WorkshopFilters = {
  workshopTypes: WorkshopType[];
  fields: WorkshopField[];
  regions: RegionCode[];
  statuses: WorkshopPhase[];
};

type Props = {
  filters: WorkshopFilters;
  onChange: (filters: WorkshopFilters) => void;
  onReset: () => void;
  onExport: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchOptions: string[];
};

const statusOptions: { value: WorkshopPhase; label: string }[] = (
  ['scheduled', 'ongoing', 'completed'] as WorkshopPhase[]
).map((key) => ({ value: key, label: workshopPhaseLabel[key] }));

const typeOptions = workshopTypeMeta.map((t) => ({ value: t.key, label: t.label }));
const regionOptions = focusRegionMeta.map((r) => ({ value: r.code, label: r.name }));
const fieldOptions = workshopFields.map((f) => ({ value: f, label: f }));

export default function FilterBar({ filters, onChange, onReset, onExport, search, onSearchChange, searchOptions }: Props) {
  return (
    <div className="rounded-[14px] bg-surface p-5">
      <div className="flex flex-wrap items-end gap-4">
        <MultiSelectFilter
          label="مسارات الورش التدريبية"
          placeholder="جميع الورش العمل"
          options={typeOptions}
          selected={filters.workshopTypes}
          onChange={(v) => onChange({ ...filters, workshopTypes: v as WorkshopFilters['workshopTypes'] })}
        />
        <MultiSelectFilter
          label="المجالات"
          placeholder="جميع المجالات"
          options={fieldOptions}
          selected={filters.fields}
          onChange={(v) => onChange({ ...filters, fields: v as WorkshopFilters['fields'] })}
        />
        <MultiSelectFilter
          label="المنطقة"
          placeholder="كل المناطق"
          options={regionOptions}
          selected={filters.regions}
          onChange={(v) => onChange({ ...filters, regions: v as WorkshopFilters['regions'] })}
        />
        <MultiSelectFilter
          label="الحالة"
          placeholder="جميع الحالات"
          options={statusOptions}
          selected={filters.statuses}
          onChange={(v) => onChange({ ...filters, statuses: v as WorkshopFilters['statuses'] })}
        />
      </div>

      <div className="mt-[18px] flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-[10px] border border-bg bg-bg px-4 py-1.5 text-sm font-medium text-main-text"
        >
          <RotateCcw size={13} />
          مسح الفلاتر
        </button>

        <div className="flex flex-1 justify-center">
          <SearchAutocomplete
            value={search}
            onChange={onSearchChange}
            options={searchOptions}
            placeholder="ابحث عن ورشة..."
          />
        </div>

        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-[#0b1f2b]"
        >
          <Download size={14} />
          تصدير
        </button>
      </div>
    </div>
  );
}
