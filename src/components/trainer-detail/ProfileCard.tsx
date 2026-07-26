import { useState, type ComponentType } from 'react';
import { BadgeCheck, Briefcase, BookOpen, Camera, Check, CircleCheck, Clapperboard, Copy, Globe, ImageIcon, Music2, Palette, Video } from 'lucide-react';
import type { Trainer } from '../../data/trainers';
import { nationalityByCode } from '../../data/trainers';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';
import { useNotifications } from '../../state/NotificationsContext';
import DocumentPreviewModal from '../trainers/DocumentPreviewModal';

const categoryLabel: Record<Trainer['category'], string> = {
  local: 'محلي',
  regional: 'إقليمي',
  international: 'دولي',
};

// The source data only records account/platform *names* the trainer is listed on (e.g. "IMDb",
// "LinkedIn"), not actual profile URLs — so these render as informational badges, not links.
const ACCOUNT_ICON: Record<string, ComponentType<{ size?: number }>> = {
  imdb: Clapperboard,
  linkedin: Briefcase,
  instagram: Camera,
  wikipedia: BookOpen,
  vimeo: Video,
  soundcloud: Music2,
  behance: Palette,
};

function accountIcon(name: string): ComponentType<{ size?: number }> {
  return ACCOUNT_ICON[name.trim().toLowerCase()] ?? Globe;
}

type Props = {
  trainer: Trainer;
  className?: string;
};

export default function ProfileCard({ trainer, className }: Props) {
  const { addNotification } = useNotifications();
  const [copied, setCopied] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const flag = nationalityByCode[trainer.nationalityCode];
  const expertise = trainer.expertise ?? [];

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(trainer.email);
      addNotification(trainer.email ? `تم نسخ البريد الإلكتروني: ${trainer.email}` : 'لا يتوفر بريد إلكتروني لهذا المدرب حالياً.');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      addNotification('تعذّر نسخ البريد الإلكتروني.');
    }
  }

  return (
    <div
      dir="rtl"
      className={`flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-surface p-6 text-center shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)] ${className ?? ''}`}
    >
      {trainer.profileImage ? (
        <img
          src={resolveFileUrl(API_URL, trainer.profileImage)}
          alt={trainer.fullName}
          className="size-36 rounded-full border-4 border-orange object-cover"
        />
      ) : (
        <span className="flex size-36 items-center justify-center rounded-full border-4 border-orange bg-white/10 text-4xl font-bold text-off-white">
          {trainer.fullName.trim().charAt(0)}
        </span>
      )}

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-main-text">{trainer.fullName}</h2>
          {flag && (
            <img
              src={flag.flagIcon}
              alt={trainer.nationality}
              title={trainer.nationality}
              className="size-5 shrink-0 rounded-full border border-white/10 object-cover"
            />
          )}
        </div>
        <p className="text-sm text-subtle-blue">{trainer.position}</p>
        {trainer.company && <p className="text-xs text-muted">{trainer.company}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-off-white">
          {categoryLabel[trainer.category]}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
          <BadgeCheck size={13} />
          {trainer.position ? `${trainer.position} – مدرب معتمد` : 'مدرب معتمد'}
        </span>
      </div>

      {trainer.accounts && trainer.accounts.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {trainer.accounts.map((name) => {
            const Icon = accountIcon(name);
            return (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-xs font-medium text-main-text"
              >
                <Icon size={14} />
                {name}
              </span>
            );
          })}
        </div>
      )}

      {trainer.biography && (
        <div className="w-full rounded-xl border-e-[3px] border-orange/50 bg-black/10 p-4 text-right">
          <p className="mb-1.5 text-base font-bold text-main-text">نبذة مهنية</p>
          <p className="text-xs leading-relaxed text-body-text">{trainer.biography}</p>
        </div>
      )}

      {expertise.length > 0 && (
        <>
          <div className="h-px w-full bg-white/5" />

          <ul className="flex w-full flex-col gap-2.5">
            {expertise.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-right text-sm text-body-text">
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-orange" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={handleCopyEmail}
          className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-[#06131c] transition-all duration-200 ${
            copied ? 'scale-[1.02] bg-teal' : 'bg-orange hover:brightness-110'
          }`}
        >
          {copied ? <Check size={16} className="animate-[pop_0.25s_ease-out]" /> : <Copy size={16} />}
          {copied ? 'تم نسخ البريد الإلكتروني' : 'نسخ البريد الإلكتروني'}
        </button>
        <button
          type="button"
          onClick={() => setShowPassport(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-border px-4 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ImageIcon size={18} />
          عرض جواز السفر
        </button>
      </div>

      {showPassport && <DocumentPreviewModal trainer={trainer} kind="passport" onClose={() => setShowPassport(false)} />}
    </div>
  );
}
