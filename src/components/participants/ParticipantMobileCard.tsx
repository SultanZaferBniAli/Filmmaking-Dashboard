import { ChevronDown } from 'lucide-react';
import type { Participant } from '../../data/participants';
import { experienceLevelLabel, completedWorkshopCount } from '../../data/participants';
import ParticipantExpandedDetails from './ParticipantExpandedDetails';

type Props = {
  participant: Participant;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
};

export default function ParticipantMobileCard({ participant: p, expanded, onToggleExpand }: Props) {
  const count = completedWorkshopCount(p);
  return (
    <div className="rounded-2xl border border-white/5 bg-surface p-4">
      <button
        type="button"
        onClick={() => onToggleExpand(p.id)}
        aria-expanded={expanded}
        aria-label={expanded ? 'طي تفاصيل المشارك' : 'عرض تفاصيل المشارك'}
        className="flex w-full items-start justify-between gap-3 text-right"
      >
        <span className="flex items-center gap-2 rounded-lg px-1 py-1 text-off-white">
          <span className="font-semibold">{count}</span>
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
        <span className="flex flex-1 flex-col items-start gap-1">
          <span className="truncate text-[15px] font-medium text-white">{p.fullName}</span>
          <span className="truncate text-sm text-muted">{p.jobTitle}</span>
          <span dir="ltr" className="truncate text-xs text-muted">
            {p.phone}
          </span>
          <span className="text-xs text-muted">{experienceLevelLabel[p.experienceLevel]}</span>
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <ParticipantExpandedDetails participant={p} />
        </div>
      )}
    </div>
  );
}
