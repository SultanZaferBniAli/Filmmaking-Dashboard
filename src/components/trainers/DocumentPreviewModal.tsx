import { Download } from 'lucide-react';
import type { Trainer } from '../../data/trainers';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';
import Modal from '../Modal';
import { buildMockTrainerDocumentDataUri, downloadTrainerDocument, trainerDocumentLabel, type TrainerDocumentKind } from '../../utils/trainerDocuments';

type Props = {
  trainer: Trainer;
  kind: TrainerDocumentKind;
  onClose: () => void;
};

// Only "passport" has a real uploaded file today (trainer.passportDocument, from the workbook's
// passport_photo column) — "cv" still has no backing data anywhere, so it always falls back to
// the mock preview.
const realDocumentField: Record<TrainerDocumentKind, keyof Trainer> = {
  passport: 'passportDocument',
  cv: 'cvDocument',
};

export default function DocumentPreviewModal({ trainer, kind, onClose }: Props) {
  const realDocument = trainer[realDocumentField[kind]] as string | undefined;
  const imageSrc = realDocument ? resolveFileUrl(API_URL, realDocument) : buildMockTrainerDocumentDataUri(trainer, kind);

  function handleDownload() {
    if (realDocument) {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `${trainer.id}-${kind}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    downloadTrainerDocument(trainer, kind);
  }

  return (
    <Modal title={`${trainerDocumentLabel[kind]} — ${trainer.fullName}`} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <img
          src={imageSrc}
          alt={`${trainerDocumentLabel[kind]} - ${trainer.fullName}`}
          className="max-h-[60vh] w-full rounded-xl border border-border object-contain"
        />
        {!realDocument && (
          <p className="text-xs text-muted">لا تتوفر وثيقة حقيقية لهذا المدرب بعد — المعروض أعلاه نموذج توضيحي فقط.</p>
        )}
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إغلاق
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
    </Modal>
  );
}
