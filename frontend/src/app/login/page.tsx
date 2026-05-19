'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Sun, Moon, Languages, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/stores/auth';
import { useLocale, useT } from '@/i18n';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const login = useAuth((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`${t('common.success')} · ${user.real_name}`);
      router.replace('/dashboard');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background overflow-hidden">
      {/* ─── 左侧装饰区:CSS 绘制的书架插画 ───────────────────────────── */}
      {/* G2: aria-hidden 让屏幕阅读器跳过纯装饰区, 不朗读 16 本伪书名 */}
      <aside aria-hidden="true" className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#3B2614] via-[#5C3A1E] to-[#8C5A2A] text-amber-50">
        {/* 顶纸纹理 */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
             style={{
               backgroundImage:
                 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px),' +
                 'radial-gradient(circle at 70% 80%, white 1px, transparent 1px)',
               backgroundSize: '32px 32px',
             }} />

        <div className="relative z-10 flex items-center gap-2">
          <BookOpen className="size-7 text-amber-300" strokeWidth={1.6} />
          <span className="font-serif text-2xl tracking-tight">BookNook</span>
        </div>

        {/* 书架插画 */}
        <div className="relative z-10 flex-1 flex items-center justify-center my-8">
          <div className="w-full max-w-md">
            {/* 三层书架 */}
            {[0, 1, 2].map((row) => (
              <div key={row} className="mb-3">
                <div className="flex items-end gap-1.5 px-2 pb-1">
                  {bookshelfRow(row).map((b, i) => (
                    <div
                      key={i}
                      className="rounded-sm shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2)] flex items-center justify-center"
                      style={{
                        height:           `${b.h}px`,
                        width:            `${b.w}px`,
                        background:       b.bg,
                        transform:        `rotate(${b.tilt}deg)`,
                        transformOrigin:  'bottom center',
                      }}
                    >
                      <span
                        className="text-[8px] font-serif text-white/80"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >{b.title}</span>
                    </div>
                  ))}
                </div>
                <div className="h-3 rounded-sm bg-[#2A1B0E] shadow-inner" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="font-serif text-4xl leading-tight mb-3 text-balance">
            {t('brand.tagline')}
          </h2>
          <p className="text-amber-100/70 leading-relaxed">
            完整覆盖图书的进货、入库、销售、退货与财务全流程 ——<br />
            像翻一本书那样,轻松管理整座书城。
          </p>
        </div>
      </aside>

      {/* ─── 右侧登录表单 ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col">
        {/* 顶部工具栏 */}
        <header className="absolute top-0 right-0 flex items-center gap-1 p-6">
          <Button
            variant="ghost" size="icon"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            title="切换语言 / Language"
          >
            <Languages className="size-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="切换主题 / Theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm animate-fade-in">
            {/* 移动端 logo */}
            <div className="lg:hidden flex items-center gap-2 mb-10 text-primary">
              <BookOpen className="size-7" />
              <span className="font-serif text-2xl">BookNook · 暖书阁</span>
            </div>

            <div className="mb-8 space-y-2">
              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <Sparkles className="size-3" />
                {t('brand.name_en')}
              </span>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                {t('auth.login_title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('auth.login_subtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth.username')}</Label>
                <Input
                  id="username" name="username" required autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="super"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password" name="password" type="password" required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? t('auth.submitting') : t('auth.submit')}
              </Button>
            </form>

            {/* 演示账号 (仅开发模式渲染, prod build 会被 dead-code elimination 消除) */}
            {isDev && (
              <div className="mt-8 p-4 rounded-lg bg-secondary/40 border border-border/60">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('auth.demo_accounts')}
                </p>
                <div className="space-y-1.5 text-xs text-foreground/80 font-mono">
                  <DemoAccount user="super"  role="超级管理员" onPick={(u, p) => { setUsername(u); setPassword(p); }} />
                  <DemoAccount user="admin1" role="普通管理员" onPick={(u, p) => { setUsername(u); setPassword(p); }} />
                  <DemoAccount user="admin2" role="普通管理员" onPick={(u, p) => { setUsername(u); setPassword(p); }} />
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-3">
                  密码统一: <code className="px-1 py-0.5 rounded bg-background">Admin@2026</code>
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="p-6 text-center text-xs text-muted-foreground/60">
          数据库引论 · 中期实验 2026 · 李俊辉 24307090032
        </footer>
      </section>
    </div>
  );
}

function DemoAccount({ user, role, onPick }: { user: string; role: string; onPick: (u: string, p: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(user, 'Admin@2026')}
      className="w-full flex items-center justify-between rounded px-2 py-1 hover:bg-background cursor-pointer transition-colors"
    >
      <span>{user}</span>
      <span className="text-muted-foreground">{role}</span>
    </button>
  );
}

/** 装饰用书架数据 */
function bookshelfRow(idx: number) {
  const palettes = [
    ['#A0541B', '#C7723A', '#7B3A12', '#D58E48', '#9C4C1A', '#8A4015', '#B8602A', '#A85420'],
    ['#5A3A2B', '#3E2A1F', '#7A4D38', '#6A3F2E', '#8B5A3F', '#523A2C', '#4A3325', '#6B452F'],
    ['#7C2D12', '#92400E', '#A16207', '#6B3010', '#B45309', '#86340E', '#783A14', '#9A4F11'],
  ];
  const titles = [
    ['红楼梦','解忧杂货店','人间失格','活着','小王子','百年孤独','局外人','失踪的孩子'],
    ['西方哲学史','算法导论','人类简史','深度工作','原则','美的历程','思考快与慢','艺术故事'],
    ['深入Node','CSS揭秘','设计模式','编码','Rust程序设计','置身事内','叫魂','硅谷钢铁侠'],
  ];
  const palette = palettes[idx % palettes.length];
  const tt = titles[idx % titles.length];
  return tt.map((title, i) => ({
    title,
    bg: palette[i % palette.length],
    h:  120 + ((i * 7 + idx * 11) % 40),
    w:  20  + ((i * 5 + idx * 3)  % 14),
    tilt: ((i + idx) % 5 === 0 ? (i % 2 ? -3 : 3) : 0),
  }));
}
