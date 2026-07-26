import type { Workshop } from '../data/workshops';
import { regionNameByCode, workshopTypeMeta, workshopPhaseLabel } from '../data/workshops';
import { nationalityByCode } from '../data/trainers';
import { getWorkshopPhase, getParticipantAttendance, isCertificateEligible } from '../state/selectors';
import { formatArabicDate } from './date';
import { API_URL } from '../data/api';

export class WorkshopExportError extends Error {}

const typeLabelByKey = Object.fromEntries(workshopTypeMeta.map((t) => [t.key, t.label]));

export function infoRows(workshop: Workshop): { label: string; value: string | number }[] {
  return [
    { label: 'اسم الورشة', value: workshop.workshop_name },
    { label: 'نوع الورشة', value: typeLabelByKey[workshop.workshop_type] },
    { label: 'المجال', value: workshop.field },
    { label: 'الحالة', value: workshopPhaseLabel[getWorkshopPhase(workshop)] },
    { label: 'المنطقة', value: regionNameByCode[workshop.region] },
    { label: 'المدينة', value: workshop.city },
    { label: 'تاريخ البداية', value: formatArabicDate(workshop.start_date) },
    { label: 'تاريخ النهاية', value: formatArabicDate(workshop.end_date) },
    { label: 'المدرب', value: workshop.trainer_name },
    { label: 'جنسية المدرب', value: nationalityByCode[workshop.trainer_nationality]?.nameAr ?? workshop.trainer_nationality },
    { label: 'نبذة عن المدرب', value: workshop.trainer_bio },
    { label: 'المستوى', value: workshop.level },
    { label: 'اللغة', value: workshop.language },
    { label: 'طريقة الحضور', value: workshop.location_type === 'in-person' ? 'حضوري' : 'عن بُعد' },
    { label: 'اسم الموقع', value: workshop.location_name || '—' },
    { label: 'رابط الموقع', value: workshop.location_link || '—' },
    { label: 'منصة الاجتماع', value: workshop.platform || '—' },
    { label: 'رابط الاجتماع', value: workshop.meeting_link || '—' },
    { label: 'السعة', value: workshop.capacity },
    { label: 'عدد المسجلين', value: workshop.registered_participants },
    { label: 'الوصف', value: workshop.description },
    { label: 'الأهداف', value: workshop.objectives.join(' | ') || '—' },
    { label: 'ملاحظات المدرب', value: workshop.trainer_notes || '—' },
    { label: 'ملاحظات عامة', value: workshop.general_notes || '—' },
    { label: 'التوصيات', value: workshop.recommendations || '—' },
    { label: 'تاريخ الإعلان', value: formatArabicDate(workshop.created_at) },
    { label: 'تاريخ آخر تحديث', value: formatArabicDate(workshop.updated_at) },
  ];
}

export function workshopStats(workshop: Workshop) {
  return {
    registrations: { male: workshop.male_applications, female: workshop.female_applications },
    accepted: { male: workshop.male_accepted, female: workshop.female_accepted },
    attendance: { male: workshop.male_attendance, female: workshop.female_attendance },
    actualAttendance: { male: workshop.male_actual_attendance, female: workshop.female_actual_attendance },
    ratingCounts: [workshop.rating_5_count, workshop.rating_4_count, workshop.rating_3_count, workshop.rating_2_count, workshop.rating_1_count] as [number, number, number, number, number],
  };
}

export function workshopParticipants(workshop: Workshop) {
  return workshop.participants.map((p) => {
    const { attended, missed } = getParticipantAttendance(p);
    return { name: p.name, phone: p.phone, email: p.email, department: p.department, attended, missed, eligible: isCertificateEligible(p) };
  });
}

// Fetches the org's real Excel template (see backend/templates/workshop-export-template.xlsx —
// same fonts/colors/tables as the participants export, see exportParticipants.ts) and fills it
// with this workshop's data server-side, preserving the template's 2 real Excel Tables (with
// their live conditional-formatting/percentage formulas) exactly.
export async function exportWorkshopExcel(workshop: Workshop): Promise<void> {
  const sessionCount = workshop.participants.reduce((max, p) => Math.max(max, p.sessionAttendance.length), 0);

  const attendanceRows = workshop.participants.map((p) => ({
    name: p.name,
    sessions: Array.from({ length: sessionCount }, (_, i) => p.sessionAttendance[i] ?? false),
  }));

  const res = await fetch(`${API_URL}/export/workshop-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workshopName: workshop.workshop_name,
      infoRows: infoRows(workshop),
      stats: workshopStats(workshop),
      participants: workshopParticipants(workshop),
      sessionCount,
      attendanceRows,
    }),
  });
  if (!res.ok) {
    throw new WorkshopExportError('تعذّر إصدار ملف الورشة، حاول مرة أخرى.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workshop.workshop_name}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
