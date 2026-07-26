import { useRef, useState } from 'react';
import { UploadCloud, Check, X, Loader2 } from 'lucide-react';
import type { StagingSession, StagedBatch } from '../../data/admin';
import { uploadAdminFiles, applyStaging, discardStaging, fetchStaging, AdminApiError } from '../../data/admin';
import { useData } from '../../state/DataContext';
import { useNotifications } from '../../state/NotificationsContext';
import BatchReviewTable from './BatchReviewTable';

export default function UploadReviewPanel() {
  const { reload } = useData();
  const { addNotification } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<StagingSession | null>(null);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadAdminFiles(Array.from(files));
      setSession(result);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'تعذّر رفع الملف، حاول مرة أخرى.');
    } finally {
      setUploading(false);
    }
  }

  function updateBatch(updated: StagedBatch) {
    setSession((s) => (s ? { ...s, batches: s.batches.map((b) => (b.entity === updated.entity ? updated : b)) } : s));
  }

  const hasBlockingErrors = session?.batches.some((b) => b.summary.errors > 0) ?? false;

  async function handleApply() {
    if (!session) return;
    setApplying(true);
    setError(null);
    try {
      const { results, sessionDiscarded } = await applyStaging(session.stagingId);
      const applied = results.filter((r) => r.applied);
      const blocked = results.filter((r) => !r.applied);
      if (applied.length > 0) {
        addNotification(
          `تم التطبيق: ${applied.map((r) => `${r.entity} (+${r.inserted} / ~${r.updated})`).join('، ')}`,
        );
      }
      if (blocked.length > 0) {
        addNotification(`تعذّر تطبيق: ${blocked.map((r) => r.entity).join('، ')} — لا تزال هناك أخطاء يجب إصلاحها.`);
      }
      reload();
      if (sessionDiscarded) {
        setSession(null);
      } else {
        setSession(await fetchStaging(session.stagingId));
      }
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'تعذّر تطبيق التغييرات، حاول مرة أخرى.');
    } finally {
      setApplying(false);
    }
  }

  async function handleDiscard() {
    if (!session) return;
    try {
      await discardStaging(session.stagingId);
      addNotification('تم تجاهل التغييرات المرفوعة — لم يتم تعديل أي بيانات.');
    } catch {
      // Best-effort: even if the discard call fails (e.g. already applied/expired), clear the
      // local review state so the user isn't stuck looking at a stale session.
    } finally {
      setSession(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-surface p-6 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-main-text">رفع بيانات الورش</h3>
          <p className="mt-1 text-xs text-subtle-blue">
            ارفع أربعة ملفات منفصلة (ورش، مدربون، مشاركون، تقييمات) أو ملف واحد يحتوي على أوراق عمل متعددة — سيتم اكتشاف نوع كل
            ورقة تلقائيًا. لن يتم حفظ أي شيء إلا بعد الضغط على "تطبيق".
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-[10px] bg-male px-4 py-2 text-sm font-semibold text-[#06131c] disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {uploading ? 'جارٍ الرفع والتحقق...' : 'رفع ملف Excel'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="rounded-lg bg-notif-red/10 px-3 py-2 text-xs text-notif-red">{error}</p>}

      {session && (
        <>
          {session.parseWarnings.length > 0 && (
            <div className="rounded-lg bg-orange/10 p-3 text-xs text-orange">
              {session.parseWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          {session.batches.length === 0 ? (
            <p className="text-sm text-subtle-blue">لم يتم التعرف على أي بيانات صالحة في الملف المرفوع.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {session.batches.map((batch) => (
                <BatchReviewTable key={batch.entity} stagingId={session.stagingId} batch={batch} onBatchUpdate={updateBatch} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || hasBlockingErrors || session.batches.length === 0}
              title={hasBlockingErrors ? 'أصلح الأخطاء المحددة قبل التطبيق' : undefined}
              className="flex items-center gap-2 rounded-[10px] bg-male px-5 py-2.5 text-sm font-semibold text-[#06131c] disabled:opacity-40"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              تطبيق
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={applying}
              className="flex items-center gap-2 rounded-[10px] border border-border px-5 py-2.5 text-sm font-medium text-main-text disabled:opacity-40"
            >
              <X size={14} />
              تجاهل
            </button>
            {hasBlockingErrors && <span className="text-xs text-notif-red">لا يمكن التطبيق قبل إصلاح كل الأخطاء المحددة أعلاه.</span>}
          </div>
        </>
      )}
    </div>
  );
}
