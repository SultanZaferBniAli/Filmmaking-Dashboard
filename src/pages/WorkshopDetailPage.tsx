import { useEffect, useState } from 'react';
import { ChevronLeft, Award, FileText, BookOpen, Clapperboard, User, MapPin, Calendar, Clock, Users, ClipboardList, UserCheck, CheckCircle2, Mars, Venus } from 'lucide-react';
import type { Workshop } from '../data/workshops';
import { workshopTypeMeta, workshopPhaseLabel } from '../data/workshops';
import { getWorkshopPhase } from '../state/selectors';
import { formatArabicDate } from '../utils/date';
import OverviewTab from '../components/workshop-detail/OverviewTab';
import ParticipantsTab from '../components/workshop-detail/ParticipantsTab';
import AttendanceTab from '../components/workshop-detail/AttendanceTab';
import CertificatesTab from '../components/workshop-detail/CertificatesTab';
import RatingsTab from '../components/workshop-detail/RatingsTab';
import DocumentActionButton from '../components/workshop-detail/DocumentActionButton';
import { downloadAllCertificatesZip } from '../utils/exportCertificate';
import { previewParticipantGuidePdf } from '../utils/exportParticipantGuidePdf';
import { downloadWorkshopReportPptx, ReportGenerationError } from '../utils/exportReportPptx';
import { useNotifications } from '../state/NotificationsContext';
import { useAuth } from '../state/AuthContext';
import { API_URL } from '../data/api';
import { resolveFileUrl } from '../utils/resolveFileUrl';

const typeColorByKey = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.color]));

export type DetailTabKey = 'overview' | 'participants' | 'attendance' | 'certificates' | 'ratings';

const tabs: { key: DetailTabKey; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'participants', label: 'المشاركين' },
  { key: 'attendance', label: 'الحضور' },
  { key: 'certificates', label: 'الشهادات' },
  { key: 'ratings', label: 'التقييمات' },
];

function dateRangeLabel(w: Workshop): string {
  if (w.start_date === w.end_date) return formatArabicDate(w.start_date);
  const [, startM, startD] = w.start_date.split('-').map(Number);
  const [, endM, endD] = w.end_date.split('-').map(Number);
  const endLabel = formatArabicDate(w.end_date);
  const [, endMonth, endYear] = endLabel.split(' ');
  if (startM === endM) return `${startD} – ${endD} ${endMonth} ${endYear}`;
  const startMonth = formatArabicDate(w.start_date).split(' ')[1];
  return `${startD} ${startMonth} – ${endD} ${endMonth} ${endYear}`;
}

function sessionDays(w: Workshop): number {
  const start = new Date(w.start_date + 'T00:00:00Z').getTime();
  const end = new Date(w.end_date + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function InfoCell({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex-1 border-e border-white/5 px-4 py-3 text-right last:border-e-0">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>{label}</span>
        <Icon size={14} />
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-main-text">{value}</p>
    </div>
  );
}

function StatCell({
  icon: Icon,
  color,
  label,
  value,
  male,
  female,
}: {
  icon: typeof User;
  color: string;
  label: string;
  value: number;
  male: number;
  female: number;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 border-e border-white/5 px-3 py-2 last:border-e-0">
      <p className="text-start text-xs text-muted">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-xl font-bold text-main-text">{value.toLocaleString('en-US')}</p>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22` }}>
          <Icon size={20} style={{ color }} />
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-subtle-blue">
          <Mars size={12} />
          <span className="font-semibold text-male">{male.toLocaleString('en-US')}</span>
        </span>
        <span className="flex items-center gap-1 text-subtle-blue">
          <Venus size={12} />
          <span className="font-semibold text-female">{female.toLocaleString('en-US')}</span>
        </span>
      </div>
    </div>
  );
}

type Props = {
  workshop: Workshop;
  onBack: () => void;
  onUpdateWorkshop: (updated: Workshop) => void;
  onNavigateToTrainer: (trainerId: string) => void;
};

export default function WorkshopDetailPage({ workshop, onBack, onUpdateWorkshop, onNavigateToTrainer }: Props) {
  const { addNotification } = useNotifications();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<DetailTabKey>('overview');
  const [generatingReport, setGeneratingReport] = useState(false);
  const phase = getWorkshopPhase(workshop);
  const color = typeColorByKey[workshop.workshop_type];

  // This page replaces the workshops list in place (no route change), so the browser keeps
  // whatever scroll position the list was at instead of starting at the top of the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function handleGenerateGuide() {
    await previewParticipantGuidePdf(workshop);
  }

  async function handleDownloadReport() {
    setGeneratingReport(true);
    try {
      await downloadWorkshopReportPptx(workshop);
    } catch (err) {
      addNotification(err instanceof ReportGenerationError ? err.message : 'تعذّر إصدار التقرير، حاول مرة أخرى.');
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <div className="flex items-center gap-2 text-sm text-subtle-blue">
        <button type="button" onClick={onBack} className="hover:text-main-text">
          الورش
        </button>
        <ChevronLeft size={14} />
        <span className="font-medium text-main-text">تفاصيل الورشة</span>
      </div>
      <h1 className="text-right text-2xl font-bold text-main-text">تفاصيل الورشة</h1>

      <div className="rounded-[20px] bg-surface shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 pt-5">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => downloadAllCertificatesZip(workshop)}
              className="flex items-center gap-2 rounded-[10px] bg-male px-4 py-2 text-sm font-semibold text-[#06131c]"
            >
              <Award size={16} />
              إصدار الشهادات
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={generatingReport}
                className="flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-main-text disabled:opacity-60"
              >
                <FileText size={16} />
                {generatingReport ? 'جارٍ إنشاء التقرير...' : 'إنشاء التقرير'}
              </button>
            )}

            {isAdmin && (
              <DocumentActionButton
                icon={BookOpen}
                label="دليل المشارك"
                workshop={workshop}
                kind="guide"
                onGenerate={handleGenerateGuide}
                onUpdateWorkshop={onUpdateWorkshop}
              />
            )}
          </div>
        </div>

        {/* Title + status badge (right) + cover image (left) */}
        <div className="flex flex-wrap items-center gap-5 px-5 pt-5">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-main-text">{workshop.workshop_name}</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-main-text">
              {workshopPhaseLabel[phase]}
            </span>
          </div>
          <div
            className="flex h-[110px] w-[160px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: `linear-gradient(160deg, ${color}55, #0b1f2b)` }}
          >
            {workshop.workshop_image ? (
              <img src={resolveFileUrl(API_URL, workshop.workshop_image)} alt={workshop.workshop_name} className="size-full object-cover" />
            ) : (
              <Clapperboard size={32} style={{ color }} className="opacity-40" />
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-5 flex flex-wrap border-t border-white/5">
          <InfoCell icon={User} label="المدرب" value={workshop.trainer_name} />
          <InfoCell icon={MapPin} label="المدينة" value={workshop.city} />
          <InfoCell icon={Calendar} label="التاريخ" value={dateRangeLabel(workshop)} />
          <InfoCell icon={Clock} label="المدة" value={`${sessionDays(workshop)} أيام`} />
          <InfoCell icon={Users} label="السعة" value={`${workshop.capacity} مشارك`} />
        </div>

        {/* Stat row */}
        <div className="flex flex-wrap border-t border-white/5">
          <StatCell
            icon={ClipboardList}
            color="var(--color-mauve)"
            label="المسجلين"
            value={workshop.registered_participants}
            male={workshop.male_applications}
            female={workshop.female_applications}
          />
          <StatCell
            icon={UserCheck}
            color="var(--color-teal)"
            label="المقبولون"
            value={workshop.total_accepted}
            male={workshop.male_accepted}
            female={workshop.female_accepted}
          />
          <StatCell
            icon={User}
            color="var(--color-asir-navy)"
            label="الحضور"
            value={workshop.total_attendance}
            male={workshop.male_attendance}
            female={workshop.female_attendance}
          />
          <StatCell
            icon={CheckCircle2}
            color="var(--color-male)"
            label="الحضور الفعلي"
            value={workshop.actual_attendance}
            male={workshop.male_actual_attendance}
            female={workshop.female_actual_attendance}
          />
        </div>

        {/* Tabs — 5 equal-width columns stretching across the full card width */}
        <div className="grid grid-cols-2 gap-2 border-t border-white/5 px-5 py-4 sm:grid-cols-3 md:grid-cols-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`w-full rounded-[10px] px-4 py-2 text-center text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white/10 text-main-text' : 'text-subtle-blue hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border-t border-white/5 p-5">
          {tab === 'overview' && (
            <OverviewTab workshop={workshop} onGoToParticipants={() => setTab('participants')} onNavigateToTrainer={onNavigateToTrainer} />
          )}
          {tab === 'participants' && <ParticipantsTab workshop={workshop} />}
          {tab === 'attendance' && <AttendanceTab workshop={workshop} onUpdateWorkshop={onUpdateWorkshop} />}
          {tab === 'certificates' && <CertificatesTab workshop={workshop} />}
          {tab === 'ratings' && <RatingsTab workshop={workshop} />}
        </div>
      </div>
    </main>
  );
}
