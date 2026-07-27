import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, fetchSession, type Role } from '../data/authApi';

type AuthContextValue = {
  role: Role | null;
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Restores the session from the existing httpOnly cookie on first load, so a page refresh
  // doesn't force the user to log in again.
  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal)
      .then((r) => setRole(r))
      .catch(() => setRole(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isAdmin: role === 'admin',
      loading,
      login: async (username: string, password: string) => {
        const r = await apiLogin(username, password);
        setRole(r);
      },
      logout: async () => {
        await apiLogout();
        setRole(null);
      },
    }),
    [role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
