import type { Row } from '../entities/index.js';
import { workshopEntity, trainerEntity, participantEntity } from '../entities/index.js';
import { findActiveRows, findRowById } from '../store.js';

const APPLICATION_STATUS_MAP: Record<string, string> = {
  accepted: 'accepted',
  waitlist: 'applicant',
  applicant: 'applicant',
  rejected: 'rejected',
};

function mapAttendanceStatus(row: Row): string {
  if (row.attendance_status === 'حضور فعلي') return 'actual_attendance';
  if (row.attendance_status === 'حضور جزئي') return 'partial';
  if (row.attendance_status === 'لم يحضر') return 'absent';
  return 'registered'; // pre-event — no attendance recorded yet
}

// Assembles the full frontend `Participant` shape, joining back to the participant's own
// workshop for the `workshops: ParticipantWorkshop[]` entry (only present when accepted,
// matching the KPI cards' structural "accepted = has a workshops[] entry" convention).
export async function serializeParticipant(row: Row) {
  const workshop = row.workshop_id ? await findRowById(workshopEntity, String(row.workshop_id)) : undefined;
  const trainer = workshop?.trainer_id ? await findRowById(trainerEntity, String(workshop.trainer_id)) : undefined;

  const workshops = [];
  if (row.status === 'accepted' && workshop) {
    workshops.push({
      id: workshop.workshop_id,
      workshopName: workshop.workshop_name,
      workshopType: workshop.workshop_type,
      workshopField: workshop.field,
      trainerName: trainer?.name_ar,
      region: workshop.region_code,
      city: workshop.city,
      startDate: workshop.start_date,
      endDate: workshop.end_date,
      attendancePercentage: Math.round(Number(row.attendance_percentage ?? 0)),
      attendanceStatus: mapAttendanceStatus(row),
      completed: row.attendance_status === 'حضور فعلي',
    });
  }

  return {
    id: row.participant_id,
    fullName: row.full_name_arabic,
    profileImage: null,
    phone: row.phone,
    email: row.email,
    nationality: row.nationality,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    city: row.city,
    region: row.region_code,
    jobTitle: row.current_role ?? '',
    employer: undefined,
    education: row.education_level,
    specialization: row.track,
    biography: undefined,
    portfolioUrl: row.portfolio_url,
    cvDocument: undefined,
    experienceLevel: row.experience_level,
    experienceYears: undefined,
    application: {
      applicationDate: row.application_date,
      source: row.how_heard,
      status: APPLICATION_STATUS_MAP[String(row.status)] ?? 'applicant',
      evaluationScore: row.evaluation_score ?? undefined,
    },
    workshops,
  };
}

export async function serializeAllParticipants() {
  const rows = await findActiveRows(participantEntity);
  return Promise.all(rows.map(serializeParticipant));
}
