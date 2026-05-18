'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';

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
