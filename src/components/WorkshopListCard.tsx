import { useState } from 'react';
import type { Workshop } from '../data/workshops';
import { workshopTypeMeta } from '../data/workshops';
import { formatDayMonth } from '../utils/date';

type Props = {
  title: string;
  items: Workshop[];
  emptyLabel: string;
  metaMode: 'participants' | 'trainer';
};

const typeColor = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.color]));
const PAGE_SIZE = 4;

export default function WorkshopListCard({ title, items, emptyLabel, metaMode }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = items.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex h-[280px] min-h-[280px] w-full flex-col rounded-[20px] bg-surface p-6 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-main-text">{title}</h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded px-2 py-1 text-xs text-white/60 disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded px-2 py-1 text-xs text-white/60 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex h-[208px] items-center justify-center py-8 text-center text-sm text-subtle-blue">
          {emptyLabel}
        </div>
      ) : (
        <div className="relative h-[208px] min-h-[208px] overflow-hidden">
          <div className="absolute bottom-5 end-5 top-5 border-e-2 border-dashed border-white/10" />
          <ul className="flex flex-col gap-3.5">
            {visible.map((w) => {
              const { day, month } = formatDayMonth(w.start_date);
              const dotColor = typeColor[w.workshop_type];
              const metaValue =
                metaMode === 'participants'
                  ? `${w.actual_attendance || w.total_accepted} مشارك`
                  : w.trainer_name;
              return (
                <li key={w.workshop_id} className="relative z-10 flex items-center gap-3">
                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate text-[13px] font-medium text-teal text-right">{w.workshop_name}</p>
                    <div className="mt-1 flex items-center justify-start gap-1.5 text-[11px] text-peach text-right">
                      <span className="shrink-0">{w.city}</span>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                      <span className="truncate">{metaValue}</span>
                    </div>
                  </div>
                  <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-teal/[0.23] text-[14px] font-medium leading-none text-white">
                    <span>{day}</span>
                    <span className="text-[10px]">{month}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
