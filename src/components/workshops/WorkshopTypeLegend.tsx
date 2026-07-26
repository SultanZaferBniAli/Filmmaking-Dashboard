import { workshopTypeMeta, type WorkshopType } from '../../data/workshops';

type Props = {
  activeType: WorkshopType | null;
  onSelect: (type: WorkshopType | null) => void;
};

const ALL_COLOR = 'var(--color-gold)';

export default function WorkshopTypeLegend({ activeType, onSelect }: Props) {
  return (
    <div
      dir="rtl"
      className="relative h-full overflow-hidden rounded-[18px] p-1 text-right shadow-[0_20px_60px_0px_rgba(0,0,0,0.5)]"
      style={{ backgroundImage: 'linear-gradient(156.8deg, #0e2535 6%, #0b1f2b 94%)', direction: 'rtl', textAlign: 'right' }}
    >
      <div className="absolute -left-10 -top-10 size-40 rounded-full opacity-[0.06] blur-[40px]" style={{ backgroundColor: ALL_COLOR }} />
      <h3 className="px-3 pb-2 pt-3 text-right text-[16px] font-bold tracking-wide text-main-text">
        مسارات الورش التدريبية
      </h3>

      <div className="flex flex-col gap-px px-2 pb-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1 transition-colors ${
            activeType === null ? 'bg-gold/[0.09]' : 'hover:bg-white/5'
          }`}
        >
          <span
            className="size-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: ALL_COLOR, boxShadow: activeType === null ? `0 0 8px 0 ${ALL_COLOR}` : 'none' }}
          />
          <span className={`flex-1 truncate text-right text-xs ${activeType === null ? 'font-semibold text-off-white' : 'text-white/40'}`}>
            الكل
          </span>
          {activeType === null && <span className="ml-auto h-[13px] w-0.5 rounded-full bg-gold shadow-[0_0_6px_0_var(--color-gold)]" />}
        </button>

        {workshopTypeMeta.map((t) => {
          const isActive = activeType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1 transition-colors ${
                isActive ? 'bg-white/5' : 'hover:bg-white/5'
              }`}
            >
              <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              <span className={`flex-1 truncate text-right text-xs ${isActive ? 'font-semibold text-off-white' : 'text-white/40'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
