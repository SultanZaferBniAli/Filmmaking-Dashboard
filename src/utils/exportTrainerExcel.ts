import type { Trainer } from '../data/trainers';
import { workshopTypeLabel, regionNameByCode } from '../data/workshops';
import { API_URL } from '../data/api';

export class TrainerExportError extends Error {}

const categoryLabel: Record<Trainer['category'], string> = {
  local: 'محلي',
  regional: 'إقليمي',
  international: 'دولي',
};

function infoRows(trainer: Trainer): { label: string; value: string | number }[] {
  return [
    { label: 'الاسم الكامل', value: trainer.fullName },
    { label: 'الجنسية', value: trainer.nationality },
    { label: 'الفئة', value: categoryLabel[trainer.category] },
    { label: 'التخصص', value: trainer.position },
    { label: 'الشركة', value: trainer.company || '—' },
    { label: 'البريد الإلكتروني', value: trainer.email || '—' },
    { label: 'الهاتف', value: trainer.phone || '—' },
    { label: 'سنوات الخبرة', value: trainer.experienceYears ?? '—' },
    { label: 'الحسابات', value: trainer.accounts && trainer.accounts.length > 0 ? trainer.accounts.join('، ') : '—' },
    { label: 'نبذة مهنية', value: trainer.biography || 'لا تتوفر نبذة مهنية لهذا المدرب حالياً.' },
  ];
}

// Fetches the org's real Excel template (see backend/templates/workshop-export-template.xlsx —
// same fonts/colors as every other export in this app, reused purely for its styling since there
// is no dedicated trainer template) and fills it with this trainer's data server-side.
export async function exportTrainerExcel(trainer: Trainer): Promise<void> {
  const res = await fetch(`${API_URL}/export/trainer-xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trainerName: trainer.fullName,
      infoRows: infoRows(trainer),
      workshops: trainer.workshops.map((w) => ({
        name: w.name,
        type: workshopTypeLabel[w.workshopType],
        field: w.field,
        year: w.year,
        city: w.city,
        region: regionNameByCode[w.region],
      })),
      projects: (trainer.projects ?? []).map((p) => ({
        title: p.title,
        year: p.year ?? '—',
        role: p.role,
        type: p.type ?? '—',
      })),
      awards: (trainer.awards ?? []).map((a) => ({ title: a.title, year: a.year ?? '—' })),
    }),
  });
  if (!res.ok) {
    throw new TrainerExportError('تعذّر إصدار ملف المدرب، حاول مرة أخرى.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${trainer.fullName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
