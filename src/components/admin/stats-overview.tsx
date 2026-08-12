'use client';

import { MessageSquare, Users, FileText, TrendingUp } from 'lucide-react';
import type { AdminStats } from '@/types';

interface StatsOverviewProps {
  stats: AdminStats | null;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  const cards = [
    {
      label: 'Participant Sessions',
      value: stats?.totals.sessions ?? 0,
      icon: Users,
      color: 'text-[hsl(239_76%_80%)]',
      bg: 'bg-[hsl(239_76%_64%/0.1)]',
      border: 'border-[hsl(239_76%_64%/0.25)]',
    },
    {
      label: 'Total Messages',
      value: stats?.totals.messages ?? 0,
      icon: MessageSquare,
      color: 'text-[hsl(174_72%_55%)]',
      bg: 'bg-[hsl(174_72%_36%/0.1)]',
      border: 'border-[hsl(174_72%_36%/0.25)]',
    },
    {
      label: 'OBRA Drafts',
      value: stats?.obraStats.totalDrafts ?? 0,
      icon: FileText,
      color: 'text-[hsl(158_64%_60%)]',
      bg: 'bg-[hsl(158_64%_45%/0.1)]',
      border: 'border-[hsl(158_64%_45%/0.25)]',
    },
    {
      label: 'Avg Compliance Score',
      value: stats?.obraStats.avgComplianceScore ? `${stats.obraStats.avgComplianceScore}%` : '—',
      icon: TrendingUp,
      color: 'text-[hsl(38_95%_65%)]',
      bg: 'bg-[hsl(38_95%_55%/0.1)]',
      border: 'border-[hsl(38_95%_55%/0.25)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`stat-card ${card.border} border`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_50%)]">
                {card.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>

            {/* By-module breakdown for messages */}
            {card.label === 'Total Messages' && stats?.totals.byModule && (
              <div className="mt-2 flex gap-3 text-xs text-[hsl(216_20%_50%)]">
                <span>E: {stats.totals.byModule.ella ?? 0}</span>
                <span>O: {stats.totals.byModule.obra ?? 0}</span>
                <span>Y: {stats.totals.byModule.yala ?? 0}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
