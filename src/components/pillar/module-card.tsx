'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface ModuleCardProps {
  acronym: string;
  fullName: string;
  workshopTopic: string;
  description: string;
  tagline: string;
  accentColor: string;
  accentClass: 'ella' | 'obra' | 'yala' | 'likha' | 'linaw';
  buttonClass: string;
  href: string;
  icon: LucideIcon;
}

export default function ModuleCard({
  acronym,
  fullName,
  workshopTopic,
  description,
  tagline,
  accentColor,
  accentClass,
  href,
  icon: Icon,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className={`pillar-module-card ${accentClass} flex flex-col p-6 group w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm rounded-2xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] transition-all hover:border-[${accentColor}50] hover:shadow-lg cursor-pointer no-underline`}
      style={{ borderColor: undefined }}
    >
      {/* Icon + acronym */}
      <div className="mb-5 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
        >
          <Icon className="h-6 w-6" style={{ color: accentColor }} />
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: `${accentColor}15`,
            color: accentColor,
            border: `1px solid ${accentColor}30`,
          }}
        >
          AI Tool
        </span>
      </div>

      {/* Title */}
      <h3
        className="mb-0.5 text-xl font-black tracking-wide"
        style={{ color: accentColor }}
      >
        {acronym}
      </h3>
      <p className="mb-1 text-xs font-medium text-[hsl(216_20%_55%)]">
        {fullName}
      </p>

      {/* Workshop topic badge */}
      <div className="mb-3 rounded-lg bg-[hsl(224_35%_20%)] border border-[hsl(224_27%_25%)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(216_20%_50%)] mb-0.5">
          Capability
        </p>
        <p className="text-xs font-medium text-[hsl(214_100%_90%)] leading-snug">
          {workshopTopic}
        </p>
      </div>

      {/* Description */}
      <p className="mb-1 text-xs text-[hsl(216_20%_55%)] leading-relaxed flex-1">
        {description}
      </p>
      <p className="text-[10px] text-[hsl(216_20%_45%)] font-medium">
        {tagline}
      </p>
    </Link>
  );
}
