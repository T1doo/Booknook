'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen, LayoutDashboard, Library, ShoppingBag, ShoppingCart, Receipt,
  FileSpreadsheet, Bell, Users, ScrollText, UserCircle2,
} from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

type Item = {
  href: string;
  i18n: string;
  icon: React.ComponentType<{ className?: string }>;
  superOnly?: boolean;
};

const items: Item[] = [
  { href: '/dashboard',     i18n: 'nav.dashboard',    icon: LayoutDashboard },
  { href: '/books',         i18n: 'nav.books',        icon: Library },
  { href: '/purchases',     i18n: 'nav.purchases',    icon: ShoppingBag },
  { href: '/sales',         i18n: 'nav.sales',        icon: ShoppingCart },
  { href: '/transactions',  i18n: 'nav.transactions', icon: Receipt },
  { href: '/reports',       i18n: 'nav.reports',      icon: FileSpreadsheet },
  { href: '/alerts',        i18n: 'nav.alerts',       icon: Bell },
  { href: '/users',         i18n: 'nav.users',        icon: Users,     superOnly: true },
  { href: '/logs',          i18n: 'nav.logs',         icon: ScrollText,superOnly: true },
  { href: '/profile',       i18n: 'nav.profile',      icon: UserCircle2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const t = useT();

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border hover:opacity-90 transition-opacity">
        <BookOpen className="size-6 text-sidebar-accent" strokeWidth={1.8} />
        <div className="flex flex-col leading-tight">
          <span className="font-serif text-lg font-semibold tracking-tight">BookNook</span>
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">暖书阁</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          if (it.superOnly && user?.role !== 'super_admin') return null;
          const active =
            it.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-soft'
                  : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-white/5',
              )}
            >
              <it.icon className="size-4 shrink-0" />
              <span>{t(it.i18n)}</span>
              {it.superOnly && !active && (
                <span className="ml-auto text-[9px] uppercase tracking-wide text-sidebar-foreground/40">
                  super
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 text-[10px] text-sidebar-foreground/40 border-t border-sidebar-border">
        v1.0 · 24307090032
      </div>
    </aside>
  );
}
