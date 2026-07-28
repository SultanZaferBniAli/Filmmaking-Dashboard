import { useEffect, useState } from 'react';
import Sidebar, { type NavKey } from './components/Sidebar';
import Header from './components/Header';
import StatCards from './components/StatCards';
import RatingCard from './components/RatingCard';
import WorkshopTypesCard from './components/WorkshopTypesCard';
import WorkshopListCard from './components/WorkshopListCard';
import RegionCard from './components/RegionCard';
import WorkshopsPage from './pages/WorkshopsPage';
import TrainersPage from './pages/TrainersPage';
import ParticipantsPage from './pages/ParticipantsPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { FiltersProvider } from './state/FiltersContext';
import { NotificationsProvider } from './state/NotificationsContext';
import { DataProvider, useData } from './state/DataContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { useDashboardData } from './state/useDashboardData';

const pageTitles: Partial<Record<NavKey, string>> = {
  workshops: 'ورش العمل',
  trainers: 'المدربين',
  participants: 'المشاركين',
  admin: 'الإدارة',
};

function Dashboard() {
  const { kpis, ratings, upcoming, completed, regionBreakdown, typeBreakdown } = useDashboardData();

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-6 pb-10 md:px-10">
      <StatCards kpis={kpis} />

      {/* DOM order below is the RTL reading order: first child renders rightmost
          (closest to the sidebar), matching the Figma left-to-right layout:
          Rating (leftmost) · Executed (middle) · Upcoming (rightmost). */}
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="h-full">
          <WorkshopListCard title="الورش القادمة" items={upcoming} emptyLabel="لا توجد ورش قادمة ضمن الفلاتر الحالية" metaMode="trainer" />
        </div>
        <div className="h-full">
          <WorkshopListCard title="الورش المنفذه" items={completed} emptyLabel="لا توجد ورش منفذة ضمن الفلاتر الحالية" metaMode="participants" />
        </div>
        <div className="h-full">
          <RatingCard ratings={ratings} />
        </div>
      </div>

      {/* Same logic: WorkshopTypes (leftmost) · Region (rightmost, next to sidebar). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[2fr_1fr] items-stretch">
        <RegionCard regionBreakdown={regionBreakdown} />
        <WorkshopTypesCard typeBreakdown={typeBreakdown} />
      </div>
    </main>
  );
}

function AppShell() {
  const [active, setActive] = useState<NavKey>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Set only by goToTrainer (below) so a workshop's trainer info can deep-link into the trainers
  // tab already open on that trainer's detail page. Cleared on every ordinary sidebar navigation
  // so it can't leak into an unrelated later visit to the trainers tab.
  const [pendingTrainerId, setPendingTrainerId] = useState<string | null>(null);
  const { loading, error, reload } = useData();
  const { isAdmin } = useAuth();

  function goToTrainer(trainerId: string) {
    setPendingTrainerId(trainerId);
    setActive('trainers');
  }

  function handleNavChange(key: NavKey) {
    setPendingTrainerId(null);
    setActive(key);
  }

  // Switching sidebar tabs swaps in an entirely different page component in place (no route
  // change), so without this the browser keeps whatever scroll position the previous tab was at.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [active]);

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-bg text-subtle-blue">
        جارٍ تحميل البيانات...
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <p className="max-w-md text-sm text-notif-red">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-main-text hover:bg-white/5"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <FiltersProvider>
      <div
        dir="rtl"
        className="flex min-h-screen bg-bg bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/assets/bg-cinematic.svg')" }}
      >
        <Sidebar
          active={active}
          onChange={handleNavChange}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          isAdmin={isAdmin}
        />

        <div className="flex flex-1 flex-col overflow-x-hidden">
          <Header
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            title={pageTitles[active] ?? 'لوحة تحكم الورش التدريبية'}
          />

          {active === 'overview' && <Dashboard />}
          {active === 'workshops' && <WorkshopsPage onNavigateToTrainer={goToTrainer} />}
          {active === 'trainers' && <TrainersPage initialDetailTrainerId={pendingTrainerId} />}
          {active === 'participants' && <ParticipantsPage />}
          {active === 'admin' && isAdmin && <AdminPage />}
        </div>
      </div>
    </FiltersProvider>
  );
}

function AuthGate() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-bg text-subtle-blue">
        جارٍ التحقق من الجلسة...
      </div>
    );
  }

  if (!role) return <LoginPage />;

  // Only mounted once authenticated: DataProvider's initial fetches and its SSE connection both
  // require a valid session, and DataProvider needs to sit under AuthProvider to read `role`.
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <AuthGate />
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;
