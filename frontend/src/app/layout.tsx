import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono, Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-en',
  display: 'swap',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif-en',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
const notoSerif = Noto_Serif_SC({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-serif-cn',
  display: 'swap',
  preload: false,
});
const notoSans = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-sans-cn',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'BookNook · 暖书阁',
  description: '暖书阁 · 图书销售管理系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} ${notoSerif.variable} ${notoSans.variable}`}
      style={{
        // @ts-expect-error CSS var assignment
        '--font-sans':  `${inter.style.fontFamily}, ${notoSans.style.fontFamily}`,
        '--font-serif': `${playfair.style.fontFamily}, ${notoSerif.style.fontFamily}`,
        '--font-mono':  jetbrains.style.fontFamily,
      }}
    >
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
