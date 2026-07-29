import type { Workshop, WorkshopParticipant } from '../data/workshops';
import { API_URL } from '../data/api';

export class CertificateGenerationError extends Error {}

async function downloadBlob(res: Response, filename: string): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Fetches the backend-generated certificate (real data filled into the org's actual male/female
// PowerPoint templates) and downloads it — fetched as a blob rather than a plain <a href>
// navigation so a failure (e.g. participant below the attendance threshold) surfaces as a real
// error instead of silently downloading a JSON error body with a .pptx extension.
export async function downloadCertificate(workshop: Workshop, participant: WorkshopParticipant): Promise<void> {
  const res = await fetch(`${API_URL}/workshops/${workshop.workshop_id}/participants/${participant.participant_id}/certificate.pptx`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new CertificateGenerationError('تعذّر إصدار الشهادة، تأكد من استيفاء المشارك لشرط نسبة الحضور.');
  }
  await downloadBlob(res, `${participant.name}-certificate.pptx`);
}

export async function downloadAllCertificatesZip(workshop: Workshop): Promise<void> {
  const res = await fetch(`${API_URL}/workshops/${workshop.workshop_id}/certificates.zip`, { credentials: 'include' });
  if (!res.ok) {
    throw new CertificateGenerationError('تعذّر إصدار الشهادات، تأكد من وجود مشاركين مستحقين.');
  }
  await downloadBlob(res, `شهادات-${workshop.workshop_name}.zip`);
}
