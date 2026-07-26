import { API_URL } from './api';

export type DiffKind = 'insert' | 'update' | 'skip' | 'error';

export interface StagedIssue {
  rowIndex: number;
  field: string | null;
  severity: 'warning' | 'error';
  message: string;
}

export interface StagedRow {
  index: number;
  data: Record<string, unknown>;
  kind: DiffKind;
  changedFields: string[];
}

export interface BatchSummary {
  new: number;
  updated: number;
  unchanged: number;
  warnings: number;
  errors: number;
}

export interface StagedBatch {
  entity: string;
  sourceLabel: string;
  rows: StagedRow[];
  issues: StagedIssue[];
  summary: BatchSummary;
  applied: boolean;
}

export interface StagingSession {
  stagingId: string;
  uploadedAt: string;
  batches: StagedBatch[];
  parseWarnings: string[];
}

export interface ApplyResult {
  entity: string;
  applied: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  blockedByErrors: number;
}

export class AdminApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new AdminApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? `Request failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function uploadAdminFiles(files: File[]): Promise<StagingSession> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const res = await fetch(`${API_URL}/admin/upload`, { method: 'POST', body: form });
  return readJsonOrThrow<StagingSession>(res);
}

export async function fetchStaging(stagingId: string): Promise<StagingSession> {
  const res = await fetch(`${API_URL}/admin/staging/${stagingId}`);
  return readJsonOrThrow<StagingSession>(res);
}

export async function patchStagingRow(
  stagingId: string,
  entity: string,
  rowIndex: number,
  patch: Record<string, unknown>,
): Promise<StagedBatch> {
  const res = await fetch(`${API_URL}/admin/staging/${stagingId}/batches/${entity}/rows/${rowIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJsonOrThrow<StagedBatch>(res);
}

export async function setBatchWorkshopId(stagingId: string, entity: string, workshopId: string): Promise<StagedBatch> {
  const res = await fetch(`${API_URL}/admin/staging/${stagingId}/batches/${entity}/workshop`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workshop_id: workshopId }),
  });
  return readJsonOrThrow<StagedBatch>(res);
}

export async function applyStaging(stagingId: string, batches?: string[]): Promise<{ results: ApplyResult[]; sessionDiscarded: boolean }> {
  const res = await fetch(`${API_URL}/admin/staging/${stagingId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batches }),
  });
  return readJsonOrThrow(res);
}

export async function discardStaging(stagingId: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/staging/${stagingId}`, { method: 'DELETE' });
  return readJsonOrThrow(res);
}

export async function uploadTrainerPhoto(trainerId: string, file: File): Promise<{ filename: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/admin/trainers/${trainerId}/photo`, { method: 'POST', body: form });
  return readJsonOrThrow(res);
}

export async function deleteTrainerPhoto(trainerId: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/trainers/${trainerId}/photo`, { method: 'DELETE' });
  return readJsonOrThrow(res);
}

export async function uploadWorkshopPhotosAdmin(
  workshopId: string,
  files: File[],
  makeCover = false,
): Promise<{ photos: { filename: string; url: string }[] }> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  if (makeCover) form.append('cover', 'true');
  const res = await fetch(`${API_URL}/admin/workshops/${workshopId}/photos`, { method: 'POST', body: form });
  return readJsonOrThrow(res);
}

export async function deleteWorkshopPhoto(workshopId: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/workshops/${workshopId}/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  return readJsonOrThrow(res);
}
