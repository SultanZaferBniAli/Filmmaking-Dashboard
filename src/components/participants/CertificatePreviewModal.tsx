import { Download, Printer } from 'lucide-react';
import type { Participant, ParticipantWorkshop } from '../../data/participants';
import Modal from '../Modal';

// Builds a self-contained mock certificate (SVG) for preview/download/print — this project
// has no backend document storage, so no real certificate file exists or is exposed via a
// public URL; the "secure preview" requirement is satisfied by generating it client-side.
function buildCertificateDataUri(participant: Participant, workshop: ParticipantWorkshop): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="880" height="620" viewBox="0 0 880 620">
      <rect width="880" height="620" fill="#0b1f2b" />
      <rect x="16" y="16" width="848" height="588" rx="16" fill="none" stroke="#c9a84c" stroke-width="2" />
      <text x="440" y="90" font-family="sans-serif" font-size="26" fill="#c9a84c" text-anchor="middle">شهادة إتمام تدريب</text>
      <text x="440" y="130" font-family="sans-serif" font-size="13" fill="#7a7d8a" text-anchor="middle">برنامج صناع الأفلام — هيئة الأفلام</text>
      <line x1="80" y1="160" x2="800" y2="160" stroke="#1a3547" stroke-width="1" />
      <text x="440" y="230" font-family="sans-serif" font-size="22" fill="#f7fafc" text-anchor="middle">${participant.fullName}</text>
      <text x="440" y="200" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="middle">تشهد إدارة البرنامج بأن</text>
      <text x="440" y="280" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="middle">قد أتم بنجاح ورشة</text>
      <text x="440" y="310" font-family="sans-serif" font-size="18" fill="#f7fafc" text-anchor="middle">${workshop.workshopName}</text>
      <text x="700" y="420" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">رقم الشهادة</text>
      <text x="700" y="445" font-family="sans-serif" font-size="14" fill="#f7fafc" text-anchor="end">${workshop.certificate?.certificateNumber ?? ''}</text>
      <text x="700" y="480" font-family="sans-serif" font-size="12" fill="#7a7d8a" text-anchor="end">تاريخ الإصدار</text>
      <text x="700" y="505" font-family="sans-serif" font-size="14" fill="#f7fafc" text-anchor="end">${workshop.certificate?.issueDate ?? ''}</text>
      <text x="440" y="580" font-family="sans-serif" font-size="10" fill="#7a7d8a" text-anchor="middle">مستند تجريبي لأغراض العرض فقط</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Props = {
  participant: Participant;
  workshop: ParticipantWorkshop;
  onClose: () => void;
};

export default function CertificatePreviewModal({ participant, workshop, onClose }: Props) {
  const dataUri = buildCertificateDataUri(participant, workshop);

  function handleDownload() {
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `${participant.id}-${workshop.id}-certificate.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>شهادة - ${participant.fullName}</title></head><body style="margin:0"><img src="${dataUri}" style="width:100%" onload="window.print()" /></body></html>`);
    win.document.close();
  }

  return (
    <Modal title={`شهادة — ${workshop.workshopName}`} onClose={onClose} maxWidth="max-w-xl">
      <div className="flex flex-col items-center gap-4">
        <img
          src={dataUri}
          alt={`شهادة ${participant.fullName} - ${workshop.workshopName}`}
          className="max-h-[60vh] w-full rounded-xl border border-border object-contain"
        />
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إغلاق
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-main-text hover:bg-white/5"
            >
              <Printer size={14} />
              طباعة
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-gold/15 px-5 py-2 text-sm font-semibold text-gold hover:bg-gold/25"
            >
              <Download size={14} />
              تحميل
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
