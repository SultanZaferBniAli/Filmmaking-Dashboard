import { Star } from 'lucide-react';
import type { Ratings } from '../state/selectors';

export default function RatingCard({ ratings }: { ratings: Ratings }) {
  if (ratings.total === 0) {
    return (
      <div className="flex flex-col self-start rounded-[20px] bg-surface p-4 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
        <h3 className="mb-3 text-[15px] font-semibold text-main-text">التقييم العام للورش التدريبية</h3>
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Star size={20} className="text-white/20" />
          <p className="text-sm text-subtle-blue">لا توجد تقييمات ضمن الفلاتر الحالية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col self-start rounded-[20px] bg-surface p-4 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
      <h3 className="mb-3 text-[15px] font-semibold text-main-text">التقييم العام للدورات</h3>

      <div className="flex items-start gap-2">
        <div className="flex w-[88px] shrink-0 flex-col items-center justify-center gap-1 border-e border-white/40 pe-3">
          <span className="text-[32px] font-extrabold tracking-tight text-main-text">{ratings.average.toFixed(1)}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={10}
                className={i < Math.round(ratings.average) ? 'fill-orange text-orange' : 'fill-white/15 text-white/15'}
              />
            ))}
          </div>
          <div className="flex flex-col items-center pt-1 text-center">
            <span className="text-[8px] text-muted-blue">إجمالي التقييمات</span>
            <span className="text-[9px] font-bold text-body-text">{ratings.total.toLocaleString('en-US')} تقييم</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2">
          {ratings.breakdown.map((row) => (
            <div key={row.stars} className="flex items-center gap-1">
              <span className="w-7 shrink-0 text-[9px] font-bold text-white">{row.percent}%</span>
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-orange to-orange/70 shadow-[0_0_5px_0px_rgba(255,150,25,0.27)]"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-muted-blue">
                {row.stars}
                <Star size={7} className="fill-muted-blue text-muted-blue" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
