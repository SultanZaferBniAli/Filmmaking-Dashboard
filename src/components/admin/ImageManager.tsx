import { useRef, useState } from 'react';
import { Upload, Trash2, Loader2, Star } from 'lucide-react';
import { useData } from '../../state/DataContext';
import { useNotifications } from '../../state/NotificationsContext';
import { API_URL } from '../../data/api';
import { resolveFileUrl } from '../../utils/resolveFileUrl';
import {
  uploadTrainerPhoto,
  deleteTrainerPhoto,
  uploadWorkshopPhotosAdmin,
  deleteWorkshopPhoto,
  AdminApiError,
} from '../../data/admin';

type TargetKind = 'trainer' | 'workshop';

export default function ImageManager() {
  const { trainers, workshops, reload } = useData();
  const { addNotification } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<TargetKind>('trainer');
  const [trainerId, setTrainerId] = useState<string>('');
  const [workshopId, setWorkshopId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const selectedTrainer = trainers.find((t) => t.id === trainerId);
  const selectedWorkshop = workshops.find((w) => w.workshop_id === workshopId);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      if (kind === 'trainer') {
        if (!trainerId) {
          addNotification('اختر مدربًا أولًا.');
          return;
        }
        await uploadTrainerPhoto(trainerId, files[0]);
        addNotification('تم حفظ صورة المدرب.');
      } else {
        if (!workshopId) {
          addNotification('اختر ورشة أولًا.');
          return;
        }
        const makeCover = (selectedWorkshop?.photos.length ?? 0) === 0;
        await uploadWorkshopPhotosAdmin(workshopId, Array.from(files), makeCover);
        addNotification('تم حفظ صور الورشة.');
      }
      reload();
    } catch (err) {
      addNotification(err instanceof AdminApiError ? err.message : 'تعذّر رفع الصورة، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTrainerPhoto() {
    if (!trainerId) return;
    setBusy(true);
    try {
      await deleteTrainerPhoto(trainerId);
      addNotification('تم حذف صورة المدرب.');
      reload();
    } catch (err) {
      addNotification(err instanceof AdminApiError ? err.message : 'تعذّر حذف الصورة.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveWorkshopPhoto(filename: string) {
    if (!workshopId) return;
    setBusy(true);
    try {
      await deleteWorkshopPhoto(workshopId, filename);
      addNotification('تم حذف الصورة.');
      reload();
    } catch (err) {
      addNotification(err instanceof AdminApiError ? err.message : 'تعذّر حذف الصورة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-surface p-6 shadow-[0_4px_8px_2px_rgba(0,0,0,0.25)]">
      <h3 className="text-base font-bold text-main-text">إدارة الصور</h3>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-border bg-white/5 p-1 text-xs">
          <button
            type="button"
            onClick={() => setKind('trainer')}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${kind === 'trainer' ? 'bg-peach text-[#2a1608]' : 'text-white/60'}`}
          >
            صورة مدرب
          </button>
          <button
            type="button"
            onClick={() => setKind('workshop')}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${kind === 'workshop' ? 'bg-peach text-[#2a1608]' : 'text-white/60'}`}
          >
            صور ورشة
          </button>
        </div>

        {kind === 'trainer' ? (
          <select
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
            className="rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-main-text"
          >
            <option value="">اختر مدربًا...</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={workshopId}
            onChange={(e) => setWorkshopId(e.target.value)}
            className="rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-main-text"
          >
            <option value="">اختر ورشة...</option>
            {workshops.map((w) => (
              <option key={w.workshop_id} value={w.workshop_id}>
                {w.workshop_name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || (kind === 'trainer' ? !trainerId : !workshopId)}
          className="flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-main-text disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          رفع صورة{kind === 'workshop' ? 'ة/صور' : ''}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={kind === 'workshop'}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {kind === 'trainer' && selectedTrainer && (
        <div className="flex items-center gap-3">
          {selectedTrainer.profileImage ? (
            <div className="group relative size-24 overflow-hidden rounded-xl border border-white/10">
              <img src={resolveFileUrl(API_URL, selectedTrainer.profileImage)} alt={selectedTrainer.fullName} className="size-full object-cover" />
              <button
                type="button"
                onClick={handleRemoveTrainerPhoto}
                disabled={busy}
                className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="حذف الصورة"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-subtle-blue">لا توجد صورة لهذا المدرب بعد.</p>
          )}
        </div>
      )}

      {kind === 'workshop' && selectedWorkshop && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {selectedWorkshop.photos.length === 0 ? (
            <p className="col-span-full text-xs text-subtle-blue">لا توجد صور لهذه الورشة بعد.</p>
          ) : (
            selectedWorkshop.photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-white/10">
                <img src={resolveFileUrl(API_URL, photo.url)} alt="" className="size-full object-cover" />
                {selectedWorkshop.workshop_image === resolveFileUrl(API_URL, photo.url) && (
                  <span className="absolute start-1 top-1 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-peach">
                    <Star size={9} fill="currentColor" /> غلاف
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveWorkshopPhoto(photo.id)}
                  disabled={busy}
                  className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="حذف الصورة"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
