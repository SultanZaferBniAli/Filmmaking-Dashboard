import { useEffect, useRef } from 'react';
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
const AUTO_SCROLL_PX_PER_SEC = 12;

export default function WorkshopListCard({ title, items, emptyLabel, metaMode }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  function stopScrolling() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  function startScrolling() {
    if (frameRef.current !== null) return;
    let last = performance.now();
    const step = (now: number) => {
      const el = listRef.current;
      if (!el) {
        frameRef.current = null;
        return;
      }
      const dt = (now - last) / 1000;
      last = now;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        const next = el.scrollTop + AUTO_SCROLL_PX_PER_SEC * dt;
        el.scrollTop = next > maxScroll ? 0 : next;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }

  useEffect(() => stopScrolling, []);

  return (
    <div
      className="flex h-[178px] min-h-[178px] w-full flex-col rounded-[20px] bg-surface p-6 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]"
      onMouseEnter={startScrolling}
      onMouseLeave={stopScrolling}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-bold text-main-text">{title}</h3>
      </div>

      {items.length === 0 ? (
        <div className="flex h-[94px] items-center justify-center text-center text-sm text-subtle-blue">
          {emptyLabel}
        </div>
      ) : (
        <div className="relative h-[94px] min-h-[94px] overflow-hidden">
          <div className="pointer-events-none absolute bottom-5 end-5 top-5 z-10 border-e-2 border-dashed border-white/10" />
          <div
            ref={listRef}
            className="h-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex flex-col gap-3.5">
              {items.map((w) => {
                const { day, month } = formatDayMonth(w.start_date);
                const dotColor = typeColor[w.workshop_type];
                const metaValue =
                  metaMode === 'participants'
                    ? `${w.actual_attendance || w.total_accepted} مشارك`
                    : w.trainer_name;
                return (
                  <li key={w.workshop_id} className="relative flex items-center gap-3">
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
        </div>
      )}
    </div>
  );
}
