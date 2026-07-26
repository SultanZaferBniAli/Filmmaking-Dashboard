import { Fragment, useEffect, useState } from 'react';
import { Check, X, Save } from 'lucide-react';
import type { Workshop, WorkshopParticipant } from '../../data/workshops';
import { formatDayMonth } from '../../utils/date';
import { useNotifications } from '../../state/NotificationsContext';

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  workshop: Workshop;
  onUpdateWorkshop: (updated: Workshop) => void;
};

export default function AttendanceTab({ workshop, onUpdateWorkshop }: Props) {
  const { addNotification } = useNotifications();
  const [draft, setDraft] = useState<WorkshopParticipant[]>(workshop.participants);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft whenever the underlying workshop's saved attendance changes from
  // outside this tab (e.g. switching to a different workshop, or an external update).
  useEffect(() => {
    setDraft(workshop.participants);
  }, [workshop.workshop_id, workshop.participants]);

  const isDirty = draft !== workshop.participants;
  const sessionCount = draft[0]?.sessionAttendance.length ?? 0;

  function toggle(participantId: string, sessionIndex: number) {
    setError(null);
    setDraft((current) =>
      current.map((p) =>
        p.participant_id === participantId
          ? { ...p, sessionAttendance: p.sessionAttendance.map((v, i) => (i === sessionIndex ? !v : v)) }
          : p,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onUpdateWorkshop({ ...workshop, participants: draft });
      addNotification(`تم حفظ حضور المشاركين لورشة "${workshop.workshop_name}" وتحديث الإحصائيات`);
    } catch {
      setError('تعذّر حفظ الحضور. تأكد من تشغيل الخادم الخلفي (backend) ثم أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  }

  if (draft.length === 0 || sessionCount === 0) {
    return <p className="py-10 text-center text-sm text-subtle-blue">لا يوجد مشاركون لتسجيل حضورهم.</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl border border-notif-red/30 bg-notif-red/10 px-4 py-2 text-sm text-notif-red">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded border border-notif-red/40 bg-notif-red/10">
              <X size={10} className="text-notif-red" />
            </span>
            غائب
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded border border-teal bg-teal/20">
              <Check size={10} className="text-teal" />
            </span>
            حاضر
          </span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 rounded-[10px] bg-male px-4 py-2 text-sm font-semibold text-[#06131c] disabled:opacity-40"
        >
          <Save size={15} />
          {saving ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          style={{ display: 'grid', gridTemplateColumns: `160px repeat(${sessionCount}, 56px)` }}
          className="min-w-max"
        >
          <div className="sticky start-0 z-10 bg-surface px-3 py-2 text-right text-xs font-semibold text-main-text">
            اسم المشارك
          </div>
          {Array.from({ length: sessionCount }).map((_, i) => {
            const { day, month } = formatDayMonth(addDaysIso(workshop.start_date, i));
            return (
              <div key={i} className="flex flex-col items-center justify-center px-1 py-2 text-[10px] text-muted">
                <span>{day}</span>
                <span>{month}</span>
              </div>
            );
          })}

          {draft.map((p) => (
            <Fragment key={p.participant_id}>
              <div className="sticky start-0 z-10 truncate border-t border-white/5 bg-surface px-3 py-2 text-right text-sm text-off-white">
                {p.name}
              </div>
              {p.sessionAttendance.map((present, i) => (
                <div key={i} className="flex items-center justify-center border-t border-white/5 p-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(p.participant_id, i)}
                    aria-label={present ? 'حاضر' : 'غائب'}
                    title={present ? 'حاضر' : 'غائب'}
                    className={`flex size-8 items-center justify-center rounded-lg border transition-colors ${
                      present ? 'border-teal bg-teal/20 text-teal' : 'border-notif-red/40 bg-notif-red/10 text-notif-red'
                    }`}
                  >
                    {present ? <Check size={15} /> : <X size={15} />}
                  </button>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
