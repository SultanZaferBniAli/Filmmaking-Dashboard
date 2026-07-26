import Modal from '../Modal';
import type { Workshop } from '../../data/workshops';

type Props = {
  workshop: Workshop;
  onConfirm: () => void;
  onClose: () => void;
};

export default function DeleteConfirmModal({ workshop, onConfirm, onClose }: Props) {
  return (
    <Modal title="حذف الورشة" onClose={onClose} maxWidth="max-w-sm">
      <p className="text-right text-sm leading-relaxed text-body-text">
        هل أنت متأكد من حذف ورشة <span className="font-semibold text-main-text">{workshop.workshop_name}</span>؟ لا يمكن
        التراجع عن هذا الإجراء.
      </p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
          إلغاء
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-notif-red px-5 py-2 text-sm font-semibold text-white"
        >
          حذف نهائياً
        </button>
      </div>
    </Modal>
  );
}
