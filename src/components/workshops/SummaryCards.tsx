import { Film, Calendar, Play, CheckCircle2 } from 'lucide-react';

type SummaryCardDef = {
  key: string;
  label: string;
  value: number;
  sublabel: string;
  icon: typeof Film;
  color: string;
  glow: string;
};

function SummaryCard({ card }: { card: SummaryCardDef }) {
  const Icon = card.icon;
  return (
    <div
      dir="rtl"
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-surface p-5 text-right shadow-[0_8px_32px_0px_rgba(0,0,0,0.4)]"
      style={{ direction: 'rtl', textAlign: 'right' }}
    >
      <div
        className="absolute -top-5 left-1/2 size-20 -translate-x-1/2 rounded-full opacity-[0.06] blur-[30px]"
        style={{ backgroundColor: card.glow }}
      />

      {/* Icon aligned to the right; title stacked directly under it, also right-aligned. */}
      <div className="flex w-full">
        <span
          className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: card.color, boxShadow: `0 4px 6px ${card.color}45` }}
        >
          <Icon size={18} className="text-white" />
        </span>
      </div>

      <span className="mt-5 w-full truncate text-right text-sm font-semibold tracking-wide text-white/70">{card.label}</span>

      <div className="mt-auto flex w-full flex-col items-start text-right">
        <span className="w-full text-right text-[38px] font-bold leading-none text-white">{card.value}</span>
        {/* Default flex-start packing = right-aligned under dir="rtl": sublabel (first child)
            sits rightmost, the dot (second child) sits just to its left. */}
        <div className="mt-1.5 flex w-full items-center gap-1.5">
          <span className="text-[11px] text-white/35">{card.sublabel}</span>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: card.glow }} />
        </div>
      </div>
    </div>
  );
}

type Props = {
  total: number;
  scheduled: number;
  ongoing: number;
  completed: number;
};

export default function SummaryCards({ total, scheduled, ongoing, completed }: Props) {
  // DOM order = RTL reading order (first child renders rightmost, matching Figma L-to-R:
  // المكتملة · الجارية · المجدولة · إجمالي الورش).
  const cards: SummaryCardDef[] = [
    {
      key: 'total',
      label: 'إجمالي الورش',
      value: total,
      sublabel: 'طوال الوقت',
      icon: Film,
      color: 'var(--color-status-total)',
      glow: 'var(--color-status-total-glow)',
    },
    {
      key: 'scheduled',
      label: 'الورش المجدولة',
      value: scheduled,
      sublabel: 'خلال 30 يوماً',
      icon: Calendar,
      color: 'var(--color-status-scheduled)',
      glow: 'var(--color-status-scheduled)',
    },
    {
      key: 'ongoing',
      label: 'الورش الجارية',
      value: ongoing,
      sublabel: 'قيد التنفيذ',
      icon: Play,
      color: 'var(--color-status-ongoing)',
      glow: 'var(--color-status-ongoing-glow)',
    },
    {
      key: 'completed',
      label: 'الورش المكتملة',
      value: completed,
      sublabel: 'طوال الوقت',
      icon: CheckCircle2,
      color: 'var(--color-status-completed)',
      glow: 'var(--color-status-completed-glow)',
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <SummaryCard key={card.key} card={card} />
      ))}
    </>
  );
}
