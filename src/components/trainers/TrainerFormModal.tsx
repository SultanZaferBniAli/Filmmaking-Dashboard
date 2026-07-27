import { useState } from 'react';
import Modal from '../Modal';
import type { Trainer } from '../../data/trainers';
import { nationalities } from '../../data/trainers';
import { useData } from '../../state/DataContext';
import { useNotifications } from '../../state/NotificationsContext';
import { createTrainer, updateTrainer, type TrainerInput } from '../../data/api';

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-main-text outline-none text-right';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-right">
      <span className="text-xs font-medium text-subtle-blue">{label}</span>
      {children}
    </label>
  );
}

// Generates the next `TR-###` id, matching the convention already used by every imported
// trainer row (see backend/src/entities/trainer.ts).
function nextTrainerId(existingIds: string[]): string {
  const maxSeq = existingIds
    .map((id) => Number(id.match(/^TR-(\d+)$/)?.[1]))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `TR-${String(maxSeq + 1).padStart(3, '0')}`;
}

type Props = {
  initial?: Trainer;
  onClose: () => void;
};

export default function TrainerFormModal({ initial, onClose }: Props) {
  const { trainers, reload } = useData();
  const { addNotification } = useNotifications();

  const [nameAr, setNameAr] = useState(initial?.fullName ?? '');
  const [nameEn, setNameEn] = useState('');
  const [nationalityCode, setNationalityCode] = useState(initial?.nationalityCode ?? nationalities[0].code);
  const [field, setField] = useState(initial?.position ?? '');
  const [contact, setContact] = useState(initial?.phone ?? '');
  const [yearsExperience, setYearsExperience] = useState('');
  const [professionalMembership, setProfessionalMembership] = useState('');
  const [accounts, setAccounts] = useState('');
  const [bio, setBio] = useState('');
  const [notableWorks, setNotableWorks] = useState('');
  const [festivalRecognition, setFestivalRecognition] = useState('');
  const [award, setAward] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim() || !nationalityCode) {
      setError('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const nationality = nationalities.find((n) => n.code === nationalityCode);
      if (initial) {
        // Edit only touches the fields this form can safely round-trip (the trainer's
        // biography/works/etc. are folded into prose server-side and can't be reconstructed
        // from the displayed profile) — the backend PATCH merges into the existing raw row, so
        // omitted fields keep their current value.
        const payload: Partial<TrainerInput> = {
          name_ar: nameAr.trim(),
          nationality: nationality?.nameAr ?? null,
          nationality_code: nationalityCode,
          field: field.trim() || null,
          contact: contact.trim() || null,
        };
        await updateTrainer(initial.id, payload);
        addNotification(`تم حفظ التعديلات على "${nameAr.trim()}" بنجاح`);
      } else {
        const payload: TrainerInput = {
          trainer_id: nextTrainerId(trainers.map((t) => t.id)),
          name_ar: nameAr.trim(),
          name_en: nameEn.trim() || null,
          nationality: nationality?.nameAr ?? null,
          nationality_code: nationalityCode,
          field: field.trim() || null,
          years_experience: yearsExperience.trim() || null,
          professional_membership: professionalMembership.trim() || null,
          accounts: accounts.trim() || null,
          bio: bio.trim() || null,
          notable_works: notableWorks.trim() || null,
          festival_recognition: festivalRecognition.trim() || null,
          award: award.trim() || null,
          contact: contact.trim() || null,
          profile_image: null,
        };
        await createTrainer(payload);
        addNotification(`تمت إضافة المدرب "${nameAr.trim()}" بنجاح`);
      }
      reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ بيانات المدرب. تأكد من تشغيل الخادم الخلفي ثم أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? 'تعديل بيانات المدرب' : 'إضافة مدرب'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم بالعربية *">
            <input className={inputClass} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </Field>
          <Field label="الجنسية *">
            <select className={inputClass} value={nationalityCode} onChange={(e) => setNationalityCode(e.target.value)}>
              {nationalities.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.nameAr}
                </option>
              ))}
            </select>
          </Field>

          <Field label="المجال / التخصص">
            <input className={inputClass} value={field} onChange={(e) => setField(e.target.value)} />
          </Field>
          <Field label="وسيلة التواصل">
            <input dir="ltr" className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+9665xxxxxxxx" />
          </Field>

          {!initial && (
            <>
              <Field label="الاسم بالإنجليزية">
                <input dir="ltr" className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </Field>
              <Field label="سنوات الخبرة">
                <input className={inputClass} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
              </Field>
              <Field label="العضويات المهنية">
                <input className={inputClass} value={professionalMembership} onChange={(e) => setProfessionalMembership(e.target.value)} />
              </Field>
              <Field label="الحسابات (مفصولة بفاصلة)">
                <input className={inputClass} value={accounts} onChange={(e) => setAccounts(e.target.value)} placeholder="IMDb، LinkedIn" />
              </Field>
              <Field label="الجائزة">
                <input className={inputClass} value={award} onChange={(e) => setAward(e.target.value)} />
              </Field>
              <Field label="حضور المهرجانات">
                <input className={inputClass} value={festivalRecognition} onChange={(e) => setFestivalRecognition(e.target.value)} />
              </Field>
            </>
          )}
        </div>

        {!initial && (
          <>
            <Field label="أعمال بارزة (مفصولة بـ ؛)">
              <input className={inputClass} value={notableWorks} onChange={(e) => setNotableWorks(e.target.value)} placeholder="اسم العمل (السنة)؛ عمل آخر" />
            </Field>
            <Field label="نبذة مهنية">
              <textarea className={`${inputClass} min-h-[80px] resize-y`} value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
          </>
        )}

        {error && <p className="text-right text-xs text-notif-red">{error}</p>}

        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-burgundy px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : initial ? 'حفظ التعديلات' : 'إضافة المدرب'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
