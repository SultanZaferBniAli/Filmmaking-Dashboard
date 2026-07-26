import { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import type { StagedBatch, StagedRow } from '../../data/admin';
import { patchStagingRow, setBatchWorkshopId, AdminApiError } from '../../data/admin';
import { useData } from '../../state/DataContext';

const WORKSHOP_SCOPED_ENTITIES = new Set(['participants', 'feedback']);

const ENTITY_LABELS: Record<string, string> = {
  workshops: 'الورش',
  trainers: 'المدربون',
  participants: 'المشاركون',
  feedback: 'التقييمات',
};

const KIND_LABELS: Record<StagedRow['kind'], string> = {
  insert: 'جديد',
  update: 'محدث',
  skip: 'بدون تغيير',
  error: 'خطأ',
};

const KIND_ROW_CLASS: Record<StagedRow['kind'], string> = {
  insert: 'border-e-2 border-e-male/70',
  update: 'border-e-2 border-e-peach/70',
  skip: 'opacity-60',
  error: 'border-e-2 border-e-notif-red bg-notif-red/[0.06]',
};

const KIND_BADGE_CLASS: Record<StagedRow['kind'], string> = {
  insert: 'bg-male/20 text-male',
  update: 'bg-peach/20 text-peach',
  skip: 'bg-white/10 text-subtle-blue',
  error: 'bg-notif-red/20 text-notif-red',
};

type Props = {
  stagingId: string;
  batch: StagedBatch;
  onBatchUpdate: (batch: StagedBatch) => void;
};

function cellValueToInputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function BatchReviewTable({ stagingId, batch, onBatchUpdate }: Props) {
  const { workshops } = useData();
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [cellError, setCellError] = useState<string | null>(null);
  const [assigningWorkshop, setAssigningWorkshop] = useState(false);

  const commonWorkshopId = useMemo(() => {
    if (batch.rows.length === 0) return '';
    const ids = new Set(batch.rows.map((r) => String(r.data.workshop_id ?? '')));
    return ids.size === 1 ? [...ids][0] : '';
  }, [batch.rows]);

  async function assignWorkshop(workshopId: string) {
    if (!workshopId) return;
    setAssigningWorkshop(true);
    setCellError(null);
    try {
      const updated = await setBatchWorkshopId(stagingId, batch.entity, workshopId);
      onBatchUpdate(updated);
    } catch (err) {
      setCellError(err instanceof AdminApiError ? err.message : 'تعذّر تعيين الورشة لهذه البيانات.');
    } finally {
      setAssigningWorkshop(false);
    }
  }

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of batch.rows) {
      for (const key of Object.keys(row.data)) {
        if (key === 'deleted_at') continue;
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [batch.rows]);

  const issuesByRow = useMemo(() => {
    const map = new Map<number, typeof batch.issues>();
    for (const issue of batch.issues) {
      const list = map.get(issue.rowIndex) ?? [];
      list.push(issue);
      map.set(issue.rowIndex, list);
    }
    return map;
  }, [batch.issues]);

  async function commitCell(rowIndex: number, field: string, rawValue: string, wasBoolean: boolean) {
    const cellKey = `${rowIndex}:${field}`;
    setSavingCell(cellKey);
    setCellError(null);
    try {
      const value = wasBoolean ? rawValue === 'true' : rawValue === '' ? null : rawValue;
      const updated = await patchStagingRow(stagingId, batch.entity, rowIndex, { [field]: value });
      onBatchUpdate(updated);
    } catch (err) {
      setCellError(err instanceof AdminApiError ? err.message : 'تعذّر التحقق من الصف، حاول مرة أخرى.');
    } finally {
      setSavingCell(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-main-text">{ENTITY_LABELS[batch.entity] ?? batch.entity}</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-male/20 px-3 py-1 font-medium text-male">{batch.summary.new} جديد</span>
          <span className="rounded-full bg-peach/20 px-3 py-1 font-medium text-peach">{batch.summary.updated} محدث</span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-subtle-blue">{batch.summary.unchanged} بدون تغيير</span>
          <span className="rounded-full bg-orange/20 px-3 py-1 font-medium text-orange">{batch.summary.warnings} تحذير</span>
          <span className="rounded-full bg-notif-red/20 px-3 py-1 font-medium text-notif-red">{batch.summary.errors} خطأ</span>
        </div>
      </div>

      {WORKSHOP_SCOPED_ENTITIES.has(batch.entity) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <span className="text-xs text-subtle-blue">
            هذا الملف مُجمّع بعد انتهاء ورشة معيّنة (بدون عمود workshop_id)؟ اختر الورشة لتعيين كل الصفوف لها دفعة واحدة:
          </span>
          <select
            value={commonWorkshopId}
            disabled={assigningWorkshop}
            onChange={(e) => assignWorkshop(e.target.value)}
            className="rounded-lg border border-border bg-bg px-2 py-1 text-xs text-main-text disabled:opacity-50"
          >
            <option value="">اختر ورشة...</option>
            {workshops.map((w) => (
              <option key={w.workshop_id} value={w.workshop_id}>
                {w.workshop_name}
              </option>
            ))}
          </select>
          {assigningWorkshop && <Loader2 size={13} className="animate-spin text-subtle-blue" />}
        </div>
      )}

      {cellError && <p className="text-xs text-notif-red">{cellError}</p>}

      <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr>
              <th className="whitespace-nowrap border-b border-border px-2 py-2 text-start font-semibold text-subtle-blue">الحالة</th>
              {columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-border px-2 py-2 text-start font-semibold text-subtle-blue">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => {
              const rowIssues = issuesByRow.get(row.index) ?? [];
              return (
                <tr key={row.index} className={`border-b border-border/60 ${KIND_ROW_CLASS[row.kind]}`}>
                  <td className="whitespace-nowrap px-2 py-1.5 align-top">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_BADGE_CLASS[row.kind]}`}>
                        {KIND_LABELS[row.kind]}
                      </span>
                      {rowIssues.map((issue, i) => (
                        <span
                          key={i}
                          className={`flex items-center gap-1 text-[10px] ${issue.severity === 'error' ? 'text-notif-red' : 'text-orange'}`}
                          title={issue.message}
                        >
                          {issue.severity === 'error' ? <AlertCircle size={10} /> : <AlertTriangle size={10} />}
                          {issue.field ? `${issue.field}: ` : ''}
                          {issue.message}
                        </span>
                      ))}
                    </div>
                  </td>
                  {columns.map((col) => {
                    const value = row.data[col];
                    const isChanged = row.changedFields.includes(col);
                    const isBoolean = typeof value === 'boolean';
                    const cellKey = `${row.index}:${col}`;
                    return (
                      <td key={col} className={`min-w-[110px] px-1 py-1 align-top ${isChanged ? 'bg-peach/10' : ''}`}>
                        {isBoolean ? (
                          <input
                            type="checkbox"
                            defaultChecked={value as boolean}
                            disabled={savingCell === cellKey}
                            onChange={(e) => commitCell(row.index, col, String(e.target.checked), true)}
                          />
                        ) : (
                          <input
                            type="text"
                            defaultValue={cellValueToInputString(value)}
                            disabled={savingCell === cellKey}
                            className="w-full min-w-[100px] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-main-text hover:border-border focus:border-peach focus:bg-white/5 focus:outline-none disabled:opacity-50"
                            onBlur={(e) => {
                              const next = e.target.value;
                              if (next !== cellValueToInputString(value)) commitCell(row.index, col, next, false);
                            }}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
