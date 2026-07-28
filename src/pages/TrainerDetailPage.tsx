import { useEffect, useState } from 'react';
import { Award, Calendar, ChevronLeft, FileSpreadsheet, MapPin } from 'lucide-react';
import type { Trainer } from '../data/trainers';
import ProfileCard from '../components/trainer-detail/ProfileCard';
import InfoCard from '../components/trainer-detail/InfoCard';
import ProjectsTimeline from '../components/trainer-detail/ProjectsTimeline';
import { exportTrainerExcel, TrainerExportError } from '../utils/exportTrainerExcel';
import { useNotifications } from '../state/NotificationsContext';

type Props = {
  trainer: Trainer;
  onBack: () => void;
};

export default function TrainerDetailPage({ trainer, onBack }: Props) {
  const { addNotification } = useNotifications();
  const [exporting, setExporting] = useState(false);

  // This page replaces the trainers list in place (no route change), so the browser keeps
  // whatever scroll position the list was at instead of starting at the top of the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await exportTrainerExcel(trainer);
    } catch (err) {
      addNotification(err instanceof TrainerExportError ? err.message : 'تعذّر إصدار ملف المدرب، حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <div className="flex items-center gap-2 text-sm text-subtle-blue">
        <button type="button" onClick={onBack} className="hover:text-main-text">
          المدربين
        </button>
        <ChevronLeft size={14} />
        <span className="font-medium text-main-text">الملف الشخصي للمدرب</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-right text-2xl font-bold text-main-text">الملف الشخصي للمدرب</h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-main-text disabled:opacity-60"
        >
          <FileSpreadsheet size={16} />
          {exporting ? 'جارٍ التحميل...' : 'تحميل بيانات المدرب'}
        </button>
      </div>

      {/* DOM order = RTL reading order: profile (rightmost) · info cards (middle). Stacked on
          mobile/tablet, side by side from xl up — see the grid template below. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr] xl:items-start">
        <ProfileCard trainer={trainer} />

        <div className="flex flex-col gap-5">
          <InfoCard title="تفاصيل الورشة">
            {trainer.workshops.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {trainer.workshops.map((w) => (
                  <li key={w.id} className="rounded-xl border border-white/5 bg-black/10 px-4 py-3">
                    <p className="text-sm font-semibold text-off-white">{w.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        {w.city}
                        <MapPin size={12} />
                      </span>
                      <span className="flex items-center gap-1.5">
                        {w.year}
                        <Calendar size={12} />
                      </span>
                      <span>{w.field}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">لا توجد ورش مسندة لهذا المدرب حالياً.</p>
            )}
          </InfoCard>

          <InfoCard title="الجوائز والترشيحات">
            {trainer.awards && trainer.awards.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {trainer.awards.map((a, i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-black/10 px-4 py-3">
                    <span className="flex-1 text-sm text-off-white">
                      {a.title}
                      {a.year ? ` — ${a.year}` : ''}
                    </span>
                    <Award size={16} className="shrink-0 text-gold" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">لا توجد جوائز أو ترشيحات مسجلة.</p>
            )}
          </InfoCard>

          <ProjectsTimeline trainer={trainer} />
        </div>
      </div>
    </main>
  );
}
