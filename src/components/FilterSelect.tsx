import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type FilterSelectProps<T extends string> = {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder: string;
  options: { value: T; label: string }[];
};

export default function FilterSelect<T extends string>({ label, value, onChange, placeholder, options }: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? placeholder;

  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide text-main-text">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-end gap-2 rounded-[10px] border border-white/10 bg-bg px-3 py-2 text-xs font-medium text-subtle-blue"
        >
          <ChevronDown size={14} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className={`flex-1 truncate text-right ${value !== null ? 'font-semibold text-main-text' : ''}`}>{selectedLabel}</span>
        </button>

        {open && (
          <>
            <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute start-0 top-full z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-[10px] border border-border bg-bg p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`block w-full truncate rounded-lg px-3 py-2 text-right text-xs ${
                  value === null ? 'bg-white/10 text-main-text' : 'text-subtle-blue hover:bg-white/5'
                }`}
              >
                {placeholder}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`block w-full truncate rounded-lg px-3 py-2 text-right text-xs ${
                    value === opt.value ? 'bg-peach/10 font-semibold text-peach' : 'text-subtle-blue hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
