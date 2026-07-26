import { useRef, useState } from 'react';
import { ChevronDown, Download, Upload, RotateCcw, type LucideIcon } from 'lucide-react';
import type { Workshop } from '../../data/workshops';
import { uploadWorkshopDocument, removeWorkshopDocument, downloadWorkshopDocument, DocumentUploadError, type DocKind } from '../../utils/workshopDocuments';
import { useNotifications } from '../../state/NotificationsContext';

type Props = {
  icon: LucideIcon;
  label: string;
  workshop: Workshop;
  kind: DocKind;
  onGenerate: () => Promise<void>;
  onUpdateWorkshop: (updated: Workshop) => void;
};

const FIELD_BY_KIND = { report: 'report_file', guide: 'guide_file' } as const;

// A single button that offers two ways to get this workshop's report/guide: auto-generate it
// from live data (this app's own generator), or upload an org-prepared file that overrides
// the auto-generated one from then on — persisted server-side per workshop.
export default function DocumentActionButton({ icon: Icon, label, workshop, kind, onGenerate, onUpdateWorkshop }: Props) {
  const { addNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const field = FIELD_BY_KIND[kind];
  const file = workshop[field];

  async function handleGenerate() {
    setOpen(false);
    setBusy(true);
    try {
      await onGenerate();
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadCustom() {
    setOpen(false);
    if (file) downloadWorkshopDocument(file);
  }

  function handlePickFile() {
    setOpen(false);
    inputRef.current?.click();
  }

  async function handleFileSelected(selected: File | null) {
    if (!selected) return;
    setBusy(true);
    try {
      const uploaded = await uploadWorkshopDocument(workshop.workshop_id, kind, selected);
      onUpdateWorkshop({ ...workshop, [field]: uploaded });
      addNotification(`تم رفع ${label} بنجاح`);
    } catch (err) {
      addNotification(err instanceof DocumentUploadError ? err.message : 'تعذّر رفع الملف، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveCustom() {
    setOpen(false);
    setBusy(true);
    try {
      await removeWorkshopDocument(workshop.workshop_id, kind);
      onUpdateWorkshop({ ...workshop, [field]: null });
    } catch {
      addNotification('تعذّرت إزالة الملف، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          void handleFileSelected(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-main-text disabled:opacity-60"
      >
        <Icon size={16} />
        {busy ? 'جارٍ التنفيذ...' : label}
        <ChevronDown size={14} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-[10px] border border-border bg-bg p-1 shadow-xl">
            {file ? (
              <>
                <button type="button" onClick={handleDownloadCustom} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-main-text hover:bg-white/5">
                  <Download size={14} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span>تنزيل الملف المرفوع</span>
                    <span className="truncate text-xs text-muted">{file.filename}</span>
                  </span>
                </button>
                <button type="button" onClick={handlePickFile} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-main-text hover:bg-white/5">
                  <Upload size={14} />
                  استبدال الملف
                </button>
                <button type="button" onClick={handleRemoveCustom} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-notif-red hover:bg-white/5">
                  <RotateCcw size={14} />
                  إزالة والعودة للتوليد التلقائي
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleGenerate} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-main-text hover:bg-white/5">
                  <Download size={14} />
                  تنزيل (توليد تلقائي)
                </button>
                <button type="button" onClick={handlePickFile} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-main-text hover:bg-white/5">
                  <Upload size={14} />
                  رفع ملف مخصص
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
