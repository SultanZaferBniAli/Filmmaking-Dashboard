import type { Workshop } from './workshops';
import type { Trainer } from './trainers';
import type { Participant } from './participants';
import type { FeedbackResponse } from './feedback';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantAttendance }),
  });
  if (!res.ok) throw new Error(`PATCH /workshops/${workshopId}/attendance failed with ${res.status}`);
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

export async function createParticipant(payload: NewParticipantInput): Promise<void> {
  const res = await fetch(`${API_URL}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `POST /participants failed with ${res.status}`);
  }
}
