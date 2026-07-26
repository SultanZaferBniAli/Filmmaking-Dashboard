import { API_URL } from '../data/api';
import type { Workshop } from '../data/workshops';

export class ReportGenerationError extends Error {}

// Fetches the backend-generated post-workshop report (real data filled into the fixed
// PowerPoint template) and downloads it — fetched as a blob rather than a plain <a href>
// navigation so a failed generation (e.g. workshop not found) surfaces as a real error instead
// of silently downloading a JSON error body with a .pptx extension.
export async function downloadWorkshopReportPptx(workshop: Workshop): Promise<void> {
  const res = await fetch(`${API_URL}/workshops/${workshop.workshop_id}/report.pptx`);
  if (!res.ok) {
    throw new ReportGenerationError('تعذّر إصدار التقرير، حاول مرة أخرى.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workshop.workshop_id}-report.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
