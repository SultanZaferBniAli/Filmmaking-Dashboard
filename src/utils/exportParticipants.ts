import type { Participant } from '../data/participants';
import { participantStatusLabel, attendanceStatusLabel, experienceLevelLabel, completedWorkshopCount } from '../data/participants';
import { regionNameByCode, workshopTypeLabel } from '../data/workshops';
import { API_URL } from '../data/api';

export class ParticipantsExportError extends Error {}

const genderLabel: Record<'male' | 'female', string> = { male: 'ذكر', female: 'أنثى' };

// Mirrors backend/src/report/buildParticipantsXlsx.ts's ParticipantExportRow — one row per
// participant per workshop enrollment (or one blank-workshop row for a participant enrolled in
// none), matching the org's own export template column-for-column (see conversation history).
interface ParticipantExportRow {
  name: string;
  phone: string;
  email: string;
  gender: string;
  jobTitle: string;
  experienceLevel: string;
  experienceYears: string | number;
  applicationStatus: string;
  acceptanceStatus: string;
  attendanceStatus: string;
  actualAttendance: string;
  workshopName: string;
  workshopType: string;
  workshopField: string;
  region: string;
  city: string;
  workshopDate: string;
  registeredCount: number;
  attendedCount: number;
  completedCount: number;
  certificateAvailable: string;
}

function participantRows(p: Participant): ParticipantExportRow[] {
  const acceptanceStatus = p.workshops.length > 0 ? 'مقبول' : p.application.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
  const attendedCount = p.workshops.filter((w) => w.attendanceStatus === 'attended' || w.attendanceStatus === 'actual_attendance').length;
  const base = {
    name: p.fullName,
    phone: p.phone,
    email: p.email,
    gender: p.gender ? genderLabel[p.gender] : '',
    jobTitle: p.jobTitle,
    experienceLevel: experienceLevelLabel[p.experienceLevel],
    experienceYears: p.experienceYears ?? '',
    applicationStatus: participantStatusLabel[p.application.status],
    acceptanceStatus,
  };
  const counts = { registeredCount: p.workshops.length, attendedCount, completedCount: completedWorkshopCount(p) };

  if (p.workshops.length === 0) {
    return [{
      ...base,
      attendanceStatus: '',
      actualAttendance: '',
      workshopName: '',
      workshopType: '',
      workshopField: '',
      region: '',
      city: '',
      workshopDate: '',
      ...counts,
      certificateAvailable: 'غير متاحة',
    }];
  }

  return p.workshops.map((w) => ({
    ...base,
    attendanceStatus: attendanceStatusLabel[w.attendanceStatus],
    actualAttendance: w.attendanceStatus === 'actual_attendance' ? 'نعم' : 'لا',
    workshopName: w.workshopName,
    workshopType: workshopTypeLabel[w.workshopType],
    workshopField: w.workshopField,
    region: regionNameByCode[w.region],
    city: w.city,
    workshopDate: w.startDate,
    ...counts,
    certificateAvailable: w.certificate?.available ? 'متاحة' : 'غير متاحة',
  }));
}

// Sends the flat participant/workshop rows to the backend, which fills them into the org's real
// Excel template (see backend/templates/participants-export-template.xlsx) — same fonts/colors/
// legend as the template, plus a "Dashboard" sheet with live native charts. Done server-side
// because the `xlsx` package used elsewhere in this app can't write native Excel charts at all;
// the template's charts are preserved by editing the underlying OOXML directly instead of
// regenerating the workbook from scratch (see buildReportPptx.ts for the same pattern applied to
// the PPTX workshop report).
export async function exportParticipantsToExcel(participants: Participant[], filename?: string): Promise<void> {
  const rows = participants.flatMap((p) => participantRows(p));

  const res = await fetch(`${API_URL}/export/participants-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    throw new ParticipantsExportError('تعذّر إصدار ملف المشاركين، حاول مرة أخرى.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().slice(0, 10);
  link.download = filename ?? `participants-season-5-${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
