import { Award } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { getParticipantAttendance, isCertificateEligible } from '../../state/selectors';

function percentColor(pct: number): string {
  if (pct >= 80) return 'var(--color-teal)';
  if (pct >= 60) return 'var(--color-orange)';
  return 'var(--color-notif-red)';
}

const COLS =
  'grid-cols-[minmax(160px,1.3fr)_minmax(110px,0.9fr)_minmax(170px,1.3fr)_minmax(100px,0.8fr)_minmax(90px,0.7fr)_minmax(90px,0.7fr)_minmax(90px,0.8fr)]';

export default function ParticipantsTab({ workshop }: { workshop: Workshop }) {
  if (workshop.participants.length === 0) {
    return <p className="py-10 text-center text-sm text-subtle-blue">لا يوجد مشاركون مسجلون في هذه الورشة بعد.</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className={`grid ${COLS} w-full gap-2 border-b border-white/10 px-3 pb-3 text-start text-xs font-medium text-muted`}>
        <span>الاسم</span>
        <span>الهاتف</span>
        <span>البريد الإلكتروني</span>
        <span>نسبة الحضور</span>
        <span>عدد الحضور</span>
        <span>عدد الغياب</span>
        <span>الشهادة</span>
      </div>
      <div className="flex max-h-[540px] flex-col divide-y divide-white/5 overflow-y-auto">
        {workshop.participants.map((p) => {
          const attendance = getParticipantAttendance(p);
          const color = percentColor(attendance.percentage);
          const eligible = isCertificateEligible(p);
          return (
            <div key={p.participant_id} className={`grid ${COLS} w-full items-center gap-2 px-3 py-3 text-start text-sm`}>
              <span className="truncate">
                <span className="block truncate font-medium text-off-white">{p.name}</span>
                <span className="block truncate text-[11px] text-muted">{p.department}</span>
              </span>
              <span dir="ltr" className="truncate text-end text-muted">
                {p.phone}
              </span>
              <span dir="ltr" className="truncate text-end text-muted">
                {p.email}
              </span>
              <span
                className="justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ color, backgroundColor: `${color}1a` }}
              >
                {attendance.percentage.toFixed(1)}٪
              </span>
              <span className="justify-self-start font-semibold text-off-white">{attendance.attended}</span>
              <span className="justify-self-start font-semibold text-off-white">{attendance.missed}</span>
              <span className="justify-self-start">
                {eligible ? (
                  <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
                    <Award size={12} />
                    مستحق
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
