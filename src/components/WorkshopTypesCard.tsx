import { useFilters } from '../state/FiltersContext';
import type { TypeRow } from '../state/selectors';

function TypeRowView({ row, isActive, onClick }: { row: TypeRow; isActive: boolean; onClick: () => void }) {
  const pct = row.target === 0 ? 0 : (row.done / row.target) * 100;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-[15px] py-[11px] transition-colors ${
        isActive ? 'border-peach/40 bg-peach/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="flex-1 truncate text-right text-sm font-medium text-off-white">{row.label}</span>
        </div>

        <div className="flex w-[72px] shrink-0 items-baseline justify-start gap-0.5 font-mono">
          <span className="text-[16px] font-bold" style={{ color: row.color }}>
            {row.done}
          </span>
          <span className="text-sm text-muted">/{row.target}</span>
          <span className="ms-1 text-[10px] text-muted">ورشة</span>
        </div>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: row.color }}
        />
      </div>
    </button>
  );
}

export default function WorkshopTypesCard({ typeBreakdown }: { typeBreakdown: TypeRow[] }) {
  const { filters, toggleWorkshopType } = useFilters();
  const totalDone = typeBreakdown.reduce((s, r) => s + r.done, 0);
  const totalTarget = typeBreakdown.reduce((s, r) => s + r.target, 0);

  return (
    <div className="mt-4 h-full min-h-[280px] md:min-h-[420px] rounded-[20px] bg-surface p-4 shadow-[0_25px_50px_0px_rgba(0,0,0,0.25)]" style={{ transform: 'translateY(-120px)' }}>
      <h3 className="mb-4 text-right text-[16px] font-bold text-main-text">مسارات الورش التدريبية</h3>

      <div className="flex flex-col gap-2">
        {typeBreakdown.map((row) => (
          <TypeRowView
            key={row.key}
            row={row}
            isActive={filters.workshopType === row.key}
            onClick={() => toggleWorkshopType(row.key)}
          />
        ))}

        <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-gold/5 px-[15px] py-[11px]">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-gold/60" />
            <span className="text-sm font-semibold text-muted">الإجمالي</span>
          </div>

          <div className="flex w-[72px] shrink-0 items-baseline justify-start gap-0.5 font-mono">
            <span className="text-[16px] font-bold text-gold">{totalDone}</span>
            <span className="text-sm text-muted">/{totalTarget}</span>
            <span className="ms-1 text-[10px] text-muted">ورشة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
