import type { Workshop } from '../data/workshops';
import { formatArabicDate } from './date';
import { PAGE_W, PAGE_H, PDF_MARGIN, textBlock, wrapText, openSvgPageAsPdf } from './pdf';

const generalGuidelines = [
  'يرجى الحضور قبل 15 دقيقة من موعد بدء الجلسة.',
  'إحضار جهاز حاسوب محمول عند الحاجة، وأي أدوات يطلبها المدرب مسبقاً.',
  'الالتزام بحضور جميع الجلسات المقررة لاستحقاق شهادة إتمام الورشة.',
  'يمنع التصوير أو التسجيل داخل الورشة دون إذن مسبق من إدارة البرنامج.',
  'في حال التعذر عن الحضور، يرجى التواصل مع منسق البرنامج قبل موعد الجلسة.',
];

function buildGuideSvg(workshop: Workshop): string {
  const xRight = PAGE_W - PDF_MARGIN;
  const parts: string[] = [];

  parts.push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff" />`);
  parts.push(`<rect x="0" y="0" width="${PAGE_W}" height="10" fill="#c9a84c" />`);

  parts.push(textBlock(['دليل المشارك'], xRight, 100, 0, 30, '#6e1946'));
  parts.push(textBlock(['برنامج صناع الأفلام'], xRight, 138, 0, 16, '#9aa3ad'));
  parts.push(textBlock([workshop.workshop_name], xRight, 185, 0, 24, '#0b1f2b'));
  parts.push(`<line x1="${PDF_MARGIN}" y1="215" x2="${xRight}" y2="215" stroke="#e2e5e9" stroke-width="2" />`);

  let y = 260;
  parts.push(textBlock(['معلومات الورشة'], xRight, y, 0, 19, '#0b1f2b'));
  y += 34;
  const infoRows: [string, string][] = [
    ['المدرب', workshop.trainer_name],
    ['المدينة', workshop.city],
    ['التاريخ', `${formatArabicDate(workshop.start_date)} - ${formatArabicDate(workshop.end_date)}`],
    ['السعة', `${workshop.capacity} مشارك`],
    ['طريقة الحضور', workshop.location_type === 'in-person' ? `حضوري — ${workshop.location_name}` : `عن بُعد — ${workshop.platform ?? ''}`],
  ];
  for (const [label, value] of infoRows) {
    parts.push(textBlock([`${label}: ${value}`], xRight, y, 0, 15, '#3d4550'));
    y += 28;
  }

  y += 20;
  parts.push(`<line x1="${PDF_MARGIN}" y1="${y}" x2="${xRight}" y2="${y}" stroke="#e2e5e9" stroke-width="2" />`);
  y += 40;

  parts.push(textBlock(['تعليمات عامة للمشاركين'], xRight, y, 0, 19, '#0b1f2b'));
  y += 36;
  for (const guideline of generalGuidelines) {
    const lines = wrapText(guideline, 62);
    parts.push(textBlock(lines, xRight, y, 22, 15, '#3d4550'));
    y += lines.length * 22 + 16;
  }

  y += 20;
  parts.push(`<line x1="${PDF_MARGIN}" y1="${y}" x2="${xRight}" y2="${y}" stroke="#e2e5e9" stroke-width="2" />`);
  y += 40;

  parts.push(textBlock(['وصف الورشة'], xRight, y, 0, 19, '#0b1f2b'));
  y += 34;
  const descLines = wrapText(workshop.description || 'لا يوجد وصف متاح لهذه الورشة.', 62);
  parts.push(textBlock(descLines, xRight, y, 22, 15, '#3d4550'));
  y += descLines.length * 22 + 30;

  if (workshop.objectives.length > 0) {
    parts.push(textBlock(['أهداف الورشة'], xRight, y, 0, 19, '#0b1f2b'));
    y += 34;
    for (const obj of workshop.objectives) {
      const lines = wrapText(`• ${obj}`, 62);
      parts.push(textBlock(lines, xRight, y, 22, 15, '#3d4550'));
      y += lines.length * 22 + 14;
    }
  }

  parts.push(
    textBlock(
      [`تم إصدار هذا الدليل عبر برنامج صناع الأفلام — ${formatArabicDate(new Date().toISOString().slice(0, 10))}`],
      xRight,
      PAGE_H - 40,
      0,
      12,
      '#9aa3ad',
    ),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">${parts.join('')}</svg>`;
}

export async function previewParticipantGuidePdf(workshop: Workshop): Promise<void> {
  await openSvgPageAsPdf(buildGuideSvg(workshop));
}
