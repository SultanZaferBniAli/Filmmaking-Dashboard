import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AppNotification {
  id: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (message: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function hoursAgo(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}

// Seeded as already-read history so the panel isn't empty on first load — the unread
// badge only reflects real actions taken during this session (add workshop/trainer/participant).
const initialNotifications: AppNotification[] = [
  { id: 'seed-1', message: 'تم إصدار الشهادات لورشة "أساسيات التصوير السينمائي"', createdAt: hoursAgo(5), read: true },
  { id: 'seed-2', message: 'تم تسجيل حضور المشاركين في ورشة "إدارة الإنتاج الميداني"', createdAt: hoursAgo(27), read: true },
  { id: 'seed-3', message: 'تم إضافة ورشة "الإضاءة السينمائية" بنجاح', createdAt: hoursAgo(50), read: true },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      addNotification: (message) =>
        setNotifications((list) => [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message, createdAt: Date.now(), read: false },
          ...list,
        ]),
      markAllRead: () => setNotifications((list) => list.map((n) => ({ ...n, read: true }))),
    }),
    [notifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
