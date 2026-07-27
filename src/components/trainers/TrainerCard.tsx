import { useState } from 'react';
import { Film, MoreVertical, Pencil, Star, Trash2, UserRound, Users } from 'lucide-react';

export interface TrainerCardProps {
  id: string;
  name: string;
  image: string | null;
  nationality: string;
  flag: string;
  role: string;
  specialization: string;
  expertise: string[];
  rating?: number;
  traineesCount?: number;
  imagePosition?: string;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TrainerCard({
  name,
  image,
  nationality,
  flag,
  role,
  specialization,
  expertise,
  rating,
  traineesCount,
  imagePosition = 'center',
  onClick,
  onEdit,
  onDelete,
}: TrainerCardProps) {
  const hasStats = rating !== undefined || traineesCount !== undefined;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      dir="rtl"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group relative aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-[26px] bg-bg shadow-[0_20px_40px_-14px_rgba(0,0,0,0.6),0_10px_26px_-10px_rgba(255,150,25,0.14)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_30px_56px_-12px_rgba(0,0,0,0.65),0_16px_38px_-8px_rgba(255,150,25,0.3)]"
      style={{ direction: 'rtl' }}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          style={{ objectPosition: imagePosition }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#15304a] to-[#06131c] transition-transform duration-300 ease-out group-hover:scale-[1.04]">
          <UserRound size={72} className="text-white/15" />
        </div>
      )}

      {/* Dark scrim so the overlaid text stays readable over the photo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(4, 20, 31, 1) 0%, rgba(4, 20, 31, 0.95) 30%, rgba(4, 20, 31, 0.45) 58%, transparent 78%)',
        }}
      />

      {(onEdit || onDelete) && (
        <div className="absolute start-3 top-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white backdrop-blur-sm"
            aria-label="خيارات"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="إغلاق"
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div className="absolute top-full z-50 mt-2 w-36 rounded-xl border border-border bg-bg p-1 shadow-xl start-0">
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs text-off-white hover:bg-white/5"
                  >
                    <Pencil size={13} />
                    تعديل
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs text-notif-red hover:bg-notif-red/10"
                  >
                    <Trash2 size={13} />
                    حذف
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5 text-right">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold text-white">{name}</h3>
            {flag && (
              <img src={flag} alt={nationality} title={nationality} className="size-[18px] shrink-0 rounded-full border border-white/20 object-cover" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/65">
            <span className="truncate">{role}</span>
            <Film size={12} className="shrink-0" />
          </div>
          {specialization && <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-white/50">{specialization}</p>}
        </div>

        {expertise.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {expertise.slice(0, 3).map((tag, i) => (
              <span
                key={tag}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${
                  i === 0 ? 'border-orange/60 bg-orange/10 text-orange' : 'border-white/15 bg-black/20 text-white/70'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {hasStats && (
          <div className="flex items-center gap-4 border-t border-white/10 pt-2.5 text-xs text-white/65">
            {rating !== undefined && (
              <span className="flex items-center gap-1">
                <Star size={13} className="fill-orange text-orange" />
                {rating.toFixed(1)}
              </span>
            )}
            {traineesCount !== undefined && (
              <span className="flex items-center gap-1">
                <Users size={13} />
                {traineesCount.toLocaleString('en-US')}
              </span>
            )}
          </div>
        )}

        {/* Reveal-on-hover: grows in place via grid-template-rows so it never reserves dead
            space while the card sits idle, and never causes the content above it to jump. */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] border border-orange/40 bg-orange/15 px-4 py-2.5 text-sm font-semibold text-orange opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100"
              style={{ boxShadow: '0 0 20px rgba(255, 150, 25, 0.2)' }}
            >
              <UserRound size={15} />
              عرض الملف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
