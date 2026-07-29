import { useState } from 'react';
import { Award, Download } from 'lucide-react';
import type { Workshop, WorkshopParticipant } from '../../data/workshops';
import { getParticipantAttendance, isCertificateEligible, CERTIFICATE_ATTENDANCE_THRESHOLD } from '../../state/selectors';
import { downloadCertificate, CertificateGenerationError } from '../../utils/exportCertificate';
import { useNotifications } from '../../state/NotificationsContext';

export default function CertificatesTab({ workshop }: { workshop: Workshop }) {
  const { addNotification } = useNotifications();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const eligible = workshop.participants.filter(isCertificateEligible);

  async function handleDownload(participant: WorkshopParticipant) {
    setDownloadingId(participant.participant_id);
    try {
      await downloadCertificate(workshop, participant);
    } catch (err) {
      addNotification(err instanceof CertificateGenerationError ? err.message : 'تعذّر إصدار الشهادة، حاول مرة أخرى.');
    } finally {
      setDownloadingId(null);
    }
  }

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
              onClick={() => handleDownload(p)}
              disabled={downloadingId === p.participant_id}
              className="mt-2 flex items-center gap-2 rounded-[10px] bg-gold/15 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/25 disabled:opacity-40"
            >
              <Download size={13} />
              {downloadingId === p.participant_id ? 'جارٍ التحميل...' : 'عرض / تحميل الشهادة'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
