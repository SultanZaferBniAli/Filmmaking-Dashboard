import { Download, RotateCcw, UserPlus } from 'lucide-react';
import { workshopFields, workshopTypeMeta } from '../../data/workshops';
import { focusRegionMeta } from '../../data/workshops';
import { experienceLevels, experienceLevelLabel, type Participant } from '../../data/participants';
import { participantNameOptions, type ParticipantFilters, type ParticipantStatusFilter } from '../../state/participantSelectors';
import type { GenderFilter } from '../../state/filters';
import MultiSelectFilter from '../MultiSelectFilter';
import FilterSelect from '../FilterSelect';
import SearchAutocomplete from '../SearchAutocomplete';

type Props = {
  participants: Participant[];
  workshopOptions: { value: string; label: string }[];
  filters: ParticipantFilters;
  onChange: (filters: ParticipantFilters) => void;
  onReset: () => void;
  onExport: () => void;
  exporting?: boolean;
  onAddParticipant: () => void;
  search: string;
  onSearchChange: (value: string) => void;
};

// Same taxonomy/options as the Workshops page's "ورشة العمل" filter, for consistency.
const workshopTypeOptions = workshopTypeMeta.map((t) => ({ value: t.key, label: t.label }));
const fieldOptions = workshopFields.map((f) => ({ value: f, label: f }));
const regionOptions = focusRegionMeta.map((r) => ({ value: r.code, label: r.name }));
const experienceOptions = experienceLevels.map((l) => ({ value: l, label: experienceLevelLabel[l] }));
const genderOptions: { value: 'male' | 'female'; label: string }[] = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'اناث' },
];
// Same three states as the KPI cards (المقبولين / الحضور / الحضور الفعلي).
const statusOptions: { value: ParticipantStatusFilter; label: string }[] = [
  { value: 'accepted', label: 'مقبول' },
  { value: 'attended', label: 'حضر' },
  { value: 'actual_attendance', label: 'حضور فعلي (كامل الورشة)' },
];

export default function ParticipantFilterBar({
  participants,
  workshopOptions,
  filters,
  onChange,
  onReset,
  onExport,
  exporting = false,
  onAddParticipant,
  search,
  onSearchChange,
}: Props) {
  const searchOptions = participantNameOptions(participants);

  return (
    <div className="rounded-[14px] bg-surface p-5">
      <div className="flex flex-wrap items-end gap-4">
        <MultiSelectFilter
          label="الورشة"
          placeholder="جميع الورش"
          options={workshopOptions}
          selected={filters.workshops}
          onChange={(v) => onChange({ ...filters, workshops: v })}
        />
        <MultiSelectFilter
          label="مسارات الورش التدريبية"
          placeholder="جميع الورش العمل"
          options={workshopTypeOptions}
          selected={filters.workshopTypes}
          onChange={(v) => onChange({ ...filters, workshopTypes: v as ParticipantFilters['workshopTypes'] })}
        />
        <MultiSelectFilter
          label="مجال الورشة"
          placeholder="جميع المجالات"
          options={fieldOptions}
          selected={filters.fields}
          onChange={(v) => onChange({ ...filters, fields: v as ParticipantFilters['fields'] })}
        />
        <MultiSelectFilter
          label="المنطقة"
          placeholder="كل المناطق"
          options={regionOptions}
          selected={filters.regions}
          onChange={(v) => onChange({ ...filters, regions: v as ParticipantFilters['regions'] })}
        />
        <MultiSelectFilter
          label="مستوى الخبرة"
          placeholder="جميع المستويات"
          options={experienceOptions}
          selected={filters.experienceLevels}
          onChange={(v) => onChange({ ...filters, experienceLevels: v as ParticipantFilters['experienceLevels'] })}
        />
        <FilterSelect
          label="الجنس"
          placeholder="الكل"
          options={genderOptions}
          value={filters.gender}
          onChange={(v) => onChange({ ...filters, gender: v as GenderFilter })}
        />
        <FilterSelect
          label="الحالة"
          placeholder="كل الحالات"
          options={statusOptions}
          value={filters.status}
          onChange={(v) => onChange({ ...filters, status: v as ParticipantStatusFilter | null })}
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

        <button
          type="button"
          onClick={onAddParticipant}
          className="flex items-center gap-2 rounded-xl bg-burgundy px-5 py-2 text-sm font-semibold text-white"
        >
          <UserPlus size={14} />
          إضافة مشارك
        </button>

        <div className="flex flex-1 justify-center">
          <SearchAutocomplete
            value={search}
            onChange={onSearchChange}
            options={searchOptions}
            placeholder="ابحث عن مشارك..."
          />
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-[#0b1f2b] disabled:opacity-60"
        >
          <Download size={14} />
          {exporting ? 'جارٍ التصدير...' : 'تصدير'}
        </button>
      </div>
    </div>
  );
}
