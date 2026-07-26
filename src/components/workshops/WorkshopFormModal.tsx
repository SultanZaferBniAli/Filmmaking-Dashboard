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
} from '../../data/workshops';

export type WorkshopFormValues = {
  workshop_name: string;
  workshop_type: WorkshopType;
  field: WorkshopField;
  region: RegionCode;
  city: string;
  trainer_name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  description: string;
};

type Props = {
  initial?: Workshop;
  onSave: (values: WorkshopFormValues) => void;
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

export default function WorkshopFormModal({ initial, onSave, onClose }: Props) {
  const [values, setValues] = useState<WorkshopFormValues>({
    workshop_name: initial?.workshop_name ?? '',
    workshop_type: initial?.workshop_type ?? 'in-person',
    field: (initial?.field as WorkshopField) ?? workshopFields[0],
    region: initial?.region ?? 'riyadh',
    city: initial?.city ?? '',
    trainer_name: initial?.trainer_name ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    capacity: initial?.capacity ?? 20,
    description: initial?.description ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof WorkshopFormValues>(key: K, value: WorkshopFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.workshop_name || !values.city || !values.trainer_name || !values.start_date || !values.end_date) {
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
    onSave(values);
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
          <Field label="المنطقة *">
            <select
              className={inputClass}
              value={values.region}
              onChange={(e) => update('region', e.target.value as RegionCode)}
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
          <Field label="المدرب *">
            <input
              className={inputClass}
              value={values.trainer_name}
              onChange={(e) => update('trainer_name', e.target.value)}
            />
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
          <button type="submit" className="rounded-xl bg-burgundy px-6 py-2 text-sm font-semibold text-white">
            {initial ? 'حفظ التعديلات' : 'إضافة الورشة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
