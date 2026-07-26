import { useEffect, useMemo, useState } from 'react';
import type { Workshop } from '../data/workshops';
import { getWorkshopPhase } from '../state/selectors';
import { useData } from '../state/DataContext';
import SummaryCards from '../components/workshops/SummaryCards';
import WorkshopTypeLegend from '../components/workshops/WorkshopTypeLegend';
import FilterBar, { type WorkshopFilters } from '../components/workshops/FilterBar';
import WorkshopCard from '../components/workshops/WorkshopCard';
import WorkshopFormModal, { type WorkshopFormValues } from '../components/workshops/WorkshopFormModal';
import WorkshopDetailPage from './WorkshopDetailPage';
import DeleteConfirmModal from '../components/workshops/DeleteConfirmModal';
import Pagination from '../components/Pagination';
import { exportWorkshopsToExcel, WorkshopsExportError } from '../utils/exportWorkshops';
import { useNotifications } from '../state/NotificationsContext';

const defaultFilters: WorkshopFilters = { workshopTypes: [], fields: [], regions: [], statuses: [] };
const PAGE_SIZE = 9;

type Props = {
  onNavigateToTrainer: (trainerId: string) => void;
};

export default function WorkshopsPage({ onNavigateToTrainer }: Props) {
  const { workshops: workshopList, setWorkshops: setWorkshopList, updateWorkshop } = useData();
  const { addNotification } = useNotifications();
  const [filters, setFilters] = useState<WorkshopFilters>(defaultFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [formTarget, setFormTarget] = useState<Workshop | null>(null);
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workshop | null>(null);

  // Always resolved fresh from the shared `workshopList` (instead of holding its own copy)
  // so the open detail view never goes stale after an attendance save or any other update.
  const detailTarget = detailTargetId ? (workshopList.find((w) => w.workshop_id === detailTargetId) ?? null) : null;

  const searchOptions = useMemo(
    () => Array.from(new Set(workshopList.map((w) => w.workshop_name))).sort((a, b) => a.localeCompare(b, 'ar')),
    [workshopList],
  );

  const scopedByTypeRegionField = useMemo(
    () =>
      workshopList.filter(
        (w) => (filters.workshopTypes.length === 0 || filters.workshopTypes.includes(w.workshop_type)) &&
          (filters.fields.length === 0 || (filters.fields as string[]).includes(w.field)) &&
          (filters.regions.length === 0 || filters.regions.includes(w.region)) &&
          (!search.trim() || w.workshop_name.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [workshopList, filters.workshopTypes, filters.fields, filters.regions, search],
  );

  const summary = useMemo(() => {
    let scheduled = 0;
    let ongoing = 0;
    let completed = 0;
    for (const w of scopedByTypeRegionField) {
      const phase = getWorkshopPhase(w);
      if (phase === 'scheduled') scheduled++;
      else if (phase === 'ongoing') ongoing++;
      else completed++;
    }
    return { total: scopedByTypeRegionField.length, scheduled, ongoing, completed };
  }, [scopedByTypeRegionField]);

  const visibleWorkshops = useMemo(
    () => scopedByTypeRegionField.filter((w) => filters.statuses.length === 0 || filters.statuses.includes(getWorkshopPhase(w))),
    [scopedByTypeRegionField, filters.statuses],
  );

  const totalPages = Math.max(1, Math.ceil(visibleWorkshops.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedWorkshops = visibleWorkshops.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filters.workshopTypes, filters.fields, filters.regions, filters.statuses, search]);

  function handleSaveEdit(original: Workshop, values: WorkshopFormValues) {
    setWorkshopList((list) =>
      list.map((w) =>
        w.workshop_id === original.workshop_id
          ? {
              ...w,
              workshop_name: values.workshop_name,
              workshop_type: values.workshop_type,
              field: values.field,
              region: values.region,
              city: values.city,
              trainer_name: values.trainer_name,
              start_date: values.start_date,
              end_date: values.end_date,
              capacity: values.capacity,
              description: values.description,
              updated_at: new Date().toISOString().slice(0, 10),
            }
          : w,
      ),
    );
    setFormTarget(null);
  }

  function handleDelete(workshop: Workshop) {
    setWorkshopList((list) => list.filter((w) => w.workshop_id !== workshop.workshop_id));
    setDeleteTarget(null);
  }

  async function handleExport() {
    try {
      await exportWorkshopsToExcel(visibleWorkshops);
    } catch (err) {
      addNotification(err instanceof WorkshopsExportError ? err.message : 'تعذّر إصدار ملف الورش، حاول مرة أخرى.');
    }
  }

  if (detailTarget) {
    return (
      <WorkshopDetailPage
        workshop={detailTarget}
        onBack={() => setDetailTargetId(null)}
        onUpdateWorkshop={updateWorkshop}
        onNavigateToTrainer={onNavigateToTrainer}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      {/* DOM order = RTL reading order: legend (rightmost) · total · scheduled · ongoing · completed (leftmost).
          Grid (not flex-wrap) so items shrink to fit their track instead of wrapping mid-row. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.75fr_1fr_1fr_1fr_1fr]">
        <WorkshopTypeLegend
          activeType={filters.workshopTypes.length === 1 ? filters.workshopTypes[0] : null}
          onSelect={(t) => setFilters((f) => ({ ...f, workshopTypes: t ? [t] : [] }))}
        />
        <SummaryCards
          total={summary.total}
          scheduled={summary.scheduled}
          ongoing={summary.ongoing}
          completed={summary.completed}
        />
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => {
          setFilters(defaultFilters);
          setSearch('');
        }}
        onExport={handleExport}
        search={search}
        onSearchChange={setSearch}
        searchOptions={searchOptions}
      />

      {visibleWorkshops.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-16 text-center text-sm text-subtle-blue">
          لا توجد ورش مطابقة للفلاتر الحالية.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pagedWorkshops.map((w) => (
              <WorkshopCard
                key={w.workshop_id}
                workshop={w}
                onViewDetails={(w) => setDetailTargetId(w.workshop_id)}
                onEdit={setFormTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={visibleWorkshops.length}
            itemLabel="ورشة"
            onPageChange={setPage}
          />
        </>
      )}

      {formTarget && (
        <WorkshopFormModal
          initial={formTarget}
          onClose={() => setFormTarget(null)}
          onSave={(values) => handleSaveEdit(formTarget, values)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          workshop={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </main>
  );
}
