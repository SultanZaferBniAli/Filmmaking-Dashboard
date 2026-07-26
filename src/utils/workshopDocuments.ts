import { API_URL } from '../data/api';

export type DocKind = 'report' | 'guide';

export class DocumentUploadError extends Error {}

export async function uploadWorkshopDocument(workshopId: string, kind: DocKind, file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/workshops/${workshopId}/${kind}-file`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new DocumentUploadError(body?.error?.message ?? `تعذّر رفع الملف (${res.status})`);
  }
  return res.json() as Promise<{ url: string; filename: string }>;
}

export async function removeWorkshopDocument(workshopId: string, kind: DocKind): Promise<void> {
  const res = await fetch(`${API_URL}/workshops/${workshopId}/${kind}-file`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove ${kind} file: ${res.status}`);
}

export function downloadWorkshopDocument(file: { url: string; filename: string }): void {
  const link = document.createElement('a');
  link.href = `${API_URL}${file.url}`;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
