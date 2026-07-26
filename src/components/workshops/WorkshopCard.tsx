import { useState } from 'react';
import { MapPin, Calendar, Users, Clapperboard, MoreVertical, Pencil, Trash2, FileSpreadsheet } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { workshopTypeMeta } from '../../data/workshops';
import { formatArabicDate } from '../../utils/date';
import { exportWorkshopExcel, WorkshopExportError } from '../../utils/exportWorkshopExcel';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';
import { useNotifications } from '../../state/NotificationsContext';

const typeColorByKey = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.color]));
const typeLabelByKey = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.label]));

function dateRangeLabel(w: Workshop): string {
  if (w.start_date === w.end_date) return formatArabicDate(w.start_date);

  const [, startM, startD] = w.start_date.split('-').map(Number);
  const [, endM, endD] = w.end_date.split('-').map(Number);
  const endLabel = formatArabicDate(w.end_date); // "24 مايو 2025"
  const [, endMonth, endYear] = endLabel.split(' ');

  if (startM === endM) return `${startD}–${endD} ${endMonth} ${endYear}`;
  const startMonth = formatArabicDate(w.start_date).split(' ')[1];
  return `${startD} ${startMonth} – ${endD} ${endMonth} ${endYear}`;
}

type Props = {
  workshop: Workshop;
  onViewDetails: (w: Workshop) => void;
  onEdit: (w: Workshop) => void;
  onDelete: (w: Workshop) => void;
};

export default function WorkshopCard({ workshop, onViewDetails, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { addNotification } = useNotifications();
  const color = typeColorByKey[workshop.workshop_type];
  const trainerInitial = workshop.trainer_name.replace(/^[أدم]\.\s*/, '').charAt(0);

  async function handleExport() {
    try {
      await exportWorkshopExcel(workshop);
    } catch (err) {
      addNotification(err instanceof WorkshopExportError ? err.message : 'تعذّر إصدار ملف الورشة، حاول مرة أخرى.');
    }
  }

  return (
    <div
      dir="rtl"
      className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[#1e1e30] bg-surface text-right shadow-[0_2px_16px_0px_rgba(0,0,0,0.4)]"
      style={{ direction: 'rtl', textAlign: 'right' }}
    >
      <div
        className="relative flex h-40 w-full items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${color}55, #0b1f2b)` }}
      >
        {workshop.workshop_image ? (
          <img src={resolveFileUrl(API_URL, workshop.workshop_image)} alt={workshop.workshop_name} className="size-full object-cover" />
        ) : (
          <Clapperboard size={40} style={{ color }} className="opacity-30" />
        )}
        <span
          className="absolute bottom-3 start-3 rounded-full border bg-bg px-3.5 py-1 text-xs font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          style={{ borderColor: color, color }}
        >
          {typeLabelByKey[workshop.workshop_type]}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-5">
        <h3 className="w-full truncate text-right text-[15px] font-bold text-main-text">{workshop.workshop_name}</h3>
        <p className="mt-1 w-full truncate text-right text-xs text-muted">{workshop.field}</p>

        <div className="my-2.5 h-px w-full bg-[#1e1e30]" />

        <div className="flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2">
            {workshop.trainer_image ? (
              <img
                src={resolveFileUrl(API_URL, workshop.trainer_image)}
                alt={workshop.trainer_name}
                className="size-[26px] shrink-0 rounded-full border-2 border-[#2d2d44] object-cover"
              />
            ) : (
              <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[#2d2d44] bg-white/10 text-[11px] font-semibold text-off-white">
                {trainerInitial}
              </span>
            )}
            <span className="font-medium text-off-white">{workshop.trainer_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">{workshop.city}</span>
            <MapPin size={14} className="text-muted" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-muted" />
            <span className="text-muted">{dateRangeLabel(workshop)}</span>
          </div>
          <div className="flex items-center gap-1.5" title="الحضور الفعلي / المقبولون">
            <span className="text-muted">
              {workshop.actual_attendance} / {workshop.total_accepted}
            </span>
            <Users size={14} className="text-muted" />
          </div>
        </div>

        <div className="my-2.5 h-px w-full bg-[#1e1e30]" />

        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-9 items-center justify-center rounded-[10px] border border-[#2d2d44] text-off-white"
              aria-label="خيارات"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-40" aria-label="إغلاق" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full z-50 mb-2 w-40 rounded-xl border border-border bg-bg p-1 shadow-xl start-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(workshop);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs text-off-white hover:bg-white/5"
                  >
                    <Pencil size={13} />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleExport();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs text-off-white hover:bg-white/5"
                  >
                    <FileSpreadsheet size={13} />
                    تصدير Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(workshop);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs text-notif-red hover:bg-notif-red/10"
                  >
                    <Trash2 size={13} />
                    حذف
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onViewDetails(workshop)}
            className="flex-1 rounded-[10px] border border-[#2d2d44] py-2 text-center text-[13px] font-medium text-off-white"
          >
            عرض التفاصيل
          </button>
        </div>
      </div>
    </div>
  );
}
