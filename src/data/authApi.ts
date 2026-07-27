import { API_URL } from './api';

export type Role = 'admin' | 'viewer';

export async function login(username: string, password: string): Promise<Role> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `POST /auth/login failed with ${res.status}`);
  }
  const data = (await res.json()) as { role: Role };
  return data.role;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}

// Restores the current session's role on page load (from the existing httpOnly cookie).
// Returns null if there's no session yet, without throwing — 401 here is an expected state.
export async function fetchSession(signal?: AbortSignal): Promise<Role | null> {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include', signal });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`);
  const data = (await res.json()) as { role: Role };
  return data.role;
}
