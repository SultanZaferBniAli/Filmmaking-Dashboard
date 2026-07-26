import type { Workshop } from '../data/workshops';
import { API_URL } from '../data/api';
import { infoRows, workshopParticipants, workshopStats } from './exportWorkshopExcel';

export class WorkshopsExportError extends Error {}

// Same org Excel template as the single-workshop export (exportWorkshopExcel.ts /
// backend/templates/workshop-export-template.xlsx), but with every workshop's info/stats/
// participants block placed side by side on its own sheet instead of one workshop per file — see
// backend/src/report/buildAllWorkshopsXlsx.ts. The template's 4th sheet (per-session attendance)
// is dropped: the participants block here already shows attended/missed per person.
export async function exportWorkshopsToExcel(workshops: Workshop[]): Promise<void> {
  if (workshops.length === 0) return;

  const res = await fetch(`${API_URL}/export/workshops-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workshops: workshops.map((w) => ({
        workshopName: w.workshop_name,
        infoRows: infoRows(w),
        stats: workshopStats(w),
        participants: workshopParticipants(w),
      })),
    }),
  });
  if (!res.ok) {
    throw new WorkshopsExportError('تعذّر إصدار ملف الورش، حاول مرة أخرى.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().slice(0, 10);
  link.download = `workshops-export-${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
