import type { WorkshopField, WorkshopType, RegionCode } from './workshops';

export type ExperienceLevel = 'none' | 'less_than_1' | '1_to_2' | '3_to_5' | '6_to_10' | 'more_than_10';

export const experienceLevels: ExperienceLevel[] = ['none', 'less_than_1', '1_to_2', '3_to_5', '6_to_10', 'more_than_10'];

export const experienceLevelLabel: Record<ExperienceLevel, string> = {
  none: 'بدون خبرة',
  less_than_1: 'أقل من سنة',
  '1_to_2': '1–2 سنة',
  '3_to_5': '3–5 سنوات',
  '6_to_10': '6–10 سنوات',
  more_than_10: 'أكثر من 10 سنوات',
};

export type AttendanceStatus = 'registered' | 'accepted' | 'partial' | 'attended' | 'actual_attendance' | 'absent';

export const attendanceStatusLabel: Record<AttendanceStatus, string> = {
  registered: 'مسجل',
  accepted: 'مقبول',
  partial: 'حضور جزئي',
  attended: 'حضر',
  actual_attendance: 'حضور فعلي',
  absent: 'لم يحضر',
};

export type ParticipantStatus = 'applicant' | 'accepted' | 'attended' | 'actual_attendance' | 'completed' | 'rejected' | 'absent';

export const participantStatusLabel: Record<ParticipantStatus, string> = {
  applicant: 'مقدّم طلب',
  accepted: 'مقبول',
  attended: 'حضر',
  actual_attendance: 'حضور فعلي',
  completed: 'مكتمل',
  rejected: 'مرفوض',
  absent: 'لم يحضر',
};

export interface ParticipantCertificate {
  available: boolean;
  certificateNumber?: string;
  issueDate?: string;
  documentUrl?: string;
}

export interface ParticipantWorkshop {
  id: string;
  workshopName: string;
  workshopType: WorkshopType;
  workshopField: WorkshopField;
  trainerName?: string;
  region: RegionCode;
  city: string;
  startDate: string;
  endDate: string;
  totalHours?: number;
  attendancePercentage: number;
  attendanceStatus: AttendanceStatus;
  completed: boolean;
  participantRating?: number;
  certificate?: ParticipantCertificate;
}

export interface ParticipantApplication {
  applicationDate: string;
  source?: string;
  status: ParticipantStatus;
  acceptanceReason?: string;
  rejectionReason?: string;
  evaluationScore?: number;
  notes?: string;
}

export interface Participant {
  id: string;
  fullName: string;
  profileImage?: string | null;
  phone: string;
  email: string;
  nationality?: string;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  city?: string;
  region?: RegionCode;

  jobTitle: string;
  employer?: string;
  education?: string;
  specialization?: string;
  biography?: string;
  portfolioUrl?: string;
  cvDocument?: string;

  experienceLevel: ExperienceLevel;
  experienceYears?: number;

  application: ParticipantApplication;
  workshops: ParticipantWorkshop[];
}

export function completedWorkshopCount(p: Participant): number {
  return p.workshops.filter((w) => w.completed && w.attendanceStatus === 'actual_attendance').length;
}
