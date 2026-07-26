import { ClipboardList, User, UsersRound, BadgeCheck } from 'lucide-react';
import type { TrainerKpis } from '../../state/trainerSelectors';
import KpiCardGrid, { type KpiCardDef } from '../KpiCard';

export default function TrainerKpiCards({ kpis }: { kpis: TrainerKpis }) {
  // DOM order = RTL reading order (first child renders rightmost, matching Figma L-to-R:
  // الجهات · المدربون الدوليون · المدربون المحليون والإقليميون · إجمالي المدربين).
  const cards: KpiCardDef[] = [
    {
      key: 'total',
      label: 'الاجمالي',
      value: kpis.total,
      sublabel: 'عدد المدربين اجماليًا',
      icon: ClipboardList,
      color: '#8e51ff',
      dot: '#a684ff',
    },
    {
      key: 'international',
      label: 'عالمي',
      value: kpis.international,
      sublabel: 'عدد المدربين عالميًا',
      icon: User,
      color: '#00bba7',
      dot: '#14b8a6',
    },
    {
      key: 'local-regional',
      label: 'اقليمي ومحلي',
      value: kpis.localAndRegional,
      sublabel: 'عدد المدربين اقلميًا ومحليًا',
      icon: UsersRound,
      color: '#00bc7d',
      dot: '#00d492',
    },
    {
      key: 'agencies',
      label: 'الجهات',
      value: kpis.agencies,
      sublabel: 'عدد المدربين من الجهات',
      icon: BadgeCheck,
      color: '#2b7fff',
      dot: '#51a2ff',
    },
  ];

  return <KpiCardGrid cards={cards} />;
}
