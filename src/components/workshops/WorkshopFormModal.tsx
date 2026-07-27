import { useState } from 'react';
import Modal from '../Modal';
import {
  regionMeta,
  workshopTypeMeta,
  workshopFields,
  type Workshop,
  type RegionCode,
  type WorkshopType,
  type WorkshopField,
  type LocationType,
  type WorkshopLanguage,
  type WorkshopLevel,
  type WorkshopStatus,
} from '../../data/workshops';
import { useData } from '../../state/DataContext';
import { useNotifications } from '../../state/NotificationsContext';
import { createWorkshop, updateWorkshopRecord, type WorkshopInput } from '../../data/api';

const locationTypeLabel: Record<LocationType, string> = { 'in-person': 'حضوري', virtual: 'افتراضي' };
const languageOptions: WorkshopLanguage[] = ['العربية', 'الإنجليزية'];
const levelOptions: WorkshopLevel[] = ['مبتدئ', 'متوسط', 'متقدم'];
const statusLabel: Record<WorkshopStatus, string> = { upcoming: 'قادمة', completed: 'مكتملة' };

type FormValues = {
  workshop_name: string;
  workshop_type: WorkshopType;
  field: WorkshopField;
  region_code: RegionCode;
  city: string;
  location_type: LocationType;
  location_name: string;
  start_date: string;
  end_date: string;
  language: WorkshopLanguage;
  level: WorkshopLevel;
  capacity: number;
  trainer_id: string;
  status: WorkshopStatus;
  description: string;
};

type Props = {
  initial?: Workshop;
  onClose: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-right">
      <span className="text-xs font-medium text-subtle-blue">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-main-text outline-none text-right';

// Generates the next `WS-###` id, matching the convention already used by every imported
// workshop row (see backend/src/entities/workshop.ts).
function nextWorkshopId(existingIds: string[]): string {
  const maxSeq = existingIds
    .map((id) => Number(id.match(/^WS-(\d+)$/)?.[1]))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `WS-${String(maxSeq + 1).padStart(3, '0')}`;
}

export default function WorkshopFormModal({ initial, onClose }: Props) {
  const { workshops, trainers, reload } = useData();
  const { addNotification } = useNotifications();

  const [values, setValues] = useState<FormValues>({
    workshop_name: initial?.workshop_name ?? '',
    workshop_type: initial?.workshop_type ?? 'in-person',
    field: (initial?.field as WorkshopField) ?? workshopFields[0],
    region_code: initial?.region ?? 'riyadh',
    city: initial?.city ?? '',
    location_type: initial?.location_type ?? 'in-person',
    location_name: initial?.location_name ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    language: initial?.language ?? 'العربية',
    level: initial?.level ?? 'مبتدئ',
    capacity: initial?.capacity ?? 20,
    trainer_id: initial?.trainer_id ?? trainers[0]?.id ?? '',
    status: initial?.status ?? 'upcoming',
    description: initial?.description ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.workshop_name || !values.city || !values.trainer_id || !values.start_date || !values.end_date) {
      setError('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    if (values.end_date < values.start_date) {
      setError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }
    if (values.capacity <= 0) {
      setError('السعة يجب أن تكون أكبر من صفر');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const region = regionMeta.find((r) => r.code === values.region_code);
      if (initial) {
        const payload: Partial<WorkshopInput> = {
          workshop_name: values.workshop_name,
          workshop_type: values.workshop_type,
          field: values.field,
          region_code: values.region_code,
          region_name: region?.name ?? null,
          city: values.city,
          location_type: values.location_type,
          location_name: values.location_name.trim() || null,
          start_date: values.start_date,
          end_date: values.end_date,
          language: values.language,
          level: values.level,
          capacity: values.capacity,
          trainer_id: values.trainer_id,
          status: values.status,
          description: values.description.trim() || null,
        };
        await updateWorkshopRecord(initial.workshop_id, payload);
        addNotification(`تم حفظ التعديلات على ورشة "${values.workshop_name}" بنجاح`);
      } else {
        const payload: WorkshopInput = {
          workshop_id: nextWorkshopId(workshops.map((w) => w.workshop_id)),
          workshop_name: values.workshop_name,
          workshop_type: values.workshop_type,
          field: values.field,
          year: null,
          region_code: values.region_code,
          region_name: region?.name ?? null,
          city: values.city,
          location_type: values.location_type,
          location_name: values.location_name.trim() || null,
          location_link: null,
          start_date: values.start_date,
          end_date: values.end_date,
          start_time: null,
          end_time: null,
          language: values.language,
          level: values.level,
          capacity: values.capacity,
          trainer_id: values.trainer_id,
          status: values.status,
          description: values.description.trim() || null,
          themes: null,
          workshop_image: null,
        };
        await createWorkshop(payload);
        addNotification(`تمت إضافة ورشة "${values.workshop_name}" بنجاح`);
      }
      reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الورشة. تأكد من تشغيل الخادم الخلفي ثم أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? 'تعديل الورشة' : 'إضافة ورشة جديدة'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="اسم الورشة *">
            <input
              className={inputClass}
              value={values.workshop_name}
              onChange={(e) => update('workshop_name', e.target.value)}
            />
          </Field>
          <Field label="المجال *">
            <select
              className={inputClass}
              value={values.field}
              onChange={(e) => update('field', e.target.value as WorkshopField)}
            >
              {workshopFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Field label="نوع الورشة *">
            <select
              className={inputClass}
              value={values.workshop_type}
              onChange={(e) => update('workshop_type', e.target.value as WorkshopType)}
            >
              {workshopTypeMeta.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="طريقة الانعقاد *">
            <select
              className={inputClass}
              value={values.location_type}
              onChange={(e) => update('location_type', e.target.value as LocationType)}
            >
              {(Object.entries(locationTypeLabel) as [LocationType, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="المنطقة *">
            <select
              className={inputClass}
              value={values.region_code}
              onChange={(e) => update('region_code', e.target.value as RegionCode)}
            >
              {regionMeta.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المدينة *">
            <input className={inputClass} value={values.city} onChange={(e) => update('city', e.target.value)} />
          </Field>

          <Field label="اسم الموقع">
            <input
              className={inputClass}
              value={values.location_name}
              onChange={(e) => update('location_name', e.target.value)}
              placeholder="مثال: مقر الهيئة"
            />
          </Field>
          <Field label="المدرب *">
            <select
              className={inputClass}
              value={values.trainer_id}
              onChange={(e) => update('trainer_id', e.target.value)}
            >
              {trainers.length === 0 && (
                <option value="" disabled>
                  لا يوجد مدربون بعد
                </option>
              )}
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="تاريخ البداية *">
            <input
              type="date"
              lang="en"
              dir="ltr"
              className={inputClass}
              value={values.start_date}
              onChange={(e) => update('start_date', e.target.value)}
            />
          </Field>
          <Field label="تاريخ النهاية *">
            <input
              type="date"
              lang="en"
              dir="ltr"
              className={inputClass}
              value={values.end_date}
              onChange={(e) => update('end_date', e.target.value)}
            />
          </Field>

          <Field label="اللغة">
            <select className={inputClass} value={values.language} onChange={(e) => update('language', e.target.value as WorkshopLanguage)}>
              {languageOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المستوى">
            <select className={inputClass} value={values.level} onChange={(e) => update('level', e.target.value as WorkshopLevel)}>
              {levelOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          <Field label="السعة القصوى *">
            <input
              type="number"
              min={1}
              dir="ltr"
              className={inputClass}
              value={values.capacity}
              onChange={(e) => update('capacity', Number(e.target.value))}
            />
          </Field>
          <Field label="الحالة *">
            <select className={inputClass} value={values.status} onChange={(e) => update('status', e.target.value as WorkshopStatus)}>
              {(Object.entries(statusLabel) as [WorkshopStatus, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="الوصف">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>

        {error && <p className="text-right text-xs text-notif-red">{error}</p>}

        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2 text-sm text-main-text">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-burgundy px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : initial ? 'حفظ التعديلات' : 'إضافة الورشة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
