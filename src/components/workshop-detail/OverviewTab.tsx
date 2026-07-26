import { Award, MapPin, Video, ExternalLink, ChevronLeft } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { workshopTypeMeta } from '../../data/workshops';
import { nationalityByCode } from '../../data/trainers';
import { getParticipantAttendance, isCertificateEligible } from '../../state/selectors';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';

const typeLabelByKey = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.label]));

function percentColor(pct: number): string {
  if (pct >= 80) return 'var(--color-teal)';
  if (pct >= 60) return 'var(--color-orange)';
  return 'var(--color-notif-red)';
}

function Avatar({ name, image, size = 36 }: { name: string; image?: string | null; size?: number }) {
  const initial = name.trim().charAt(0);
  if (image) {
    return (
      <img
        src={resolveFileUrl(API_URL, image)}
        alt={name}
        className="shrink-0 rounded-full border-2 border-[#2d2d44] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-[#2d2d44] bg-white/10 font-semibold text-off-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}

export default function OverviewTab({
  workshop,
  onGoToParticipants,
  onNavigateToTrainer,
}: {
  workshop: Workshop;
  onGoToParticipants: () => void;
  onNavigateToTrainer: (trainerId: string) => void;
}) {
  const topParticipants = [...workshop.participants]
    .map((p) => ({ p, attendance: getParticipantAttendance(p) }))
    .sort((a, b) => b.attendance.percentage - a.attendance.percentage)
    .slice(0, 5);

  const trainerNationality = nationalityByCode[workshop.trainer_nationality];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Rightmost: workshop info */}
      <div dir="rtl" className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 lg:order-1">
        <h3 className="mb-5 text-start text-base font-bold text-main-text">معلومات عن الورشة</h3>

        <div className="mb-5 grid grid-cols-1 border-b border-white/10 pb-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          {(
            [
              ['الفئة', typeLabelByKey[workshop.workshop_type]],
              ['المستوى', workshop.level],
              ['اللغة', workshop.language],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1.5 border-b border-white/10 py-3 text-start last:border-b-0 sm:border-b-0 sm:border-e sm:px-5 sm:py-0 sm:first:ps-0 sm:last:border-e-0 sm:last:pe-0"
            >
              <span className="text-xs text-muted">{label}</span>
              <span className="text-sm font-bold text-white">{value}</span>
            </div>
          ))}
        </div>

        <p className="mb-1 text-start text-xs text-muted">الوصف</p>
        <p className="mb-4 text-start text-sm leading-relaxed text-body-text">{workshop.description}</p>

        <p className="mb-1 text-start text-xs text-muted">محاور</p>
        <ul className="flex flex-col gap-1.5">
          {workshop.objectives.map((obj, i) => (
            <li key={i} className="text-start text-sm leading-relaxed text-body-text">
              • {obj}
            </li>
          ))}
        </ul>
      </div>

      {/* Middle: trainer + location */}
      <div className="flex flex-col gap-4 lg:order-2">
        <div
          role={workshop.trainer_id ? 'button' : undefined}
          tabIndex={workshop.trainer_id ? 0 : undefined}
          onClick={workshop.trainer_id ? () => onNavigateToTrainer(workshop.trainer_id!) : undefined}
          onKeyDown={
            workshop.trainer_id
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigateToTrainer(workshop.trainer_id!);
                  }
                }
              : undefined
          }
          className={`relative rounded-2xl border border-white/5 bg-white/[0.02] p-5 ${
            workshop.trainer_id ? 'cursor-pointer transition-colors hover:border-orange/40 hover:bg-white/[0.04]' : ''
          }`}
        >
          {trainerNationality && (
            <img
              src={trainerNationality.flagIcon}
              alt={trainerNationality.nameAr}
              title={trainerNationality.nameAr}
              className="absolute end-4 top-4 h-6 w-6 rounded-full object-cover ring-1 ring-white/20"
            />
          )}
          <div className="mb-4 flex items-center gap-1.5">
            <h3 className="text-start text-base font-bold text-main-text">المدرب</h3>
            {workshop.trainer_id && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-orange">
                عرض الملف الشخصي
                <ChevronLeft size={12} />
              </span>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Avatar name={workshop.trainer_name} image={workshop.trainer_image} size={64} />
            <div className="text-start">
              <p className="text-sm font-semibold text-main-text">{workshop.trainer_name}</p>
              <p className="text-xs text-muted">مدرب {workshop.field}</p>
            </div>
          </div>
          <p className="mt-3 text-start text-sm leading-relaxed text-body-text">{workshop.trainer_bio}</p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-1.5">
            <MapPin size={14} className="text-muted" />
            <h3 className="text-base font-bold text-main-text">موقع الورشة</h3>
          </div>
          {workshop.location_type === 'in-person' ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/20 py-8">
              <MapPin size={28} className="text-peach" />
              <span className="text-sm font-medium text-main-text">{workshop.location_name}</span>
              {workshop.location_link && (
                <a
                  href={workshop.location_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-peach hover:underline"
                >
                  عرض على الخريطة
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/20 py-8">
              <Video size={28} className="text-peach" />
              <span className="text-sm font-medium text-main-text">{workshop.platform}</span>
              {workshop.meeting_link && (
                <a
                  href={workshop.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-peach hover:underline"
                >
                  رابط الاجتماع
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Leftmost: participants summary — stretches to match the middle column's height. */}
      <div className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] p-5 lg:order-3">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-main-text">ملخص المشاركين</h3>
          <button type="button" onClick={onGoToParticipants} className="text-xs font-medium text-peach hover:underline">
            عرض الكل
          </button>
        </div>

        {topParticipants.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle-blue">لا يوجد مشاركون بعد</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-1.5 px-1 text-[9px] text-muted sm:text-[10px] lg:text-xs">
              <span>الاسم</span>
              <span className="justify-self-center whitespace-nowrap">التقييم</span>
              <span className="justify-self-center whitespace-nowrap">الحضور</span>
              <span className="justify-self-center whitespace-nowrap">الغياب</span>
              <span className="justify-self-center whitespace-nowrap">الشهادة</span>
            </div>
            {topParticipants.map(({ p, attendance }) => {
              const eligible = isCertificateEligible(p);
              return (
                <div
                  key={p.participant_id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-1.5 rounded-xl bg-black/10 px-2 py-2 text-sm"
                >
                  <span className="text-start">
                    <span className="block text-[10px] font-medium text-off-white sm:text-[11px] lg:text-xs">{p.name}</span>
                    <span className="block text-[9px] text-muted sm:text-[10px] lg:text-[11px]">{p.department}</span>
                  </span>
                  <span
                    className="justify-self-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs lg:text-sm"
                    style={{ color: percentColor(attendance.percentage), backgroundColor: `${percentColor(attendance.percentage)}1a` }}
                  >
                    {attendance.percentage.toFixed(1)}٪
                  </span>
                  <span className="justify-self-center text-xs text-off-white sm:text-sm lg:text-base">{attendance.attended}</span>
                  <span className="justify-self-center text-xs text-off-white sm:text-sm lg:text-base">{attendance.missed}</span>
                  <span className="justify-self-center">
                    {eligible ? (
                      <Award size={14} className="text-gold" />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
