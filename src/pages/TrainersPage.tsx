import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Trainer } from '../data/trainers';
import { nationalityByCode } from '../data/trainers';
import { filterTrainers, computeTrainerKpis, defaultTrainerFilters, matchesTrainerSearch, type TrainerFilters } from '../state/trainerSelectors';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { paginate } from '../state/pagination';
import { API_URL, deleteTrainer } from '../data/api';
import { resolveFileUrl } from '../utils/resolveFileUrl';
import { deriveExpertiseTags } from '../utils/trainerExpertiseTags';
import TrainerKpiCards from '../components/trainers/TrainerKpiCards';
import TrainerFilterBar from '../components/trainers/TrainerFilterBar';
import TrainerCard from '../components/trainers/TrainerCard';
import TrainerFormModal from '../components/trainers/TrainerFormModal';
import TrainerDeleteConfirmModal from '../components/trainers/TrainerDeleteConfirmModal';
import Pagination from '../components/Pagination';
import TrainerDetailPage from './TrainerDetailPage';
import { exportTrainersToExcel } from '../utils/exportTrainers';
import { useNotifications } from '../state/NotificationsContext';

const PAGE_SIZE = 9;

// One-line specialization blurb for the card — the first sentence of the trainer's biography,
// truncated. Falls back to their craft/field when no biography is on file.
function deriveSpecialization(trainer: Trainer): string {
  const firstSentence = trainer.biography?.split(/[.。]/)[0]?.trim();
  const text = firstSentence || trainer.position;
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

type Props = {
  // Set when arriving here via a "المدرب" link elsewhere (e.g. the workshop detail page) so this
  // trainer's detail view opens immediately instead of the list. Only read once, at mount — this
  // page is unmounted whenever the sidebar nav moves away from "trainers" (see App.tsx), so a
  // fresh mount is exactly when a new deep link should take effect.
  initialDetailTrainerId?: string | null;
};

export default function TrainersPage({ initialDetailTrainerId = null }: Props) {
  const { trainers: trainerList, reload } = useData();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotifications();
  const [filters, setFilters] = useState<TrainerFilters>(defaultTrainerFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [detailTargetId, setDetailTargetId] = useState<string | null>(initialDetailTrainerId);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Trainer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trainer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredTrainers = useMemo(
    () => filterTrainers(trainerList, filters).filter((t) => matchesTrainerSearch(t, search)),
    [trainerList, filters, search],
  );
  const kpis = useMemo(() => computeTrainerKpis(filteredTrainers), [filteredTrainers]);

  const totalPages = Math.max(1, Math.ceil(filteredTrainers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedTrainers = paginate(filteredTrainers, currentPage, PAGE_SIZE);

  const detailTarget = detailTargetId ? (trainerList.find((t) => t.id === detailTargetId) ?? null) : null;

  useEffect(() => {
    setPage(0);
  }, [filters, search]);

  async function handleDeleteTrainer(trainer: Trainer) {
    setDeleting(true);
    try {
      await deleteTrainer(trainer.id);
      reload();
      addNotification(`تم حذف المدرب "${trainer.fullName}" بنجاح`);
      setDeleteTarget(null);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : 'تعذّر حذف المدرب، حاول مرة أخرى.');
    } finally {
      setDeleting(false);
    }
  }

  if (detailTarget) {
    return <TrainerDetailPage trainer={detailTarget} onBack={() => setDetailTargetId(null)} />;
  }

  return (
    <main className="@container mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <TrainerKpiCards kpis={kpis} />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <TrainerFilterBar
            trainers={trainerList}
            filters={filters}
            onChange={setFilters}
            onReset={() => {
              setFilters(defaultTrainerFilters);
              setSearch('');
            }}
            onExport={() => exportTrainersToExcel(filteredTrainers)}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-burgundy px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            إضافة مدرب
          </button>
        )}
      </div>

      {filteredTrainers.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-16 text-center text-sm text-subtle-blue">
          لا يوجد مدربون مطابقون للفلاتر الحالية.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 @sm:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
            {pagedTrainers.map((t) => (
              <TrainerCard
                key={t.id}
                id={t.id}
                name={t.fullName}
                image={t.profileImage ? resolveFileUrl(API_URL, t.profileImage) : null}
                nationality={t.nationality}
                flag={nationalityByCode[t.nationalityCode]?.flagIcon ?? ''}
                role={t.position}
                specialization={deriveSpecialization(t)}
                expertise={deriveExpertiseTags(t.position)}
                onClick={() => setDetailTargetId(t.id)}
                onEdit={isAdmin ? () => setEditTarget(t) : undefined}
                onDelete={isAdmin ? () => setDeleteTarget(t) : undefined}
              />
            ))}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredTrainers.length}
            itemLabel="مدربًا"
            onPageChange={setPage}
          />
        </>
      )}

      {addModalOpen && <TrainerFormModal onClose={() => setAddModalOpen(false)} />}
      {editTarget && <TrainerFormModal initial={editTarget} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <TrainerDeleteConfirmModal
          trainer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDeleteTrainer(deleteTarget)}
          confirming={deleting}
        />
      )}
    </main>
  );
}
