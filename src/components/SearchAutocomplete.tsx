import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  label?: string;
};

function HighlightedLabel({ text, query }: { text: string; query: string }) {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-peach">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchAutocomplete({ value, onChange, options, placeholder, label }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const suggestions = query.length > 0 ? options.filter((o) => o.toLowerCase().includes(query)).slice(0, 8) : [];

  useEffect(() => {
    setHighlighted(0);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectSuggestion(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSuggestion(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="flex w-full max-w-md flex-col gap-1.5">
      {label && <label className="text-xs font-medium tracking-wide text-main-text">{label}</label>}
      <div className="relative">
        {value ? (
          <button
            type="button"
            aria-label="مسح البحث"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-white/50 hover:text-white"
          >
            <X size={14} />
          </button>
        ) : (
          <Search size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-white/40" />
        )}
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-[10px] border border-white/10 bg-bg py-2 pe-9 ps-3 text-sm text-main-text outline-none text-right"
        />

        {open && suggestions.length > 0 && (
          <div className="absolute start-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-[10px] border border-border bg-bg shadow-xl">
            {suggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
                className={`block w-full truncate px-3 py-2 text-right text-sm ${
                  idx === highlighted ? 'bg-white/10 text-main-text' : 'text-subtle-blue hover:bg-white/5'
                }`}
              >
                <HighlightedLabel text={s} query={value.trim()} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
