import { ChevronRight, ChevronLeft } from 'lucide-react';

type Props = {
  page: number; // zero-indexed
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, totalItems, itemLabel, onPageChange }: Props) {
  const currentPage = Math.min(page, totalPages - 1);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-main-text disabled:opacity-30"
        aria-label="السابق"
      >
        <ChevronRight size={16} />
      </button>
      <span className="text-sm text-subtle-blue">
        صفحة {currentPage + 1} من {totalPages} ({totalItems.toLocaleString('en-US')} {itemLabel})
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage >= totalPages - 1}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-main-text disabled:opacity-30"
        aria-label="التالي"
      >
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
