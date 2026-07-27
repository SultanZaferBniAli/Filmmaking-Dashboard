import { LayoutGrid, BookOpen, Users, GraduationCap, ShieldCheck, X, type LucideIcon } from 'lucide-react';

export type NavKey = 'overview' | 'workshops' | 'participants' | 'trainers' | 'admin';

const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
  { key: 'workshops', label: 'ورش العمل', icon: BookOpen },
  { key: 'participants', label: 'المشاركين', icon: Users },
  { key: 'trainers', label: 'المدربين', icon: GraduationCap },
  { key: 'admin', label: 'الإدارة', icon: ShieldCheck },
];

type Props = {
  active: NavKey;
  onChange: (key: NavKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
};

function SidebarContent({ active, onChange, isAdmin }: { active: NavKey; onChange: (key: NavKey) => void; isAdmin: boolean }) {
  const visibleItems = isAdmin ? navItems : navItems.filter((item) => item.key !== 'admin');

  return (
    <>
      <div className="mb-10 flex items-center justify-center gap-3">
        <img src="/assets/logo-program.png" alt="برنامج صناع الأفلام" className="h-10 w-auto object-contain" />
        <img src="/assets/logo-film-commission.png" alt="هيئة الأفلام" className="size-14 object-contain" />
      </div>

      <nav className="flex flex-col gap-1">
        {visibleItems.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative flex w-full flex-row-reverse items-center justify-end gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors ${
                isActive
                  ? 'bg-peach/12 font-semibold text-peach'
                  : 'text-white/55 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              {label}
              <Icon size={15} strokeWidth={2} />
              {isActive && <span className="absolute inset-y-[10px] end-0 w-[2px] rounded-full bg-peach" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function Sidebar({ active, onChange, mobileOpen, onCloseMobile, isAdmin }: Props) {
  return (
    <>
      <aside className="hidden w-[238px] shrink-0 rounded-[20px] border-s border-border-soft bg-surface px-6 py-8 mr-6 md:flex md:flex-col">
        <SidebarContent active={active} onChange={onChange} isAdmin={isAdmin} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-black/60"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 start-0 flex w-[238px] flex-col rounded-[20px] bg-surface px-6 py-8 shadow-2xl">
            <button
              type="button"
              onClick={onCloseMobile}
              className="mb-6 flex size-9 items-center justify-center self-end rounded-lg border border-border"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
            <SidebarContent
              active={active}
              onChange={(key) => {
                onChange(key);
                onCloseMobile();
              }}
              isAdmin={isAdmin}
            />
          </aside>
        </div>
      )}
    </>
  );
}
