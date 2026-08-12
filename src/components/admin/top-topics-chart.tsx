'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { AdminStats } from '@/types';

interface TopTopicsChartProps {
  topTopics: AdminStats['topTopics'];
  module: 'ella' | 'yala' | 'obra';
}

const MODULE_COLOR: Record<string, string> = {
  ella: 'hsl(239 76% 64%)',
  yala: 'hsl(38 95% 55%)',
  obra: 'hsl(158 64% 45%)',
};

const MODULE_LABEL: Record<string, string> = {
  ella: 'E.L.L.A.',
  yala: 'Y.A.L.A.',
  obra: 'O.B.R.A.',
};

export default function TopTopicsChart({ topTopics, module }: TopTopicsChartProps) {
  const data = topTopics
    .filter((t) => t.module === module)
    .slice(0, 10)
    .map((t) => ({ topic: t.topic, count: t.count }));

  const color = MODULE_COLOR[module];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)]">
        <p className="text-sm text-[hsl(216_20%_45%)]">No topic data yet for {MODULE_LABEL[module]}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[hsl(216_20%_65%)]">
        Top Topics — {MODULE_LABEL[module]}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(224 27% 20%)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(216 20% 50%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="topic"
            width={80}
            tick={{ fill: 'hsl(216 20% 60%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(222 47% 9%)',
              border: '1px solid hsl(224 27% 25%)',
              borderRadius: '8px',
              color: 'hsl(214 100% 97%)',
              fontSize: '12px',
            }}
            cursor={{ fill: 'hsl(224 35% 20%)' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={color} fillOpacity={1 - idx * 0.06} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
