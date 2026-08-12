'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AdminStats } from '@/types';

interface SessionTimelineProps {
  timeline: AdminStats['activityTimeline'];
}

export default function SessionTimeline({ timeline }: SessionTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)]">
        <p className="text-sm text-[hsl(216_20%_45%)]">No timeline data yet</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[hsl(216_20%_65%)]">
        Activity Timeline — Messages per Hour
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={timeline} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(224 27% 20%)" />
          <XAxis
            dataKey="hour"
            tick={{ fill: 'hsl(216 20% 50%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(216 20% 50%)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(222 47% 9%)',
              border: '1px solid hsl(224 27% 25%)',
              borderRadius: '8px',
              color: 'hsl(214 100% 97%)',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="hsl(239 84% 67%)"
            strokeWidth={2}
            dot={{ fill: 'hsl(239 84% 67%)', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
