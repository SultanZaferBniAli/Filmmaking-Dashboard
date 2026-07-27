import Modal from '../Modal';
import type { Trainer } from '../../data/trainers';

type Props = {
  trainer: Trainer;
  onConfirm: () => void;
  onClose: () => void;
  confirming?: boolean;
};

export default function TrainerDeleteConfirmModal({ trainer, onConfirm, onClose, confirming }: Props) {
  return (
    <Modal title="حذف المدرب" onClose={onClose} maxWidth="max-w-sm">
      <p className="text-right text-sm leading-relaxed text-body-text">
        هل أنت متأكد من حذف المدرب <span className="font-semibold text-main-text">{trainer.fullName}</span>؟ لا يمكن
        التراجع عن هذا الإجراء.
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
          إلغاء
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="rounded-xl bg-notif-red px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {confirming ? 'جارٍ الحذف...' : 'حذف نهائياً'}
        </button>
      </div>
    </Modal>
  );
}
