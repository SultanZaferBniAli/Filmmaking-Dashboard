import { useState } from 'react';
import Modal from '../Modal';
import { useData } from '../../state/DataContext';
import { useNotifications } from '../../state/NotificationsContext';
import { createParticipant, type NewParticipantInput } from '../../data/api';

type Props = {
  onClose: () => void;
};

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-main-text outline-none text-right';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-right">
      <span className="text-xs font-medium text-subtle-blue">{label}</span>
      {children}
    </label>
  );
}

// Generates the next `P-<workshop-number>-<seq>` id in this workshop's own numbering, matching
// the convention already used by every imported participant row (see backend/src/entities/participant.ts).
function nextParticipantId(existingIds: string[], workshopId: string): string {
  const wsNum = workshopId.match(/\d+/)?.[0] ?? '000';
  const prefix = `P-${wsNum}-`;
  const maxSeq = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export default function AddParticipantModal({ onClose }: Props) {
  const { workshops, participants, reload } = useData();
  const { addNotification } = useNotifications();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [workshopId, setWorkshopId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedWorkshops = [...workshops].sort((a, b) => b.start_date.localeCompare(a.start_date));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !gender || !workshopId) {
      setError('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    const workshop = workshops.find((w) => w.workshop_id === workshopId);
    if (!workshop) {
      setError('تعذّر العثور على الورشة المحددة');
      return;
    }

    const participantId = nextParticipantId(
      participants.map((p) => p.id),
      workshopId,
    );
    const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const payload: NewParticipantInput = {
      participant_id: participantId,
      workshop_id: workshopId,
      full_name_arabic: fullName.trim(),
      gender,
      phone: phone.trim(),
      email: `walkin.${uniqueSuffix}@onsite.local`,
      city: workshop.city,
      region_code: workshop.region,
      track: workshop.field,
      application_date: new Date().toISOString().slice(0, 10),
      status: 'accepted',
    };

    setSaving(true);
    setError(null);
    try {
      await createParticipant(payload);
      reload();
      addNotification(`تمت إضافة "${fullName.trim()}" إلى ورشة "${workshop.workshop_name}" بنجاح`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إضافة المشارك. تأكد من تشغيل الخادم الخلفي ثم أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="إضافة مشارك" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-right text-xs text-subtle-blue">
          لتسجيل مشارك حضر شخصيًا ولم يكن مسجلاً مسبقًا. يُضاف مباشرة كمقبول في الورشة المحددة ويظهر في تبويبَي المشاركين والحضور
          الخاصين بها.
        </p>

        <Field label="الاسم الكامل *">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field label="رقم الجوال *">
          <input dir="ltr" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665xxxxxxxx" />
        </Field>

        <Field label="الجنس *">
          <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
            <option value="" disabled>
              اختر الجنس
            </option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </Field>

        <Field label="الورشة *">
          <select className={inputClass} value={workshopId} onChange={(e) => setWorkshopId(e.target.value)}>
            <option value="" disabled>
              اختر الورشة
            </option>
            {sortedWorkshops.map((w) => (
              <option key={w.workshop_id} value={w.workshop_id}>
                {w.workshop_name} — {w.start_date}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-right text-xs text-notif-red">{error}</p>}

        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-burgundy px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'جارٍ الإضافة...' : 'إضافة المشارك'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
