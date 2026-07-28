import { useState } from 'react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useNotifications } from '../state/NotificationsContext';
import { useAuth } from '../state/AuthContext';
import { formatRelativeTime } from '../utils/date';

type Props = {
  onOpenSidebar?: () => void;
  title?: string;
};

export default function Header({
  onOpenSidebar,
  title = 'لوحة تحكم الورش التدريبية',
}: Props) {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const { role, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 pb-5 pt-6 md:px-10 md:pt-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface md:hidden"
          aria-label="فتح القائمة"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-main-text md:text-2xl">{title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 ms-auto">
        {role && (
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2 text-xs text-main-text hover:bg-white/5"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={14} />
            <span>خروج</span>
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              if (!open) markAllRead();
            }}
            className="relative flex size-11 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm"
            aria-label="الإشعارات"
            aria-expanded={open}
          >
            <Bell size={20} className="text-white/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -start-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-notif-red px-1 text-[10px] font-bold text-main-text">
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <>
              <button type="button" aria-label="إغلاق" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute end-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl">
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-right text-sm font-bold text-main-text">الإشعارات</h3>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-subtle-blue">لا توجد إشعارات</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-white/5">
                    {notifications.map((n) => (
                      <li key={n.id} className="px-4 py-3 text-right">
                        <p className="text-sm text-off-white">{n.message}</p>
                        <p className="mt-1 text-xs text-muted">{formatRelativeTime(n.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
