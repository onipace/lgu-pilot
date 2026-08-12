'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AdminStats } from '@/types';

interface ObraInsightsProps {
  obraStats: AdminStats['obraStats'];
}

const TEMPLATE_COLORS: Record<string, string> = {
  tax: 'hsl(239 76% 64%)',
  regulatory: 'hsl(158 64% 45%)',
  appropriation: 'hsl(38 95% 55%)',
  general: 'hsl(174 72% 36%)',
};

const TEMPLATE_LABELS: Record<string, string> = {
  tax: 'Tax',
  regulatory: 'Regulatory',
  appropriation: 'Appropriation',
  general: 'General',
};

export default function ObraInsights({ obraStats }: ObraInsightsProps) {
  const pieData = Object.entries(obraStats.templateBreakdown).map(
    ([key, value]) => ({
      name: TEMPLATE_LABELS[key] || key,
      value,
      key,
    })
  );

  const scoreColor =
    obraStats.avgComplianceScore >= 80
      ? 'text-[hsl(158_64%_60%)]'
      : obraStats.avgComplianceScore >= 60
        ? 'text-[hsl(38_95%_65%)]'
        : 'text-red-400';

  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-[hsl(216_20%_65%)]">
        O.B.R.A. Insights
      </h3>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score display */}
        <div className="space-y-3">
          <div className="stat-card border border-[hsl(158_64%_45%/0.25)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)] mb-2">
              Total Drafts Generated
            </p>
            <p className="text-3xl font-bold text-[hsl(158_64%_60%)]">
              {obraStats.totalDrafts}
            </p>
          </div>
          <div className="stat-card border border-[hsl(38_95%_55%/0.25)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)] mb-2">
              Average Compliance Score
            </p>
            <p className={`text-3xl font-bold ${scoreColor}`}>
              {obraStats.avgComplianceScore > 0 ? `${obraStats.avgComplianceScore}%` : '—'}
            </p>
          </div>
        </div>

        {/* Template breakdown pie */}
        {pieData.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)]">
              Template Usage
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={TEMPLATE_COLORS[entry.key] || 'hsl(216 20% 40%)'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(222 47% 9%)',
                    border: '1px solid hsl(224 27% 25%)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(214 100% 97%)',
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: 'hsl(216 20% 60%)', fontSize: '11px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] h-40">
            <p className="text-sm text-[hsl(216_20%_45%)]">No OBRA drafts yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
