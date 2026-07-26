import { useEffect, useMemo, useState } from 'react';
import type { Trainer } from '../data/trainers';
import { nationalityByCode } from '../data/trainers';
import { filterTrainers, computeTrainerKpis, defaultTrainerFilters, matchesTrainerSearch, type TrainerFilters } from '../state/trainerSelectors';
import { useData } from '../state/DataContext';
import { paginate } from '../state/pagination';
import { API_URL } from '../data/api';
import { resolveFileUrl } from '../utils/resolveFileUrl';
import { deriveExpertiseTags } from '../utils/trainerExpertiseTags';
import TrainerKpiCards from '../components/trainers/TrainerKpiCards';
import TrainerFilterBar from '../components/trainers/TrainerFilterBar';
import TrainerCard from '../components/trainers/TrainerCard';
import Pagination from '../components/Pagination';
import TrainerDetailPage from './TrainerDetailPage';
import { exportTrainersToExcel } from '../utils/exportTrainers';

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
  const { trainers: trainerList } = useData();
  const [filters, setFilters] = useState<TrainerFilters>(defaultTrainerFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [detailTargetId, setDetailTargetId] = useState<string | null>(initialDetailTrainerId);

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

  if (detailTarget) {
    return <TrainerDetailPage trainer={detailTarget} onBack={() => setDetailTargetId(null)} />;
  }

  return (
    <main className="@container mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <TrainerKpiCards kpis={kpis} />

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
    </main>
  );
}
