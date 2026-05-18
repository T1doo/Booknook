import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prisma 把 NUMERIC 列序列化为字符串以避免精度丢失; analytics 路由会预先 Number(),
// 但部分列表接口 (books / orders) 保持字符串. 此处同时接受两种, 调用方无需关心.
export function formatCurrency(n: number | string, currency = '¥'): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(
  d: string | Date | undefined | null,
  fmt: 'date' | 'datetime' | 'time' = 'datetime',
): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  if (fmt === 'date') return `${Y}-${M}-${D}`;
  if (fmt === 'time') return `${h}:${m}:${s}`;
  return `${Y}-${M}-${D} ${h}:${m}`;
}
