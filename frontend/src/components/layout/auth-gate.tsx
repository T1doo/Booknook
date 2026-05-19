'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth, type User } from '@/stores/auth';

/** 保护需要登录的页面: 没 token 则跳到 /login,并初次拉取 /auth/me 同步状态 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuth();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}

/**
 * D1: 角色守卫. 普通管理员手输 /users /logs 类受限路径时, 自动 replace 回 /dashboard,
 *     避免整页加载受限接口、反复弹 403 toast.
 *     后端仍有 requireSuperAdmin 兜底, 这里是用户体验层面的双层防御.
 */
export function RoleGuard({
  requiredRole,
  children,
}: {
  requiredRole: User['role'];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (user && user.role !== requiredRole) {
      toast.error('您没有权限访问该页面');
      router.replace('/dashboard');
    }
  }, [user, requiredRole, router]);

  if (!user || user.role !== requiredRole) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">
        <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
