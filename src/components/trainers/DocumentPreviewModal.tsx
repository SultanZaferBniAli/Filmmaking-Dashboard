import { Download } from 'lucide-react';
import type { Trainer } from '../../data/trainers';
import Modal from '../Modal';
import { buildMockTrainerDocumentDataUri, downloadTrainerDocument, trainerDocumentLabel, type TrainerDocumentKind } from '../../utils/trainerDocuments';

type Props = {
  trainer: Trainer;
  kind: TrainerDocumentKind;
  onClose: () => void;
};

export default function DocumentPreviewModal({ trainer, kind, onClose }: Props) {
  const dataUri = buildMockTrainerDocumentDataUri(trainer, kind);

  return (
    <Modal title={`${trainerDocumentLabel[kind]} — ${trainer.fullName}`} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <img
          src={dataUri}
          alt={`${trainerDocumentLabel[kind]} - ${trainer.fullName}`}
          className="max-h-[60vh] w-full rounded-xl border border-border object-contain"
        />
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إغلاق
          </button>
          <button
            type="button"
            onClick={() => downloadTrainerDocument(trainer, kind)}
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
