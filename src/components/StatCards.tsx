import { Mars, Venus } from 'lucide-react';
import { useFilters } from '../state/FiltersContext';
import { pickGenderValue, type GenderCount, type Kpis } from '../state/selectors';

type CardDef = {
  key: string;
  label: string;
  count: GenderCount;
  highlighted?: boolean;
};

function StatCard({ card }: { card: CardDef }) {
  const { filters } = useFilters();
  const value = pickGenderValue(card.count, filters.gender);
  const maleActive = filters.gender !== 'female';
  const femaleActive = filters.gender !== 'male';

  return (
    <div
      className={`relative h-full overflow-hidden rounded-[20px] p-4 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)] ${
        card.highlighted ? 'bg-gradient-to-br from-burgundy to-[#38001d]' : 'bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-main-text">{card.label}</span>
      </div>

      <div className="mt-3 text-[34px] font-bold text-main-text text-left">{value.toLocaleString('en-US')}</div>

      <div className="mt-2 flex items-start gap-6 text-xs">
        <div className={`flex flex-col items-center gap-1 transition-opacity ${maleActive ? '' : 'opacity-30'}`}>
          <span className="flex items-center gap-1 text-subtle-blue">
            <Mars size={12} />
            ذكور
          </span>
          <span className="text-sm font-bold text-male">{card.count.male.toLocaleString('en-US')}</span>
        </div>
        <div className={`flex flex-col items-center gap-1 transition-opacity ${femaleActive ? '' : 'opacity-30'}`}>
          <span className="flex items-center gap-1 text-subtle-blue">
            <Venus size={12} />
            اناث
          </span>
          <span className="text-sm font-bold text-female">{card.count.female.toLocaleString('en-US')}</span>
        </div>
      </div>
    </div>
  );
}

export default function StatCards({ kpis }: { kpis: Kpis }) {
  // DOM order matches Figma's visual left-to-right order under RTL grid auto-placement
  // (first child renders rightmost, closest to the sidebar).
  const cards: CardDef[] = [
    { key: 'registrations', label: 'إجمالي التسجيلات', count: kpis.registrations },
    { key: 'accepted', label: 'إجمالي المقبولين', count: kpis.accepted },
    { key: 'attendance', label: 'إجمالي الحضور', count: kpis.attendance },
    { key: 'actual', label: 'الحضور الفعلي', count: kpis.actualAttendance, highlighted: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.key} card={card} />
      ))}
    </div>
  );
}
