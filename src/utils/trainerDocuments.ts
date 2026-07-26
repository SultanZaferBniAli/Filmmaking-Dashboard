import type { Trainer } from '../data/trainers';

export type TrainerDocumentKind = 'passport' | 'cv';

export const trainerDocumentLabel: Record<TrainerDocumentKind, string> = {
  passport: 'وثيقة جواز السفر',
  cv: 'السيرة الذاتية',
};

// Builds a self-contained mock document (SVG) for preview/download — this project has no
// backend document storage, so no real passport/CV file exists or is exposed via a public URL.
export function buildMockTrainerDocumentDataUri(trainer: Trainer, kind: TrainerDocumentKind): string {
  const title = trainerDocumentLabel[kind];
  const docNumber = `${kind.toUpperCase()}-${trainer.id.replace('tr-', '')}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="880" viewBox="0 0 640 880">
      <rect width="640" height="880" fill="#0b1f2b" />
      <rect x="16" y="16" width="608" height="848" rx="16" fill="none" stroke="#c9a84c" stroke-width="2" />
      <text x="320" y="90" font-family="sans-serif" font-size="22" fill="#c9a84c" text-anchor="middle">${title}</text>
      <line x1="60" y1="120" x2="580" y2="120" stroke="#1a3547" stroke-width="1" />
      <text x="580" y="180" font-family="sans-serif" font-size="16" fill="#f7fafc" text-anchor="end">${trainer.fullName}</text>
      <text x="580" y="150" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">الاسم الكامل</text>
      <text x="580" y="240" font-family="sans-serif" font-size="16" fill="#f7fafc" text-anchor="end">${trainer.nationality}</text>
      <text x="580" y="210" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">الجنسية</text>
      <text x="580" y="300" font-family="sans-serif" font-size="16" fill="#f7fafc" text-anchor="end">${trainer.position}</text>
      <text x="580" y="270" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">المسمى الوظيفي</text>
      <text x="580" y="360" font-family="sans-serif" font-size="16" fill="#f7fafc" text-anchor="end">${docNumber}</text>
      <text x="580" y="330" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">رقم الوثيقة</text>
      <rect x="60" y="740" width="520" height="1" fill="#1a3547" />
      <text x="320" y="800" font-family="sans-serif" font-size="11" fill="#7a7d8a" text-anchor="middle">مستند تجريبي لأغراض العرض فقط — برنامج صناع الأفلام</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function downloadTrainerDocument(trainer: Trainer, kind: TrainerDocumentKind): void {
  const link = document.createElement('a');
  link.href = buildMockTrainerDocumentDataUri(trainer, kind);
  link.download = `${trainer.id}-${kind}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
