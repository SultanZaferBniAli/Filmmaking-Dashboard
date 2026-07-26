import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
};

export default function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="إغلاق" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative z-10 max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-white/60 hover:text-white"
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
          <h2 className="text-[17px] font-bold text-main-text">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
