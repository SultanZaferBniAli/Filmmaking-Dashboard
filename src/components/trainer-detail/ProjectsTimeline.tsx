import { useState } from 'react';
import { Clapperboard, LayoutGrid } from 'lucide-react';
import type { Trainer } from '../../data/trainers';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';

const INITIAL_COUNT = 10;

export default function ProjectsTimeline({ trainer }: { trainer: Trainer }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...(trainer.projects ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);

  return (
    <div
      dir="rtl"
      className="@container flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface p-5 text-right shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]"
    >
      <div className="border-b border-white/5 pb-3">
        <h3 className="text-base font-bold text-main-text">أعمال ومنجزات سينمائية</h3>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted">لا توجد أعمال مسجلة لهذا المدرب حالياً.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 @sm:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5">
          {visible.map((p, i) => (
            <div key={`${p.title}-${i}`} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/5 bg-white/5">
                {p.poster ? (
                  <img src={resolveFileUrl(API_URL, p.poster)} alt={p.title} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Clapperboard size={26} className="text-muted" />
                  </div>
                )}
                <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-orange backdrop-blur-sm">
                  {p.year ?? '—'}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-off-white" title={p.title}>
                {p.title}
              </p>
              <p className="truncate text-xs text-muted">{p.role}</p>
              {p.type && <span className="w-fit rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-subtle-blue">{p.type}</span>}
            </div>
          ))}
        </div>
      )}

      {sorted.length > INITIAL_COUNT && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-[10px] border border-border px-4 py-2.5 text-sm font-medium text-main-text hover:bg-white/5"
        >
          <LayoutGrid size={15} />
          عرض جميع الأعمال
        </button>
      )}
    </div>
  );
}
