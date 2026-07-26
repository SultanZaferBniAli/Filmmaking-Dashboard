import { useEffect, useMemo, useState } from 'react';
import { filterParticipants, computeParticipantKpis, defaultParticipantFilters, matchesParticipantSearch, type ParticipantFilters } from '../state/participantSelectors';
import { useData } from '../state/DataContext';
import { paginate } from '../state/pagination';
import ParticipantKpiCards from '../components/participants/ParticipantKpiCards';
import ParticipantFilterBar from '../components/participants/ParticipantFilterBar';
import ParticipantsTable from '../components/participants/ParticipantsTable';
import ParticipantMobileCard from '../components/participants/ParticipantMobileCard';
import AddParticipantModal from '../components/participants/AddParticipantModal';
import Pagination from '../components/Pagination';
import { exportParticipantsToExcel, ParticipantsExportError } from '../utils/exportParticipants';
import { useNotifications } from '../state/NotificationsContext';
import { RotateCcw } from 'lucide-react';

const PAGE_SIZE = 7;

export default function ParticipantsPage() {
  const { participants: participantList, workshops: workshopList } = useData();
  const { addNotification } = useNotifications();
  const [filters, setFilters] = useState<ParticipantFilters>(defaultParticipantFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportParticipantsToExcel(filteredParticipants);
    } catch (err) {
      addNotification(err instanceof ParticipantsExportError ? err.message : 'تعذّر إصدار ملف المشاركين، حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  }

  const filteredParticipants = useMemo(
    () => filterParticipants(participantList, filters).filter((p) => matchesParticipantSearch(p, search)),
    [participantList, filters, search],
  );

  const workshopOptions = useMemo(
    () =>
      [...workshopList]
        .sort((a, b) => a.workshop_name.localeCompare(b.workshop_name, 'ar'))
        .map((w) => ({ value: w.workshop_id, label: w.workshop_name })),
    [workshopList],
  );
  const kpis = useMemo(() => computeParticipantKpis(filteredParticipants), [filteredParticipants]);

  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedParticipants = paginate(filteredParticipants, currentPage, PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filters, search]);

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <ParticipantKpiCards kpis={kpis} />

      <ParticipantFilterBar
        participants={participantList}
        workshopOptions={workshopOptions}
        filters={filters}
        onChange={setFilters}
        onReset={() => {
          setFilters(defaultParticipantFilters);
          setSearch('');
        }}
        onExport={handleExport}
        exporting={exporting}
        onAddParticipant={() => setAddParticipantOpen(true)}
        search={search}
        onSearchChange={setSearch}
      />

      {addParticipantOpen && <AddParticipantModal onClose={() => setAddParticipantOpen(false)} />}

      {filteredParticipants.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[20px] bg-surface p-16 text-center">
          <p className="text-sm text-subtle-blue">لا توجد نتائج مطابقة للفلاتر المحددة</p>
          <button
            type="button"
            onClick={() => {
              setFilters(defaultParticipantFilters);
              setSearch('');
            }}
            className="flex items-center gap-2 rounded-[10px] border border-bg bg-bg px-4 py-1.5 text-sm font-medium text-main-text"
          >
            <RotateCcw size={13} />
            مسح الفلاتر
          </button>
        </div>
      ) : (
        <>
          <div className="hidden sm:block">
            <ParticipantsTable participants={pagedParticipants} expandedId={expandedId} onToggleExpand={toggleExpand} />
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {pagedParticipants.map((p) => (
              <ParticipantMobileCard key={p.id} participant={p} expanded={expandedId === p.id} onToggleExpand={toggleExpand} />
            ))}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredParticipants.length}
            itemLabel="مشاركًا"
            onPageChange={setPage}
          />
        </>
      )}
    </main>
  );
}
