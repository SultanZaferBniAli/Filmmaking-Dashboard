import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  Award,
  Clock,
  Star,
} from 'lucide-react';
import type { Participant, ParticipantWorkshop, AttendanceStatus } from '../../data/participants';
import { experienceLevelLabel, attendanceStatusLabel } from '../../data/participants';
import { regionNameByCode, workshopTypeLabel } from '../../data/workshops';
import CertificatePreviewModal from './CertificatePreviewModal';

type TabKey = 'personal' | 'workshops' | 'certificates';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'personal', label: 'المعلومات الشخصية' },
  { key: 'workshops', label: 'سجل الورش' },
  { key: 'certificates', label: 'الشهادات' },
];

const attendanceStatusColor: Record<AttendanceStatus, string> = {
  registered: '#7a7d8a',
  accepted: '#4fbaf0',
  partial: '#ff9619',
  attended: '#91b9b4',
  actual_attendance: '#00bc7d',
  absent: '#ef4444',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {label}
    </span>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col items-start gap-0.5 text-right">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {label}
        <Icon size={12} />
      </span>
      <span className="text-sm font-medium text-off-white">{value}</span>
    </div>
  );
}

export default function ParticipantExpandedDetails({ participant }: { participant: Participant }) {
  const [tab, setTab] = useState<TabKey>('personal');
  const [certificateTarget, setCertificateTarget] = useState<ParticipantWorkshop | null>(null);

  const eligibleWorkshops = participant.workshops.filter((w) => w.completed && w.attendanceStatus === 'actual_attendance');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`w-full rounded-[10px] px-3 py-2 text-center text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-white/10 text-main-text' : 'text-subtle-blue hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Field icon={Phone} label="رقم الجوال" value={participant.phone} />
            <Field icon={Mail} label="البريد الإلكتروني" value={participant.email} />
            <Field icon={MapPin} label="المدينة / المنطقة" value={participant.city && participant.region ? `${participant.city} — ${regionNameByCode[participant.region]}` : undefined} />
            <Field icon={Calendar} label="تاريخ الميلاد" value={participant.dateOfBirth} />
            <Field icon={Briefcase} label="المسمى الوظيفي" value={participant.jobTitle} />
            <Field icon={Briefcase} label="جهة العمل" value={participant.employer} />
            <Field icon={GraduationCap} label="التعليم" value={participant.education} />
            <Field icon={Star} label="التخصص" value={participant.specialization} />
            <Field icon={Clock} label="سنوات الخبرة" value={participant.experienceYears} />
            <Field icon={Clock} label="مستوى الخبرة" value={experienceLevelLabel[participant.experienceLevel]} />
          </div>

          {participant.biography && (
            <p className="mt-4 text-right text-sm leading-relaxed text-body-text">{participant.biography}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {participant.portfolioUrl && (
              <a
                href={participant.portfolioUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-[#2d2d44] px-4 py-2 text-sm text-off-white hover:bg-white/5"
              >
                <LinkIcon size={14} />
                رابط الأعمال
              </a>
            )}
          </div>
        </div>
      )}

      {tab === 'workshops' && (
        <div className="flex flex-col gap-3">
          {participant.workshops.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-subtle-blue">
              لا يوجد ورش مسجلة لهذا المشارك.
            </p>
          ) : (
            participant.workshops.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge label={attendanceStatusLabel[w.attendanceStatus]} color={attendanceStatusColor[w.attendanceStatus]} />
                    {w.completed && <Badge label="مكتمل" color="#c9a84c" />}
                  </div>
                  <p className="text-sm font-semibold text-off-white">{w.workshopName}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field icon={Briefcase} label="المجال" value={w.workshopField} />
                  <Field icon={Briefcase} label="نوع الورشة" value={workshopTypeLabel[w.workshopType]} />
                  <Field icon={Briefcase} label="المدرب" value={w.trainerName} />
                  <Field icon={MapPin} label="المدينة / المنطقة" value={`${w.city} — ${regionNameByCode[w.region]}`} />
                  <Field icon={Calendar} label="تاريخ البداية" value={w.startDate} />
                  <Field icon={Calendar} label="تاريخ النهاية" value={w.endDate} />
                  <Field icon={Clock} label="إجمالي الساعات" value={w.totalHours} />
                  <Field icon={Star} label="نسبة الحضور" value={`${w.attendancePercentage}٪`} />
                  {w.participantRating !== undefined && <Field icon={Star} label="تقييم المشارك" value={`${w.participantRating}/5`} />}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'certificates' && (
        <div className="flex flex-col gap-3">
          {participant.workshops.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-subtle-blue">
              لم يكمل المشارك أي ورشة حتى الآن
            </p>
          ) : eligibleWorkshops.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-subtle-blue">
              لم يكمل المشارك أي ورشة حتى الآن
            </p>
          ) : (
            eligibleWorkshops.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 p-4">
                <div className="flex items-center gap-2">
                  {w.certificate?.available ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCertificateTarget(w)}
                        className="flex items-center gap-2 rounded-xl bg-gold/15 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/25"
                      >
                        <Award size={13} />
                        عرض الشهادة
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-subtle-blue">تم استكمال الورشة، والشهادة قيد الإصدار</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-off-white">{w.workshopName}</p>
                  {w.certificate?.certificateNumber && (
                    <p className="text-xs text-muted">
                      {w.certificate.certificateNumber} · {w.certificate.issueDate}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {certificateTarget && (
        <CertificatePreviewModal participant={participant} workshop={certificateTarget} onClose={() => setCertificateTarget(null)} />
      )}
    </div>
  );
}
