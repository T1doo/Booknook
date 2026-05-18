'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sun, Moon, Languages, LogOut, UserCircle2, Bell,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/stores/auth';
import { useLocale, useT } from '@/i18n';
import { api } from '@/lib/api';

const titleMap: Record<string, string> = {
  dashboard:    'nav.dashboard',
  books:        'nav.books',
  purchases:    'nav.purchases',
  sales:        'nav.sales',
  transactions: 'nav.transactions',
  reports:      'nav.reports',
  alerts:       'nav.alerts',
  users:        'nav.users',
  logs:         'nav.logs',
  profile:      'nav.profile',
};

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useT();

  const seg = pathname.split('/')[1] || 'dashboard';
  const titleKey = titleMap[seg] || 'nav.dashboard';

  // 轻量轮询: 库存预警数 (15s)
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    const load = () =>
      api.get<unknown[]>('/alerts').then((r) => setAlertCount(Array.isArray(r) ? r.length : 0)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-16 shrink-0 border-b bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center gap-4 px-6">
      <h1 className="font-serif text-xl font-semibold tracking-tight">
        {t(titleKey)}
      </h1>

      <div className="flex-1" />

      {/* 操作组 */}
      <Button
        variant="ghost" size="icon"
        onClick={() => router.push('/alerts')}
        className="relative"
        title="库存预警"
      >
        <Bell className="size-4" />
        {alertCount > 0 && (
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
        )}
      </Button>

      <Button
        variant="ghost" size="icon"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
        title={t('common.language')}
      >
        <Languages className="size-4" />
      </Button>

      <Button
        variant="ghost" size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={t('common.theme')}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-muted/60 transition-colors cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.real_name?.slice(0, 1) ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">{user?.real_name}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {user?.employee_no}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/profile')}>
            <UserCircle2 className="size-4 mr-2" />
            {t('nav.profile')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              if (!window.confirm('确定要退出登录吗?')) return;
              await logout();
              router.replace('/login');
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            {t('auth.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
