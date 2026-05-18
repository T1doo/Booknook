/**
 * Recharts 封装,适配暖书店主题色板
 */
'use client';

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export const palette = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// ─── 折线 / 面积图 ─────────────────────────────────────────────────────
export function TrendChart({
  data, xKey, yKey, height = 260, color = palette[0],
}: {
  data: Array<Record<string, string | number>>;
  xKey: string; yKey: string;
  height?: number; color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          color: 'hsl(var(--popover-foreground))',
        }} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2}
              fill="url(#grad-trend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── 横向柱状 (Top N) ────────────────────────────────────────────────
export function HBarChart({
  data, xKey, yKey, height = 260, color = palette[0],
}: {
  data: Array<Record<string, string | number>>;
  xKey: string; yKey: string;
  height?: number; color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 60, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey={yKey} fontSize={11} width={80}
               stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          color: 'hsl(var(--popover-foreground))',
        }} />
        <Bar dataKey={xKey} fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 双柱对比 (收支) ────────────────────────────────────────────────
export function DualBarChart({
  data, xKey, height = 260,
}: {
  data: Array<{ income: number; expense: number } & Record<string, string | number>>;
  xKey: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          color: 'hsl(var(--popover-foreground))',
        }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="income"  name="收入" fill={palette[1]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="支出" fill={palette[3]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 饼图 ─────────────────────────────────────────────────────────────
export function CategoryPie({
  data, nameKey = 'category', valueKey = 'stock', height = 260,
}: {
  data: Array<Record<string, string | number>>;
  nameKey?: string; valueKey?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip contentStyle={{
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          color: 'hsl(var(--popover-foreground))',
        }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          stroke="hsl(var(--card))"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
