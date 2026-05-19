/**
 * 用户认证状态 (zustand)
 *
 * - 不再存储 token: 鉴权完全由 HttpOnly cookie 承担 (C6)
 * - persist 只持久化 user (用于刷新瞬间 UI 不闪烁), 但权威信息以 /auth/me 为准
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

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
        // 后端通过 Set-Cookie 下发 HttpOnly token, 响应 body 只含 user
        const r = await api.post<{ user: User }>('/auth/login', { username, password });
        set({ user: r.user });
        return r.user;
      },
      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* ignore */ }
        set({ user: null });
      },
    }),
    {
      name: 'booknook-auth',
      // G5: 不强转, 只持久化 user 字段
      partialize: (s) => ({ user: s.user } as unknown as AuthState),
    },
  ),
);
