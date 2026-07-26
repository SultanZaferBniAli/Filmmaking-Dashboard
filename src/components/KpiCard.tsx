import type { LucideIcon } from 'lucide-react';

export type KpiCardDef = {
  key: string;
  label: string;
  value: number;
  sublabel?: string;
  icon: LucideIcon;
  color: string;
  dot?: string;
};

export function KpiCard({ card }: { card: KpiCardDef }) {
  const Icon = card.icon;
  return (
    <div className="flex h-full items-center gap-3 rounded-[11px] bg-surface p-4">
      <div className="flex flex-1 flex-col">
        <p className="w-full truncate text-right text-xs font-medium tracking-wide text-white/50">{card.label}</p>
        <p className="mt-1 w-full text-right text-[38px] font-bold leading-[38px] text-white">
          {card.value.toLocaleString('en-US')}
        </p>
        {/* Default flex-start packing = right-aligned under dir="rtl": sublabel text (first
            child) sits rightmost, the dot (second child) sits just to its left. */}
        {card.sublabel && (
          <div className="mt-1.5 flex w-full items-center gap-1.5">
            <span className="text-[11px] text-white/35">{card.sublabel}</span>
            {card.dot && <span className="size-1.5 shrink-0 rounded-[3px]" style={{ backgroundColor: card.dot }} />}
          </div>
        )}
      </div>
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${card.color}33` }}
      >
        <Icon size={20} style={{ color: card.color }} />
      </span>
    </div>
  );
}

export default function KpiCardGrid({ cards }: { cards: KpiCardDef[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.key} card={card} />
      ))}
    </div>
  );
}
