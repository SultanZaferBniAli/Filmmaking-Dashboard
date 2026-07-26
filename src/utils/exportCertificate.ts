import type { Workshop, WorkshopParticipant } from '../data/workshops';
import { isCertificateEligible } from '../state/selectors';
import { formatArabicDate } from './date';
import { downloadZip } from './zip';

export function buildCertificateHtml(workshop: Workshop, participant: WorkshopParticipant): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>شهادة إتمام - ${participant.name}</title>
<style>
  body { margin: 0; background: #06131c; font-family: 'Cairo', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .cert { width: 800px; padding: 60px; border: 3px solid #c9a84c; border-radius: 20px; background: linear-gradient(160deg, #0e2535, #0b1f2b); color: #f7fafc; text-align: center; }
  .badge { color: #c9a84c; font-size: 14px; letter-spacing: 4px; text-transform: uppercase; }
  h1 { font-size: 32px; margin: 20px 0 4px; }
  .name { font-size: 28px; font-weight: bold; color: #fac39b; margin: 24px 0; }
  .workshop { font-size: 18px; margin-bottom: 8px; }
  .meta { color: #a8c4d4; font-size: 14px; margin-top: 24px; }
  .line { width: 120px; height: 3px; background: #c9a84c; margin: 24px auto; border-radius: 3px; }
</style>
</head>
<body>
  <div class="cert">
    <div class="badge">شهادة إتمام</div>
    <h1>برنامج صناع الأفلام</h1>
    <div class="line"></div>
    <p>تشهد اللجنة المنظمة بأن</p>
    <div class="name">${participant.name}</div>
    <p>قد أتم بنجاح ورشة</p>
    <div class="workshop">${workshop.workshop_name}</div>
    <div class="meta">${formatArabicDate(workshop.start_date)} – ${formatArabicDate(workshop.end_date)} · ${workshop.city}</div>
  </div>
</body>
</html>`;
}

export function downloadCertificate(workshop: Workshop, participant: WorkshopParticipant) {
  const html = buildCertificateHtml(workshop, participant);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `شهادة-${participant.name}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadAllCertificatesZip(workshop: Workshop) {
  const eligible = workshop.participants.filter(isCertificateEligible);
  const files = eligible.map((p) => ({
    name: `شهادة-${p.name}.html`,
    content: buildCertificateHtml(workshop, p),
  }));
  downloadZip(files, `شهادات-${workshop.workshop_name}.zip`);
}
