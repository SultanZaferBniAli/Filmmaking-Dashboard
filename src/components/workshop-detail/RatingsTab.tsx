import { Star, MessageSquare, Lightbulb } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { computeQuestionRatings, computeYesNoBreakdown } from '../../data/feedback';
import { useData } from '../../state/DataContext';
import { computeRatings } from '../../state/selectors';

type Props = { workshop: Workshop };

const OPTION_COLOR: Record<string, string> = {
  نعم: 'var(--color-teal)',
  'نعم جزئياً': 'var(--color-orange)',
  ربما: 'var(--color-orange)',
  لا: 'var(--color-notif-red)',
};

export default function RatingsTab({ workshop }: Props) {
  const { feedback } = useData();
  const workshopFeedback = feedback.filter((f) => f.workshopId === workshop.workshop_id);
  const ratings = computeRatings([workshop]);

  const questionRatings = computeQuestionRatings(workshopFeedback);
  const yesNoBreakdown = computeYesNoBreakdown(workshopFeedback);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center">
          <p className="text-xs text-muted">التقييم العام</p>
          <p className="mt-2 text-4xl font-extrabold text-main-text">{ratings.total === 0 ? '—' : ratings.average.toFixed(1)}</p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} className={i < Math.round(ratings.average) ? 'fill-orange text-orange' : 'fill-white/15 text-white/15'} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center">
          <p className="text-xs text-muted">إجمالي الردود</p>
          <p className="mt-2 text-4xl font-extrabold text-main-text">{workshopFeedback.length}</p>
        </div>
      </div>

      {ratings.total > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-3 text-sm font-bold text-main-text">توزيع التقييمات</h3>
          <div className="flex flex-col gap-2">
            {ratings.breakdown.map((row) => (
              <div key={row.stars} className="flex items-center gap-2">
                <span className="flex w-10 shrink-0 items-center gap-0.5 text-xs text-muted-blue">
                  {row.stars}
                  <Star size={10} className="fill-muted-blue text-muted-blue" />
                </span>
                <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-orange" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="w-10 shrink-0 text-end text-xs font-semibold text-white">{row.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {workshopFeedback.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 text-sm font-bold text-main-text">تقييم كل سؤال</h3>
          <div className="flex flex-col gap-3">
            {questionRatings.map((q) => (
              <div key={q.key} className="rounded-xl border border-white/5 bg-bg/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-main-text">{q.label}</span>
                  <div className="flex items-center gap-3">
                    {q.average !== null && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < Math.round(q.average!) ? 'fill-orange text-orange' : 'fill-white/15 text-white/15'}
                          />
                        ))}
                      </span>
                    )}
                    <span className="rounded-full bg-orange/15 px-2 py-0.5 text-xs font-semibold text-orange">
                      {q.average === null ? '—' : `${q.average.toFixed(1)} / 5`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workshopFeedback.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-4 text-sm font-bold text-main-text">الأسئلة النعم / لا</h3>
          <div className="flex flex-col gap-4">
            {yesNoBreakdown.map((q) => (
              <div key={q.key} className="rounded-xl border border-white/5 bg-bg/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-main-text">{q.label}</span>
                  <span className="text-xs text-muted">{q.total} ردًا</span>
                </div>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-muted-blue">{opt.label}</span>
                      <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${opt.percent}%`, backgroundColor: OPTION_COLOR[opt.label] ?? 'var(--color-orange)' }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-end text-xs font-semibold text-white">
                        {opt.percent}% ({opt.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <h3 className="mb-4 text-sm font-bold text-main-text">جميع الردود</h3>
        {workshopFeedback.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle-blue">لا توجد تقييمات لهذه الورشة بعد.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {workshopFeedback.map((f) => (
              <div key={f.feedbackId} className="rounded-xl border border-white/5 bg-bg/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-main-text">{f.respondentName ?? 'مشارك مجهول'}</span>
                  {typeof f.overallRating === 'number' && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < f.overallRating! ? 'fill-orange text-orange' : 'fill-white/15 text-white/15'} />
                      ))}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-start text-xs">
                  {f.gainedKnowledge && (
                    <span
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={{ color: OPTION_COLOR[f.gainedKnowledge] ?? 'var(--color-muted)', backgroundColor: `${OPTION_COLOR[f.gainedKnowledge] ?? 'var(--color-muted)'}22` }}
                    >
                      اكتساب معرفة: {f.gainedKnowledge}
                    </span>
                  )}
                  {f.intendsToApply && (
                    <span
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={{ color: OPTION_COLOR[f.intendsToApply] ?? 'var(--color-muted)', backgroundColor: `${OPTION_COLOR[f.intendsToApply] ?? 'var(--color-muted)'}22` }}
                    >
                      نية التطبيق: {f.intendsToApply}
                    </span>
                  )}
                  {typeof f.professionalConnections === 'number' && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-subtle-blue">
                      علاقات مهنية: {f.professionalConnections}
                    </span>
                  )}
                </div>
                {f.comments && (
                  <div className="mt-3 flex items-start gap-2 border-t border-white/5 pt-3">
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-teal" />
                    <p className="text-start text-xs leading-relaxed text-body-text">{f.comments}</p>
                  </div>
                )}
                {f.suggestions && (
                  <div className="mt-2 flex items-start gap-2">
                    <Lightbulb size={13} className="mt-0.5 shrink-0 text-orange" />
                    <p className="text-start text-xs leading-relaxed text-body-text">{f.suggestions}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
