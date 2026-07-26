import type { Participant, ExperienceLevel } from '../data/participants';
import type { WorkshopField, WorkshopType, RegionCode } from '../data/workshops';
import type { GenderFilter } from './filters';

// Mirrors the three "beyond just registered" KPI cards (المقبولين / الحضور / الحضور الفعلي)
// so the filter and the cards always agree on what each status means.
export type ParticipantStatusFilter = 'accepted' | 'attended' | 'actual_attendance';

export type ParticipantFilters = {
  workshops: string[]; // workshop_id — see ParticipantWorkshop.id in data/participants.ts
  workshopTypes: WorkshopType[];
  fields: WorkshopField[];
  regions: RegionCode[];
  experienceLevels: ExperienceLevel[];
  gender: GenderFilter;
  status: ParticipantStatusFilter | null;
};

export const defaultParticipantFilters: ParticipantFilters = {
  workshops: [],
  workshopTypes: [],
  fields: [],
  regions: [],
  experienceLevels: [],
  gender: null,
  status: null,
};

function matchesStatus(p: Participant, status: ParticipantStatusFilter): boolean {
  if (status === 'accepted') return p.workshops.length > 0;
  if (status === 'attended') {
    return p.workshops.some((w) => w.attendanceStatus === 'attended' || w.attendanceStatus === 'actual_attendance');
  }
  return p.workshops.some((w) => w.attendanceStatus === 'actual_attendance');
}

export function filterParticipants(participants: Participant[], filters: ParticipantFilters): Participant[] {
  return participants.filter((p) => {
    if (filters.workshops.length > 0 && !p.workshops.some((w) => filters.workshops.includes(w.id))) {
      return false;
    }
    if (filters.workshopTypes.length > 0 && !p.workshops.some((w) => filters.workshopTypes.includes(w.workshopType))) {
      return false;
    }
    if (filters.fields.length > 0 && !p.workshops.some((w) => filters.fields.includes(w.workshopField))) {
      return false;
    }
    if (filters.regions.length > 0 && !(p.region && filters.regions.includes(p.region))) {
      return false;
    }
    if (filters.experienceLevels.length > 0 && !filters.experienceLevels.includes(p.experienceLevel)) {
      return false;
    }
    if (filters.gender && p.gender !== filters.gender) {
      return false;
    }
    if (filters.status && !matchesStatus(p, filters.status)) {
      return false;
    }
    return true;
  });
}

export interface ParticipantKpis {
  totalApplicants: number;
  totalAccepted: number;
  totalAttendance: number;
  totalActualAttendance: number;
}

export function computeParticipantKpis(participants: Participant[]): ParticipantKpis {
  let totalAccepted = 0;
  let totalAttendance = 0;
  let totalActualAttendance = 0;
  for (const p of participants) {
    if (p.workshops.length > 0) totalAccepted++;
    if (p.workshops.some((w) => w.attendanceStatus === 'attended' || w.attendanceStatus === 'actual_attendance')) totalAttendance++;
    if (p.workshops.some((w) => w.attendanceStatus === 'actual_attendance')) totalActualAttendance++;
  }
  return { totalApplicants: participants.length, totalAccepted, totalAttendance, totalActualAttendance };
}

export function participantNameOptions(participants: Participant[]): string[] {
  return Array.from(new Set(participants.map((p) => p.fullName))).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function matchesParticipantSearch(participant: Participant, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return participant.fullName.toLowerCase().includes(query);
}
