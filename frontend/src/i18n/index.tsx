/**
 * 轻量国际化 (无服务端路由,仅客户端切换)
 * 通过 React Context + zustand 持久化
 */
'use client';

import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import zh from './messages/zh.json';
import en from './messages/en.json';

type Locale = 'zh' | 'en';
type Dict = typeof zh;

const dicts: Record<Locale, Dict> = { zh, en };

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleState>()(
  persist<LocaleState>(
    (set) => ({
      locale: 'zh',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'booknook-locale' },
  ),
);

function get(obj: unknown, path: string): string | undefined {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' && key in (acc as object) ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  ) as string | undefined;
}

export function useT() {
  const locale = useLocale((s) => s.locale);
  const dict = dicts[locale];
  return React.useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const tpl = get(dict, key) ?? key;
      if (!params) return tpl;
      return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
    },
    [dict],
  );
}
