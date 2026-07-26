import { ClipboardList, UsersRound, UserCheck, CheckCircle2 } from 'lucide-react';
import type { ParticipantKpis } from '../../state/participantSelectors';
import KpiCardGrid, { type KpiCardDef } from '../KpiCard';

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export default function ParticipantKpiCards({ kpis }: { kpis: ParticipantKpis }) {
  const acceptedPct = pct(kpis.totalAccepted, kpis.totalApplicants);
  const attendancePct = pct(kpis.totalAttendance, kpis.totalAccepted);
  const actualPct = pct(kpis.totalActualAttendance, kpis.totalAttendance);

  // DOM order = RTL reading order (first child renders rightmost, matching Figma L-to-R:
  // الحضور الفعلي · الحضور · المقبولون · إجمالي المسجلين).
  const cards: KpiCardDef[] = [
    {
      key: 'registrants',
      label: 'المسجلين',
      value: kpis.totalApplicants,
      sublabel: 'كامل',
      icon: ClipboardList,
      color: '#8e51ff',
      dot: '#a684ff',
    },
    {
      key: 'accepted',
      label: 'المقبولين',
      value: kpis.totalAccepted,
      sublabel: `${acceptedPct}% من الكل`,
      icon: UsersRound,
      color: '#00bc7d',
      dot: '#00d492',
    },
    {
      key: 'attendance',
      label: 'الحضور',
      value: kpis.totalAttendance,
      sublabel: `${attendancePct}% من المقبولين`,
      icon: UserCheck,
      color: '#00bba7',
      dot: '#14b8a6',
    },
    {
      key: 'actual-attendance',
      label: 'الحضور الفعلي',
      value: kpis.totalActualAttendance,
      sublabel: `${actualPct}% من الحضور`,
      icon: CheckCircle2,
      color: '#2b7fff',
      dot: '#51a2ff',
    },
  ];

  return <KpiCardGrid cards={cards} />;
}
