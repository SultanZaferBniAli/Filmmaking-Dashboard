import { ChevronDown } from 'lucide-react';
import type { Participant } from '../../data/participants';
import { experienceLevelLabel, completedWorkshopCount } from '../../data/participants';
import ParticipantExpandedDetails from './ParticipantExpandedDetails';

const COLS = 'grid-cols-[minmax(170px,1.3fr)_140px_minmax(170px,1.2fr)_160px_130px_120px]';

type Props = {
  participants: Participant[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
};

export default function ParticipantsTable({ participants, expandedId, onToggleExpand }: Props) {
  return (
    <div className="w-full overflow-x-auto rounded-[20px] bg-surface">
      <div className={`grid ${COLS} min-w-full gap-2 border-b border-white/10 px-6 py-3 text-right text-xs font-medium text-muted`}>
        <span>الاسم</span>
        <span>رقم الجوال</span>
        <span>البريد الإلكتروني</span>
        <span>المسمى الوظيفي</span>
        <span>مستوى الخبرة</span>
        <span>عدد الورش المكتملة</span>
      </div>

      <div className="flex flex-col divide-y divide-white/5">
        {participants.map((p, idx) => {
          const isExpanded = expandedId === p.id;
          const count = completedWorkshopCount(p);
          return (
            <div key={p.id} className={idx % 2 === 1 ? 'bg-white/[0.015]' : ''}>
              <div className={`grid ${COLS} min-w-full items-center gap-2 px-6 py-4 text-sm`}>
                <span className="truncate text-right font-medium text-off-white" title={p.fullName}>
                  {p.fullName}
                </span>
                <span dir="ltr" className="truncate text-right text-muted" title={p.phone}>
                  {p.phone}
                </span>
                <span dir="ltr" className="truncate text-right text-muted" title={p.email}>
                  {p.email}
                </span>
                <span className="truncate text-right text-muted" title={p.jobTitle}>
                  {p.jobTitle}
                </span>
                <span className="truncate text-right text-muted">{experienceLevelLabel[p.experienceLevel]}</span>
                <button
                  type="button"
                  onClick={() => onToggleExpand(p.id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'طي تفاصيل المشارك' : 'عرض تفاصيل المشارك'}
                  className="flex items-center justify-self-start gap-2 rounded-lg px-2 py-1 text-off-white hover:bg-white/5"
                >
                  <span className="font-semibold">{count}</span>
                  <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-white/5 bg-black/10 px-6 py-5">
                  <ParticipantExpandedDetails participant={p} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
