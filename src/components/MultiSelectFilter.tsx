import { useEffect, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

type Option = { value: string; label: string };

type Props = {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function MultiSelectFilter({ label, placeholder, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Light debounce on the search box — dataset is small but this keeps the filter
  // responsive without re-filtering on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredOptions = options.filter((opt) => opt.label.toLowerCase().includes(search.trim().toLowerCase()));

  const buttonLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? placeholder)
        : `${selected.length} محدد`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function handleKeyDown(e: React.KeyboardEvent, value: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(value);
    }
  }

  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide text-main-text">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-end gap-2 rounded-[10px] border border-white/10 bg-bg px-3 py-2 text-xs font-medium text-subtle-blue"
        >
          <ChevronDown size={14} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className={`flex-1 truncate text-right ${selected.length > 0 ? 'font-semibold text-main-text' : ''}`}>
            {buttonLabel}
          </span>
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="مسح الاختيار"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
            >
              <X size={11} />
            </span>
          )}
        </button>

        {open && (
          <>
            <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              role="listbox"
              aria-multiselectable="true"
              className="absolute start-0 top-full z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-[10px] border border-border bg-bg shadow-xl"
            >
              <div className="relative border-b border-white/10 p-2">
                <Search size={13} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="بحث..."
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-1.5 pe-8 text-right text-xs text-main-text outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto p-1">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs ${
                    selected.length === 0 ? 'bg-white/10 text-main-text' : 'text-subtle-blue hover:bg-white/5'
                  }`}
                >
                  {selected.length === 0 && <Check size={13} />}
                  <span className="flex-1 text-right">{placeholder}</span>
                </button>
                {filteredOptions.length === 0 && (
                  <p className="px-3 py-3 text-center text-xs text-muted">لا توجد نتائج</p>
                )}
                {filteredOptions.map((opt) => {
                  const isSelected = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(opt.value)}
                      onKeyDown={(e) => handleKeyDown(e, opt.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-xs ${
                        isSelected ? 'bg-peach/10 font-semibold text-peach' : 'text-subtle-blue hover:bg-white/5'
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                      <span className="flex-1 truncate text-right">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
