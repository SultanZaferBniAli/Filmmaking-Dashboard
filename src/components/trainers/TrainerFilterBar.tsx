import { Download, RotateCcw } from 'lucide-react';
import type { Trainer } from '../../data/trainers';
import { workshopFields, workshopTypeMeta } from '../../data/workshops';
import { nationalityOptions, trainerNameOptions, type TrainerFilters } from '../../state/trainerSelectors';
import MultiSelectFilter from '../MultiSelectFilter';
import SearchAutocomplete from '../SearchAutocomplete';

type Props = {
  trainers: Trainer[];
  filters: TrainerFilters;
  onChange: (filters: TrainerFilters) => void;
  onReset: () => void;
  onExport: () => void;
  search: string;
  onSearchChange: (value: string) => void;
};

const workshopTypeOptions = workshopTypeMeta.map((t) => ({ value: t.key, label: t.label }));
const fieldOptions = workshopFields.map((f) => ({ value: f, label: f }));

export default function TrainerFilterBar({ trainers, filters, onChange, onReset, onExport, search, onSearchChange }: Props) {
  const natOptions = nationalityOptions(trainers).map((n) => ({ value: n.code, label: n.label }));
  const searchOptions = trainerNameOptions(trainers);

  return (
    <div className="rounded-[14px] bg-surface p-5">
      <div className="flex flex-wrap items-end gap-4">
        <MultiSelectFilter
          label="مسارات الورش التدريبية"
          placeholder="جميع الورش العمل"
          options={workshopTypeOptions}
          selected={filters.workshopTypes}
          onChange={(v) => onChange({ ...filters, workshopTypes: v as TrainerFilters['workshopTypes'] })}
        />
        <MultiSelectFilter
          label="مجال الورشة"
          placeholder="جميع المجالات"
          options={fieldOptions}
          selected={filters.fields}
          onChange={(v) => onChange({ ...filters, fields: v as TrainerFilters['fields'] })}
        />
        <MultiSelectFilter
          label="جنسية المدرب"
          placeholder="جميع الجنسيات"
          options={natOptions}
          selected={filters.nationalityCodes}
          onChange={(v) => onChange({ ...filters, nationalityCodes: v })}
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
            placeholder="ابحث عن مدرب..."
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
