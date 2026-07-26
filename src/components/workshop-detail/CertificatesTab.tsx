import { Award, Download } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { getParticipantAttendance, isCertificateEligible, CERTIFICATE_ATTENDANCE_THRESHOLD } from '../../state/selectors';
import { downloadCertificate } from '../../utils/exportCertificate';

export default function CertificatesTab({ workshop }: { workshop: Workshop }) {
  const eligible = workshop.participants.filter(isCertificateEligible);

  if (workshop.participants.length === 0) {
    return <p className="py-10 text-center text-sm text-subtle-blue">لا يوجد مشاركون في هذه الورشة بعد.</p>;
  }

  if (eligible.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-subtle-blue">
        لا يوجد مشاركون مستحقون للشهادة بعد (يتطلب نسبة حضور {CERTIFICATE_ATTENDANCE_THRESHOLD}٪ فأكثر).
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {eligible.map((p) => {
        const attendance = getParticipantAttendance(p);
        return (
          <div
            key={p.participant_id}
            className="flex flex-col items-center gap-3 rounded-2xl border border-gold/20 p-5 text-center"
            style={{ backgroundImage: 'linear-gradient(160deg, rgba(201,168,76,0.08), rgba(11,31,43,0.9))' }}
          >
            <Award size={32} className="text-gold" />
            <p className="text-sm font-bold text-main-text">{p.name}</p>
            <p className="text-xs text-muted">{workshop.workshop_name}</p>
            <p className="text-xs text-teal">نسبة الحضور {attendance.percentage.toFixed(1)}٪</p>
            <button
              type="button"
              onClick={() => downloadCertificate(workshop, p)}
              className="mt-2 flex items-center gap-2 rounded-[10px] bg-gold/15 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/25"
            >
              <Download size={13} />
              عرض / تحميل الشهادة
            </button>
          </div>
        );
      })}
    </div>
  );
}
