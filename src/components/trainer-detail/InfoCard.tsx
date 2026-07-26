import type { ReactNode } from 'react';

type Props = {
  title: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function InfoCard({ title, headerExtra, children, className }: Props) {
  return (
    <section
      dir="rtl"
      className={`rounded-2xl border border-white/5 bg-surface p-5 text-right shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)] ${className ?? ''}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-main-text">{title}</h3>
        {headerExtra}
      </div>
      {children}
    </section>
  );
}
