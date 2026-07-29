import type { Workshop, WorkshopType, LocationType, WorkshopLanguage, WorkshopLevel, WorkshopStatus, RegionCode } from './workshops';
import type { Trainer } from './trainers';
import type { Participant } from './participants';
import type { FeedbackResponse } from './feedback';

// Production builds always call the backend through the same origin as the frontend — proxied
// to the real backend via vercel.json's rewrites — instead of a cross-origin absolute URL. Cross-
// site cookies (frontend on one domain, backend on another) get blocked outright by cross-site
// tracking prevention on iOS (both Safari and Chrome, which shares Safari's engine there), so the
// login session cookie would set but never actually get sent back on later requests. Routing
// everything through one origin sidesteps that entirely, for every browser, not just iOS. Local
// dev is unaffected — `import.meta.env.PROD` is only true for an actual `vite build`.
export const API_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000');

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

// Shared write helper for the raw entity routes (POST/PATCH/DELETE) — unwraps the backend's
// `{ error: { message } }` shape into a plain Error, matching the pattern createParticipant
// established.
async function writeJson(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(errBody?.error?.message ?? `${method} ${path} failed with ${res.status}`);
  }
}

export function fetchWorkshops(signal?: AbortSignal): Promise<Workshop[]> {
  return getJson('/view/workshops', signal);
}

export function fetchWorkshopById(workshopId: string, signal?: AbortSignal): Promise<Workshop> {
  return getJson(`/view/workshops/${workshopId}`, signal);
}

export function fetchTrainers(signal?: AbortSignal): Promise<Trainer[]> {
  return getJson('/view/trainers', signal);
}

export function fetchParticipants(signal?: AbortSignal): Promise<Participant[]> {
  return getJson('/view/participants', signal);
}

export function fetchFeedback(signal?: AbortSignal): Promise<FeedbackResponse[]> {
  return getJson('/view/feedback', signal);
}

export type AttendanceEntry = {
  participant_id: string;
  day_1?: boolean;
  day_2?: boolean;
  day_3?: boolean;
  day_4?: boolean;
  day_5?: boolean;
};

export async function saveWorkshopAttendance(workshopId: string, participantAttendance: AttendanceEntry[]): Promise<Workshop> {
  const res = await fetch(`${API_URL}/workshops/${workshopId}/attendance`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantAttendance }),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(errBody?.error?.message ?? `PATCH /workshops/${workshopId}/attendance failed with ${res.status}`);
  }
  return res.json() as Promise<Workshop>;
}

// Payload for a walk-in registration: someone who shows up at a workshop without having
// pre-registered. Mirrors the backend's raw `participants` row shape (one row = one person's
// enrollment in one workshop), not the aggregated frontend `Participant` type.
export type NewParticipantInput = {
  participant_id: string;
  workshop_id: string;
  full_name_arabic: string;
  gender: 'male' | 'female';
  phone: string;
  email: string;
  city: string | null;
  region_code: string | null;
  track: string | null;
  application_date: string;
  status: 'accepted';
};

export function createParticipant(payload: NewParticipantInput): Promise<void> {
  return writeJson('POST', '/participants', payload);
}

// Raw `workshops` row shape (backend/src/entities/workshop.ts's workshopSchema), used for
// create/update — distinct from the aggregated `Workshop` view type used for display.
export type WorkshopInput = {
  workshop_id: string;
  workshop_name: string;
  workshop_type: WorkshopType;
  field: string;
  year: number | null;
  region_code: RegionCode;
  region_name: string | null;
  city: string;
  location_type: LocationType;
  location_name: string | null;
  location_link: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  language: WorkshopLanguage | null;
  level: WorkshopLevel | null;
  capacity: number | null;
  trainer_id: string;
  status: WorkshopStatus;
  description: string | null;
  themes: string | null;
  workshop_image: string | null;
};

export function createWorkshop(payload: WorkshopInput): Promise<void> {
  return writeJson('POST', '/workshops', payload);
}

export function updateWorkshopRecord(workshopId: string, payload: Partial<WorkshopInput>): Promise<void> {
  return writeJson('PATCH', `/workshops/${workshopId}`, payload);
}

export function deleteWorkshop(workshopId: string): Promise<void> {
  return writeJson('DELETE', `/workshops/${workshopId}`);
}

// Raw `trainers` row shape (backend/src/entities/trainer.ts's trainerSchema), used for
// create/update — profile_image is managed separately via the photo upload endpoint.
export type TrainerInput = {
  trainer_id: string;
  name_ar: string;
  name_en: string | null;
  nationality: string | null;
  nationality_code: string;
  field: string | null;
  years_experience: string | null;
  professional_membership: string | null;
  accounts: string | null;
  bio: string | null;
  notable_works: string | null;
  festival_recognition: string | null;
  award: string | null;
  contact: string | null;
  profile_image: string | null;
};

export function createTrainer(payload: TrainerInput): Promise<void> {
  return writeJson('POST', '/trainers', payload);
}

export function updateTrainer(trainerId: string, payload: Partial<TrainerInput>): Promise<void> {
  return writeJson('PATCH', `/trainers/${trainerId}`, payload);
}

export function deleteTrainer(trainerId: string): Promise<void> {
  return writeJson('DELETE', `/trainers/${trainerId}`);
}
