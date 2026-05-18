/**
 * 用户认证状态 (zustand)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setToken } from '@/lib/api';

export type User = {
  id: string;
  username: string;
  real_name: string;
  employee_no: string;
  role: 'super_admin' | 'admin';
  gender: 'male' | 'female' | 'other';
  age: number | null;
};

interface AuthState {
  user: User | null;
  hydrated: boolean;
  setUser: (u: User | null) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  login: (username: string, password: string) => Promise<User>;
}

export const useAuth = create<AuthState>()(
  persist<AuthState>(
    (set) => ({
      user: null,
      hydrated: false,
      setUser: (u) => set({ user: u }),
      hydrate: async () => {
        try {
          const me = await api.get<User>('/auth/me');
          set({ user: me, hydrated: true });
        } catch {
          set({ user: null, hydrated: true });
        }
      },
      login: async (username, password) => {
        const r = await api.post<{ token: string; user: User }>(
          '/auth/login',
          { username, password },
        );
        setToken(r.token);
        set({ user: r.user });
        return r.user;
      },
      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        setToken(null);
        set({ user: null });
      },
    }),
    { name: 'booknook-auth', partialize: (s) => ({ user: s.user } as AuthState) },
  ),
);
